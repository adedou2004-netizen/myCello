# Mandarin to Go — P0 browser storage inventory
Checked 2026-11-11 from branch `feature/mandarin-to-go-local-first`. **No production app or Supabase data changed.**

## Confirmed in current scripts
| Page | localStorage key | Contents | Backup treatment |
|---|---|---|---|
| `mandarin/index.html` | `mandarinAppV2` | Entire phone-app `db` with entries, lessons, examples and review state | Export/import JSON object with schema validation |
| `expressions/index.html` | `mandarinExpressionsV1` | Array of expressions + spaced repetition fields | Export/import and validate array |
| `radicals-60/index.html` | `rad60_i` | Current radical index | Export/import integer |
| `radicals-60/index.html` | `rad60_done` | Learned radical indexes | Export/import JSON array |

### Additional keys reported in existing `mandarin/APP.md`; still to verify in large root app script
- `hanzi-review` and `hanzi-current` (character review state).
- `mandarinPendingPinyin` (pending capture); inspect its precise format.
- Search all pages/scripts, not just this list, before calling a backup comprehensive.

## Important: all these pages are paths on the same GitHub Pages origin
`localStorage` is origin-scoped, so `/mandarin/`, `/expressions/` and `/radicals-60/` may all be backed up from one screen on that origin. **But** GitHub Pages custom domains or future alternative domains would create separate origins and require per-origin export or migration. Cross-origin iframes must not be assumed accessible.

## Existing local content limitations
- `mandarinAppV2` local entries can be modified and contain source/lesson/example data; do not wipe on import.
- Current card display retrieves official artwork from Supabase Storage and/or public bucket. Downloadable official images and local user-supplied image assets have different backup requirements.
- A complete backup must include any user-uploaded images held in IndexedDB or other app storage **once that feature is implemented**.
- Do not include auth tokens, cookies, payment or Mamie LeMonde storage keys.

## Next small implementable change
1. Add an isolated, **versioned, data-only** export/preview/restore utility for known local storage keys; no automatic import.
2. Validate structure, detect missing keys, show replace/merge conflicts before writing, and rollback on failure.
3. Add ZIP image support as part of a later tested iteration; do not market the JSON-only backup as complete.
4. Test empty-state, old-state, partial-state, corrupted file, import twice and cancelled import.
5. Only then expose a Backup & Restore settings UI in the phone shell.

## Supabase
No schema migrations, storage uploads, RLS or billing changes are required for the local backup feature.
