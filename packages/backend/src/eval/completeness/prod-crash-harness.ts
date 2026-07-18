import { SqliteRunLedger } from '../../seams/run-ledger.js';
import { runVoiceFanOut, type VoiceOperation } from '../../engine/completeness/voice-orchestrator.js';

// Child-process harness for the PRODUCTION crash acceptance test (P8). It drives a run of
// N healthy voices through the production orchestrator against a FILE-BACKED (durable)
// SqliteRunLedger, logging each call with its PHASE (1 = original, 2 = resume) so the
// parent can prove no completed voice is re-executed after a crash. Eval-side (compiled to
// dist so it can be spawned) but it exercises the PRODUCTION machinery, not the V-1 scaffold.
//
//   node prod-crash-harness.js <dbPath> <runId> <phase> <killAfter> <n>
//
// PHASE 1: after `killAfter` durable commits it prints "PAUSED" and idles forever — the
// parent SIGKILLs it (a true crash: ledger not closed, WAL not checkpointed). Concurrency
// is 1 so exactly `killAfter` voices commit, in order, before the pause — the crash point
// is deterministic. PHASE 2: resumes the same run + ledger; the orchestrator skips voices
// already terminal (P8) and finishes the rest, then prints "DONE" and exits 0.

interface ProdFinding {
  readonly voiceId: string;
  readonly noticing: string;
}

class PauseSignal extends Error {}

/** A trivial all-healthy per-voice operation: every voice answers with one finding. */
const operation: VoiceOperation<ProdFinding> = {
  call: (voiceId) =>
    Promise.resolve({
      text: JSON.stringify({ findings: [{ noticing: `meaning for ${voiceId}`, sourceFindingId: voiceId }] }),
      stopReason: 'end_turn',
    }),
  parse: (text, voiceId) => {
    const parsed = JSON.parse(text) as { findings: { noticing: string }[] };
    return { usable: true, findings: parsed.findings.map((f) => ({ voiceId, noticing: f.noticing })) };
  },
};

async function main(): Promise<void> {
  const [dbPath, runId, phaseStr, killAfterStr, nStr] = process.argv.slice(2);
  const phase = Number(phaseStr);
  const killAfter = Number(killAfterStr);
  const n = Number(nStr);

  const voiceIds = Array.from({ length: n }, (_, i) => `voice:${i}`);
  const ledger = new SqliteRunLedger(dbPath);
  let committed = 0;

  try {
    await runVoiceFanOut({
      runId,
      voiceIds,
      operation,
      ledger,
      concurrency: 1, // deterministic crash point
      onAttempt: (voiceId, attempt) => void ledger.logCall(runId, voiceId, attempt, phase),
      onCommit: (voiceId) => {
        committed += 1;
        process.stdout.write(`COMMIT ${voiceId}\n`);
        if (phase === 1 && committed === killAfter) {
          process.stdout.write('PAUSED\n');
          throw new PauseSignal();
        }
      },
    });
  } catch (err) {
    if (err instanceof PauseSignal) {
      await new Promise<never>(() => {
        /* idle until the parent SIGKILLs us — the crash */
      });
    }
    throw err;
  }

  ledger.close();
  process.stdout.write('DONE\n');
}

await main();
