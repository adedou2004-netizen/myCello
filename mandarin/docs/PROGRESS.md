# Progress — November 26, 2026

## Implemented

Local administration server and mockup-based vocabulary/detail and card-studio layouts; real dictionary snapshot; search across Hanzi, English and marked/numbered pinyin; bulk import, review flags, prompt export and lesson creation; editing; history/source/component review; imported art; gated SVG draft cards with browser PNG export; explicit approval/rejection; administration backup/restore; learning bundles that merge without replacing progress; connection inventory/report; IndexedDB progress checkpoints/recovery; local device speech synthesis.

The local dictionary has 325 words. Initial cloud snapshot has 49 card records and 60 images in `man_vocabularyCard`. Local reconciliation adds 31 pending/private card records and corrects two paths, yielding 80 local card records across the existing buckets. No cloud records, image bytes or approval statuses were changed.

Removed obsolete `mandarin/APP.md`. Updated `design/capture.md`, `createPalaceImage.md`, the embedded prompt and root README. Created the nine requested `mandarin/docs/` files. The original data snapshot is retained before local edits.

## Remaining

Local AI research/image generation; actual private-image downloads/previews from Supabase; cloud writeback and cross-device synchronization; exact decorative artwork/wordmark parity; full async IndexedDB-only cutover; manual resolution of missing-word/ambiguous images; real-browser visual, PNG export and real-phone checks. The administration metadata backup does not contain original Supabase image bytes.

## Verification

`npm test`: 44 tests passed, including the existing 35 tests and nine administration/persistence checks. `git diff --check` passed. See `TEST_PLAN.md` for coverage. Never interpret passing DOM checks as visual approval of the UI or automatically approve generated images.
