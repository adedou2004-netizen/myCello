# Capture implementation and qualification

## Implemented flow

1. Open the rear camera on request, take a full-resolution frame, stop camera tracks, and show the frozen image. An uploaded image is decoded with EXIF orientation applied and normalized to PNG. Retake and 90-degree rotation are available.
2. Move or resize the green crop with pointer/touch or keyboard arrows (Shift resizes). Bounds are normalized against the actual displayed image, then converted to intrinsic source pixels. Screen rotation/resizing does not alter the selected pixels.
3. Preview the exact PNG submitted to a reusable Tesseract.js 5.1.1 worker (`chi_sim`, pinned model package 1.0.0). Optional oversized-print optimization reduces ink bands taller than 60px towards 40px. It never upscales missing detail. Preview and diagnostic dimensions show the processed input. No remote OCR, AI-generated transcription, mock characters, or sample fallback is used.
4. Preserve raw text, punctuation, repeated characters and line boundaries. Review/edit and explicitly confirm. Editing invalidates verification. Use native textarea highlighting or tap start/end with Select range to choose a character, expression or sentence. Dictionary suggestions appear only after verification; missing pinyin/meanings remain blank for manual review. Source-context pinyin handles readings that differ from a dictionary default.
5. Save using normalized lookup, explicit existing-sense selection, deduplicated lesson links, and separate source sentence/translation/note. Existing dictionary meanings and review history are preserved. New entries graduate to SRS after three successful lesson passes. Previously eligible vocabulary keeps its history and eligibility.

## Persistence and privacy

Vocabulary retains the existing `mandarinAppV2` localStorage contract. Capture constructs a detached next snapshot and replaces the whole JSON record atomically; failed writes do not change the in-memory dictionary. This avoids a risky vocabulary migration. A baseline comparison refuses saves after another tab changes the dictionary (not a full distributed synchronization system).

A separate IndexedDB transaction stores the private capture draft, including the normalized photo, crop, corrected text, verification, selection and form fields. Draft writes are serialized and generation-guarded. Restore is explicit. Backgrounding stops camera/OCR and schedules draft persistence; abrupt OS termination before a pending transaction completes can still lose the last unsaved keystrokes.

Versioned JSON backup export/import includes dictionary, lessons, examples, review history and current draft text/form. Photo bytes are deliberately excluded from exported JSON. Imports are validated and require explicit replacement confirmation; previous dictionary bytes are retained under `mandarinAppV2-before-restore`. Corrupt existing JSON is never silently overwritten.

Supabase tables, policies, image assets, and approval statuses are unchanged. There is no cloud vocabulary synchronization. Recognition is local; first use requires internet to load CDN scripts, WASM and Chinese traineddata. Full offline app installation/caching is not claimed.

## Concurrency and errors

Capture revision and job IDs invalidate stale OCR completions. A 90-second watchdog and Cancel terminate the worker. New images clear prior output. Camera epochs stop streams that arrive after navigation or cancellation. Streams stop on navigation, pagehide, or backgrounding. Blob URLs are revoked on replacement/exit. OCR errors and empty results never substitute vocabulary. All results remain unverified until user confirmation; confidence is advisory, not proof of correctness.

`?captureDebug=1` exposes source dimensions, source-pixel crop, processed OCR dimensions/scale, raw text, line boxes/confidence, engine/language, job IDs and timing. These remain in the tab and are not sent to telemetry.

## Automated checks

- `npm ci && npm test`: pure rule tests and DOM integration tests with jsdom and fake IndexedDB.
- `npm run test:ocr`: actual Tesseract WASM recognition on generated Chinese fixtures. Requires Python 3, Pillow, and `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc` (plus DejaVu Sans for pinyin). Script generates inputs in ignored `tests/results/fixtures` and writes `tests/results/ocr-benchmark.json`.
- The OCR benchmark uses a known selected region, excludes pinyin above that region, and applies the same `CaptureCore.textScale` rule as the application. Python/Pillow performs fixture resizing; browser canvas interpolation can differ slightly.

Measured in this environment after crop/size optimization: clear `她今天非常`, a full sentence, two lines, a pinyin-excluded line, and dense print returned exact Chinese character sequences. Blank and English-only crops returned no Chinese. The deliberately blurred fixture returned empty text, correctly requiring retry/manual entry. These synthetic results are not a real-phone accuracy claim.

## Remaining real-device release checks

The cloud browser could not connect to the local preview, so no visual/browser-camera pass is claimed. Before production release, verify on Android Chrome and iPhone Safari:

- Camera permission allow/deny, camera focus, rapid captures and navigation while permission is pending.
- Portrait/landscape crop alignment, all four touch handles, full-image crop, rotation, narrow layout and safe-area actions.
- Real books/screens with glare, shadows, perspective, small print and pinyin annotations.
- Native textarea selection, two-tap range selection, keyboard navigation and screen-reader announcements.
- Reload/draft restoration with real Blob storage, storage exhaustion, backup download/restore and existing vocabulary preservation.

OCR remains fallible. A cloud-engine comparison is deferred unless the corrected pipeline fails the real-photo benchmark. No cloud service was provisioned or charged.


## Personal dictionary review

Every Capture save commits `dictionaryReview: "pending"` on the canonical dictionary entry in the same localStorage snapshot as vocabulary, source context and lesson links. Recapturing an existing word requeues that entry without duplicating it. Library offers All words and Needs review filters. Missing pinyin/English meanings and legacy captured examples (photo/manual sourceType) also appear without a destructive migration.

Open saved entry and dictionary rows open the selected word directly, independent of Today SRS. Review allows editing pinyin, English and optional French, with the saved source context visible. Save changes keeps edited entries pending; Save and mark reviewed requires pinyin and English, persists `dictionaryReview: "reviewed"`, and does not change SRS eligibility, history, lesson links, or practice passes. Conflicting tabs and storage failures use the same atomic save guard as Capture. Backups preserve the review field with all other entry metadata.

The UI explicitly says saved on this device. This is browser-local personal data, not authenticated account storage or cross-device synchronization. No private vocabulary is sent to Supabase or the shared card index by this feature.
