# Admin Vocabulary Management

Specification status: Draft — not yet approved or complete.

![Admin Vocabulary Management design](./adminVocabMgmt.png)

Design image: expected alongside this file; original PNG upload pending. The following is a starter specification based on prior documented decisions, not a completed visual audit. Confirm all details against the supplied design.

## Purpose
Maintain the vocabulary catalog and prepare lessons.

## Entry conditions
Local administration navigation.

## Interface elements
Count row, Hanzi/pinyin/English/French search, selected word details, add word, bulk JSON import, review flags, prompts and lesson creation.

## Behavior
Use normalized identity matching; preserve distinct readings and meanings. Existing implemented behavior is documented in FUNCTIONAL_SPEC.md.

## Data
Local dictionary snapshot; see DATABASE.md. See [DATABASE](../DATABASE.md) and [ARCHITECTURE](../ARCHITECTURE.md).

## Navigation
Vocabulary Cards, Import / Export, Settings and Help.

## Acceptance criteria
- [ ] Confirm visual reference and all controls.
- [ ] Confirm behavior, data writes, navigation and error states.
- [ ] Obtain explicit specification approval.
- [ ] Verify implementation and real-device behavior where applicable.
