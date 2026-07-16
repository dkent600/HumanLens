import { ANTHROPIC_MODEL } from '../../../seams/anthropic-llm-provider.js';
import type { TerminalObservation } from '../terminal-state.js';
import { PER_VOICE_SYSTEM, buildUserPrompt } from './anthropic-voice-model.js';
import { contrastPaths } from './two-path-contrast.js';
import { requireClient, sampleVoices } from './shared.js';

// F1-b — the ★ DEMONSTRATION (build_context.md V-1 RESULT ★). Not an assertion: an
// observed, side-by-side contrast on ONE identical real response. The pure two-path logic
// lives in two-path-contrast.ts (offline-tested); this file makes the single real call.
//
// HISTORICAL NOTE (the fix landed): the fake-empty-drop seam fix means the production seam
// now surfaces `stopReason`, so PATH 1 below models a consumer that IGNORES the signal —
// the pre-fix world this harness documented. Kept as the record of the drop; a re-run now
// demonstrates what the fix closed, not a live defect.
//
// A truncated real call (low max_tokens → stop_reason='max_tokens'; with thinking on, the
// tiny budget is spent on thinking so the findings text comes back empty) is routed two ways:
//   PATH 1 — the PRODUCTION seam, which DISCARDS stop_reason → {text:''} reads as chosen-empty
//            → answered-empty → NEVER retried (P7): a permanent silent drop.
//   PATH 2 — the SKELETON's total adapter, which HAS the real stop_reason → delivered-but-unusable
//            (retryable): correct.
// The ONLY difference is whether stop_reason was available. That delta IS ★. We deliberately do
// NOT fix the production seam here; erasing the delta would defeat the run.
//
//   npm run f1b            # default max_tokens=16
//   npm run f1b -- 8       # a lower truncation budget (sharper — empty body)
//
// If truncation won't trigger, we report what was tried, not skip F1-b silently.

async function main(): Promise<void> {
  const maxTokens = Number(process.argv[2] ?? 16);
  const client = requireClient();
  const voice = sampleVoices().find((v) => v.voiceId === 'eval-u24');
  if (!voice) throw new Error('eval-u24 missing from the sample fixture');
  const knownVoiceIds = new Set([voice.voiceId]);

  console.log('F1-b — ★ demonstration: production seam (stop_reason discarded) vs total adapter\n');
  console.log(`Model: ${ANTHROPIC_MODEL} | voice: ${voice.voiceId} | max_tokens: ${maxTokens} | thinking: adaptive`);
  console.log('One real model call (truncation-forcing). Do NOT fix the production seam for this run — the delta IS ★.\n');

  // ONE real call — thinking adaptive so a tiny budget is spent on thinking, emptying the text.
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system: PER_VOICE_SYSTEM,
    messages: [{ role: 'user', content: buildUserPrompt(voice.voiceId, voice.content) }],
  });

  if (message.stop_reason !== 'max_tokens') {
    console.log(`Truncation did NOT trigger: stop_reason='${message.stop_reason}' at max_tokens=${maxTokens}.`);
    console.log('The model completed within the budget. Re-run with a lower max_tokens (e.g. `npm run f1b -- 8`).');
    console.log('Reporting this rather than skipping F1-b silently (disposition totality).');
    return;
  }

  const result = await contrastPaths(message, voice.voiceId, knownVoiceIds);

  console.log(`Real stop_reason: ${result.realStopReason}   (non-natural → truncated)`);
  console.log(`Body text length: ${result.bodyText.length} chars${result.bodyText.length === 0 ? '  (EMPTY)' : ''}`);
  console.log(`Body preview: ${JSON.stringify(result.bodyText.slice(0, 120))}\n`);
  console.log('┌─ PATH 1 — production seam (stop_reason DISCARDED; consumer assumes natural)');
  console.log(`│    lands as: ${result.path1ProductionSeam.state} / ${result.path1ProductionSeam.reasonCode}`);
  console.log(`│    retried?  ${retriedText(result.path1ProductionSeam)}`);
  console.log('└─ PATH 2 — total adapter (real stop_reason available)');
  console.log(`     lands as: ${result.path2TotalAdapter.state} / ${result.path2TotalAdapter.reasonCode}`);
  console.log(`     retried?  ${retriedText(result.path2TotalAdapter)}\n`);

  const divergent = result.path1ProductionSeam.state !== result.path2TotalAdapter.state;
  console.log(
    divergent
      ? '★ DELTA CONFIRMED: the identical response is mis-accounted through the production seam ' +
          'and correctly routed through the total adapter — the only difference is stop_reason availability.'
      : 'NOTE: the two paths did not diverge on this response (body was unparseable either way). ' +
          'Try a lower max_tokens for an EMPTY body, where the divergence is sharpest — reporting as-is.',
  );
}

function retriedText(obs: TerminalObservation): string {
  if (obs.state === 'answered-empty') return 'NO — chosen-empty is terminal (P7). Silent drop.';
  if (obs.state === 'answered-with-findings') return 'NO — treated as a complete answer. Partial kept as authoritative.';
  if (obs.state === 'delivered-but-unusable') return 'YES — model-layer retry, then surfaced as a gap. Correct.';
  return 'YES — infra-layer retry.';
}

await main();
