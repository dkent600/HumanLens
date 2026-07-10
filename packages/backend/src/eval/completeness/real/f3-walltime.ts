import { runFanOut } from '../fan-out.js';
import { Ledger } from '../ledger.js';
import { observeVoiceCall } from '../voice-call-adapter.js';
import { buildReport, formatReport } from '../report.js';
import { ANTHROPIC_MODEL } from '../../../seams/anthropic-llm-provider.js';
import { AnthropicVoiceModel } from './anthropic-voice-model.js';
import { requireClient, sampleVoices } from './shared.js';

// F3 — wall-clock a full per-voice pass over the sample under fan-out (build_context.md F3).
// Target: interactive, single minutes. Reports two wall-clocks RAW:
//   • sequential  — the V-1 validator's fan-out as-built (a latency upper bound)
//   • concurrent  — a bounded-concurrency driver, the shape the mechanism recommendation
//                   (sync PARALLEL fan-out) would actually use — so the parallel speedup is visible.
//
//   npm run f3          # full 25-voice sample, concurrency 5
//   npm run f3 -- 8     # concurrency 8

function seconds(startNs: bigint): string {
  return (Number(process.hrtime.bigint() - startNs) / 1e9).toFixed(1);
}

/** A bounded-concurrency pass: the mechanism's sync PARALLEL fan-out, each voice committed atomically. */
async function concurrentPass(
  voices: readonly { voiceId: string; content: string }[],
  model: AnthropicVoiceModel,
  ledger: Ledger,
  runId: string,
  concurrency: number,
): Promise<void> {
  const knownVoiceIds = new Set(voices.map((v) => v.voiceId));
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= voices.length) return;
      const voiceId = voices[i].voiceId;
      const obs = await observeVoiceCall(voiceId, knownVoiceIds, () => model.call(runId, voiceId, 0));
      ledger.recordTerminal(runId, voiceId, obs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, voices.length) }, () => worker()));
}

async function main(): Promise<void> {
  const concurrency = Number(process.argv[2] ?? 5);
  const client = requireClient();
  const voices = sampleVoices();

  console.log('F3 — wall-clock a full per-voice pass under fan-out\n');
  console.log(`Model: ${ANTHROPIC_MODEL} | voices: ${voices.length} | concurrency: ${concurrency}`);
  console.log(`Real calls: ${voices.length} sequential + ${voices.length} concurrent = ${voices.length * 2}. Target: single minutes.\n`);

  // Sequential (the validator's fan-out as-built).
  const seqLedger = new Ledger(':memory:');
  const seqModel = new AnthropicVoiceModel(voices, client);
  const seqStart = process.hrtime.bigint();
  await runFanOut({ runId: 'f3-seq', voiceIds: voices.map((v) => v.voiceId), model: seqModel, ledger: seqLedger });
  const seqSecs = seconds(seqStart);

  // Concurrent (the mechanism's sync parallel fan-out).
  const conLedger = new Ledger(':memory:');
  const conModel = new AnthropicVoiceModel(voices, client);
  const conStart = process.hrtime.bigint();
  await concurrentPass(voices, conModel, conLedger, 'f3-con', concurrency);
  const conSecs = seconds(conStart);

  console.log(`sequential fan-out:  ${seqSecs}s  (${voices.length} voices, one at a time)`);
  console.log(`concurrent fan-out:  ${conSecs}s  (${voices.length} voices, up to ${concurrency} at once)\n`);
  console.log('Sequential landings:');
  console.log(formatReport(buildReport(seqLedger, 'f3-seq')));

  seqLedger.close();
  conLedger.close();
}

await main();
