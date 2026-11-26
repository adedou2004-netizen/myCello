# Vocabulary card creation

Create a vocabulary card for the selected Hanzi, official tone-marked Hanyu Pinyin and intended English meaning. Keep the chosen reading and meaning distinct from other senses. French is optional.

A complete card contains very large correctly written Hanzi, pinyin, meaning, a vivid consistent illustration, significant components with their own Hanzi/pinyin/meanings and semantic or phonetic roles, reliably sourced character history, and a clearly labeled invented mnemonic. Never present a visual story as historical etymology. If research is incomplete, report what is missing rather than producing a supposedly verified complete card. Example sentences are optional for the current application MVP.

Use Draft, Approved and Rejected. Generation or saving never counts as approval. Reuse an explicitly approved image when appropriate. Never change an approval status or upload to Supabase without the user's authorization.

## Filenames

Use one English word, underscore, ASCII pinyin with a tone number after each toned syllable, and hyphens between syllables. Examples: `strawberry_cao3-mei2.png`, `sunrise_ri4-chu1.png`, `green_lv4.png`. ASCII `v` represents ü. An unmarked neutral syllable can remain without a number (`de`); retain explicit `5` if supplied. Separate English meanings get separate files even when Hanzi and pinyin are identical.

The vocabulary card bucket is exactly `man_vocabularyCard`; dictionary rows are in `man_entries` and card connections in `vocabulary_cards`. Legacy images may remain in `mandarin-assets`. Preserve their existing paths until an authorized rename is performed. A Memory Palace is a separate scene that can contain vocabulary pins, not another name for a vocabulary card.

## Local workflow

Open Vocabulary Card Studio. Inspect the local dictionary's research, sources and structured components. Correct and verify them, add a mnemonic and import an illustration. Create Draft Card renders a complete card only when required data passes validation. Export PNG downloads the rendered card. Approve Draft and Reject Draft are explicit user actions and affect only the selected local draft. The studio does not claim an image-generation engine is connected and makes no paid AI API calls. Export Image Prompt supplies a reusable prompt for artwork creation elsewhere.
