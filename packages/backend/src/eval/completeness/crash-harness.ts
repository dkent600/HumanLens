import { Ledger } from './ledger.js';
import { AdversarialModel, type RunPlan, type VoicePlan } from './adversarial-model.js';
import { runFanOut } from './fan-out.js';

// Child-process harness for the CRASH ACCEPTANCE TEST (behavior j / P8). It drives a run
// of N healthy voices against a FILE-BACKED (durable) ledger, logging each model call with
// its PHASE (1 = original, 2 = resume) so the parent can prove no completed voice is
// re-executed after a crash.
//
//   node crash-harness.js <dbPath> <runId> <phase> <killAfter> <n>
//
// PHASE 1: after `killAfter` durable commits it prints "PAUSED" and idles forever — the
// parent then SIGKILLs it (a true process crash: the ledger is not closed, the WAL is not
// checkpointed). Exactly `killAfter` voices are committed and NO further work happens, so
// the crash point is deterministic.
// PHASE 2: resumes the SAME run and same ledger file; the fan-out skips voices already
// terminal (P8) and finishes the rest, then prints "DONE" and exits 0.

/** Thrown from onCommit to stop phase 1 cleanly at the crash point (before the parent kill). */
class PauseSignal extends Error {}

async function main(): Promise<void> {
  const [dbPath, runId, phaseStr, killAfterStr, nStr] = process.argv.slice(2);
  const phase = Number(phaseStr);
  const killAfter = Number(killAfterStr);
  const n = Number(nStr);

  const voiceIds = Array.from({ length: n }, (_, i) => `voice:${i}`);
  const validPlan: VoicePlan = { attempts: ['valid'], repeatLast: false };
  const plan: RunPlan = { voiceIds, plans: new Map(voiceIds.map((id) => [id, validPlan])) };

  const ledger = new Ledger(dbPath);
  const model = new AdversarialModel(plan);
  let committed = 0;

  try {
    await runFanOut({
      runId,
      voiceIds,
      model,
      ledger,
      onAttempt: (voiceId, attempt) => ledger.logCall(runId, voiceId, attempt, phase),
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
      // Durably committed exactly `killAfter` voices; idle until the parent SIGKILLs us.
      await new Promise<never>(() => {
        /* never resolves — the parent kill is the "crash" */
      });
    }
    throw err;
  }

  ledger.close();
  process.stdout.write('DONE\n');
}

await main();
