# Architecture and operations

## Run

From the repository root:

```sh
npm ci
npm run admin
```

Open `http://127.0.0.1:8765/`. Node's built-in HTTP server binds to loopback. It serves the studio and learning app and reads the private snapshot from `mandarin/admin/.data/dictionary.json`. Install the separately supplied data archive there before starting on another computer. The `.data` directory is ignored by Git; it must never be included in public source commits.

No build system, web framework, authentication service, dictionary API or paid model is needed. `MYCELLO_ADMIN_PORT` optionally changes the port. Keep a stable port/origin: browser learning data is scoped to the origin.

| Data | Storage |
| --- | --- |
| Editable local dictionary, research, components, card metadata, admin lessons | `.data/dictionary.json` |
| Original recoverable administration state | `.data/original-backup.json` |
| Imported raster art and generated local SVG | Embedded in local administration JSON and its export |
| Original cloud vocabulary images | Private `man_vocabularyCard`; legacy art in private `mandarin-assets` |
| Other existing cloud assets | `man_audio`, `man_lesson_covers`, `memory_palaces`; unchanged |
| Local app dictionary, progress, SRS, lesson passes and palace choices | IndexedDB `myCello-learning`, store `snapshots`, key `current`; compatible full JSON in localStorage `mandarinAppV2` |
| Unfinished capture/photo/crop | Existing capture IndexedDB store |

## Learning persistence

Existing synchronous JSON commits remain intact so capture stays atomic and compatible. Each successful save queues a full IndexedDB checkpoint including SRS and lesson passes. The IndexedDB queue snapshots data at enqueue time and serializes writes. Startup recovers IndexedDB if compatibility JSON is absent. When compatibility JSON exists it takes precedence, avoiding replacement with a stale asynchronous checkpoint. A write failure displays a warning; export a backup. Abrupt termination before the queued transaction finishes can leave IndexedDB behind the compatible JSON.

This is dual persistence, not a completed IndexedDB-only cutover. The learning app still loads its legacy shared card viewer from Supabase; OCR/drawing libraries and models can require first-load downloads. Administration dictionary and card rendering are local. Device speech synthesis replaces the dictionary-audio Edge Function call; installed browser voices determine pronunciation availability.

## Transfer and privacy

Administration changes stay local. Export an administration JSON to transfer/restore the studio, or a learning bundle to merge words/lessons into Capture. Browser learning data on GitHub Pages and localhost are separate; use the app backup to transfer progress. Cloud synchronization, image upload and publishing are not implemented. No service-role key is embedded.
