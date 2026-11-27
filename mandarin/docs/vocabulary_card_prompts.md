# Mandarin Vocabulary Card — Master Prompt

## Purpose
Create a complete, historically grounded, visually memorable vocabulary card for each selected Mandarin word and intended English meaning. This is a reusable specification, not a prompt for one particular word.

## Before generating — reuse existing cards
Normalize Hanzi with NFC and trim whitespace. Match the selected word, reading and intended meaning against the vocabulary catalog. Check the canonical image path and verify that the image exists and loads. Reuse an existing approved matching card; do not regenerate it. A missing permission or connection is not evidence that a card is absent. Stroke-animation links are not vocabulary cards. Memory palace backgrounds are separate user photos or selected images; these rules apply only to vocabulary cards.

## Stage 1 — Research before image generation
1. Verify simplified Hanzi, tone-marked Hanyu Pinyin and intended English meaning; include French if supplied. Record traditional forms where relevant.
2. Research historical formation and original meaning. Prefer Outlier Dictionary, CUHK Multi-function Chinese Character Database, Dong Chinese, Chinese Etymology (Richard Sears), then Wiktionary.
3. Cross-check historical claims against at least two independent reliable references. Record actual source URLs, findings, disagreements and uncertainty. Never fabricate citations or mark legacy imports verified without checking.
4. Identify formation type (pictographic, semantic compound, phonosemantic, etc.), examine ancient forms where available, and identify actual component functions. Do not confuse a dictionary radical, modern visual shape, semantic component and phonetic component. For multi-character words, research each character and explain the combined meaning.
5. Choose the strongest visual connection between the written form and intended meaning.

## Stage 2 — Mnemonic
Prefer a historically supported illustration. If insufficient, use verified components in a memorable scene, correctly distinguishing phonetic from semantic functions. If still insufficient, invent a vivid, striking story that helps recall the written form and meaning. Explicitly label invented associations as mnemonics, not historical facts. Every card needs a usable memory aid, but an invented story is unnecessary when historical imagery is effective.

## Stage 3 — Complete image prompt
Supply actual researched content, not instructions for the image generator to research.
Include:
- Very large correctly written simplified Hanzi.
- Large tone-marked pinyin and English meaning; French if supplied.
- Concise verified historical explanation, with uncertainty explicitly noted where relevant.
- Large component characters, pinyin, meanings and actual roles where applicable. Do not force component decomposition for a pictograph.
- A concrete illustration description and short memory trick, clearly separated from historical explanation.
- At least one short natural example sentence, with pinyin and English translation. Generate and check one if none was supplied.
- Source references in the research record and exported prompt; keep lengthy URLs off the artwork.

## Mandatory image format
Portrait orientation only. Aspect ratio 2:3; target resolution 1024 × 1536 pixels. Design for smartphone reading without zooming. Use consistent vivid watercolor styling, generous safe margins, vertical hierarchy, readable type and high contrast. Place the large Hanzi, pinyin and meaning prominently, followed by the memorable illustration and concise educational content. Avoid crowded layouts, tiny print, square and landscape cards. Preserve the character's correct strokes and proportions.

## Validation gate
Reject incomplete image prompts. Never export unresolved placeholders such as UNVERIFIED, To be written, null example, or missing required research or memory aid. A documented scholarly uncertainty is acceptable; fabricated certainty is not. If reliable evidence is unavailable, mark Research Required and disable image-prompt export until research has been completed or uncertainty has been explicitly documented from reliable sources. Do not invent component meanings, source URLs or ancient glyphs. Reject arbitrary imagery, inaccurate components, mislabeled phonetic elements and unreadable typography.

## Local administration workflow
Keep the administration local and do not require external AI API calls. Use verified local reference data or import research from external AI-assisted/manual research; cross-check and retain evidence before marking verified. Separate research requests from final image prompts. The prompt formatter must not silently substitute placeholders for research. Store structured components, source references, historical explanation, mnemonic and example with the vocabulary record. Use this document as the single master specification for future prompt generation.

## Approval and naming
Generated images remain Draft until explicitly approved by the user. Never upload or publish automatically. Use a single English meaning followed by underscore and ASCII numbered pinyin, with hyphens between syllables, e.g. cloud_yun2.png or strawberry_cao3-mei2.png. Separate cards for distinct English meanings even when Hanzi and pinyin match.

## Manual research prompt template
Copy the following with the rules above into a suitable research AI:

> Research the Mandarin vocabulary item: {{hanzi}}; reading: {{pinyin}}; intended meaning: {{meaning}}. Apply all research, mnemonic and validation rules in this document. Return structured Hanzi, traditional form if relevant, tone-marked pinyin, meanings, formation type, components with roles and meanings, historical explanation, source URLs and uncertainty, visual mnemonic, and a natural example with pinyin and English translation. Do not generate an image yet. If information is missing, report it explicitly.

## Image generation prompt template
Use the verified research output to populate the following template, applying the mandatory format and validation rules above. Never send unresolved placeholders to an image model.

> Create a complete portrait 2:3 Mandarin vocabulary card (1024 × 1536) for {{hanzi}}, {{pinyin}}, {{meaning}}. Use consistent vivid watercolor styling and a clear phone-readable layout. Display the Hanzi very large, with correct strokes, followed by tone-marked pinyin and meanings. Illustrate {{scene}}. Include {{verified_history}}, {{components}}, {{mnemonic}} and {{example_with_pinyin_and_translation}}. Distinguish invented mnemonics from historical facts. Keep source URLs off the artwork. Avoid unrelated writing, logos and watermarks, but retain all required educational text.

## Review and publication
Both manual and automated workflows use this same document. Inspect each draft for glyph accuracy, tone marks, factual accuracy and readability. Only explicit approval authorizes publication. After approval, use the current `man_vocabularyCard` bucket and `man_entries.vocabulary_card_path` mapping, verifying the live schema and actual bucket identifier before writing. Store a canonical bucket-relative path, not an expiring signed URL. Use authorized access without weakening permissions. Check duplicates again before uploading, never overwrite an approved image without permission, and verify both the image bytes and database mapping after publication. If publication is incomplete, report the failed step. Do not create duplicate cards to repair a missing link.

For manual use, copy the relevant template and these master rules; for local administration, load this file rather than maintaining a second copy. Do not require external paid AI APIs. A card is optional for learning and must not block review or reveal answers before help is requested.
