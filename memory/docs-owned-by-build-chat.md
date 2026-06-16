---
name: docs-owned-by-build-chat
description: Do not edit files under docs/ from the code repo; propose notes for the build chat instead
metadata:
  type: feedback
---

The `docs/` files (`build_approach.md`, `build_implementation.md`, `build_context.md`, `identification_workflow.md`) are single-writer: each is "written ONLY by this build chat." From the code repo, do NOT edit them directly — even though CLAUDE.md says to "note it in build_context.md."

**Why:** the build chat owns the docs (source of truth) and also serves as a second opinion on the code work; keeping the single-writer discipline intact matters more than the convenience of editing from here.

**How to apply:** when a code-side decision should be recorded, *draft* the note (matching the target doc's voice — `build_implementation.md` for design-of-implementation decisions, a one-line state pointer in `build_context.md`) and hand it to the user to carry into the build chat. Propose insertion points; don't write. Related: [[repo-layout]].
