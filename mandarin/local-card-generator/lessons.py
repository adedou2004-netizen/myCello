"""Durable local lesson drafts and the independent per-word worker."""

from copy import deepcopy
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
from threading import RLock, Thread
from uuid import uuid4

from PIL import Image

from cards import HAN, card_details, render_card, save_card
from research import dictionaries, research_ready, research_word


MAX_WORDS = 20
EXAMPLE_FIELDS = ("example Chinese", "example pinyin", "example English")


def parse_words(raw):
    if not isinstance(raw, str) or len(raw) > 5000:
        raise ValueError("Paste a list of up to 20 Mandarin words.")
    tokens = re.split(r"[\s,，、;；]+", re.sub(r"(?m)^\s*(?:[-•*]|\d+[.、)])\s*", "", raw.strip()))
    words = [token for token in tokens if token]
    if not words:
        raise ValueError("Enter at least one Mandarin word.")
    invalid = next((word for word in words if not re.fullmatch(HAN + "{1,12}", word)), None)
    if invalid:
        raise ValueError(f"“{invalid}” is invalid. Enter 1–12 Chinese characters per word.")
    dictionary = dictionaries()[0] if research_ready() else {}
    distinct = {}
    for word in words:
        forms = dictionary.get(word, ())
        canonical = {entry[0] for entry in forms}
        key = next(iter(canonical)) if len(canonical) == 1 else word
        distinct.setdefault(key, word)
    if len(distinct) > MAX_WORDS:
        raise ValueError("A lesson can contain at most 20 distinct words.")
    return list(distinct), len(words) - len(distinct)


def write_atomic(path, content):
    pending = path.with_suffix(f".{uuid4().hex}.tmp")
    try:
        with pending.open("wb") as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        pending.replace(path)
    finally:
        pending.unlink(missing_ok=True)


def complete_card(fields):
    details = card_details(fields)
    if not details["example"]:
        raise ValueError("Add a short example in Chinese, pinyin, and English in Manual card details.")
    return details


def matching_card(output, details, *, draft=None):
    """Match the meaning and reading, and use headword metadata when present."""
    stem = Path(details["filename"]).stem
    if not output.is_dir():
        return None
    for file in sorted(output.glob(stem + "*.png"), key=lambda path: (len(path.name), path.name)):
        if not re.fullmatch(re.escape(stem) + r"(?:-v[2-9]|-v[1-9]\d+)?\.png", file.name):
            continue
        try:
            with Image.open(file) as png:
                if png.format != "PNG":
                    continue
                word = png.info.get("Mandarin headword")
                if word and word != details["headword"]:
                    continue
                if draft and png.info.get("Studio draft") != draft:
                    continue
                png.verify()
            return file.name
        except (OSError, SyntaxError, ValueError):
            continue
    return None


