# Mandarin to Go — Local-first implementation plan
Status: **backup feature implemented on development branch; browser acceptance pending** · Branch: `feature/mandarin-to-go-local-first`

## Product decisions (approved 2026-11-11)
- **Keep learner activity local by default.** No per-answer calls to Supabase for SRS, quiz history, or palace placements. Preserve existing browser data during upgrades where possible; exporting it is more important than cloud sync.
- The paid product is a **bring-your-own-materials Mandarin learning hub**. Users can add/import characters, expressions, sentences, and images made with external tools. Do **not** integrate paid AI image generation.
- The **official dictionary** is shared, curated content, downloaded/cached on demand and usable offline once downloaded. Adding an entry already in the dictionary retrieves its available meanings, pinyin, examples, component analyses, pronunciation, and approved Memory Cards. Personal variants remain alongside official ones, not overwritten. Batch lookups, versioned manifests and caching should minimize traffic.
- Learners may **opt in to submit selected cards or vocabulary** for editorial review. Do not collect their entire local collections silently. Only reviewed, legally reusable material is published to the official dictionary.
- **Portable backup and restore are launch requirements**: transfer personal entries, lesson lists, SRS, notes, personal images, and palace placements between computer and phone through a user-downloaded portable file. Offer merge/replace preview and schema versioning. No passwords, access tokens or billing data in backups.
- Memory Palace scene: learner-uploaded room image, large black CJK character text placed on furniture; tap/click opens full card; desktop hover preview is optional, disabled in quizzes/edit mode. Both suggested hotspots and free-position adjustments; store placements locally.
- Plan **separate `mandarin_memberships`**, sharing authentication infrastructure but not product entitlement with Mamie LeMonde. Billing implementation waits until needed. Server-verified access to paid content; no service-role key in public frontend.
- Keep the current `myCello` GitHub repo and `mandarin/` deployment path; show branding as **Mandarin to Go**. Do not rename repository, move paths, or disturb other apps.
- This file supersedes the *cloud-write assumptions* in `mandarin/APP.md`, not its descriptions of the present app. It does not authorize destructive Supabase migrations.

## Repo findings verified by code
- `mandarin/index.html` is the phone shell. It uses `localStorage` and loads `memory_palace_cards` read-only. It can generate an external ChatGPT prompt; it does not need an embedded image generator.
- `mandarin/APP.md` documents existing keys: `hanzi-review`, `hanzi-current`, `mandarinExpressionsV1`, `rad60_i`, `rad60_done`, `mandarinPendingPinyin`. Inspect current scripts for further keys before migrating.
- Existing Supabase assets/storage and dictionary tables should be audited, not deleted on speculation.
- `mandarin/APP.md` is older than current product decisions; update only after verifying an implementation.

## Phases (small changes and tests)
### P0 — Inventory and safety (first)
- [ ] Inventory all browser storage keys, their formats and owners across `mandarin/`, root character app, `expressions/`, and `radicals-60/`; identify iframe origins.
- [ ] Record the current static deployment URLs, current content IDs and the actual Supabase reads; avoid changes outside Mandarin.
- [ ] Read-only audit RLS, Storage permissions, path conventions and duplicate cards; never expose secret keys.
- [ ] Establish smoke checks for character quiz, expressions, lessons, camera, speech, radicals, and palace viewer.
- [ ] Document current duplicate detection and how local entries map to official dictionary records.

### P1 — Portable backup and restore (implemented; manual browser acceptance pending)
- [x] Implement a **versioned** portable ZIP bundle with manifest and JSON for settings, vocabulary, lessons, SRS, reviews, and palace placements; include personal images/assets as binary files.
- [x] Do not export auth credentials, Stripe information, secrets, webcam recordings, or other unrelated browser keys.
- [x] Back up **documented Mandarin-related legacy storage keys** until the app migrates to a single storage model. Validate their values before importing.
- [x] Add user-visible **Export backup**, **Import backup**, preview, and explicit **Merge / Replace** choices. Never silently overwrite data. Define per-record stable IDs and merge conflicts.
- [ ] Complete real-device round trip (automated simulated ZIP, merge, corruption and image restore tests passed) with existing/empty browser, duplicate imports, corrupted ZIP, large image, cancelled restore, and phone-to-PC.
- [x] Use IndexedDB for uploaded personal cards; `localStorage` is not suitable for image binaries.

