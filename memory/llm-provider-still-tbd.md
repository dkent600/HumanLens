---
name: llm-provider-still-tbd
description: "The LLM provider/model is still undecided even though AnthropicLlmProvider exists in code — don't flag AGENTS.md \"TBD\" as stale"
metadata:
  node_type: memory
  type: project
  originSessionId: c283dad6-e2fa-48ee-bcab-a2a00c47829e
  modified: 2026-10-03T17:42:45.866Z
---

The LLM provider + model decision is still open (confirmed by the user 2026-10-03), even though the backend has a working `AnthropicLlmProvider` behind the provider seam and `docs/build_context.md` records it as the "first real model". That is a provider in use, not a final choice. The "LLM provider + model: TBD" line in AGENTS.md is correct.

**Why:** a 2026-10-03 prompt audit flagged the TBD line as stale because of the existing Anthropic provider. The user corrected it: having one implementation doesn't mean the decision has been made.

**How to apply:** don't propose rewriting the TBD line or treating Anthropic as the decided vendor. Keep vendor-specific code behind the seam.
