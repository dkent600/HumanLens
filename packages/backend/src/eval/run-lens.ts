import type { Unit } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';
import type { LlmProvider } from '../seams/llm-provider.js';
import { ANTHROPIC_MODEL } from '../seams/anthropic-llm-provider.js';
import { hasAnthropicKey, selectLlmProvider } from '../seams/select-llm-provider.js';
import { ListeningLens } from '../engine/lenses/listening-lens.js';

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
// tolerant parse, add ONE entry to LENS_RUNNERS. An Evidence-layer lens reads the units
// with an empty prior-findings snapshot (like Listening below); a later-layer lens would
// build representative prior findings first. Keep this the place prompts are tuned.

function clearedUnit(position: number, speakerToken: string, content: string, language = 'en'): Unit {
  return {
    unitId: `eval-u${position}`,
    engagementId: 'eng:eval',
    ingestedBy: 'actor:eval',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'eval-sample',
    position,
    language,
    content,
    deidStatus: 'cleared',
    speakerToken,
  };
}

// A small set of de-identified comments to eyeball against. spk-a appears twice, so
// honest support counting ("N units across M sources", M < N) is visible; one Spanish
// comment lets the real model's bilingual handling be eyeballed too.
const SAMPLE_UNITS: readonly Unit[] = [
  clearedUnit(0, 'spk-a', 'The workload has been heavy for months and it is hard to keep up.'),
  clearedUnit(1, 'spk-b', 'I do not feel safe raising concerns with my manager.'),
  clearedUnit(2, 'spk-a', 'Leadership talks about inclusion but I do not see it in daily decisions.'),
  clearedUnit(3, 'spk-c', 'My team genuinely supports each other, which makes a real difference.'),
  clearedUnit(4, 'spk-d', 'There is little follow-through after the feedback sessions.'),
  clearedUnit(5, 'spk-e', 'Nadie escucha de verdad cuando pedimos ayuda.', 'es'),
];

type LensRunner = (units: readonly Unit[], provider: LlmProvider) => Promise<readonly Finding[]>;

// Only lenses with a REAL system contract + tolerant parse belong here. Listening is the
// first; add the next as a sibling entry.
const LENS_RUNNERS: Record<string, LensRunner> = {
  listening: (units, provider) => new ListeningLens().run(units, [], provider),
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
    console.log(`  content:    ${finding.content}`);
    console.log(`  anchors:    ${finding.evidenceLinks.join(', ') || '(none)'}`);
    console.log(`  support:    ${finding.supportSet.unitCount} units / ${finding.supportSet.sourceCount} sources`);
    console.log(`  clientSafe: ${finding.clearedToClientSafe} (held by default)\n`);
  }
}

await main();
