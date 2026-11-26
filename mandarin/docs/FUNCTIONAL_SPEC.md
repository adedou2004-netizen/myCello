# Behavior and business rules

## Vocabulary

Search normalizes case, combining accents, tone digits and syllable separators. Identity matching retains tone distinctions. A different reading or English meaning must not silently overwrite an existing entry. Bulk import accepts a JSON array containing `hanzi`, `pinyin`, `meaning_en` and optional `entry_type`; exact normalized duplicates are skipped, new entries are unverified. Invalid imports publish no partial snapshot.

Select words to create a named book lesson. Export Learning Bundle transfers words and lessons through the learning app's Capture import. Import maps identical entries to existing IDs, deduplicates lesson links, and preserves review history. New imported words are initially outside global SRS; the existing three-successful-practice rule controls graduation. Existing eligible vocabulary retains its schedule. Lesson practice and global SRS remain distinct.

## Research and cards

History must have verified status, text and at least one source. Every supplied component references a dictionary entry with Hanzi, pinyin and meaning; it needs a verified role: semantic, phonetic, both, or visual mnemonic. Imported legacy research is never treated as verified automatically. Editing identity fields queues research for review.

Complete card rendering requires history, sources, pinyin, English, a separate invented mnemonic and an imported raster illustration. It renders large Hanzi and components, with optional French and a supplied example. Missing requirements produce an explanation and no complete card. Research verification is a manual assertion, not an automated fact-checking claim.

The local renderer produces SVG containing imported artwork and educational text. Export PNG rasterizes the preview in the browser. Prompts can be exported individually or in bulk; they are instructions, not generated images. No AI engine is bundled or falsely shown as connected.

Existing Supabase `pending` cards appear as Draft. New cards are pending/private. Explicit Approve Draft or Reject Draft affects the selected local card only. Generation, import, reconciliation and saving never imply approval. Original assets are not overwritten or renamed.

## Filenames and matching

New filename: one English word, underscore, ASCII pinyin with tone numbers and hyphens between syllables: `strawberry_cao3-mei2.png`. Use `v` for ü. Neutral syllables can omit a digit; an explicitly supplied 5 is retained. Use distinct one-word English prefixes for distinct meanings.

Inventory excludes placeholders. Matching uses the actual filename, pinyin including tone, and English sense. Existing paths remain authoritative; compact versus hyphenated path discrepancies can be repaired only when a single card matches. Ambiguous or unrecognized names and missing dictionary entries remain unresolved. Matching does not approve or publish images.

## Recovery

The local server retains `original-backup.json` before the first update, validates the entire snapshot, refuses stale writes using an ETag, and atomically replaces `dictionary.json`. Restore explicitly confirms replacement. Export includes local illustrations and generated SVG cards. Learning progress has its own backup and IndexedDB persistence; administration backups do not claim to include another device's learning history.
