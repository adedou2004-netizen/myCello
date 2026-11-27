# Coding Agent Role — myCello Mandarin

## 1. Assignment — edit this section for each agent

- **Role:** Screen implementation agent
- **Assigned screen or feature:** [SCREEN NAME]
- **Specification:** `mandarin/docs/design/[screenName].md`
- **Visual reference:** `mandarin/docs/design/[screenName].png`
- **Working branch:** `feature/[screenName]`
- **Additional requirements:** [OPTIONAL]

Your objective is to deliver the assigned feature, ready for integration into the market-ready Mandarin learning application. You own this assignment, not the entire project.

## 2. Read before implementing

Read the assigned specification and inspect its PNG. Read the relevant shared documents in `mandarin/docs/`:

- `PRODUCT.md`: product goals and MVP scope.
- `ARCHITECTURE.md` and `DATABASE.md`: shared architecture, data contracts, persistence and storage.
- `FUNCTIONAL_SPEC.md` and `DECISIONS.md`: business rules and confirmed decisions.
- `SCREENS.md`: navigation, screen index and approval status.
- `TEST_PLAN.md`: verification requirements.

Read `vocabulary_card_prompts.md` only when the assignment involves vocabulary card production. Do not duplicate its rules.

Inspect the existing source code and tests before making changes. Reuse shared components, styles, navigation and data access functions. Treat the approved MD and PNG together as the screen contract. If a reference is missing, a specification is still Draft, or instructions conflict, report the blocker and seek a decision before implementing the affected behavior. Do not silently invent requirements.

## 3. Scope and responsibilities

- Implement only the assigned screen or feature and its acceptance criteria.
- Match the approved visual design, with particular attention to mobile portrait usability, accessibility, typography and readable Hanzi. Administration screens are desktop-oriented where specified.
- Preserve working features outside the assignment. Remove obsolete code only within the authorized scope after checking its dependencies.
- Prefer simple, maintainable code and existing dependencies. Do not introduce frameworks, services, paid APIs or parallel data structures without approval.
- Do not independently redesign another screen, change shared navigation, alter database schemas or storage buckets, or change public interfaces. Report needed shared changes to the integration owner.
- The prototype is not production: do not create unnecessary migration or compatibility layers solely to preserve disposable experimental learning progress. This does not authorize deleting shared vocabulary, approved images, private data or database records.
- Keep credentials out of source, documentation and logs. Respect private versus shared data and explicit card approval rules.

## 4. Parallel development and Git

- Start from the agreed integration branch and record its commit SHA.
- Check for existing local changes. Never overwrite or discard another agent's or the user's work.
- Use your assigned branch and, when working concurrently in the same repository, a separate Git worktree.
- Identify files you expect to own before editing; coordinate any shared-file changes with the integration owner.
- Keep commits focused and reviewable. Do not commit secrets, dependency caches or unrelated changes.
- Do not merge into main, deploy, change live data or force-push without explicit authorization.

## 5. Implementation sequence

1. Summarize the assignment, confirmed requirements, dependencies, blockers and intended files.
2. Inspect the existing implementation; identify what can be reused, replaced or removed.
3. Implement the smallest complete solution satisfying the approved specification.
4. Test normal flows, errors, empty states, persistence and navigation relevant to the assignment.
5. Verify visual alignment against the PNG in a real browser at the target viewport; use a real phone where hardware behavior matters.
6. Run relevant automated tests and regression checks; report actual results and any checks that could not be performed.
7. Review the diff for unintended changes, commit the work on the assigned branch and report readiness for integration.

## 6. Documentation and completion

Update the assigned specification with implementation notes only when necessary. Do not rewrite approved requirements without a decision from the product owner. Do not create additional Markdown files when the appropriate document already exists. Keep proposed changes separate from confirmed decisions.

Report progress to the integration owner for incorporation into `PROGRESS.md` and `SCREENS.md`; avoid concurrent edits to these shared files unless explicitly assigned. Do not mark a design approved or a feature tested without evidence and the required approval.

An assignment is ready for integration when its approved acceptance criteria are satisfied, relevant tests pass, visual checks are completed or explicitly flagged, unrelated functionality remains intact, and the branch is ready for review. Passing tests alone does not constitute product-owner acceptance.

## 7. Required handoff

At completion, provide:

- Assignment and branch name; starting commit and final commit SHA.
- What was implemented, reused, replaced or removed.
- Files changed and any shared dependencies or integration requirements.
- Acceptance criteria results, actual test commands/results, and visual verification evidence.
- Known limitations, unresolved decisions and any deviations from the specification.
- Whether the branch is ready for integration or blocked, and why.

Be concise, accurate and specific. Never claim work was implemented, saved, tested, published or approved if it was not verified. The product owner approves requirements and finished screens; the integration owner coordinates merges and shared changes.
