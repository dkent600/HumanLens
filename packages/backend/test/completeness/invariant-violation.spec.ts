import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  runVoiceFanOut,
  type ParsedVoiceBody,
  type VoiceOperation,
} from '../../src/engine/completeness/voice-orchestrator.js';
import { InMemoryRunLedger } from '../../src/engine/completeness/in-memory-run-ledger.js';
import { FakeLlmProvider, type LensResponsePayload } from '../../src/seams/llm-provider.js';
import { HumanMeaningLens } from '../../src/engine/lenses/human-meaning-lens.js';
import { ListeningLens } from '../../src/engine/lenses/listening-lens.js';
import { runPerVoiceLens } from '../../src/engine/completeness/per-voice-lens.js';
import { makeOrdinaryFinding, type Finding } from '../../src/domain/finding.js';
import type { Unit } from '../../src/domain/types.js';

// PER-LENS COMPLETENESS INVARIANT — enforced, never retried (the relay's load-bearing rule).
// A lens declares whether answered-empty is legitimate for a voice. When it is NOT and the
// voice resolves answered-empty, the run records a VIOLATION alongside the truthful
// answered-empty state — and CRUCIALLY does not retry it (re-asking an empty voice until it
// stops coming back empty is manufacturing findings under pressure, the exact failure P7
// prevents) and does not reroute it to delivered-but-unusable.

interface VF {
  readonly voiceId: string;
}

/** A hand-built operation: returns valid findings or a natural-finish EMPTY body per plan,
 *  declares answered-empty (il)legitimate, and counts calls per voice. */
function scriptedOp(
  plan: ReadonlyMap<string, 'valid' | 'empty'>,
  legitimate: boolean,
  calls: Map<string, number>,
): VoiceOperation<VF> {
  return {
    call: (voiceId) => {
      calls.set(voiceId, (calls.get(voiceId) ?? 0) + 1);
      const body = plan.get(voiceId) === 'empty' ? '{"findings":[]}' : `{"v":"${voiceId}"}`;
      return Promise.resolve({ text: body, stopReason: 'end_turn' });
    },
    parse: (text, voiceId): ParsedVoiceBody<VF> => {
      const parsed = JSON.parse(text) as { findings?: unknown };
      if (Array.isArray(parsed.findings)) return { usable: true, findings: [] }; // usable empty
      return { usable: true, findings: [{ voiceId }] };
    },
    answeredEmptyLegitimate: () => legitimate,
  };
}

describe('completeness invariant — a declared-illegitimate empty is a violation, never retried', () => {
  it('records a violation on the answered-empty record and calls the voice exactly ONCE', async () => {
    const ledger = new InMemoryRunLedger();
    const calls = new Map<string, number>();
    const plan = new Map<string, 'valid' | 'empty'>([['v0', 'empty']]);
    await runVoiceFanOut({
      runId: 'r',
      voiceIds: ['v0'],
      operation: scriptedOp(plan, false, calls),
      ledger,
      infraBackoff: () => Promise.resolve(),
    });

    const row = await ledger.getRow('r', 'v0');
    expect(row?.state).toBe('answered-empty'); // TRUTHFUL — the model usably responded with nothing
    expect(row?.reasonCode).toBe('chosen-empty'); // NOT rerouted to delivered-but-unusable
    expect(row?.invariantViolation).toBeTypeOf('string'); // the visible defect, recorded alongside
    expect(calls.get('v0')).toBe(1); // NEVER retried (P7 anti-fabrication)

    const violations = await ledger.invariantViolations('r');
    expect(violations.map((v) => v.voiceId)).toEqual(['v0']);
  });

  it('records NO violation when the lens declares the empty legitimate', async () => {
    const ledger = new InMemoryRunLedger();
    const calls = new Map<string, number>();
    const plan = new Map<string, 'valid' | 'empty'>([['v0', 'empty']]);
    await runVoiceFanOut({
      runId: 'r',
      voiceIds: ['v0'],
      operation: scriptedOp(plan, true, calls),
      ledger,
      infraBackoff: () => Promise.resolve(),
    });
    const row = await ledger.getRow('r', 'v0');
    expect(row?.state).toBe('answered-empty');
    expect(row?.invariantViolation).toBeUndefined();
    expect(calls.get('v0')).toBe(1);
  });

  it('PROPERTY: every illegitimate empty is answered-empty + violation + exactly one call', async () => {
    const planArb = fc
      .array(fc.constantFrom<'valid' | 'empty'>('valid', 'empty'), { minLength: 1, maxLength: 15 })
      .map((kinds) => {
        const voiceIds = kinds.map((_, i) => `v${i}`);
        return { voiceIds, plan: new Map(voiceIds.map((id, i) => [id, kinds[i]])) };
      });

    await fc.assert(
      fc.asyncProperty(planArb, async ({ voiceIds, plan }) => {
        const ledger = new InMemoryRunLedger();
        const calls = new Map<string, number>();
        await runVoiceFanOut({
          runId: 'r',
          voiceIds,
          operation: scriptedOp(plan, false, calls), // illegitimate everywhere
          ledger,
          infraBackoff: () => Promise.resolve(),
        });
        for (const voiceId of voiceIds) {
          const row = await ledger.getRow('r', voiceId);
          expect(calls.get(voiceId)).toBe(1); // no voice is ever retried
          if (plan.get(voiceId) === 'empty') {
            expect(row?.state).toBe('answered-empty');
            expect(row?.invariantViolation).toBeTypeOf('string');
          } else {
            expect(row?.state).toBe('answered-with-findings');
            expect(row?.invariantViolation).toBeUndefined();
          }
        }
      }),
      { numRuns: 500, seed: 5_904_001 },
    );
  });
});