### P2 — Unified local data and learning
- [ ] Specify client-side canonical entry/lesson/review data models and adapters for existing browser keys.
- [ ] Reconcile three review algorithms into one local SRS by `entry_id + skill_type`; optional migration of existing review data.
- [ ] Import/paste vocabulary, CSV and JSON with batch dedupe and source information.
- [ ] Keep Mandarin characters and pinyin clearly legible, including French-ear clues.
- [ ] No server writes on every review or lesson practice.

### P3 — Official dictionary distribution
- [ ] Curate official dictionary in Supabase; keep existing tables until audited.
- [ ] Export a versioned **public content package / manifest** (static hosting where viable), searchable by normalized spelling and pronunciation; avoid per-keystroke SQL.
- [ ] On adding one or several entries: resolve official matches and download each available related asset once; retain personal notes/cards; show offline or missing-assets status.
- [ ] Cache installed dictionary and official assets. Verify update does not reset learner progress.

### P4 — Memory Cards and room scenes
- [ ] User-uploaded cards and room backgrounds live locally; no image-generation API.
- [ ] Distinguish **Memory Card** (per-entry art) from **Memory Palace** (scene/room).
- [ ] Build pale room scene with accessible high-contrast text glyphs, furniture hotspots and optional drag adjustments; positions stored as normalized coordinates in browser.
- [ ] Tap/click opens full card; optional desktop hover preview outside quizzing; hints affect local grading.
- [ ] Offer separate personal and official cards, with personal choice taking priority when selected.

### P5 — Curated contributions and membership
- [ ] Opt-in submit a *specific* card or vocabulary entry with rights/permission confirmation and explicit metadata.
- [ ] Enforce reasonable size/type/quantity/rate limits, private staging, and authenticated ownership.
- [ ] Build admin desktop queue: inspect, edit, reject, publish. No automatic addition to official dictionary.
- [ ] Add separate `mandarin_memberships` entitlements when billing is ready; reuse authentication, not Mamie plan status.

### P6 — Ship safeguards
- [ ] Cross-device backup/restore and offline tests; accessibility and focus/keyboard tests.
- [ ] Cost measurements: static CDN requests, image bytes, Storage, database read patterns, membership checks.
- [ ] Publish with a rollback plan and keep unrelated myCello/Mamie apps untouched.

## Architecture boundaries
| Area | Authoritative location |
|---|---|
| Personal vocabulary, notes, lessons, SRS, Memory Palace layouts | Device (localStorage / IndexedDB, transitioned carefully) |
| Transfer between devices | User-controlled versioned backup |
| Shared official vocabulary and approved cards | Curated central dictionary/static content distribution |
| Community submissions | Explicitly submitted items only, private review queue |
| Identity & paid entitlements | Server-controlled, separate Mandarin membership |
| AI image creation | User's external tool; not a service provided by this app |

## Do not do
- Do not rename or move `myCello/mandarin` or modify Mamie LeMonde data.
- Do not drop/alter existing Supabase tables yet.
- Do not make SRS dependent on online access.
- Do not upload personal cards by default.
- Do not promise syncing of local changes across devices: backup/restore is deliberately manual.
- Do not conflate image storage files with paths or fail closed when an optional official asset is unavailable.

## Immediate next task
Implement **P0 inventory** and then the **P1 backup engine** on this branch with tests before changing app screens. Starting with a storage adapter and export/restore tests avoids locking a faulty file format into the public app.

## Implementation status (2026-11-11)
- Added `mandarin/backup.js` with local versioned ZIP export/import, CRC validation, Merge/Replace and IndexedDB personal image support.
- Added Backup dialog and Upload card in `mandarin/index.html`.
- Added `mandarin/STORAGE_AUDIT.md` and `mandarin/BACKUP_TESTING.md`.
- Automated in-memory tests passed; real desktop and mobile browser tests are still required **before merging**.
- No writes to Supabase or `main`.
