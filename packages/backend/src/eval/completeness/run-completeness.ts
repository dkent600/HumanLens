import { AdversarialModel, BEHAVIOR_VALUES, type Behavior, type RunPlan, type VoicePlan } from './adversarial-model.js';
import { runFanOut, DEFAULT_CAPS } from './fan-out.js';
import { Ledger } from './ledger.js';
import { buildReport, formatReport } from './report.js';
import { BEHAVIORS, PROPERTIES } from './properties.js';

// Dev / demonstration harness for the completeness validator — the manual path for
// eyeballing how each adversarial behavior routes through the fan-out and lands in the
// ledger. It is NOT part of the server (nothing under this folder is). Mirrors run-lens.ts.
//
//   Build + run (from packages/backend):  npm run completeness
//
// The PROPERTY suite (test/completeness/*.spec.ts) is the seeded, thousands-of-runs
// acceptance check with shrinking. This runner is the human-readable companion: it drives
// a DETERMINISTIC demonstrative plan — one perpetual voice per behavior, plus a couple of
// transient-then-recover voices — so a reviewer can SEE every behavior's terminal state
// and reason code, not just a green tick (build-phase governance: green is inspectable).

/** One perpetual voice per behavior (repeatLast) + transient-recover + a healthy voice. */
function demonstrativePlan(): { plan: RunPlan; labels: Map<string, string> } {
  const entries: { id: string; label: string; plan: VoicePlan }[] = [];
  let i = 0;

  // A voice that ALWAYS does one behavior — shows that behavior's terminal landing.
  for (const behavior of BEHAVIOR_VALUES) {
    entries.push({ id: `voice:${i++}`, label: `perpetual ${behavior}`, plan: { attempts: [behavior], repeatLast: true } });
  }
  // Transient failures that RECOVER (repeatLast false → valid after the scripted attempts):
  const transient: Behavior[][] = [['transport'], ['malformed', 'malformed'], ['rate-limited', 'server-error']];
  for (const attempts of transient) {
    entries.push({ id: `voice:${i++}`, label: `transient ${attempts.join('→')}→recover`, plan: { attempts, repeatLast: false } });
  }
  // A plainly healthy voice.
  entries.push({ id: `voice:${i++}`, label: 'healthy', plan: { attempts: ['valid'], repeatLast: false } });

  const voiceIds = entries.map((e) => e.id);
  const plans = new Map<string, VoicePlan>(entries.map((e) => [e.id, e.plan]));
  const labels = new Map<string, string>(entries.map((e) => [e.id, e.label]));
  return { plan: { voiceIds, plans }, labels };
}

async function main(): Promise<void> {
  const runId = 'run:demo';
  const { plan, labels } = demonstrativePlan();
  const ledger = new Ledger(':memory:');
  const model = new AdversarialModel(plan);

  console.log('V-1 completeness validator — demonstrative run (eval-scaffolding, NOT the adopted mechanism)\n');
  console.log(`Caps: model-layer retries ${DEFAULT_CAPS.modelRetries}, infra-layer retries ${DEFAULT_CAPS.infraRetries}\n`);
  console.log('Adversarial behaviors exercised (a–l):');
  for (const [key, desc] of Object.entries(BEHAVIORS)) {
    console.log(`  (${key}) ${desc}`);
  }
  console.log('');

  await runFanOut({ runId, voiceIds: plan.voiceIds, model, ledger });

  console.log('Per-voice outcome:');
  for (const voiceId of plan.voiceIds) {
    const row = ledger.getRow(runId, voiceId);
    console.log(
      `  ${voiceId.padEnd(10)} ${(labels.get(voiceId) ?? '').padEnd(34)} → ${row?.state} / ${row?.reasonCode} ` +
        `(${model.callCount(voiceId)} call${model.callCount(voiceId) === 1 ? '' : 's'})`,
    );
  }
  console.log('');
  console.log(formatReport(buildReport(ledger, runId)));
  console.log('');
  console.log(`Properties held as the acceptance contract: ${Object.keys(PROPERTIES).join(', ')}.`);
  console.log('The seeded property suite (test/completeness) is the thousands-of-runs check with shrinking.');

  ledger.close();
}

await main();
