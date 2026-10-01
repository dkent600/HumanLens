---
name: testing-practices
description: Human Lens testing standard — property-based testing (fast-check), metamorphic testing, and deterministic simulation testing, plus the project's test governance (canonical property ids, pinned seeds, shrunk counterexamples become fixtures, no weakening-to-pass). Use whenever writing, reviewing, or fixing tests in any package (backend, frontend, shared), and when designing a new feature so its invariants are testable from the start.
---

# Testing practices — Human Lens

Three techniques are the default toolkit for this project. Example-based tests
(one input, one expected output) are still fine for a specific known case, but
they are not enough on their own for anything with an invariant. Reach for these
first:

| Technique | One-line idea | Question it answers |
|---|---|---|
| **Property-based testing** | Generate many random inputs and check invariants. | "Does this rule hold for *every* input, not just the ones I thought of?" |
| **Metamorphic testing** | Check that related inputs produce related outputs. | "I can't say what the exact output should be, but I know how it must change when the input changes this way." |
| **Deterministic simulation testing** | Run the whole system in a controlled, replayable simulation. | "Does the whole system stay correct under hostile conditions, and can I replay any failure exactly?" |

Runner: **Vitest** everywhere. Generator/shrinker: **fast-check** (already a
backend devDependency; add it to another package only when that package needs it).

The reference implementation of all of this is the completeness work:
`packages/backend/src/engine/completeness/properties.ts` (canonical registry),
`packages/backend/src/eval/completeness/arbitraries.ts` (generators),
`packages/backend/src/eval/completeness/adversarial-model.ts` (deterministic hostile
mock), and `packages/backend/test/completeness/` (the suites). Copy those patterns.

---

## 1. Property-based testing

Generate many inputs with fast-check, assert an invariant over each, and let
fast-check shrink any failure to a minimal counterexample.

```typescript
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

const SEED = 6_001_001; // pinned — see "Seeds" below

describe('assemble — evidence anchoring', () => {
  it('every interpretive finding links to ≥1 unit in its own engagement', () => {
    fc.assert(
      fc.property(engagementArb, (engagement) => {
        const brief = assemble(engagement);
        for (const f of brief.findings) {
          if (f.kind === 'absence') continue; // the one sanctioned exception
          expect(f.unitIds.length).toBeGreaterThan(0);
          for (const id of f.unitIds) expect(engagement.unitIds).toContain(id);
        }
      }),
      { seed: SEED, numRuns: 500 },
    );
  });
});
```

(Illustrative shape — match the real domain types and function names.)

Rules:
- **Write arbitraries, not fixtures.** Put reusable `fc.Arbitrary<T>` generators in
  one module per area (like `arbitraries.ts`). Keep ids deterministic and stable
  across shrinks (`voice:0`, `voice:1`, …) so counterexamples stay readable.
- **Cover the edges in the generator.** Empty collections, a single element, the
  maximum size, duplicates, unicode and bilingual text, uncleared `deid_status`
  values. If an edge matters, make sure the arbitrary can produce it.
- **Assert invariants, not reimplementations.** A property that recomputes the
  answer the same way the code does proves nothing. Assert things that must be
  true regardless of how the answer is computed.
- **Async code** uses `fc.asyncProperty` with `await fc.assert(...)`.

Invariants this project already names, and which should be properties wherever the
code touches them:
- **Evidence anchoring** — interpretive findings link to units; `absence` is the only exception.
- **Strength is derived** from the support set, never asserted.
- **Projection integrity** — client-safe ⊆ internal, with evidence links preserved.
- **Gate enforcement** — no unit reaches a lens unless `deid_status` is `cleared`.
- **Engagement + actor isolation** — material never crosses engagements; every write is attributed to its actor.
- **Completeness** — every voice is accounted for in exactly one terminal state (P1–P9 and friends).
- **Authorization deny paths** — every actor-facing operation honours a deny decision.

## 2. Metamorphic testing

Use this when there is no exact oracle: the expected output is unknown, but a
*relation* between two runs is known. Run the system on an input, transform the
input in a known way, run again, and check that the outputs relate as they must.

```typescript
it('unit order does not change the finding set (permutation relation)', async () => {
  await fc.assert(
    fc.asyncProperty(engagementArb, fc.infiniteStream(fc.nat()), async (eng, rng) => {
      const shuffled = shuffleWith(eng.units, rng); // deterministic, from generated data
      const a = await runPipeline(eng);
      const b = await runPipeline({ ...eng, units: shuffled });
      expect(normalize(b.findings)).toEqual(normalize(a.findings));
    }),
    { seed: SEED, numRuns: 200 },
  );
});
```

Relations that fit Human Lens:
- **Permutation.** Reordering units or voices does not change the set of findings,
  after normalizing order.
- **Isolation.** Adding any material to engagement B leaves engagement A's brief
  byte-identical.
