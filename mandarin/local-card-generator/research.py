from collections import defaultdict
from functools import lru_cache
import gzip
import json
from pathlib import Path
import re
from urllib.error import URLError
from urllib.request import Request, urlopen

from cards import HAN, card_details, reading_and_slug


CACHE = Path(__file__).with_name("research-cache")
SOURCES = {
    "CC-CEDICT": "https://cc-cedict.org/editor/editor.php?handler=Download",
    "Make Me a Hanzi": "https://github.com/skishore/makemeahanzi",
}
DOWNLOADS = {
    "cedict.gz": (
        "https://cc-cedict.org/editor/editor_export_cedict.php?c=gz",
        "https://raw.githubusercontent.com/rhcarvalho/cedict/master/cedict_1_0_ts_utf-8_mdbg.txt",
    ),
    "hanzi.jsonl": ("https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt",),
}
ENTRY = re.compile(r"(\S+) (\S+) \[([^\]]+)\] /(.+)/")
LAYOUT = {"⿰": "left to right", "⿱": "top to bottom", "⿲": "left to right",
          "⿳": "top to bottom", "⿴": "enclosure", "⿵": "enclosure from above",
          "⿶": "enclosure from below", "⿷": "enclosure from the left",
          "⿸": "enclosure from the upper left", "⿹": "enclosure from the upper right",
          "⿺": "enclosure from the lower left", "⿻": "overlapping"}
EXAMPLES = {
    "草莓": ("strawberry", "fraise", "我喜欢吃草莓。", "Wǒ xǐhuan chī cǎoméi.", "I like eating strawberries.",
             "Picture a bright red strawberry peeking out of the grass. The grass reminds you of 草.",
             "A large ripe red strawberry peeking out of a tuft of grass, with golden seeds and green leaves."),
    "苹果": ("apple", "pomme", "我吃苹果。", "Wǒ chī píngguǒ.", "I eat an apple.",
             "Picture a shiny apple hanging from a fruit tree. 果 reminds you that it is a fruit.",
             "A shiny red apple hanging from a small branch on a fruit tree, with one leaf curling above it."),
}


def research_ready():
    return all((CACHE / name).is_file() for name in DOWNLOADS)


def download_research():
    CACHE.mkdir(exist_ok=True)
    for name, urls in DOWNLOADS.items():
        target = CACHE / name
        if target.is_file():
            continue
        for url in urls:
            try:
                request = Request(url, headers={"User-Agent": "myLexiGo Vocabulary Card Studio"})
                with urlopen(request, timeout=30) as response:
                    content = response.read(16_000_001)
                break
            except URLError as error:
                if url == urls[-1]:
                    raise RuntimeError(f"Could not download {name}. Check the internet connection and restart.") from error
        if len(content) > 16_000_000:
            raise RuntimeError("The research download exceeds its expected size.")
        if name == "cedict.gz":
            if not content.startswith(b"\x1f\x8b"):
                content = gzip.compress(content)
            if b"[cao3 mei2]" not in gzip.decompress(content):
                raise RuntimeError("The downloaded CC-CEDICT archive was not recognized.")
        elif "character" not in json.loads(content.splitlines()[0]):
            raise RuntimeError("The downloaded Make Me a Hanzi data was not recognized.")
        pending = target.with_suffix(".partial")
        pending.write_bytes(content)
        pending.replace(target)
        print(f"Installed research data: {name}", flush=True)


def compact(value, length):
    if len(value) <= length:
        return value
    return (value[:length-1].rsplit(" ", 1)[0] or value[:length-1]) + "…"


@lru_cache(maxsize=1)
def dictionaries():
    if not research_ready():
        raise RuntimeError("Research data is missing. Close the generator and run Start Generator.cmd while connected to the internet.")
    words = defaultdict(list)
    with gzip.open(CACHE / "cedict.gz", "rt", encoding="utf-8-sig") as archive:
        for line in archive:
            entry = ENTRY.fullmatch(line.strip())
            if entry:
                traditional, simplified, pinyin, gloss = entry.groups()
                for form in dict.fromkeys((simplified, traditional)):
                    words[form].append((simplified, traditional, pinyin.lower(), gloss.split("/")))
    with (CACHE / "hanzi.jsonl").open(encoding="utf-8") as source:
        characters = {row["character"]: row for row in map(json.loads, source)}
    return words, characters


def visible_parts(sequence):
    def parse(remaining):
        token = next(remaining)
        if token in LAYOUT:
            children = [parse(remaining) for _ in range(3 if token in {"⿲", "⿳"} else 2)]
            return "(" + " + ".join(children) + ")"
        if re.fullmatch(HAN, token):
            return token
        raise ValueError("Unknown component")

    if sequence[:1] not in LAYOUT:
        return ""
    try:
        remaining = iter(sequence)
        parts = parse(remaining)
        if next(remaining, None) is None:
            return f"{parts[1:-1]} ({LAYOUT[sequence[0]]})"
    except (StopIteration, ValueError):
        pass
    return ""


def distinct_glosses(glosses):
    for raw in glosses:
        if re.match(r"CL:|(?:old |archaic |also )?variant of|see |also written", raw, re.I):
            continue
        gloss = re.sub(r"^\((?:bound form|literary)\)\s*", "", raw, flags=re.I)
        gloss = re.sub(r"\s*\(CL:.*$", "", gloss).strip()
        if re.search(r"[a-zA-Z0-9]", gloss):
            yield gloss


def gloss_rank(gloss):
    return (
        bool(re.match(r"surname\b|\(surname|\(archaic\)|.{1,25}:|[A-Z]", gloss)),
        " (" in gloss,
    )


