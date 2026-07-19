import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SqliteRunLedger } from '../../src/seams/sqlite-run-ledger.js';
import {
  DEFAULT_CAPS,
  observeVoiceCall,
  runVoiceFanOut,
  type VoiceOperation,
} from '../../src/engine/completeness/voice-orchestrator.js';
import {
  TERMINAL_STATES,
  type ReasonCode,
  type TerminalState,
} from '../../src/engine/completeness/terminal-state.js';
import { PROPERTIES } from '../../src/engine/completeness/properties.js';
import type { LlmResponse } from '../../src/seams/llm-provider.js';
import {
  ScriptedVoiceOperation,
  prodPlanOf,
  prodRunPlanArb,
  type ProdFinding,
  type ProdRunPlan,
} from './production-harness.js';

// The PRODUCTION property suite — the same acceptance contract the V-1 scaffold holds
// (P1–P9 + adapter totality + run-scoping + G-1), now asserted against the PRODUCTION
// machinery (voice-orchestrator + the SqliteRunLedger seam). Every assertion cites a
// canonical property id. A failing property is a code bug or a spec error routed to Doug,
// NEVER relaxed here.

/** Reason codes each terminal state may carry, in the ADOPTED (collapsed) production set. */
const ALLOWED_REASONS: Readonly<Record<TerminalState, readonly ReasonCode[]>> = {
  'answered-with-findings': ['ok'],
  'answered-empty': ['chosen-empty'],
  'delivered-but-unusable': ['refused', 'malformed', 'retries-exhausted'],
  'failed': ['transport', 'provider-rejected', 'retries-exhausted'],
};

const MAX_ATTEMPTS_PER_VOICE = 1 + DEFAULT_CAPS.modelRetries + DEFAULT_CAPS.infraRetries;

// Pinned seeds — a green run reproduces exactly (governance: green is inspectable).
const SEED_RUN_LEVEL = 5_903_001;
const SEED_RESUME = 5_903_002;

/** No-op infra backoff — tests must not sleep real seconds on failed-retry paths. */
const noBackoff = (): Promise<void> => Promise.resolve();

async function driveRun(
  plan: ProdRunPlan,
  runId = 'run:p',
): Promise<{ ledger: SqliteRunLedger; op: ScriptedVoiceOperation }> {
  const ledger = new SqliteRunLedger(':memory:');
  const op = new ScriptedVoiceOperation(plan, new Set(plan.voiceIds));
  // concurrency 1 keeps seeded runs deterministic (so fast-check can shrink); concurrency
  // is a perf axis orthogonal to the accounting properties.
  await runVoiceFanOut({
    runId,
    voiceIds: plan.voiceIds,
    operation: op,
    ledger,
    concurrency: 1,
    infraBackoff: noBackoff,
  });
  return { ledger, op };
}

