---
name: revisit-headless-ui-choice
description: Open item to discuss — Aurelia Headless UI vs DaisyUI is decided in the spec but neither is installed; the frontend is bespoke Tailwind
metadata:
  type: project
---

**Open, to revisit with Doug (raised 2026-08-25).** `docs/build_implementation.md` decides
the component-primitive layer as **Aurelia Headless UI** (`@aurelia-ui-toolkits/headless`
+ its Tailwind companion) with **DaisyUI** as the proven fallback. Neither is in
`packages/frontend/package.json`. The two screens built so far (intake, brief) are bespoke
Aurelia custom elements styled by Tailwind v4 directly.

**Why:** the spec flagged Aurelia Headless UI as a watch item — brand new (1.0.0, small
community), to be leaned on "where it earns its place" rather than depended on for the
whole UI. The code has quietly taken the do-nothing path, which is a legitimate outcome of
that instruction but has never been decided out loud. The decision point is real now:
the UI surface is modest, so the honest options are (a) adopt Headless UI for the few
primitives that want it, (b) fall back to DaisyUI, or (c) formally record "bespoke
Tailwind, no primitive kit" and let the spec drop the choice.

**How to apply:** don't resolve this by installing something mid-task — it's a spec
decision, and `docs/` has a single writer. Surface it when frontend component work comes
up; whatever is decided goes back to the SMI build chat as a short decision note, not a
direct `docs/` edit. The frontend README currently states the gap as fact.

Related: [[commit-everything-including-docs]]