// ── Lens-level: the two per-voice lenses declare the right invariant ────────────────────

function clearedUnit(unitId: string, speakerToken: string, content: string): Unit {
  return {
    unitId,
    engagementId: 'eng:1',
    ingestedBy: 'actor:test',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content,
    deidStatus: 'cleared',
    speakerToken,
  };
}

describe('Human Meaning declares answered-empty NEVER legitimate (every voice yields >=1)', () => {
  it('an empty response for a voice is recorded as a violation, not retried', async () => {
    const units = [clearedUnit('u1', 'spk-a', 'a voice worth interpreting')];
    const prior: Finding[] = [
      makeOrdinaryFinding({ findingId: 'listening:0-0', lens: 'listening', verbatim: 'a surfaced voice', evidenceLinks: ['u1'], units }),
    ];
    // A fake that returns NO meaning for the voice (the u9-style silent skip).
    const emptyFake = new FakeLlmProvider((): LensResponsePayload => ({ findings: [] }));
    const ledger = new InMemoryRunLedger();
    const { findings } = await runPerVoiceLens(new HumanMeaningLens(), units, prior, emptyFake, {
      ledger,
      runId: 'r',
    });

    expect(findings).toHaveLength(0);
    const row = await ledger.getRow('r', 'listening:0-0');
    expect(row?.state).toBe('answered-empty'); // truthful
    expect(row?.invariantViolation).toBeTypeOf('string'); // Human Meaning: illegitimate -> violation
  });
});

describe('Listening declares answered-empty legitimate ONLY for non-authored emptiness', () => {
  it('an AUTHORED unit that comes back empty is a violation; a whitespace unit is not', async () => {
    const authored = clearedUnit('u1', 'spk-a', 'a real authored comment');
    const whitespace = clearedUnit('u2', 'spk-b', '   ');
    const emptyFake = new FakeLlmProvider((): LensResponsePayload => ({ findings: [] }));

    const ledger = new InMemoryRunLedger();
    await runPerVoiceLens(new ListeningLens(), [authored, whitespace], [], emptyFake, { ledger, runId: 'r' });

    const authoredRow = await ledger.getRow('r', 'u1');
    expect(authoredRow?.state).toBe('answered-empty');
    expect(authoredRow?.invariantViolation).toBeTypeOf('string'); // authored -> must yield a finding

    const whitespaceRow = await ledger.getRow('r', 'u2');
    expect(whitespaceRow?.state).toBe('answered-empty');
    expect(whitespaceRow?.invariantViolation).toBeUndefined(); // non-authored -> legitimately empty
  });
});
