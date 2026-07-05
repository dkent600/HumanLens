---
name: no-auto-real-model-eval
description: Never run the real-model eval harness automatically — it costs the user money
metadata:
  type: feedback
---

Do NOT run the real-model eval harness (`npm run eval -- <lens>` when `ANTHROPIC_API_KEY` is present, i.e. `Provider: real Anthropic model`) on my own initiative — each run makes live Anthropic API calls the user pays for. Instead, when a change would benefit from a live check, flag it and let the user decide whether to run it.

**Why:** The user is cost-conscious about API spend and asked (2026-07) not to trigger paid runs automatically.

**How to apply:** Free to run without asking — they stay on the deterministic fake, no API calls: `npm test`, `npm run build`, `npm run lint`, and `npm run eval` when no key is set (falls back to the fake). The `meaning` runner makes TWO real calls (Listening then Human Meaning); `listening` makes one. Related: [[commit-everything-including-docs]].
