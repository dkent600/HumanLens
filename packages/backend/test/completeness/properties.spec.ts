import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runPlanArb } from '../../src/eval/completeness/arbitraries.js';
import { AdversarialModel, type RunPlan, type VoicePlan } from '../../src/eval/completeness/adversarial-model.js';
import { runFanOut, DEFAULT_CAPS } from '../../src/eval/completeness/fan-out.js';
import { Ledger } from '../../src/eval/completeness/ledger.js';
import { buildReport } from '../../src/eval/completeness/report.js';
import { TERMINAL_STATES, type ReasonCode, type TerminalState } from '../../src/eval/completeness/terminal-state.js';
import { PROPERTIES } from '../../src/engine/completeness/properties.js';

// The seeded RUN-LEVEL property suite — the thousands-of-runs acceptance check with
// shrinking. Every assertion cites a canonical property id from the registry. A failing
// property is a code bug or a spec error (route to Doug), NEVER relaxed here to go green.

/** Reason codes each terminal state is allowed to carry (P2/P4 routing consistency). */
const ALLOWED_REASONS: Readonly<Record<TerminalState, readonly ReasonCode[]>> = {
  'answered-with-findings': ['ok'],
  'answered-empty': ['chosen-empty'],
  'delivered-but-unusable': [
    'malformed',
    'parse-exception',
    'refusal',
    'truncated',
    'out-of-protocol',
    'provenance-violation',
    'retries-exhausted',
  ],
  'failed': ['transport', 'provider-rejected', 'retries-exhausted'],
};

const MAX_ATTEMPTS_PER_VOICE = 1 + DEFAULT_CAPS.modelRetries + DEFAULT_CAPS.infraRetries;

// Pinned seeds — a green run is EXACTLY reproducible (build-phase governance: "green is
// inspectable, reports the seeds"). Each seed still explores its full numRuns of distinct
// plans; pinning only fixes WHICH corpus, so a failure reproduces byte-for-byte and its
// shrunk counterexample is stable enough to lift into a fixture.
const SEED_RUN_LEVEL = 5_901_001;
const SEED_RESUME = 5_901_002;

async function driveRun(plan: RunPlan, runId = 'run:p'): Promise<{ ledger: Ledger; model: AdversarialModel }> {
  const ledger = new Ledger(':memory:');
  const model = new AdversarialModel(plan);
  await runFanOut({ runId, voiceIds: plan.voiceIds, model, ledger });
  return { ledger, model };
}

/** Build a deterministic plan from labelled per-voice scripts. */
function planOf(scripts: readonly VoicePlan[]): RunPlan {
  const voiceIds = scripts.map((_, i) => `voice:${i}`);
  return { voiceIds, plans: new Map(voiceIds.map((id, i) => [id, scripts[i]])) };
}

describe('completeness — run-level properties (seeded, thousands of runs)', () => {
  it(`P1/P2/P3/P4/P6/P9 hold across every seeded run`, async () => {
    const runId = 'run:p';
    await fc.assert(
      fc.asyncProperty(runPlanArb, async (plan) => {
        const { ledger, model } = await driveRun(plan, runId);
        try {
          const rows = ledger.allRows(runId);

          // P1 totality — every voice, exactly one terminal row, one of the four states.
          expect(rows).toHaveLength(plan.voiceIds.length);
          expect(new Set(rows.map((r) => r.voiceId)).size).toBe(plan.voiceIds.length);

          for (const row of rows) {
            expect(TERMINAL_STATES).toContain(row.state); // P1
            expect(ALLOWED_REASONS[row.state]).toContain(row.reasonCode); // P2 / P4 routing
            expect(model.callCount(row.voiceId)).toBeLessThanOrEqual(MAX_ATTEMPTS_PER_VOICE); // P9 bounded
          }

          // P3 provenance — a persisted finding belongs ONLY to an answered-with-findings
          // voice, and its stored voice id is that voice (never a misattribution).
          for (const voiceId of ledger.voicesWithFindings(runId)) {
            expect(ledger.getRow(runId, voiceId)?.state).toBe('answered-with-findings');
            for (const finding of ledger.findingsFor(runId, voiceId)) {
              expect(finding.voiceId).toBe(voiceId);
            }
          }

          // P6 report accuracy — derived-from-ledger totals match the ledger exactly.
          const report = buildReport(ledger, runId);
          const stateSum = TERMINAL_STATES.reduce((sum, s) => sum + report.byState[s], 0);
          expect(stateSum).toBe(plan.voiceIds.length);
          expect(report.voiceCount).toBe(plan.voiceIds.length);
          expect(report.attributedFindingCount).toBe(ledger.findingCount(runId));
          expect(report.gaps).toHaveLength(report.byState['delivered-but-unusable'] + report.byState['failed']);
        } finally {
          ledger.close();
        }
      }),
      { numRuns: 2000, seed: SEED_RUN_LEVEL },
    );
  });

  it(`P5/P8 — a resume re-drives nothing and leaves the ledger byte-identical`, async () => {
    const runId = 'run:resume';
    await fc.assert(
      fc.asyncProperty(runPlanArb, async (plan) => {
        const ledger = new Ledger(':memory:');
        try {
          const first = new AdversarialModel(plan);
          await runFanOut({ runId, voiceIds: plan.voiceIds, model: first, ledger });
          const rowsAfterFirst = ledger.allRows(runId);
          const findingsAfterFirst = ledger.findingCount(runId);

          // Resume against a FRESH model — every voice is already terminal.
          const second = new AdversarialModel(plan);
          await runFanOut({ runId, voiceIds: plan.voiceIds, model: second, ledger });

          for (const voiceId of plan.voiceIds) {
            expect(second.callCount(voiceId)).toBe(0); // P8: completed voices are not re-run
          }
          expect(ledger.allRows(runId)).toEqual(rowsAfterFirst); // P5: no duplication / drift
          expect(ledger.findingCount(runId)).toBe(findingsAfterFirst);
        } finally {
          ledger.close();
        }
      }),
      { numRuns: 500, seed: SEED_RESUME },
    );
  });
});

