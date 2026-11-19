from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
import time
import unittest
from unittest.mock import patch

from PIL import Image

from cards import card_details
from lessons import Lessons, parse_words


FRUITS = "草莓 苹果 香蕉 橙子 葡萄 西瓜 芒果 梨 桃子 樱桃 柠檬 菠萝 蓝莓 木瓜 椰子 火龙果 猕猴桃 石榴 柚子 榴莲"


class StubIllustrator:
    def __init__(self):
        self.draws = []
        self.fail = None

    def draw(self, scene):
        self.draws.append(scene)
        if self.fail == scene:
            raise RuntimeError("Test image failure")
        return Image.new("RGB", (32, 32), (len(self.draws) * 10 % 255, 80, 60))


def stub_research(word):
    if word == "龘龘":
        raise LookupError("No entry")
    fields = {
        "headword": word, "English meaning": f"word {ord(word[0])}",
        "pinyin": " ".join(["yi1"] * len(word)),
        "character analysis": "\n".join(f"{glyph} Test component." for glyph in word),
        "mnemonic": "A memory cue.", "scene": word,
        "example Chinese": f"看{word}。", "example pinyin": "Test reading", "example English": "Test example.",
    }
    details = card_details(fields)
    return {"options": [{"fields": fields, "pinyin": details["pinyin"], "filename": details["filename"]}], "sources": {}}


class LessonTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "state"
        self.output = Path(temporary.name) / "output"
        self.output.mkdir()
        self.art = StubIllustrator()
        self.store = self.new_store()
        mock = patch("lessons.research_word", side_effect=stub_research)
        self.research = mock.start()
        self.addCleanup(mock.stop)

    def new_store(self):
        return Lessons(self.root, self.output, self.art, Lock())

    def wait_for_lesson(self, lesson_id):
        until = time.monotonic() + 10
        while time.monotonic() < until:
            lesson = self.store.get(lesson_id)
            if not lesson["running"]:
                return lesson
            time.sleep(.015)
        self.fail("Lesson worker did not finish")

    def create(self, words, auto=False, title="Fruits"):
        lesson = self.store.create({"title": title, "words": words, "auto": auto})
        return self.wait_for_lesson(lesson["id"])

    def act(self, lesson, item, action, **data):
        return self.store.action({"lesson": lesson["id"], "item": item["id"], "action": action, **data})

    def test_limit_and_validation(self):
        with self.assertRaisesRegex(ValueError, "at least one"):
            parse_words("  ")
        with self.assertRaisesRegex(ValueError, "invalid"):
            parse_words("草莓, strawberry")
        with self.assertRaisesRegex(ValueError, "at most 20"):
            parse_words(FRUITS + " 山")
        words, dropped = parse_words("1. 草莓, 苹果\n• 草莓、香蕉;橙子\n葡萄")
        self.assertEqual(words, ["草莓", "苹果", "香蕉", "橙子", "葡萄"])
        self.assertEqual(dropped, 1)

    def test_research_only_for_five_and_twenty(self):
        for size in (5, 20):
            with self.subTest(size=size):
                lesson = self.create(" ".join(FRUITS.split()[:size]), title=f"Fruits {size}")
                self.assertEqual(len(lesson["items"]), size)
                self.assertTrue(all(item["state"] == "researched" for item in lesson["items"]))
                self.assertFalse(self.art.draws)

    def test_resubmitting_research_only_lesson_for_automatic_images_reuses_it(self):
        original = self.create("草莓 苹果")
        requested = self.create("苹果 草莓", auto=True)
        self.assertEqual(original["id"], requested["id"])
        self.assertEqual([item["state"] for item in requested["items"]], ["ready", "ready"])
        self.assertEqual(self.research.call_count, 2)

    def test_generation_approval_regeneration_and_reuse(self):
        lesson = self.create("草莓 苹果")
        first, second = lesson["items"]
        with self.assertRaisesRegex(ValueError, "before saving"):
            self.act(lesson, first, "save")
        self.act(lesson, first, "generate", fields=first["fields"])
        lesson = self.wait_for_lesson(lesson["id"])
        first = lesson["items"][0]
        self.assertEqual(first["state"], "ready")
        original_png = self.store.image(lesson["id"], first["id"])
        self.assertEqual(self.art.draws, ["草莓"])
        revised = {**first["fields"], "mnemonic": "A different memory cue."}
        self.act(lesson, first, "edit", fields=revised)
        lesson = self.wait_for_lesson(lesson["id"])
        first = lesson["items"][0]
        self.assertEqual(self.art.draws, ["草莓"])
        self.assertNotEqual(self.store.image(lesson["id"], first["id"]), original_png)
        lesson = self.act(lesson, first, "save")
        first = lesson["items"][0]
        approved = self.output / first["card"]
        before = approved.read_bytes()
        self.act(lesson, first, "regenerate", fields=first["fields"])
        lesson = self.wait_for_lesson(lesson["id"])
        self.assertEqual(lesson["items"][1], second)
        self.assertEqual(self.art.draws, ["草莓", "草莓"])
        lesson = self.act(lesson, lesson["items"][0], "save")
        self.assertRegex(lesson["items"][0]["card"], r"-v2\.png$")
        self.assertEqual(approved.read_bytes(), before)
        prior_count = self.research.call_count
        reuse = self.create("草莓", True, "Other lesson")
        self.assertEqual(reuse["items"][0]["state"], "existing")
        self.assertEqual(self.research.call_count, prior_count)

    def test_failures_are_isolated_and_individually_retried(self):
        self.art.fail = "苹果"
        lesson = self.create("草莓 龘龘 苹果 香蕉 橙子", auto=True)
        self.assertEqual([item["state"] for item in lesson["items"]], ["ready", "failed", "failed", "ready", "ready"])
        self.assertEqual(lesson["items"][1]["failure"], "research")
        self.assertEqual(lesson["items"][2]["failure"], "image")
        self.art.fail = None
        self.act(lesson, lesson["items"][2], "retry")
        self.act(lesson, lesson["items"][1], "retry")
        resumed = self.wait_for_lesson(lesson["id"])
        self.assertEqual([item["state"] for item in resumed["items"]], ["ready", "failed", "ready", "ready", "ready"])
        self.assertEqual(self.art.draws.count("草莓"), 1)
        self.assertEqual(self.art.draws.count("苹果"), 2)

    def test_restart_restores_progress_and_completed_drafts(self):
        lesson = self.create("草莓 苹果", auto=True)
        first, second = lesson["items"]
        with self.store.lock:
            pending = self.store.records[lesson["id"]]["items"][1]
            pending["state"] = "generating"
            self.store.persist()
        self.store = self.new_store()
        recovered = self.store.get(lesson["id"])
        self.assertEqual([item["state"] for item in recovered["items"]], ["ready", "queued"])
        self.act(lesson, first, "resume")
        recovered = self.wait_for_lesson(lesson["id"])
        self.assertEqual(recovered["items"][1]["draft"], second["draft"])
        self.assertEqual(self.art.draws, ["草莓", "苹果"])


if __name__ == "__main__":
    unittest.main()
