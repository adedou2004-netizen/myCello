# Inspection and implementation findings

Inspected the repository at base commit `178c999` and live Supabase metadata/data on November 26, 2026.

- `main` contained a static learning application with tested capture, a localStorage vocabulary contract and a separate capture-draft IndexedDB store. No administration application was present.
- The cloud already contains the revised `man_*` tables beside legacy `mandarin_*` tables. Reusing them as the snapshot source preserves earlier reconciliation work.
- `man_vocabularyCard` is private and contains 60 image objects plus one placeholder, rather than the earlier estimate of 15 images. Its 49 cloud card records also reference legacy assets in other buckets; record and object counts are different measures.
- Two compact/hyphenated filename differences make stored card paths disagree with the inventory. Thirty-one additional files have a unique pinyin-with-tone and English-sense match in the existing dictionary. These 33 connections were applied to the local snapshot; cloud data and approval statuses are unchanged.
- Four image records still lack a dictionary entry after path repair; 14 remaining files need manual review. Missing tone digits, inconsistent filename punctuation, spelling such as `lu4` for ü, absent words and distinct senses should not be guessed automatically.
- The standard-library Node server avoids new runtime dependencies. Offline card assembly from imported art avoids token charges; local AI image generation would need a separately installed and tested model.

These findings are an engineering inventory, not verification of the educational content. Character history remains unverified until reviewed against reliable references. No new etymology claims are introduced here.

The environment's Chromium executable was incomplete; browser download was denied and the remote browser could not reach localhost. DOM integration checks cover interactions, but screenshot/mobile/PNG rendering verification remains pending.
