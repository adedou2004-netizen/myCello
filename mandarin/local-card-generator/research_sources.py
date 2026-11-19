"""Optional offline evidence and example sentences for the studio."""

import csv
from functools import lru_cache
from io import BytesIO
import json
from pathlib import Path
import re
import tarfile
from urllib.parse import quote
from urllib.request import urlopen
from uuid import uuid4


CACHE = Path(__file__).with_name("research-cache")
SENTENCES = "https://raw.githubusercontent.com/krmanik/Chinese-Example-Sentences/main/Chinese%20Example%20Sentences/cmn_sen_db_2.tsv"
DONG = "https://registry.npmjs.org/dong-chinese-dictionary-data/-/dong-chinese-dictionary-data-1.20251225.1.tgz"
EXAMPLE_SOURCE = "https://github.com/krmanik/Chinese-Example-Sentences"
SUPPLEMENTS = ("examples.tsv", "dong-reviewed.json")

# Independently checked on the indicated pages. These notes are summaries.
VERIFIED = {
    "休": ("Early forms show a person beside a tree, an image of resting.", {
        "Academia Sinica · 休": "https://chardb.iis.sinica.edu.tw/evolution.jsp?cid=6915",
        "Taiwan Ministry of Education · 休": "https://dict.variants.moe.edu.tw/dictView.jsp?ID=-936",
    }),
    "草": ("The traditional analysis associates 艸 with plants and 早 with the sound.", {
        "CUHK · 草": "https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=%E8%8D%89",
    }),
    "莓": ("The modern form uses 艹 as a plant clue and 每 as a sound clue.", {
        "Taiwan Ministry of Education · 莓": "https://dict.variants.moe.edu.tw/dictView.jsp?ID=37984",
    }),
}


def install_supplements():
    CACHE.mkdir(exist_ok=True)
    for name, url in zip(SUPPLEMENTS, (SENTENCES, DONG)):
        target = CACHE / name
        if target.is_file():
            continue
        archive = CACHE / "dong.tgz"
        if name == "dong-reviewed.json" and archive.is_file():
            payload = archive.read_bytes()
        else:
            with urlopen(url, timeout=45) as response:
                payload = response.read(32_000_001)
        if len(payload) > 32_000_000:
            raise RuntimeError("The research download exceeded its expected size.")
        if name == "dong-reviewed.json":
            payload = reviewed_records(payload)
        elif payload.count(b"\n") < 1000 or payload.splitlines()[0].count(b"\t") != 4:
            raise RuntimeError("The example sentence download was not recognized.")
        temporary = target.with_suffix(f".{uuid4().hex}.partial")
        try:
            temporary.write_bytes(payload)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
        print(f"Installed research data: {name}", flush=True)


def reviewed_records(payload):
    records = {}
    with tarfile.open(fileobj=BytesIO(payload), mode="r|gz") as archive:
        for member in archive:
            if not member.isfile() or not re.fullmatch(r"package/u/[0-9a-f]+\.json", member.name):
                continue
            for row in json.load(archive.extractfile(member)):
                if row.get("isVerified") and (row.get("hint") or row.get("components")):
                    records[row["char"]] = {
                        "hint": row.get("hint") or "",
                        "components": [[part["character"], part.get("type", [])] for part in row.get("components", [])
                                       if part.get("character")],
                    }
    if len(records) < 100:
        raise RuntimeError("The Dong Chinese character archive was not recognized.")
    return json.dumps(records, ensure_ascii=False).encode()


@lru_cache(maxsize=1)
def dong_records():
    path = CACHE / "dong-reviewed.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def dong_link(glyph):
    return "https://www.dong-chinese.com/wiki/" + quote(glyph)


@lru_cache(maxsize=1)
def corpus():
    path = CACHE / "examples.tsv"
    if not path.is_file():
        return []
    with path.open(encoding="utf-8-sig", newline="") as file:
        return [row[1:] for row in csv.reader(file, delimiter="\t")
                if len(row) == 5 and 3 <= len(row[1]) <= 32 and all(0 < len(text) <= 160 for text in row[1:])]


def compact_pinyin(text):
    return re.sub(r"[\W_]+", "", text.lower())


@lru_cache(maxsize=1024)
def examples_for_word(word):
    return [(chinese, reading, english, compact_pinyin(reading), re.findall(r"[a-z]{3,}", english.lower()))
            for chinese, _, reading, english in corpus() if word in chinese]


@lru_cache(maxsize=1024)
def find_example(word, pinyin, meaning):
    marked = compact_pinyin(pinyin)
    keywords = set(re.findall(r"[a-z]{3,}", meaning.lower())) - {"the", "and", "one"}
    candidates = []
    for chinese, reading, english, reading_key, english_tokens in examples_for_word(word):
        if marked not in reading_key:
            continue
        match = any(token.startswith(key) or key.startswith(token) for token in english_tokens for key in keywords)
        if not match:
            continue
        candidates.append((abs(len(chinese) - 11), len(english), chinese, reading, english))
    if candidates:
        return min(candidates)[2:]
    return ()