describe(`P7 — ${PROPERTIES.P7.title}`, () => {
  it('a chosen-empty voice is terminal on the first empty response — one call, never retried', async () => {
    const { ledger, model } = await driveRun(planOf([{ attempts: ['empty'], repeatLast: true }]), 'run:p7a');
    expect(ledger.getRow('run:p7a', 'voice:0')?.state).toBe('answered-empty');
    expect(model.callCount('voice:0')).toBe(1);
    ledger.close();
  });

  it('empty is terminal even when a later scripted attempt would answer with findings', async () => {
    // If empty were retried, attempt 1 ('valid') would flip it to answered-with-findings.
    const { ledger, model } = await driveRun(planOf([{ attempts: ['empty', 'valid'], repeatLast: false }]), 'run:p7b');
    expect(ledger.getRow('run:p7b', 'voice:0')?.state).toBe('answered-empty');
    expect(model.callCount('voice:0')).toBe(1);
    ledger.close();
  });

  it('a transient failure IS retried, but the empty that follows is then terminal', async () => {
    const { ledger, model } = await driveRun(planOf([{ attempts: ['transport', 'empty'], repeatLast: false }]), 'run:p7c');
    expect(ledger.getRow('run:p7c', 'voice:0')?.state).toBe('answered-empty');
    expect(model.callCount('voice:0')).toBe(2); // one transport retry, then the terminal empty
    ledger.close();
  });
});

describe(`P9 — ${PROPERTIES.P9.title}`, () => {
  it('a perpetually-poisoned unusable voice (l) exhausts the model layer → retries-exhausted', async () => {
    const { ledger, model } = await driveRun(planOf([{ attempts: ['malformed'], repeatLast: true }]), 'run:p9a');
    const row = ledger.getRow('run:p9a', 'voice:0');
    expect(row?.state).toBe('delivered-but-unusable');
    expect(row?.reasonCode).toBe('retries-exhausted');
    expect(model.callCount('voice:0')).toBe(1 + DEFAULT_CAPS.modelRetries);
    ledger.close();
  });

  it('a perpetually-failing transport voice exhausts the infra layer → retries-exhausted', async () => {
    const { ledger, model } = await driveRun(planOf([{ attempts: ['transport'], repeatLast: true }]), 'run:p9b');
    const row = ledger.getRow('run:p9b', 'voice:0');
    expect(row?.state).toBe('failed');
    expect(row?.reasonCode).toBe('retries-exhausted');
    expect(model.callCount('voice:0')).toBe(1 + DEFAULT_CAPS.infraRetries);
    ledger.close();
  });

  it('a voice alternating unusable/failed still terminates within the combined bound', async () => {
    const { ledger, model } = await driveRun(planOf([{ attempts: ['malformed', 'transport'], repeatLast: true }]), 'run:p9c');
    expect(ledger.getRow('run:p9c', 'voice:0')?.reasonCode).toBe('retries-exhausted');
    expect(model.callCount('voice:0')).toBeLessThanOrEqual(MAX_ATTEMPTS_PER_VOICE);
    ledger.close();
  });
});

describe(`P3 — ${PROPERTIES.P3.title} (cross-voice contamination never leaks)`, () => {
  it('a voice that only ever emits findings for its neighbour never poisons the neighbour', async () => {
    const runId = 'run:p3';
    const { ledger } = await driveRun(
      planOf([
        { attempts: ['cross-voice'], repeatLast: true }, // voice:0 always names voice:1
        { attempts: ['valid'], repeatLast: false }, // voice:1 answers itself
      ]),
      runId,
    );
    expect(ledger.getRow(runId, 'voice:0')?.state).toBe('delivered-but-unusable');
    expect(ledger.findingsFor(runId, 'voice:0')).toEqual([]);
    // voice:1 carries ONLY its own finding — never the contamination aimed at it.
    expect(ledger.findingsFor(runId, 'voice:1')).toEqual([{ voiceId: 'voice:1', noticing: 'meaning for voice:1' }]);
    expect(ledger.quarantineCount(runId)).toBeGreaterThanOrEqual(1);
    ledger.close();
  });
});
