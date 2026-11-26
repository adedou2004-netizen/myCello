# Decisions

## Confirmed user requirements

Preserve the approved UI; operate administration locally; avoid paid dictionary/AI API calls; use the existing dictionary and storage; search Hanzi/English/marked or numbered pinyin; retain structured component references; distinguish sourced history from invented mnemonics; keep Draft/Approved/Rejected explicit; preserve lessons, My Words and SRS rules; use IndexedDB for local progress; take one recoverable backup; document the implementation in this folder.

Use the bucket name `man_vocabularyCard`. Name new card files with one English word and tone-numbered pinyin separated by hyphens. Do not rename approved assets automatically. Example sentences are deferred for the application MVP.

## Implementation choices

- Standard-library loopback Node server and static JS/CSS, without a new framework.
- Private local snapshot sourced from existing Supabase tables; no automatic cloud writeback.
- Reconciliation requires tone and English-sense agreement. Missing/ambiguous matches stay visible for manual review.
- Local SVG card assembly with PNG export and imported artwork; prompt export for artwork generation. No claimed automatic AI research or image engine.
- Add IndexedDB checkpoints while retaining compatible synchronous localStorage writes; a later full async storage cutover is separate work.
- Replace obsolete `mandarin/APP.md` with current scoped documentation; retain and update useful capture and card instructions.

## Unresolved work

A local generative image model, research automation, full mockup artwork parity, private cloud-image caching/preview, cross-device/cloud synchronization, IndexedDB-only storage, and real-device visual/export checks are not implemented. Existing private card images are connected by metadata; original bytes are not part of the administration data archive.