- **Gate monotonicity.** Adding a `pending` or `flagged` unit changes nothing
  downstream of the gate. Clearing it can only add findings that cite it.
- **Consistent renaming.** Renaming unit ids by a bijection renames the evidence
  links in the output by the same bijection, and changes nothing else.
- **Projection.** Removing an internal-only finding can remove at most its own
  client-safe projection, never another finding's.
- **Additivity of support.** Adding a unit that supports a finding never lowers
  that finding's derived strength.

Rules:
- Each relation states *both* the input transform and the expected output relation.
  Write it as a one-line comment above the test.
- Normalize before comparing: sort, strip generated ids or timestamps, then compare.
- Combine with property-based testing. Generate the base input with fast-check, so
  the relation is checked across many inputs, not one.
- Over the deterministic machinery (gate, orchestration, assemble, projection,
  repository) relations must hold exactly. Over **real model output** they are
  eval-side questions, measured not asserted. Never run the real-model eval
  (`npm run eval` and the `f*` scripts) on your own, because it costs money. Flag it
  and let the user run it.

## 3. Deterministic simulation testing

Run the whole system (or a whole subsystem) end to end inside a controlled world
where every source of nondeterminism comes from a seed. Inject faults. Any failure
then replays exactly from its seed.

How to build one in this codebase:
1. **Drive through the seams.** The engine is plain TypeScript with no server, so
   compose it directly with simulated seam implementations: a deterministic LLM
   provider (`FakeLlmProvider`, or a scripted hostile model like
   `AdversarialModel`), the in-memory repository, an in-memory run ledger, and the
   trivial identity and authorization seams (or a denying one, to test deny paths).
2. **Remove ambient nondeterminism.** No `Math.random`, `Date.now`, `new Date()`,
   `crypto.randomUUID`, or real timers inside simulated code. Pass a clock, an id
   source, and a random source in through constructors and the Awilix composition
   root. Derive all variation from the generated plan and stable coordinates such
   as `(voiceId, attempt)`.
3. **Script the hostile world.** Generate a per-run plan with fast-check describing
   what each external call does: valid, empty, malformed, refusal, hallucinated id,
   duplicate, cross-voice, transport failure, truncation, crash. The simulated
   dependency replays that plan exactly.
4. **Assert system-level invariants after each run**, citing canonical property ids.
5. **Crash and resume.** For anything durable, kill mid-run and restart, then assert
   recoverability. In-process simulation covers most of it. Keep one real
   child-process SIGKILL test as the integration check (see
   `crash-acceptance.spec.ts`).
6. **Make green inspectable.** A simulation run reports what it tested, the seeds,
   the run count, and any shrunk counterexamples. "It passed" is not a report.

## Seeds, replay, and counterexamples

- **Pin seeds** in the suite as named constants. Use a distinct seed per suite so
  corpora don't overlap. A pinned seed still explores all `numRuns` distinct
  inputs. It only fixes *which* corpus, so failures reproduce byte for byte.
- **Replay a failure** with the seed and path fast-check prints:
  `fc.assert(prop, { seed, path, endOnFailure: true })`.
- **Shrunk counterexamples become fixtures.** When a property fails, lift the
  minimal counterexample into a named example-based regression test beside the
  property, then fix the code.
- **Flaky means a bug.** A property that passes and fails on the same seed has a
  nondeterminism leak. Find it. Do not retry it, skip it, or lower `numRuns`.

## Governance (non-negotiable)

- **Properties are the acceptance contract.** Where a canonical registry exists
  (like `PROPERTIES` in `properties.ts`), tests cite property ids and import the
  statements. They never restate a property in their own words.
- **No weakening-to-pass.** A failing property is either a code bug (fix the code)
  or a spec error. A spec error goes to the user (Doug) with a short note, not into
  a relaxed assertion.
- **Ambiguous results go to the user.** A flaky property, a counterexample that
  might be "mock infidelity", or a wish to relax a property is decided by Doug.
  Two Codex instances must not agree among themselves that it is benign.
- **New behaviors are proposed, not added silently.** A new adversarial behavior or
  property found while building is staged (for example in `PROPOSED_BEHAVIORS`)
  with a note for the spec, not slipped straight into test code.
- **Every actor-facing operation has a tested deny path**, and the structural
  invariant suites (anchoring, projection integrity, gate, scoping) stay green as
  regression guards.
- **`docs/` is read-only.** If a test reveals something the spec should record,
  draft a note for the user rather than editing `docs/`.

## Checklist for a new feature

1. Name its invariants. Each becomes a property.
2. Name at least one metamorphic relation for any output with no exact oracle.
3. If it touches an external call, durability, or concurrency, add it to a
   deterministic simulation with fault injection.
4. Pin seeds, keep shrunk counterexamples as fixtures, and report seeds and run counts.
5. Keep the example-based tests for the specific cases a reader needs to see.
