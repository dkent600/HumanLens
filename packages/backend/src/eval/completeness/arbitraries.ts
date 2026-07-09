import fc from 'fast-check';
import { BEHAVIOR_VALUES, type RunPlan, type VoicePlan } from './adversarial-model.js';

// fast-check arbitraries — the seeded, shrinkable generators the property suite draws
// from. Because the model is fully deterministic given a plan (adversarial-model.ts), a
// generated RunPlan reproduces byte-for-byte from its seed, and a failing run shrinks to
// a MINIMAL RunPlan that still fails — which becomes a fixture (build-phase governance:
// "shrunk counterexamples become fixtures").

/** One behavior, drawn uniformly from the full a–l set. */
export const behaviorArb: fc.Arbitrary<(typeof BEHAVIOR_VALUES)[number]> =
  fc.constantFrom(...BEHAVIOR_VALUES);

/**
 * A per-voice script: 1–5 attempt behaviors, and whether the last repeats forever
 * (repeatLast = true is what makes a voice perpetual poison — behavior l — when its
 * behaviors never resolve).
 */
export const voicePlanArb: fc.Arbitrary<VoicePlan> = fc.record({
  attempts: fc.array(behaviorArb, { minLength: 1, maxLength: 5 }),
  repeatLast: fc.boolean(),
});

/**
 * A whole run: 1–25 voices, each with its own adversarial script. Voice ids are assigned
 * deterministically (`voice:0`, `voice:1`, …) so ids are stable across a shrink and the
 * cross-voice behavior (g) always has a real neighbor to misattribute to.
 */
export const runPlanArb: fc.Arbitrary<RunPlan> = fc
  .array(voicePlanArb, { minLength: 1, maxLength: 25 })
  .map((plans) => {
    const voiceIds = plans.map((_, i) => `voice:${i}`);
    const map = new Map<string, VoicePlan>(voiceIds.map((id, i) => [id, plans[i]]));
    return { voiceIds, plans: map };
  });
