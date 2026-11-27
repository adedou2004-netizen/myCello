# Screens and navigation

Each design PNG has a matching Markdown specification in `design/`. General business rules live in FUNCTIONAL_SPEC.md, database definitions in DATABASE.md, and implementation progress in PROGRESS.md. This index tracks specification approval separately from implementation and testing.

| Design | Specification | Specification status | PNG status | Implementation / testing |
| --- | --- | --- | --- | --- |
| [Review PNG](design/review.png) | [review.md](design/review.md) | Draft | Upload pending | Not assessed against final design |
| [My Words PNG](design/myWords.png) | [myWords.md](design/myWords.md) | Draft | Upload pending | Not assessed against final design |
| [Lessons PNG](design/lessons.png) | [lessons.md](design/lessons.md) | Draft | Upload pending | Not assessed against final design |
| [Quiz PNG](design/quiz.png) | [quiz.md](design/quiz.md) | Draft | Upload pending | Not assessed against final design |
| [Capture PNG](design/capture.png) | [capture.md](design/capture.md) | Draft | Upload pending | Not assessed against final design |
| [Memory Palace PNG](design/memoryPalace.png) | [memoryPalace.md](design/memoryPalace.md) | Draft | Upload pending | Not assessed against final design |
| [Settings PNG](design/settings.png) | [settings.md](design/settings.md) | Draft | Upload pending | Not assessed against final design |
| [Startup behavior PNG](design/startup.png) | [startup.md](design/startup.md) | Draft | Upload pending | Not assessed against final design |
| [Admin Vocabulary Management PNG](design/adminVocabMgmt.png) | [adminVocabMgmt.md](design/adminVocabMgmt.md) | Draft | Upload pending | Not assessed against final design |
| [Admin Vocabulary Cards PNG](design/adminVocabCards.png) | [adminVocabCards.md](design/adminVocabCards.md) | Draft | Upload pending | Not assessed against final design |
| [Storage Schema PNG](design/storageSchema.png) | [storageSchema.md](design/storageSchema.md) | Draft | Upload pending | Not assessed against final design |

## Shared navigation and existing administration behavior

Mobile bottom navigation: Review, My Words, Lessons, Settings; Help at top where specified. Due words open Review (previously Today), otherwise Lessons. Search accepts marked and numbered pinyin. Capture import currently supports learning bundles without replacing progress.

Administration retains blue/green palette, common header, Help, left navigation and vocabulary/detail or research/preview split; real counts instead of mock values. Import / Export supports administration JSON backup/restore, learning-bundle export, inventory, connection reports and unambiguous local matching. Administration Settings explains storage and local launch; Help explains local editing, transfer, generation and approval. Decorative artwork and exact wordmark parity remain unimplemented. Real-browser and phone checks remain required; DOM tests are not visual approval.
