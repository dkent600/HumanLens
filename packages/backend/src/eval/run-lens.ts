import type { Unit } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';
import type { LlmProvider } from '../seams/llm-provider.js';
import { ANTHROPIC_MODEL } from '../seams/anthropic-llm-provider.js';
import { hasAnthropicKey, selectLlmProvider } from '../seams/select-llm-provider.js';
import { ListeningLens } from '../engine/lenses/listening-lens.js';
import { HumanMeaningLens } from '../engine/lenses/human-meaning-lens.js';
import { SAMPLE_UNITS } from './sample-units.js';

// Dev / eval harness — the manual path for eyeballing REAL model output on ONE lens,
// the loop where a lens's prompt gets tuned. It is NOT part of the server: buildContainer
// and the running app stay on the fake; only this entry point selects the real provider.
//
//   Build + run (from packages/backend):  npm run eval -- listening
//   The npm script loads packages/backend/.env if present (--env-file-if-exists), so
//   Doug's local ANTHROPIC_API_KEY is picked up automatically. With no key it falls back
//   to the deterministic fake, so the harness still runs end to end (just not the model).
//
// EXTENDING TO THE NEXT LENS: when a sibling lens gets its own real system contract +
// tolerant parse, add ONE entry to LENS_RUNNERS. An Evidence-wave lens reads the units
// with an empty prior-findings snapshot (like Listening below); a later-wave lens builds
// representative prior findings first (like `meaning`, which runs Listening for real to
// get the voices, then interprets them). Keep this the place prompts are tuned.

// The eval fixture (SAMPLE_UNITS) lives in ./sample-units.ts — the single source of truth,
// shared with the real-model falsifier harnesses. See that file for the per-unit rationale
// (Listening contract probes, the eight Human Meaning outputs + restraint controls, u9).

type LensRunner = (units: readonly Unit[], provider: LlmProvider) => Promise<readonly Finding[]>;

// Only lenses with a REAL system contract + tolerant parse belong here. Listening is the
// first; add the next as a sibling entry.
const LENS_RUNNERS: Record<string, LensRunner> = {
  listening: (units, provider) => new ListeningLens().run(units, [], provider),
  // Meaning is INTERPRETIVE and reads the Listening findings, so build them first (for
  // real) and then interpret each voice. The bilingual SAMPLE_UNITS carry Spanish (u5,
  // u8) and mixed (u13) voices, so the translation path is exercised end to end here: the
  // Spanish lives in the underlying Listening finding's verbatim/translation, and Human
  // Meaning's noticing comes back in English (Item 9, EN/ES).
  meaning: async (units, provider) => {
    const listeningFindings = await new ListeningLens().run(units, [], provider);
    return new HumanMeaningLens().run(units, listeningFindings, provider);
  },
};

async function main(): Promise<void> {
  const lensName = process.argv[2] ?? 'listening';
  const runner = LENS_RUNNERS[lensName];
  if (!runner) {
    console.error(`Unknown lens "${lensName}". Available: ${Object.keys(LENS_RUNNERS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const usingReal = hasAnthropicKey();
  console.log(`Lens:     ${lensName}`);
  console.log(`Provider: ${usingReal ? `real Anthropic model (${ANTHROPIC_MODEL})` : 'deterministic fake (no ANTHROPIC_API_KEY found)'}`);
  console.log(`Units:    ${SAMPLE_UNITS.length}`);
  for (const unit of SAMPLE_UNITS) {
    console.log(`  [${unit.unitId}] (${unit.speakerToken}, ${unit.language}) ${unit.content}`);
  }
  console.log('');

  const findings = await runner(SAMPLE_UNITS, selectLlmProvider());

  console.log(`${findings.length} finding(s):\n`);
  for (const finding of findings) {
    console.log(`[${finding.findingId}] (${finding.lens})`);
    // Model B: a surfacing finding carries verbatim, an interpretive one a noticing.
    if (finding.noticing !== null) {
      console.log(`  noticing:   ${finding.noticing}`);
    } else {
      console.log(`  verbatim:   ${finding.verbatim ?? '(none — absence finding)'}`);
    }
    if (finding.translation !== undefined) {
      console.log(`  translation:${finding.translation} (translated from ${finding.sourceLanguage})`);
    }
    console.log(`  anchors:    ${finding.evidenceLinks.join(', ') || '(none)'}`);
    console.log(`  support:    ${finding.supportSet.unitCount} units / ${finding.supportSet.sourceCount} sources`);
    console.log(`  clientSafe: ${finding.clearedToClientSafe} (held by default)\n`);
  }
}

await main();
