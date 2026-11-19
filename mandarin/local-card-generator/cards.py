import ctypes
from ctypes import wintypes
from functools import lru_cache
from io import BytesIO
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont, ImageOps


HAN = r"[\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U000323af]"
PINYIN = re.compile(r"[a-zü]{1,7}[0-5]")
TONES = ("", "\u0304", "\u0301", "\u030c", "\u0300", "")
CREAM = "#fffaf2"
INK = "#2f2823"
WIDTH = 1100


def reading_and_slug(numbered):
    groups = numbered.lower().replace("u:", "ü").replace("v", "ü").split("/")
    display = []
    filename = []
    for group in groups:
        syllables = group.replace("’", " ").replace("'", " ").replace("-", " ").split()
        if not syllables:
            raise ValueError("Enter numbered pinyin such as cao3 mei2.")
        word = ""
        for syllable in syllables:
            if not PINYIN.fullmatch(syllable):
                raise ValueError(f"Give each pinyin syllable a tone number. Check {syllable!r}.")
            letters = syllable[:-1]
            tone = int(syllable[-1]) or 5
            filename.append(f"{letters.replace('ü', 'v')}{tone}")
            vowel = next((c for c in "ae" if c in letters), "")
            if not vowel and "ou" in letters:
                vowel = "o"
            index = letters.find(vowel) if vowel else max(
                (i for i, c in enumerate(letters) if c in "aeiouü"), default=-1
            )
            if index == -1:
                if syllable in {"r0", "r5"}:
                    word += "r"
                    continue
                if letters not in {"m", "n", "ng", "hm", "hng"}:
                    raise ValueError(f"Check the pinyin syllable {syllable!r}.")
                index = letters.index("m" if "m" in letters else "n")
            marked = letters[:index + 1] + TONES[tone] + letters[index + 1:]
            if word and letters[0] in "aeo":
                word += "’"
            word += unicodedata.normalize("NFC", marked)
        display.append(word)
    return " ".join(display), "-".join(filename)


def card_details(data):
    def field(name, limit, required=True):
        value = data.get(name, "")
        if not isinstance(value, str):
            raise ValueError("Enter text in each card field.")
        value = unicodedata.normalize("NFC", value.strip())
        if len(value) > limit or (required and not value):
            raise ValueError(f"Enter {name} using at most {limit} characters.")
        return value

    headword = field("headword", 12)
    if not re.fullmatch(HAN + r"{1,12}", headword):
        raise ValueError("Use 1–12 Chinese characters for the headword.")
    english = field("English meaning", 60)
    ascii_english = unicodedata.normalize("NFKD", english).encode("ascii", "ignore").decode()
    meaning_slug = "-".join(re.findall(r"[a-z0-9]+", ascii_english.lower()))
    if not meaning_slug:
        raise ValueError("Enter an English meaning containing letters or digits.")
    pinyin, pinyin_slug = reading_and_slug(field("pinyin", 100))
    if len(pinyin_slug.split("-")) != len(headword):
        raise ValueError("Give each character one pinyin syllable. Use r5 for a separate 儿 in an erhua ending.")

    characters = field("character analysis", 1200).splitlines()
    characters = [line.strip() for line in characters if line.strip()]
    if len(characters) != len(headword) or any(
        not line.startswith(character + " ") for character, line in zip(headword, characters)
    ):
        raise ValueError("Enter one analysis line per character, in order. Start each line with its character and a space.")
    if any(not line.split(" ", 1)[1].strip() for line in characters):
        raise ValueError("Add a reading and explanation after each character.")

    history = field("history", 280, False)
    source = field("history source", 160, False)
    if history and not source:
        raise ValueError("Add a source for the history note.")
    example = [field(name, 160, False) for name in ("example Chinese", "example pinyin", "example English")]
    if any(example) and not all(example):
        raise ValueError("Enter the example in Chinese, pinyin, and English.")
    return {
        "headword": headword,
        "pinyin": pinyin,
        "english": english,
        "french": field("French meaning", 60, False),
        "filename": f"{meaning_slug}_{pinyin_slug}.png",
        "characters": characters,
        "history": history,
        "source": source,
        "mnemonic": field("mnemonic", 300),
        "scene": field("scene", 350),
        "example": example if all(example) else [],
    }


@lru_cache
def font(size, bold=False):
    fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    try:
        return ImageFont.truetype(str(fonts / name), size)
    except OSError as error:
        raise RuntimeError("Install the Windows Simplified Chinese supplemental fonts (Microsoft YaHei).") from error


def wrap(text, face, width):
    tokens = re.findall(HAN + r"|[^\s\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U000323af]+|\s+", text)
    lines = []
    line = ""
    for token in tokens:
        if face.getlength(line + token) <= width:
            line += token
            continue
        if line.strip():
            lines.append(line.rstrip())
        line = ""
        for character in token.lstrip():
            if face.getlength(line + character) > width:
                lines.append(line)
                line = ""
            line += character
    if line.strip():
        lines.append(line.rstrip())
    return lines


