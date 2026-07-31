---
name: mark-the-final-response
description: "Head every final response with a \"## ⬛ FINAL — <topic>\" marker so it is separable from in-progress tool narration"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 08dbd98e-ec0f-47a9-b18c-d9d738d8b82c
  modified: 2026-07-31T20:14:58.790Z
---

End-of-turn responses must open with a scannable marker heading:

`## ⬛ FINAL — <short topic>`

Everything before it in the turn (tool calls, intermediate narration, progress notes) is
working output; the marked block is the answer.

**Why:** Doug reads the transcript while a prompt is still processing. Without a marker
there is no visual boundary between narration emitted mid-work and the actual conclusion,
so the answer has to be hunted for — and a partially-read intermediate note can be mistaken
for the result. This matters more here than in most projects because turns in this repo are
long and tool-heavy (evals, harness runs, multi-file changes).

**How to apply:** Open the final response with the marker heading and a short topic
("Freeze-and-replay implemented", "Pre-baseline check"). Keep the rest of the formatting as
it is — plain-text blocks for anything Doug pastes elsewhere, per
[[paste-friendly-report-formatting]]. One marker per turn, always the last block. Do not
mark intermediate messages.