class Lessons:
    def __init__(self, root, output, illustrator, image_lock):
        self.root = root
        self.output = output
        self.illustrator = illustrator
        self.image_lock = image_lock
        self.lock = RLock()
        self.active = set()
        self.root.mkdir(parents=True, exist_ok=True)
        self.manifest = root / "lessons.json"
        self.records = json.loads(self.manifest.read_text(encoding="utf-8")) if self.manifest.exists() else {}
        recovered = False
        for lesson in self.records.values():
            for item in lesson["items"]:
                if item["state"] == "researching":
                    item["state"] = "pending"
                    recovered = True
                elif item["state"] == "generating":
                    item["state"] = "queued"
                    recovered = True
        if recovered:
            self.persist()

    def persist(self):
        write_atomic(self.manifest, json.dumps(self.records, ensure_ascii=False).encode("utf-8"))

    def list(self):
        with self.lock:
            return [{"id": lesson["id"], "title": lesson["title"], "count": len(lesson["items"])}
                    for lesson in reversed(self.records.values())]

    def get(self, lesson_id):
        with self.lock:
            lesson = self.records.get(lesson_id)
            if lesson is None:
                raise LookupError("Lesson not found.")
            return {**deepcopy(lesson), "running": lesson_id in self.active}

    def create(self, data):
        title = data.get("title")
        if not isinstance(title, str) or not 1 <= len(title.strip()) <= 100:
            raise ValueError("Enter a lesson title of up to 100 characters.")
        words, duplicates = parse_words(data.get("words"))
        auto = data.get("auto") is True
        with self.lock:
            existing = next((lesson for lesson in self.records.values()
                             if lesson["title"].casefold() == title.strip().casefold()
                             and {item["word"] for item in lesson["items"]} == set(words)), None)
            if existing:
                if auto:
                    for item in existing["items"]:
                        if item["state"] in {"pending", "researching"}:
                            item["auto"] = True
                        if item["state"] == "researched":
                            try:
                                self.prepare(item)
                            except ValueError as error:
                                item["error"] = str(error)
                    self.persist()
                    self.start(existing["id"])
                return {**self.get(existing["id"]), "duplicates": duplicates}
            lesson_id = uuid4().hex
            items = [{"id": uuid4().hex, "word": word, "state": "pending", "auto": auto} for word in words]
            self.records[lesson_id] = {"id": lesson_id, "title": title.strip(), "items": items}
            self.persist()
            self.start(lesson_id)
            return {**self.get(lesson_id), "duplicates": duplicates}

    def item(self, lesson, item_id):
        item = next((item for item in lesson["items"] if item["id"] == item_id), None)
        if item is None:
            raise LookupError("Word not found in this lesson.")
        return item

    def artifact(self, draft, art=False):
        return self.root / f"{draft}{'-art' if art else ''}.png"

    def image(self, lesson_id, item_id):
        with self.lock:
            item = self.item(self.get(lesson_id), item_id)
            if item.get("card") and item["state"] in {"existing", "saved"}:
                path = self.output / item["card"]
            elif item.get("draft"):
                path = self.artifact(item["draft"])
            else:
                raise LookupError("No preview yet.")
            try:
                return path.read_bytes()
            except FileNotFoundError as error:
                raise LookupError("The card image is missing.") from error

    def start(self, lesson_id):
        if lesson_id not in self.active:
            self.active.add(lesson_id)
            Thread(target=self.run, args=(lesson_id,), daemon=True).start()

    def prepare(self, item, *, force=False, previous=None):
        details = complete_card(item["fields"])
        item["filename"] = details["filename"]
        if not force:
            existing = matching_card(self.output, details)
            if existing:
                item.update(state="existing", card=existing)
                return
        raw = json.dumps(item["fields"], ensure_ascii=False, sort_keys=True).encode()
        draft = item.get("job") if item.get("failure") == "image" and not force else None
        if not draft:
            draft = uuid4().hex if force else hashlib.sha256(b"lesson-v1:" + raw).hexdigest()
        item.update(state="queued", job=draft, reuse=previous, force=force, card=None)

    def action(self, data):
        lesson_id = data.get("lesson")
        if not isinstance(lesson_id, str):
            raise ValueError("Select a lesson first.")
        with self.lock:
            self.get(lesson_id)
            lesson = self.records[lesson_id]
            action = data.get("action")
            if action == "resume":
                self.start(lesson_id)
                return self.get(lesson_id)
            item = self.item(lesson, data.get("item"))
            if item["state"] in {"researching", "generating", "queued"}:
                raise ValueError("This word is still processing.")
            if action == "retry":
                if item["state"] != "failed":
                    raise ValueError("Only failed items can be retried.")
                if item["failure"] == "research":
                    item["state"] = "pending"
                elif item["failure"] == "save":
                    self.approve(item)
                else:
                    item["state"] = "queued"
            elif action == "save":
                self.approve(item)
            elif action == "select":
                index = data.get("choice")
                options = item.get("research", {}).get("options", [])
                if type(index) is not int or not 0 <= index < len(options):
                    raise ValueError("Select an available reading and meaning.")
                self.select(item, index)
            elif action in {"edit", "generate", "regenerate"}:
                if "fields" not in item or not isinstance(data.get("fields"), dict):
                    raise ValueError("Research this word before generating a card.")
                fields = data["fields"]
                details = card_details(fields)
                if details["headword"] != item["fields"]["headword"]:
                    raise ValueError("Keep the researched headword when editing a lesson card.")
                previous = item.get("draft") if fields["scene"] == item["fields"]["scene"] else None
                if action != "edit" or previous:
                    complete_card(fields)
                item.update(fields=fields, pinyin=details["pinyin"], filename=details["filename"], error=None, failure=None)
                if action == "edit" and not previous:
                    item.update(state="researched", card=None, draft=None)
                else:
                    self.prepare(item, force=action == "regenerate" or bool(previous),
                                 previous=previous if action != "regenerate" else None)
            else:
                raise ValueError("Unknown lesson action.")
            if item["state"] != "failed":
                item.update(error=None, failure=None)
            self.persist()
            if item["state"] in {"pending", "queued"}:
                self.start(lesson_id)
            return self.get(lesson_id)

    def select(self, item, index):
        fields = item["research"]["options"][index]["fields"]
        existing = matching_card(self.output, card_details(fields))
        item.update(choice=index, fields=fields, pinyin=item["research"]["options"][index]["pinyin"], card=existing, draft=None, job=None,
                    state="existing" if existing else "researched", filename=item["research"]["options"][index]["filename"])

    def approve(self, item):
        if item["state"] == "saved":
            return
        if item["state"] != "ready" and item.get("failure") != "save":
            raise ValueError("Generate and review this card before saving.")
        try:
            details = complete_card(item["fields"])
            # Recover a save that finished just before a server shutdown.
            saved = matching_card(self.output, details, draft=item["draft"])
            if not saved:
                saved = save_card(self.artifact(item["draft"]).read_bytes(), details["filename"], self.output).name
            item.update(state="saved", card=saved)
        except OSError:
            item.update(state="failed", failure="save", error="Could not write the approved PNG. Check the Downloads folder and retry.")

    def research(self, item):
        with self.lock:
            previous = next((entry["research"] for lesson in self.records.values() for entry in lesson["items"]
                             if entry["word"] == item["word"] and entry["state"] in {"saved", "existing"}
                             and entry.get("research") and (self.output / entry["card"]).is_file()), None)
        result = previous or research_word(item["word"])
        item["research"] = result
        self.select(item, 0)
        if item["state"] == "researched" and item["auto"]:
            try:
                self.prepare(item)
            except ValueError as error:
                item["error"] = str(error)

    def illustrate(self, item):
        details = complete_card(item["fields"])
        draft = item["job"]
        with self.image_lock:
            if not item.get("force"):
                existing = matching_card(self.output, details)
                if existing:
                    item.update(state="existing", card=existing)
                    return
            target = self.artifact(draft)
            if not target.is_file():
                own_art = self.artifact(draft, art=True)
                previous = self.artifact(item["reuse"], art=True) if item.get("reuse") else own_art
                if own_art.is_file() or previous.is_file():
                    with Image.open(own_art if own_art.is_file() else previous) as saved_art:
                        art = saved_art.copy()
                else:
                    art = self.illustrator.draw(details["scene"])
                if not own_art.is_file():
                    buffer = BytesIO()
                    art.save(buffer, format="PNG")
                    write_atomic(own_art, buffer.getvalue())
                write_atomic(target, render_card(details, art, draft=draft))
            item.update(state="ready", draft=draft, card=None)

    def run(self, lesson_id):
        try:
            while True:
                with self.lock:
                    items = self.records[lesson_id]["items"]
                    item = next((item for item in items if item["state"] == "pending"), None)
                    stage = "research"
                    if item is None:
                        item = next((item for item in items if item["state"] == "queued"), None)
                        stage = "image"
                    if item is None:
                        self.active.discard(lesson_id)
                        return
                    item["state"] = "researching" if stage == "research" else "generating"
                    self.persist()
                    draft = deepcopy(item)
                try:
                    (self.research if stage == "research" else self.illustrate)(draft)
                except (ValueError, LookupError, RuntimeError, OSError) as error:
                    draft.update(state="failed", failure=stage, error=str(error))
                except Exception as error:
                    draft.update(state="failed", failure=stage, error=f"{type(error).__name__}: {error}")
                with self.lock:
                    if stage == "research" and item["auto"] and not draft["auto"]:
                        draft["auto"] = True
                        if draft["state"] == "researched":
                            try:
                                self.prepare(draft)
                            except ValueError as error:
                                draft["error"] = str(error)
                    item.update(draft)
                    self.persist()
        except BaseException:
            with self.lock:
                self.active.discard(lesson_id)
            raise