def fit(text, width, maximum, minimum, bold=False):
    for size in range(maximum, minimum - 1, -2):
        face = font(size, bold)
        if face.getlength(text) <= width:
            return face
    return font(minimum, bold)


def render_card(details, art):
    sections = [("Characters", details["characters"], "#fbe9df", "#8b3b2e")]
    if details["history"]:
        sections.append(("History", [details["history"], details["source"]], "#f9efce", "#74521d"))
    sections.append(("Mnemonic", [details["mnemonic"]], "#eaf0d9", "#426327"))
    if details["example"]:
        sections.append(("Example sentence", details["example"], "#f1e7f3", "#654379"))

    body = font(29)
    line_height = 43
    blocks = []
    for title, paragraphs, background, accent in sections:
        rows = []
        for text in paragraphs:
            glyph = None
            if title == "Characters":
                glyph, text = text.split(" ", 1)
            rows.append((glyph, wrap(text, body, WIDTH - (211 if glyph else 140))))
        height = 95 + sum(len(lines) * line_height + 8 for _, lines in rows)
        blocks.append((title, rows, background, accent, height))

    height = 530 + sum(block[-1] + 18 for block in blocks)
    card = Image.new("RGB", (WIDTH, height), CREAM)
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((7, 7, WIDTH - 8, height - 8), radius=46, outline="#e7aca2", width=5)

    hero_x, hero_y, hero_size = 622, 42, 434
    art = ImageOps.fit(art.convert("RGB"), (hero_size, hero_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", art.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, hero_size - 1, hero_size - 1), radius=34, fill=255)
    card.paste(art, (hero_x, hero_y), mask)

    headword = details["headword"]
    left_x, center = 46, 320
    head_face = fit(headword, 540, 220, 60, True)
    head_lines = wrap(headword, head_face, 540)
    head_height = head_face.size + 10
    y = 181 - (len(head_lines) - 1) * head_height / 2
    for line in head_lines:
        draw.text((center, y), line, font=head_face, fill="#70221d", anchor="mm")
        y += head_height
    draw.rounded_rectangle((left_x, 321, 594, 389), radius=28, fill="#f8dad4")
    pinyin = details["pinyin"]
    pinyin_face = fit(pinyin, 522, 46, 18, True)
    pinyin_lines = wrap(pinyin, pinyin_face, 522)
    for index, line in enumerate(pinyin_lines):
        draw.text((center, 355 + (index - (len(pinyin_lines) - 1) / 2) * 24), line,
                  font=pinyin_face, fill="#70221d", anchor="mm")
    english = details["english"]
    draw.text((center, 419), english, font=fit(english, 544, 46, 18, True), fill=INK, anchor="mm")
    if details["french"]:
        french = details["french"]
        draw.text((center, 465), french, font=fit(french, 544, 29, 16), fill="#69524b", anchor="mm")

    y = 507
    for title, rows, background, accent, block_height in blocks:
        draw.rounded_rectangle((42, y, WIDTH - 42, y + block_height), radius=27, fill=background)
        draw.text((70, y + 20), title, font=font(34, True), fill=accent)
        text_y = y + 76
        for glyph, lines in rows:
            if glyph:
                draw.rounded_rectangle((70, text_y - 3, 123, text_y + 43), radius=12, fill="#f5d5ca")
                draw.text((96, text_y + 20), glyph, font=font(37, True), fill=accent, anchor="mm")
            for line in lines:
                draw.text((141 if glyph else 70, text_y), line, font=body, fill=INK)
                text_y += line_height
            text_y += 8
        y += block_height + 18

    buffer = BytesIO()
    card.save(buffer, format="PNG")
    return buffer.getvalue()


def downloads_folder():
    # FOLDERID_Downloads follows any location the user selected in Windows.
    identifier = (ctypes.c_ubyte * 16).from_buffer_copy(
        UUID("374DE290-123F-4565-9164-39C4925E467B").bytes_le
    )
    path = ctypes.c_wchar_p()
    known_folder = ctypes.windll.shell32.SHGetKnownFolderPath
    known_folder.argtypes = (ctypes.c_void_p, wintypes.DWORD, wintypes.HANDLE, ctypes.POINTER(ctypes.c_wchar_p))
    known_folder.restype = ctypes.c_long
    try:
        if known_folder(ctypes.byref(identifier), 0, None, ctypes.byref(path)):
            raise OSError("Windows could not resolve the Downloads folder.")
        return Path(path.value)
    finally:
        free = ctypes.windll.ole32.CoTaskMemFree
        free.argtypes = (ctypes.c_void_p,)
        free.restype = None
        free(ctypes.cast(path, ctypes.c_void_p))


def save_card(png, filename, directory):
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=directory, suffix=".tmp", delete=False) as temp:
        pending = Path(temp.name)
    try:
        pending.write_bytes(png)
        target = directory / filename
        version = 2
        while True:
            try:
                # Windows rename is atomic and refuses to replace an existing file.
                if os.name == "nt":
                    pending.rename(target)
                else:
                    os.link(pending, target)
                return target
            except FileExistsError:
                target = directory / f"{Path(filename).stem}-v{version}.png"
                version += 1
    finally:
        pending.unlink(missing_ok=True)
