# Validation

Run `npm ci && npm test` from the repository root.

The suite covers existing crop/OCR state, capture, dictionary review, source preservation, duplicate prevention, backup validation and three-successful-practice graduation, plus administration tests for:

- Search using Hanzi, English, marked/numbered/compact/spaced pinyin.
- New filenames and preserving tone distinctions during identity matching.
- Unambiguous image connections, ambiguous exclusions, idempotence and unchanged approval.
- Refusing complete cards without verified history, sources, component roles or artwork.
- Rendering educational SVG text with escaped user content.
- Local HTTP read/write/backup, stale-edit refusal, cross-origin refusal and private-path blocking.
- IndexedDB checkpoint serialization and recovery across store instances.
- Actual administration DOM search, draft generation, persisted pending status, explicit approval and rejection of incomplete generation.
- Actual learning application IndexedDB recovery, grading persistence and vocabulary-bundle merge without loss of progress or duplicate imports.

## Manual acceptance checks remaining

Open local administration in a real desktop browser and on a narrow screen. Verify layout against supplied mockups, keyboard navigation, full SVG preview, PNG export, imported artwork, backup download and restoration. Check fonts and long meanings/history in generated cards. Verify the learning app on Android/iPhone for IndexedDB persistence, camera/OCR and audio voices.

The earlier OCR benchmark is unchanged; no new OCR recognition engine was introduced. Do not claim browser screenshots, PNG rasterization, or real-phone qualification from DOM tests.
