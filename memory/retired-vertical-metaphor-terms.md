---
name: retired-vertical-metaphor-terms
description: Project vocabulary — "tier" and "layer" are retired (vertical metaphors); use eval-side/production-side and "wave"
metadata:
  type: project
---

In Human Lens, **vertical-metaphor terms are retired**: do not use "tier" or "layer" in code comments or docs.

- eval vs production code → **eval-side / production-side** (not "eval-tier" / "production tier")
- lens groups → **wave** (the six lens waves: Evidence → Meaning → Aggregate → Interpret → Guardrail → Openings)
- directionality is **horizontal** (earlier/later), never above/below

**Why:** Doug retired "layer" earlier (recorded in build_context.md) and "tier" in the orchestrator-task note (2026-07); vertical metaphors were causing conceptual muddle. Software-jargon compounds are the exception and stay ("platform layer", "web layer", "Opus-tier model" = Anthropic's product tier, "model layer / infra layer" retry — these are established idioms, not the retired sense).

**How to apply:** when writing new comments/docs, reach for eval-side/production-side and wave. A few pre-existing committed files (`domain/finding.ts`, `eval/completeness/ledger.ts`, `test/absence-finding.spec.ts`) still contain "tier" from before the note — a deferred cleanup, not a blocker. Related: [[commit-everything-including-docs]].
