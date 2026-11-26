# Mandarin Vocabulary Card — Master Prompt

## Purpose
Create a complete, historically grounded, visually memorable vocabulary card for each selected Mandarin word and intended English meaning. This is a reusable specification, not a prompt for one particular word.

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
