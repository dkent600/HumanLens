---
name: commit-everything-including-docs
description: When committing in HumanLens, include doc changes too — Doug holds me responsible for committing everything
metadata:
  type: feedback
---

When asked to commit in this project, commit **everything** in the working tree, including `docs/` changes — do not leave them out. Doug holds me responsible for committing everything in the project.

**Why:** `docs/` are read-only from my side for *editing* (single-writer rule, per CLAUDE.md), but that does **not** extend to committing. The doc edits (made by the build chat) are usually associated with the code change I'm committing and belong in the same logical unit of history. Earlier I excluded `docs/build_context.md` from a commit on the read-only reasoning; that was wrong.

**How to apply:** On "commit," stage all changes including `docs/`. Prefer a separate commit for the docs (no-amend preference) when they're distinct, but still commit them in the same session — never leave a modified file behind. The CLAUDE.md "docs are read-only" rule governs *who edits*, not *who commits*.
