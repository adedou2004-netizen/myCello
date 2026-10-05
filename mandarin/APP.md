# Mandarin app documentation

Reviewed October 5, 2026 against `adedou2004-netizen/myCello` on `main` and the Supabase diagram in the journal.

## Purpose

A personal, mobile-first app for Mandarin met in the wild.

- Progressive lists of characters and expressions from reading and listening.
- A memory-palace card for any character you want to keep.
- Each character linked to an example you actually encountered.
- Quizzes that play a sound and ask you to match the word and the character.
- Short sessions, one thumb, camera and audio close at hand.

## What exists

| Piece | Path | Behavior |
| --- | --- | --- |
| Phone shell | `mandarin/index.html` | Bottom nav, camera OCR, pinyin stub, memory-palace viewer. Iframes the other pages. |
| Characters | `index.html` | 307 hardcoded entries. Writing, meaning quiz, pinyin quiz. Streak stored in `localStorage`. |
| Expressions | `expressions/index.html` | 33 seed phrases plus user adds. Local spaced repetition. Handwriting and OCR. |
| Radicals | `radicals-60/index.html` | 60 radicals, French sound cue, meaning quiz. |
| Palace art | `mandarin/memory-palace/hui.svg` | Sample card. Live cards come from `memory_palace_cards`. |

The phone does not read or write `mandarin_entries`, `mandarin_entry_links`, `mandarin_exposures`, `mandarin_review_states`, `mandarin_review_events`, or `mandarin_character_examples`.

Local keys in use:

- `hanzi-review`, `hanzi-current` — character streak, learned at 3 correct, no due date.
- `mandarinExpressionsV1` — 3 correct, then 1 / 3 / 7 / 14 / 30 / 60 / 120 days.
- `rad60_i`, `rad60_done` — position and learned set.
- `mandarinPendingPinyin` — Add stores pinyin and stops.

`memory_palace_cards` is read-only. Fields used: `subject_type`, `subject_text`, `storage_path`, `title`, `note`. Images live in the `memory-palace-cards` bucket.

## Review

Keep:

- French-ear sound clue beside pinyin, never instead of it.
- Camera capture with the green focus box.
- Hanzi Writer for writing.
- The Supabase split between item, encounter, example, schedule, and event log.

Fix first:

- One app, one memory. The iframe shell hides the inner tabs and waits 700 ms for the frame.
- `index.html` is about 1.2 MB because of an embedded Unihan lookup. Lazy-load it.
- No listening quiz. Current games show the character and ask for English or pinyin.
- Photo import drops the sentence, the picture, and the source.
- Memory palace can be viewed, not created, from capture.
- Three different review rules. `mandarin_review_states` already has the right shape and is unused.
- No manifest, icons, or offline write queue.
- Every mandarin table needs RLS: `user_id = auth.uid()`.

## Target screens

| Screen | Primary action | Writes |
| --- | --- | --- |
| Today | Due queue across the dictionary | `mandarin_review_events`, `mandarin_review_states` |
| Lessons | Pick a list and practice it, due or not | lesson items only; grades still update the shared review state |
| Capture | Save what you just saw or heard, into a lesson | entries once, then a lesson link, exposures, examples |
| Library | The one dictionary: new, learning, review, known | notes, status |
| Quiz | Listen, match, write, from due or from a lesson | events by `skill_type` |

Lessons are lists. The dictionary is the set of unique characters and expressions.

- A character is stored once in `mandarin_entries`. Adding 学 from a book does not create a second 学.
- A lesson only stores a link in `mandarin_lesson_items`. The same 学 can be in Lesson 3, chapter 2 of a book, and a school vocabulary list.
- Course lessons keep the current picker: Lesson 1 is characters 1–10, Lesson 2 is 11–20, and you tap the one you want.
- A book, a class list, or a podcast can be a lesson too. Capture asks which lesson to add to.
- Practice this lesson walks that list in order and ignores `next_review_at`. Today still shows only what is due.
- A grade from a lesson still updates the shared review state, so the dictionary schedule stays one.

Palace and examples sit on the character, not in a gallery.

- While you study 学, a Palace button and an Examples button are on that card. Same on a lesson card and on an expression.
- Palace opens only the pictures and story for that character or expression. It is a hint so you can write or recall it now.
- Examples opens the sentences you met for that same entry, with sound if you have it.
- There is no screen of many palaces. If a card has no palace yet, the button says Add palace and saves it against that entry.

Quizzes:

- Hear audio, pick character or word.
- See character, pick audio.
- Meaning and pinyin from due cards.
- Writing on one character from a due expression.
- A meaning hit does not count as a listening hit.

## Schema as seen

`mandarin_entries`: `id`, `user_id`, `entry_type`, `simplified`, `traditional`, `pinyin`, `sound_clue`, `meaning_en`, `meaning_fr`, `radical`, `components`, `phonetic_component`, `stroke_count`, `independent_use`, `notes`, `source`, `tags`, `character_image_path`, `meaning_image_path`, `mnemonic_image_path`, `audio_path`, `stroke_source`, `first_learned_at`, `last_used_at`, `created_at`, `updated_at`.

`mandarin_entry_links`: `id`, `user_id`, `parent_entry_id`, `child_entry_id`, `relationship`, `position`, `created_at`.

`mandarin_exposures`: `id`, `user_id`, `entry_id`, `exposure_type`, `context_note`, `used_at`.

`mandarin_review_states`: `id`, `user_id`, `entry_id`, `skill_type`, `strength`, `interval_days`, `correct_streak`, `last_result`, `last_response_ms`, `last_reviewed_at`, `next_review_at`, `updated_at`. Unique on user, entry, and skill.

`mandarin_review_events`: `id`, `user_id`, `entry_id`, `skill_type`, `result`, `response_ms`, `hint_used`, `reviewed_at`.

`mandarin_character_examples`: present in the table list. Columns were not in the screenshot. Target columns are in `mandarin-schema.sql`.

`mandarin_lessons`: `id`, `user_id`, `title`, `lesson_kind` (course, book, class, podcast, custom), `source_title`, `position`, `parent_lesson_id`, `created_at`.

`mandarin_lesson_items`: `id`, `user_id`, `lesson_id`, `entry_id`, `position`, `added_because`, `note`, `created_at`. Unique on lesson and entry. Not unique on entry alone.

`memory_palace_cards`: one card per character or expression, opened from that item. Add `entry_id` and `user_id`. Do not key only on the glyph, and do not present these as a browsable gallery.

## Build order

1. Confirm RLS and example-table columns.
2. Replace the iframe with one mobile page. Import the 307 seed characters once.
3. Capture writes the dictionary once, then links the entry to the open lesson.
4. Lesson practice walks that list and ignores due dates. Grades still update `review_states`.
5. Today reads `review_states` and grades write events.
6. Listening quiz, speech synthesis first, your own audio later.
7. Web manifest, icons, and an offline write queue.

## Locked decisions

- Show simplified and traditional on the card. Simplified is the form you study. Traditional is beside it when it differs.
- The French-ear sound clue is always visible, next to pinyin.
- Membership will gate the app later. Keep the `memberships` table in the model. Do not build billing now.
- One palace table. Keep `memory_palace_cards`. Add `entry_id` and `user_id`. Do not make a second palace table, and do not store the picture in `mandarin_entry_links`.
- The picture itself lives in the existing Supabase Storage bucket `memory-palace-cards`. The table row only stores `storage_path`. The Palace button on a character loads that one file.

## Open decisions

None of the earlier product questions are still open. Next choice is only when membership starts to gate access.
