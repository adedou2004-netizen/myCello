# Database and data structures

Inspected Supabase project `dbqrenlvinqheyjppxby` on November 26, 2026. These are actual tables, not new migrations.

| Table | Observed role |
| --- | --- |
| `man_entries` | 325 revised dictionary entries: UUID, owner, Hanzi, traditional Hanzi, pinyin, English, entry type, HSK, sound clue, notes, verification and timestamps |
| `man_entry_research` | 325 research rows; entry reference, history, source JSON, imported unverified research, verification |
| `man_entry_components` | 144 ordered entry/component references, component role, explanation, verification |
| `vocabulary_cards` | 49 original cloud card records; nullable entry reference, subject, pinyin, sense, bucket/path, pending/approved/rejected, is_shared |
| `mandarin_entries` | 325 legacy dictionary rows still referenced by legacy review/link tables |
| `mandarin_review_states` | Existing cloud review state; not the local learning app's active persistence |
| `memory_palace_cards` | Legacy shared image index still used by the older app viewer |

No table, RLS policy, bucket visibility or cloud row is changed by this implementation. Legacy tables must not be deleted merely because newer names exist.

## Local administration snapshot

`mandarin/admin/.data/dictionary.json` uses `{format:'myCello-admin', version:1, entries, research, components, cards, buckets, objects, lessons?}`. It preserves the exported row fields and IDs. Local-only word fields include `meaning_fr`, `mnemonic`, `filenameMeaning`, `illustration` (raster data URL) and optional `example`. Local generated cards have `local_svg`, `storage_bucket:null`, `review_status:'pending'`, and `is_shared:false`.

`objects` is a point-in-time bucket inventory. It is not refreshed automatically. New images in Supabase require a fresh authorized snapshot/import.

Learning bundles use `{format:'myCello-vocabulary-bundle', version:1, entries, lessons}`. They carry vocabulary, not administration owner IDs or research archives. The learning app uses its existing entry IDs, examples, lessons, reviews, palace and lessonPractice structures.
