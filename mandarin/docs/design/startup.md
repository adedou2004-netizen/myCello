# Startup behavior

Specification status: Draft — not yet approved or complete.

![Startup behavior design](./startup.png)

Design image: expected alongside this file; original PNG upload pending. The following is a starter specification based on prior documented decisions, not a completed visual audit. Confirm all details against the supplied design.

## Purpose
Open the appropriate first screen.

## Entry conditions
Application launch.

## Interface elements
Startup routing; exact loading and error states to confirm.

## Behavior
Open Review when due vocabulary exists, otherwise Lessons; reconcile resume behavior.

## Data
Read due queue and unfinished sessions. See [DATABASE](../DATABASE.md) and [ARCHITECTURE](../ARCHITECTURE.md).

## Navigation
Review or Lessons.

## Acceptance criteria
- [ ] Confirm visual reference and all controls.
- [ ] Confirm behavior, data writes, navigation and error states.
- [ ] Obtain explicit specification approval.
- [ ] Verify implementation and real-device behavior where applicable.
