import type Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_MODEL } from '../../../seams/anthropic-llm-provider.js';
import { AnthropicVoiceModel } from './anthropic-voice-model.js';
import { requireClient, sampleVoices } from './shared.js';

// F2 — cache instrumentation under a REAL CONCURRENT fan-out burst (build_context.md F2,
// upgraded per A1). Reports THREE numbers RAW, not summarized:
//   1. measured hit rate — from the actual usage tokens under a warm concurrent burst
//   2. break-even hit rate — derived from Anthropic's documented cache multipliers
//   3. worst-case 0%-hit arithmetic — the cost if every call paid a cache WRITE (cold burst)
//
//   npm run f2               # pre-warm, then a concurrent burst over the full sample
//   npm run f2 -- 10         # burst of 10 voices
//   npm run f2 -- 25 --cold  # NO pre-warm — the cold-start case where all calls may write
//
// Anthropic prompt-caching multipliers (documented; verify against the pricing page at run):
//   cache WRITE = 1.25× base input tokens, cache READ = 0.10× base input tokens.
const WRITE_MULT = 1.25;
const READ_MULT = 0.1;

/** Break-even hit rate h*: where cache cost == no-cache cost for the prefix. h* = (w-1)/(w-r). */
const BREAK_EVEN_HIT_RATE = (WRITE_MULT - 1) / (WRITE_MULT - READ_MULT);

interface Totals {
  cacheRead: number;
  cacheWrite: number;
  uncachedInput: number;
  output: number;
}

async function main(): Promise<void> {
  const burst = Number(process.argv[2] ?? 25);
  const cold = process.argv.includes('--cold');
  const client = requireClient();
  const voices = sampleVoices().slice(0, burst);

  console.log('F2 — cache instrumentation under a real concurrent fan-out burst\n');
  console.log(`Model: ${ANTHROPIC_MODEL} | burst: ${voices.length} concurrent calls | pre-warm: ${cold ? 'NO (cold)' : 'yes'}`);
  console.log(`Real calls: ${voices.length}${cold ? '' : ' + 1 pre-warm'}. Prompt caching ON (system prompt marked ephemeral).\n`);

  const totals: Totals = { cacheRead: 0, cacheWrite: 0, uncachedInput: 0, output: 0 };
  const perCall: Anthropic.Usage[] = [];
  const model = new AnthropicVoiceModel(voices, client, {
    cacheSystemPrompt: true,
    onUsage: (usage) => perCall.push(usage),
  });

  if (!cold) {
    // Pre-warm: one call to create the cache entry before the burst (A1 impl note). Anthropic's
    // minimum max_tokens is 1, so this is a tiny real call, not a true max_tokens:0.
    const warm = new AnthropicVoiceModel(voices.slice(0, 1), client, {
      cacheSystemPrompt: true,
      maxTokens: 1,
    });
    await warm.call('f2-warm', voices[0].voiceId, 0);
  }

  // The burst — fire every voice concurrently (Promise.all is the barrier).
  await Promise.all(voices.map((v) => model.call('f2', v.voiceId, 0)));

  for (const u of perCall) {
    totals.cacheRead += u.cache_read_input_tokens ?? 0;
    totals.cacheWrite += u.cache_creation_input_tokens ?? 0;
    totals.uncachedInput += u.input_tokens;
    totals.output += u.output_tokens;
  }

  console.log('Aggregate usage over the burst:');
  console.log(`  cache_read_input_tokens     ${totals.cacheRead}`);
  console.log(`  cache_creation_input_tokens ${totals.cacheWrite}`);
  console.log(`  input_tokens (uncached)     ${totals.uncachedInput}`);
  console.log(`  output_tokens               ${totals.output}\n`);

  const cacheable = totals.cacheRead + totals.cacheWrite;
  console.log('THREE NUMBERS (raw):');
  if (cacheable === 0) {
    console.log('  1. measured hit rate:   n/a — cache_read + cache_creation = 0.');
    console.log('     CAVEAT: the shared system prefix is likely below the model cache minimum (~1024 tokens),');
    console.log('     so caching did not engage. This is itself a finding: F2 needs a ≥1024-token shared prefix');
    console.log('     to measure a real hit rate. Reporting the zeros rather than masking them.');
  } else {
    const hitRate = totals.cacheRead / cacheable;
    console.log(`  1. measured hit rate:   ${(hitRate * 100).toFixed(1)}%  (cache_read / (cache_read + cache_creation))`);
  }
  console.log(`  2. break-even hit rate: ${(BREAK_EVEN_HIT_RATE * 100).toFixed(1)}%  = (${WRITE_MULT}-1)/(${WRITE_MULT}-${READ_MULT}); above this, caching is net-cheaper on the prefix`);
  console.log(
    `  3. worst-case 0%-hit:   every call writes the prefix → ${WRITE_MULT}× base on cached input ` +
      `(i.e. +${((WRITE_MULT - 1) * 100).toFixed(0)}% vs no-cache on that prefix). Cold-burst risk (A1).`,
  );
  console.log('\nRaw numbers to Doug + both chats; not a verdict.');
}

await main();