def card_gloss(gloss):
    first = re.split(r"[,;]\s+(?![^()]*\))", gloss, maxsplit=1)[0]
    first = re.sub(r"\s+\((?:informal|formal|colloquial|as opposed to)\b.*\)$", "", first, flags=re.I)
    return compact(first, 60)


def character_note(character, tone, row, words):
    reading = reading_and_slug(tone)[0]
    radical = row.get("radical")
    layout = visible_parts(row.get("decomposition", ""))
    if character == "一":
        layout = "One horizontal stroke"
    elif not layout and radical and radical != character:
        layout = f"Dictionary radical: {radical}"
    origin = row.get("etymology") or {}
    hint = origin.get("hint") or ""
    history = ""
    roles = []
    if origin.get("type") == "pictophonetic":
        if origin.get("semantic"):
            roles.append(f"{origin['semantic']} gives a meaning clue")
        if origin.get("phonetic"):
            roles.append(f"{origin['phonetic']} gives a sound clue")
        if roles:
            history = "; ".join(roles)
    elif origin.get("type") in {"ideographic", "pictographic"} and hint:
        history = compact(hint.rstrip("."), 95)
    if character == "一":
        history = ""
    senses = [gloss for _, _, pinyin, glosses in words.get(character, [])
              if pinyin.replace("u:", "v").replace("ü", "v").replace("0", "5") == tone
              for gloss in distinct_glosses(glosses)]
    senses.sort(key=gloss_rank)
    definition = compact(senses[0] if senses else (row.get("definition") or "").split(";")[0], 60)
    details = [f"Dictionary sense: {definition}" if definition else "", layout, ", ".join(roles)]
    summary = ". ".join(item.rstrip(".") for item in details if item)
    return {
        "glyph": character, "reading": reading, "definition": definition,
        "layout": layout, "roles": roles, "history": history,
        "line": f"{character} {reading} — {summary or 'No component breakdown in this source'}.",
    }


def proposed_scene(word, gloss, characters):
    if word in EXAMPLES and EXAMPLES[word][0] == gloss:
        _, french, chinese, pinyin, english, mnemonic, scene = EXAMPLES[word]
        return {"French meaning": french, "example Chinese": chinese, "example pinyin": pinyin,
                "example English": english, "mnemonic": mnemonic, "scene": scene}
    clue = next((item for item in characters if item["definition"]), None)
    action = gloss.lower().startswith("to ")
    scene = (f"A person in a familiar everyday setting performing this action: {gloss[3:]}."
             if action else f"A clear, centered scene in everyday life showing the meaning: {gloss}.")
    mnemonic = f"Picture the scene for “{gloss}.” Recall that image when you see {word}."
    if word == "一" and gloss == "one":
        return {"mnemonic": "Picture one pencil lying flat. Its shape reminds you of the single horizontal stroke 一.",
                "scene": "One bright pencil lying flat and horizontally across the center of a plain wooden table."}
    if len(word) == 1 and characters[0]["history"] and not characters[0]["roles"]:
        visual = " ".join(re.sub(HAN, "", characters[0]["history"]).split())
        scene = f"A simple visual memory scene for {gloss}: {visual}."
        mnemonic = f"Imagine this scene for “{gloss}”: {visual}. Recall it when you see {word}."
    elif clue and len(word) > 1:
        mnemonic = (f"Picture the scene for “{gloss}.” Use {clue['glyph']} "
                    f"(dictionary sense “{clue['definition']}”) as a cue for {word}.")
    return {"mnemonic": mnemonic, "scene": scene}


def research_word(raw):
    if not isinstance(raw, str) or not re.fullmatch(HAN + r"{1,12}", raw.strip()):
        raise ValueError("Enter 1–12 Chinese characters, such as 草莓.")
    term = raw.strip()
    words, dictionary = dictionaries()
    options = []
    seen = set()
    for word, traditional, pinyin, glosses in words.get(term, []):
        try:
            _, slug = reading_and_slug(pinyin)
        except ValueError:
            continue
        tones = slug.split("-")
        if len(tones) != len(word):
            continue
        characters = [character_note(glyph, tone, dictionary.get(glyph, {}), words)
                      for glyph, tone in zip(word, tones)]
        history = " ".join(f"{item['glyph']}: {item['history']}." for item in characters if item["history"])
        lines = [item["line"] for item in characters]
        for sense in distinct_glosses(glosses):
            gloss = card_gloss(sense)
            rank = (word not in EXAMPLES or EXAMPLES[word][0] != gloss, *gloss_rank(sense))
            if (word, pinyin, gloss) in seen:
                continue
            seen.add((word, pinyin, gloss))
            fields = {
                "headword": word, "pinyin": pinyin, "English meaning": gloss,
                "French meaning": "", "example Chinese": "", "example pinyin": "", "example English": "",
                "character analysis": "\n".join(compact(line, 1200 // len(word) - 2) for line in lines),
                "history": compact(history, 280), "history source": "Make Me a Hanzi (Unihan and CJKlib)" if history else "",
                **proposed_scene(word, gloss, characters),
            }
            details = card_details(fields)
            options.append((rank, {
                "pinyin": details["pinyin"], "filename": details["filename"], "fields": fields,
                "characters": characters, "traditional": traditional, "sense": compact(sense, 110),
            }))
    if not options:
        raise LookupError(f"No usable dictionary entry for {term}. Try another word or open Manual card details.")
    options.sort(key=lambda pair: pair[0])
    return {"options": [option for _, option in options[:24]], "sources": SOURCES}
