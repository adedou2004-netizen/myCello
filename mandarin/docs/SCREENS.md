# Screens and navigation

Use `adminVocabMgmt.png` and `admin_vocabCards.png` as the administration visual references. Preserve their blue/green palette, common header, Help, left navigation and vocabulary/detail or research/preview split. Decorative art and an exact reproduction of the supplied wordmark remain unimplemented. Display real counts rather than mockup values.

| Screen | Implemented behavior |
| --- | --- |
| Vocabulary | Single count row; Hanzi/pinyin/English/French search; selectable words; editable details; add word; bulk JSON import, review flag, prompts and lesson creation |
| Vocabulary Cards | Selected word, history, sources, dictionary-linked components, mnemonic and illustration import on the left; gated card preview, PNG export, explicit draft approval/rejection on the right |
| Import / Export | Complete administration JSON backup/restore; learning-bundle export; card inventory and connection report; unambiguous local matching |
| Settings | Explains current storage and how to launch local administration |
| Help | Instructions for local editing, transfer, generation and approval |

The learning app retains its navigation and features; Library is labeled My Words. Due words open Today, otherwise Lessons. Search accepts numbered as well as marked pinyin. Capture → Backup and recovery accepts administration learning bundles without replacing progress. Existing Capture behavior is described in `../CAPTURE.md`.

The new interface has responsive CSS. Desktop/mobile visual parity and phone camera behavior require a real-browser pass; automated DOM tests are not a visual approval.
