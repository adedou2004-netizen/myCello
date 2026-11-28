# myCello — Future Development

## Practice with AI — portable lesson prompts

**Recorded:** 2026-11-27  
**Status:** Accepted product direction; future implementation, not part of current MVP work.

### Purpose

myCello is the learner's durable vocabulary knowledge base, not a replacement for an AI tutor. Learners discover vocabulary through reading, videos, conversations or any LLM, capture it into myCello lessons, and retain it through vocabulary cards, Memory Palace and spaced repetition. They can then take selected vocabulary back to any LLM for interactive tutoring.

The idea emerged from a reading session using HSK Story, Friday Afternoon — Chapter 1, followed by adaptive vocabulary and reading-comprehension practice in ChatGPT. Recognition was easier than active recall and speaking, suggesting different exercise styles at different times of day.

### Scope and principles

- Keep the existing app, navigation, capture, lessons and SRS behavior intact.
- Generate portable plain-text prompts locally; no LLM API, API keys, token billing, provider dependency or embedded chatbot.
- Support any external AI tutor, including free tiers subject to their own limits.
- Do not require learners to understand prompt engineering.
- Do not automatically expose private examples, notes, palace pins or learning history.
- Copying a prompt does not count as completing a lesson or SRS review. Do not infer external exercise results.
- Do not begin implementation until explicitly requested.

### Proposed user flow

1. Open **Practice with AI** from a lesson, the Review screen (due vocabulary), or My Words (selected vocabulary).
2. Select one or more exercise styles.
3. Choose difficulty (Easy with hints, Adaptive, Challenging) and suggested duration (10, 20 or 30 minutes).
4. Preview the complete generated prompt and vocabulary.
5. Copy to clipboard and paste into the learner's chosen AI tutor.
6. Continue practice in that external conversation. Return to myCello for vocabulary capture or normal review.

### Built-in prompt templates

| Style | Instructions |
| --- | --- |
| Vocabulary recognition | Show Chinese words without pinyin; ask for meanings, then revisit mistakes. |
| Reading comprehension | Compose natural sentences and short paragraphs using selected vocabulary. Ask for translations one at a time. |
| Active recall | Give meanings in the learner's language; ask for Mandarin equivalents. Provide hints only as needed. |
| Conversation | Conduct a level-appropriate Mandarin conversation using selected vocabulary; correct errors constructively. |
| Pronunciation | Practice one expression at a time, with tone marks and useful pronunciation guidance. Assess audio only if the AI actually receives audio. |
| Sentence construction | Ask the learner to construct sentences using selected words; increase difficulty gradually. |
| Character exploration | Explain radicals, components, historical origins and mnemonics; distinguish evidence from invented memory aids. |

Common instructions: present large Chinese characters; use accurate Hanyu Pinyin with tone marks when explaining answers; withhold answers until the learner responds; revisit missed words; summarize progress at the end. Allow the learner to stop at any time. Treat duration as a suggested target, not a guaranteed timer.

### Example generated prompt

```text
You are my Mandarin tutor.
Lesson: Friday Afternoon — Chapter 1
Vocabulary:
聊天 — liáotiān — to chat
下课 — xiàkè — to finish class
起床 — qǐchuáng — to get up
休息 — xiūxi — to rest
以后 — yǐhòu — after

Exercise: Reading comprehension.
Difficulty: Adaptive.
Suggested duration: 20 minutes.
Create natural short sentences using this vocabulary.
Ask one question at a time. Show Chinese characters very large.
Do not show pinyin or translations before I answer.
Correct mistakes and revisit missed vocabulary in new contexts.
Summarize my progress when we finish.
```

The vocabulary above illustrates the format using words practiced in the session; it is not a verified complete extraction of the source story.

### Proposed architecture and data

Use existing vocabulary records and lesson membership, due-word selection or My Words selection. Resolve entry IDs to Hanzi, pinyin and meaning, deduplicate by entry ID (preserve distinct senses), and serialize in a stable order. Keep the generator a pure local function accepting selected entries, template IDs, difficulty, duration and learner preferences. Preview exactly what will be copied.

Built-in templates can be static application data: template ID, label and instruction text. No new database table is required for the initial version. Optional later personal templates may be stored locally with existing settings and included in backup/restore, subject to schema review.

### Later enhancement: personal templates

Allow learners to save, edit and reuse custom instructions. Examples: morning active recall and speaking, evening reading and recognition. Keep custom text private by default. Optional export of progress summaries from external tutors may be considered separately; no automatic synchronization is in scope.

### Implementation stages

1. Confirm placement and mobile layout against existing lesson, review and My Words screens.
2. Implement local prompt builder and static templates, with tests.
3. Add selection, difficulty, duration, preview and clipboard action to the lesson screen.
4. Reuse the same component for Review and My Words.
5. Consider saved personal templates and backup/restore only after the basic workflow is stable.

### Acceptance criteria

- Selected vocabulary is correctly included, with no unintended duplicates or private fields.
- All seven exercise styles can be selected, including combinations.
- Difficulty and duration change the generated instructions.
- Preview and clipboard contents match exactly, including Chinese characters and tone marks.
- Empty vocabulary or exercise selection prevents copying with a clear explanation.
- Clipboard failure offers a selectable text fallback.
- The workflow works on mobile and desktop and requires no AI network call.
- Existing lesson progress, SRS scheduling and stored vocabulary are not modified by prompt export.
- Existing application features remain functional.
- Personal templates, if implemented later, persist and restore correctly.

### Decisions still open

Exact button placement, visual layout, default exercise selection, export of optional example sentences or difficulty statistics, and personal-template persistence are proposed details to confirm before coding.

### Product positioning

myCello organizes what learners learn, helps them remember it, and gives them the freedom to practice with any AI tutor. A curated prompt library adds value without requiring the application owner to fund customers' AI tutoring sessions.