describe('production completeness — run-level properties (seeded)', () => {
  it('P1/P2/P3/P4/P6/P9 hold across every seeded run', async () => {
    const runId = 'run:p';
    await fc.assert(
      fc.asyncProperty(prodRunPlanArb, async (plan) => {
        const { ledger, op } = await driveRun(plan, runId);
        try {
          const rows = await ledger.allRows(runId);

          // P1 totality — every voice, exactly one terminal row, one of the four states.
          expect(rows).toHaveLength(plan.voiceIds.length);
          expect(new Set(rows.map((r) => r.voiceId)).size).toBe(plan.voiceIds.length);

          for (const row of rows) {
            expect(TERMINAL_STATES).toContain(row.state); // P1
            expect(ALLOWED_REASONS[row.state]).toContain(row.reasonCode); // P2 / P4 routing
            expect(op.callCount(row.voiceId)).toBeLessThanOrEqual(MAX_ATTEMPTS_PER_VOICE); // P9 bounded
          }

          // P3 provenance — a persisted finding belongs ONLY to an answered-with-findings
          // voice, and its stored voice id is that voice (never a misattribution).
          for (const voiceId of await ledger.voicesWithFindings(runId)) {
            expect((await ledger.getRow(runId, voiceId))?.state).toBe('answered-with-findings');
            for (const finding of await ledger.findingsFor(runId, voiceId)) {
              expect((finding as ProdFinding).voiceId).toBe(voiceId);
            }
          }

          // P6 accounting integrity — the ledger's own totals are consistent: findings live
          // only under answered rows, and the finding count equals the sum of persisted rows.
          let summed = 0;
          for (const voiceId of plan.voiceIds) summed += (await ledger.findingsFor(runId, voiceId)).length;
          expect(await ledger.findingCount(runId)).toBe(summed);
        } finally {
          ledger.close();
        }
      }),
      { numRuns: 1500, seed: SEED_RUN_LEVEL },
    );
  });

  it('P5/P8 — a resume re-drives nothing and leaves the ledger identical', async () => {
    const runId = 'run:resume';
    await fc.assert(
      fc.asyncProperty(prodRunPlanArb, async (plan) => {
        const ledger = new SqliteRunLedger(':memory:');
        try {
          const first = new ScriptedVoiceOperation(plan, new Set(plan.voiceIds));
          await runVoiceFanOut({ runId, voiceIds: plan.voiceIds, operation: first, ledger, concurrency: 1, infraBackoff: noBackoff });
          const rowsAfterFirst = await ledger.allRows(runId);
          const findingsAfterFirst = await ledger.findingCount(runId);

          const second = new ScriptedVoiceOperation(plan, new Set(plan.voiceIds));
          await runVoiceFanOut({ runId, voiceIds: plan.voiceIds, operation: second, ledger, concurrency: 1, infraBackoff: noBackoff });

          for (const voiceId of plan.voiceIds) {
            expect(second.callCount(voiceId)).toBe(0); // P8: completed voices are not re-run
          }
          expect(await ledger.allRows(runId)).toEqual(rowsAfterFirst); // P5: no duplication / drift
          expect(await ledger.findingCount(runId)).toBe(findingsAfterFirst);
        } finally {
          ledger.close();
        }
      }),
      { numRuns: 400, seed: SEED_RESUME },
    );
  });
});

describe(`P7 — ${PROPERTIES.P7.title}`, () => {
  it('a chosen-empty voice is terminal on the first empty — one call, never retried', async () => {
    const { ledger, op } = await driveRun(prodPlanOf([{ attempts: ['empty'], repeatLast: true }]), 'run:p7a');
    expect((await ledger.getRow('run:p7a', 'voice:0'))?.state).toBe('answered-empty');
    expect(op.callCount('voice:0')).toBe(1);
    ledger.close();
  });

  it('empty is terminal even when a later scripted attempt would answer with findings', async () => {
    const { ledger, op } = await driveRun(prodPlanOf([{ attempts: ['empty', 'valid'], repeatLast: false }]), 'run:p7b');
    expect((await ledger.getRow('run:p7b', 'voice:0'))?.state).toBe('answered-empty');
    expect(op.callCount('voice:0')).toBe(1);
    ledger.close();
  });
});

describe(`P9 — ${PROPERTIES.P9.title}`, () => {
  it('a perpetually-unusable voice exhausts the MODEL layer → retries-exhausted', async () => {
    const { ledger, op } = await driveRun(prodPlanOf([{ attempts: ['malformed'], repeatLast: true }]), 'run:p9a');
    const row = await ledger.getRow('run:p9a', 'voice:0');
    expect(row?.state).toBe('delivered-but-unusable');
    expect(row?.reasonCode).toBe('retries-exhausted');
    expect(op.callCount('voice:0')).toBe(1 + DEFAULT_CAPS.modelRetries);
    ledger.close();
  });

  it('a perpetually-failing transport voice exhausts the INFRA layer → retries-exhausted', async () => {
    const { ledger, op } = await driveRun(prodPlanOf([{ attempts: ['transport'], repeatLast: true }]), 'run:p9b');
    const row = await ledger.getRow('run:p9b', 'voice:0');
    expect(row?.state).toBe('failed');
    expect(row?.reasonCode).toBe('retries-exhausted');
    expect(op.callCount('voice:0')).toBe(1 + DEFAULT_CAPS.infraRetries);
    ledger.close();
  });

  it('a non-retryable 4xx is terminal immediately — failed/provider-rejected, no backoff (A7)', async () => {
    const { ledger, op } = await driveRun(prodPlanOf([{ attempts: ['provider-rejected'], repeatLast: true }]), 'run:a7');
    const row = await ledger.getRow('run:a7', 'voice:0');
    expect(row?.state).toBe('failed');
    expect(row?.reasonCode).toBe('provider-rejected');
    expect(op.callCount('voice:0')).toBe(1);
    ledger.close();
  });
});

