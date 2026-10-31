---
name: mandarin-character-image-prompt
description: Reuse or create Mandarin Memory Palace learning cards with large characters, pinyin, meanings and accurate component explanations; save new approved cards in Supabase mandarin-assets and register their links for later vocabulary review.
---

# Create or reuse a Memory Palace card

## Inputs and destination
Accept the selected Mandarin character or word, pinyin and intended meaning. Verify missing readings. Default to simplified Chinese, retaining a distinct traditional form when useful.

Use the existing myCello project:
- App: https://adedou2004-netizen.github.io/myCello/mandarin/
- Supabase project: dbqrenlvinqheyjppxby
- Image bucket: mandarin-assets (private; do not change bucket visibility).
- Shared card index: public.memory_palace_cards.
- Vocabulary: public.mandarin_entries; mnemonic_image_path stores the bucket-relative image filename.
Never embed secrets in this file or public app code.

## 1. Look up before generating
Normalize surrounding whitespace and Unicode NFC. Match subject_type (character or expression), subject_text and the intended reading/meaning. Inspect the actual schema before querying or updating; use the connected Supabase tools.

Check the shared card index and the matching vocabulary entry for an existing image link/path. Verify that the linked object exists and loads. A stroke-animation URI such as mycello-stroke:// is not an image card.

If a matching usable card exists, DO NOT generate or upload another image. Return only a clickable link labelled with the word and pinyin. Reuse its stored canonical object path. For a private object, obtain an authorized signed display URL; do not pretend that a public-bucket URL works.

This lookup applies when a word is SHOWN AGAIN FOR REVIEW to check whether the learner knows it. It does not require creating the word again. The app should offer the saved card link in its Memory Palace/help area, without revealing the answer before the learner chooses help.

Do not interpret an unavailable database or permission error as proof that no card exists.

## 2. Analyze a genuinely missing card
Identify the real components and their layout; distinguish semantic and phonetic components. Verify uncertain origin claims using authoritative references, or explicitly label the story "Mnemonic only." Never invent component meanings or present a mnemonic as real etymology.

For a simple character such as 一, explain the single stroke rather than inventing component addition. For compound words, explain each character briefly and illustrate the word as one scene.

## 3. Generate the actual learning card
Use the available image-generation tool, not merely a written prompt. Match the warm cream storybook style of the existing cards, with bold outlines, uncluttered composition and a clear memorable scene.

The card MUST contain:
- A VERY LARGE, correctly written Mandarin character or word.
- Official pinyin with tone marks.
- English meaning and a brief French equivalent when available.
- A readable component explanation using large Chinese components, pinyin and their meanings.
- A short sentence connecting the illustration to the meaning.

Example: 人 rén → 亻 (person) + 木 mù (tree / wood) = 休 xiū (to rest). A person rests against a tree.
Example: 一 yī (one / un): one horizontal stroke represents one.

Include the requested writing. Do not use wordless-image rules or negative prompts that exclude Chinese characters, pinyin or explanatory text. Avoid unrelated writing, watermarks, logos and visual clutter.

Inspect the generated card for glyph, tone-mark, spelling and explanation accuracy; correct material errors before saving.

## 4. Save and register
Use the established Supabase skill and supported Storage API. Upload the actual image bytes to mandarin-assets.

Use this required filename format: `english_translation_pinyin.png`.
- Start with the English translation of the selected character or expression.
- Add one underscore, then its pinyin without tone marks or tone numbers.
- Use lowercase; replace spaces within each part with hyphens so the underscore clearly separates English from pinyin.
- Strip tone diacritics; represent ü as v for an ASCII-safe filename.
- Examples: 休 xiū (rest) → `rest_xiu.png`; 一 yī (one) → `one_yi.png`; 你好 nǐ hǎo (hello) → `hello_ni-hao.png`.
- Use the selected meaning, not an entire semicolon-separated dictionary definition.
- Reuse an existing matching object. For a genuinely different card with a filename collision, preserve this base and append a version suffix, e.g. `rest_xiu-v2.png`; do not overwrite without authorization.
Never create only a database row or storage.objects metadata without uploading the bytes.

Use authorized credentials or the established upload flow. Do not make the bucket public, grant broad anonymous writes, or bypass access controls. If upload access is unavailable, retain the image, report the missing access and do not claim it was saved.

Before writing, repeat the duplicate lookup in case another session has added a card. Do not replace an existing approved card without an explicit replacement request.

After a successful upload:
1. Store the canonical bucket-relative object path in the matching mandarin_entries.mnemonic_image_path; preserve the entry's words, reviews and unrelated fields.
2. Insert the shared memory_palace_cards record with subject_type, normalized subject_text, title, explanatory note and a usable card link in storage_path according to the existing app contract. Record the canonical mandarin-assets path in the note if that field currently holds a display URL.
3. Because mandarin-assets is private, use authenticated loading or signed URLs. Signed URLs expire: retain the canonical path so a fresh display URL can be obtained. Do not present expiring URLs as permanent identifiers.
4. If a unique-key conflict occurs, reread and reuse the existing matching card instead of overwriting it.
5. Read back the stored mapping and verify a download returns a valid image.

If the image has uploaded but registration fails, report the partial result and repair the mapping before generating another image.

## 5. App behavior on later review
Load the shared word-to-card index when the app starts and refresh it when checking for a missing card. Resolve each displayed word against that index, independently of its spaced-repetition history.

If a saved card exists, show a "View Memory Palace card" link and open that card when requested; do not show the creation popup. A newly registered shared card must also work when a local personal Memory Palace record exists without a picture.

Keep personal image choices and memory stories local and preferred over shared defaults. Never overwrite a person's chosen photo or automatically submit it to the shared collection.

Only when neither a usable personal picture nor a shared card exists, offer a popup saying "Copy this into ChatGPT." Put the selected word, pinyin and meaning BEFORE these full instructions. This copied request must include this Supabase lookup/upload/registration workflow.

## Completion
For an existing card, return its verified clickable link only.
For a new card, finish the upload and registration, then return its verified clickable link with a short saved confirmation. If any step fails, state what remains incomplete.
