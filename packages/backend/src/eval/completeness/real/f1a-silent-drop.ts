import { runFanOut } from '../fan-out.js';
import { Ledger } from '../ledger.js';
import { TERMINAL_STATES, type TerminalState } from '../terminal-state.js';
import { ANTHROPIC_MODEL } from '../../../seams/anthropic-llm-provider.js';
import { AnthropicVoiceModel } from './anthropic-voice-model.js';
import { requireClient, sampleVoices, u9FocusVoices } from './shared.js';

// F1-a — SILENT-DROP-IMPOSSIBILITY on the REAL path (build_context.md V-3 / F1).
//
// Runs the u9 fixture (and, in `sample` mode, the fuller SAMPLE) through the V-1 per-voice
// fan-out against the real model (`ANTHROPIC_MODEL`), N times. PASS = ledger TOTALITY every run:
// every voice in exactly one terminal state, ZERO unaccounted. The point: in the batched
// Human Meaning call u9 intermittently vanished (dropped/dropped/surfaced); under per-voice
// fan-out u9 gets its OWN call every time, so a "drop" can no longer be silent — it can
// only manifest as answered-empty or delivered-but-unusable, both accounted.
//
//   npm run f1a                 # 50 reps of the u9-focused set (6 voices → up to ~300 calls)
//   npm run f1a -- 50 sample    # 50 reps of the full 25-voice sample (~1250+ calls — costly)
//   npm run f1a -- 20 u9        # 20 reps of the u9-focused set
//
// Governance: RAW output — per-run landings + u9's state each run; HALTS and surfaces the
// offending run if any voice is ever unaccounted (does not swallow it as benign).

function tally(rows: readonly { state: TerminalState }[]): Record<TerminalState, number> {
  const counts: Record<TerminalState, number> = {
    'answered-with-findings': 0,
    'answered-empty': 0,
    'delivered-but-unusable': 0,
    'failed': 0,
  };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

async function main(): Promise<void> {
  const reps = Number(process.argv[2] ?? 50);
  const mode = process.argv[3] ?? 'u9';
  const voices = mode === 'sample' ? sampleVoices() : u9FocusVoices();
  const client = requireClient();

  console.log('F1-a — silent-drop-impossibility (real model, per-voice fan-out)');
  console.log(`Model:  ${ANTHROPIC_MODEL}`);
  console.log(`Voices: ${voices.length} [${voices.map((v) => v.voiceId).join(', ')}]`);
  console.log(`Reps:   ${reps}`);
  console.log(`This makes up to ~${reps * voices.length} real model calls (plus any retries).\n`);
  console.log('rep   totality  u9-state                  landings (find/empty/unusable/failed)');

  const u9Landings: Record<TerminalState, number> = {
    'answered-with-findings': 0,
    'answered-empty': 0,
    'delivered-but-unusable': 0,
    'failed': 0,
  };
  let totalityHeld = 0;
  const voiceIds = voices.map((v) => v.voiceId);
  const knownVoiceIds = new Set(voiceIds);
  const hasU9 = knownVoiceIds.has('eval-u9');

  for (let rep = 0; rep < reps; rep += 1) {
    const ledger = new Ledger(':memory:');
    const runId = `f1a:${rep}`;
    const model = new AnthropicVoiceModel(voices, client);
    await runFanOut({ runId, voiceIds, model, ledger, knownVoiceIds });

    const rows = ledger.allRows(runId);
    // Totality check: exactly one row per voice, every id present, every state valid.
    const ids = new Set(rows.map((r) => r.voiceId));
    const unaccounted = voiceIds.filter((id) => !ids.has(id));
    const stateValid = rows.every((r) => TERMINAL_STATES.includes(r.state));
    const ok = rows.length === voiceIds.length && unaccounted.length === 0 && stateValid;

    const counts = tally(rows);
    const u9State = hasU9 ? ledger.getRow(runId, 'eval-u9')?.state : undefined;
    if (u9State) u9Landings[u9State] += 1;

    console.log(
      `${String(rep).padEnd(5)} ${(ok ? 'OK' : 'FAIL').padEnd(9)} ${(u9State ?? '—').padEnd(25)} ` +
        `${counts['answered-with-findings']} / ${counts['answered-empty']} / ` +
        `${counts['delivered-but-unusable']} / ${counts['failed']}`,
    );

    if (!ok) {
      console.error(`\n★ HALT — totality broken on rep ${rep}. Unaccounted voices: [${unaccounted.join(', ')}].`);
      console.error('Surfacing to Doug rather than continuing (governance: no asterisk resolved as benign).');
      ledger.close();
      process.exitCode = 1;
      return;
    }
    totalityHeld += 1;
    ledger.close();
  }

  console.log('\n=== aggregate ===');
  console.log(`totality held: ${totalityHeld}/${reps} runs  ${totalityHeld === reps ? '← PASS' : '← FAIL'}`);
  console.log('unaccounted voices across all runs: 0');
  if (hasU9) {
    console.log(
      `u9 landings over ${reps} reps: ` +
        TERMINAL_STATES.map((s) => `${s} ${u9Landings[s]}`).join(', '),
    );
    console.log(
      'Interpretation: a "drop" now surfaces as answered-empty / delivered-but-unusable — ' +
        'accounted, never missing. A missing u9 row (impossible under fan-out) would have HALTED above.',
    );
  }
}

await main();