describe(`P3 — ${PROPERTIES.P3.title} (cross-voice contamination never leaks)`, () => {
  it('a voice that only emits findings for its neighbour never poisons the neighbour', async () => {
    const runId = 'run:p3';
    const { ledger } = await driveRun(
      prodPlanOf([
        { attempts: ['cross-voice'], repeatLast: true }, // voice:0 always names voice:1
        { attempts: ['valid'], repeatLast: false }, // voice:1 answers itself
      ]),
      runId,
    );
    expect((await ledger.getRow(runId, 'voice:0'))?.state).toBe('delivered-but-unusable');
    expect(await ledger.findingsFor(runId, 'voice:0')).toEqual([]);
    expect(await ledger.findingsFor(runId, 'voice:1')).toEqual([{ voiceId: 'voice:1', noticing: 'meaning for voice:1' }]);
    expect(await ledger.quarantineCount(runId)).toBeGreaterThanOrEqual(1);
    ledger.close();
  });
});

describe(`A9 — ${PROPERTIES.A9.title} (adapter totality, production)`, () => {
  // observeVoiceCall is a total function: any call outcome — return or throw of anything —
  // and any parse behavior (incl. a parse that throws) maps to exactly one terminal state.
  const callArb: fc.Arbitrary<() => Promise<LlmResponse>> = fc.oneof(
    fc
      .record({
        stopReason: fc.constantFrom<NonNullable<LlmResponse['stopReason']>>(
          'end_turn',
          'stop_sequence',
          'max_tokens',
          'refusal',
          'pause_turn',
          'tool_use',
        ),
        text: fc.string(),
      })
      .map((r) => () => Promise.resolve<LlmResponse>(r)),
    // absent stopReason (a signal-less provider) + arbitrary body
    fc.string().map((text) => () => Promise.resolve<LlmResponse>({ text })),
    // throws: with a status (any HTTP), and without one, and a non-Error value
    fc.integer({ min: 100, max: 599 }).map((status) => () => Promise.reject(Object.assign(new Error('x'), { status }))),
    fc.constantFrom(
      () => Promise.reject(new Error('no status')),
      () => Promise.reject('a string, not an Error'),
      () => {
        throw new Error('sync throw');
      },
    ),
  );

  it('maps every outcome (incl. a throwing parse) to exactly one terminal state and never throws', async () => {
    await fc.assert(
      fc.asyncProperty(callArb, fc.boolean(), async (call, parseThrows) => {
        const op: VoiceOperation<ProdFinding> = {
          call,
          parse: (text, voiceId) => {
            if (parseThrows) throw new Error('hostile parse');
            // Otherwise a trivially-usable-empty parse (natural finish → answered-empty).
            void text;
            void voiceId;
            return { usable: true, findings: [] };
          },
        };
        const obs = await observeVoiceCall(op, 'voice:x');
        expect(TERMINAL_STATES).toContain(obs.state);
      }),
      { numRuns: 2000, seed: 5_903_003 },
    );
  });
});

describe('run-scoping — two runs share a voice id without corrupting each other', () => {
  it('keys by (run_id, voice_id): each run keeps its own accounting', async () => {
    const ledger = new SqliteRunLedger(':memory:');
    try {
      await runVoiceFanOut({
        runId: 'run:A',
        voiceIds: ['voice:0'],
        operation: new ScriptedVoiceOperation(prodPlanOf([{ attempts: ['valid'], repeatLast: true }]), new Set(['voice:0'])),
        ledger,
        infraBackoff: noBackoff,
      });
      await runVoiceFanOut({
        runId: 'run:B',
        voiceIds: ['voice:0'],
        operation: new ScriptedVoiceOperation(prodPlanOf([{ attempts: ['empty'], repeatLast: true }]), new Set(['voice:0'])),
        ledger,
        infraBackoff: noBackoff,
      });
      expect((await ledger.getRow('run:A', 'voice:0'))?.state).toBe('answered-with-findings');
      expect((await ledger.getRow('run:B', 'voice:0'))?.state).toBe('answered-empty');
      expect(await ledger.findingCount('run:A')).toBe(1);
      expect(await ledger.findingCount('run:B')).toBe(0);
    } finally {
      ledger.close();
    }
  });
});
