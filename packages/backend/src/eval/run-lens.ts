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

// The deliberate eval fixture: 17 de-identified units, all with distinct speaker tokens,
// built to exercise the Listening contract (build_approach.md §1) — bilingual + mixed
// units (u5/u8/u13), recurrence across separate voices (workload: u0/u11; effort going
// unnoticed: u3/u15), within-voice structure drawn softly (u3 dash, u9 narrative
// sequence, u15 sequence), inference bait (u14 "since the reorg"), thin/empty units
// (u4/u10), and intentionally messy punctuation/casing (u16 — verbatim, do not correct).
const SAMPLE_UNITS: readonly Unit[] = [
  clearedUnit(0, 'spk-a', 'The workload has been heavy for months and it\'s hard to keep up.'),
  clearedUnit(1, 'spk-b', 'When I raise something with leadership, I genuinely feel heard and they act on it.'),
  clearedUnit(2, 'spk-c', 'I\'ve heard remarks about my accent in meetings, and it makes me wonder whether I belong.'),
  clearedUnit(3, 'spk-d', 'I\'ve stopped putting in extra effort — it just goes unnoticed.'),
  clearedUnit(4, 'spk-e', 'Things are fine, I guess.'),
  clearedUnit(5, 'spk-f', 'No me siento seguro compartiendo lo que realmente pienso en las reuniones.', 'es'),
  clearedUnit(6, 'spk-g', 'The new onboarding process is a real improvement, and the third-floor kitchen has been out of order for weeks.'),
  clearedUnit(7, 'spk-h', 'Honestly, my own manager has been great about flexibility — that part works well for me.'),
  clearedUnit(8, 'spk-i', 'Siempre vamos contrarreloj y nadie parece notar que estamos al límite.', 'es'),
  clearedUnit(9, 'spk-j', 'After I disclosed a health condition, I noticed the interesting work quietly dried up.'),
  clearedUnit(10, 'spk-k', 'No comment.'),
  clearedUnit(11, 'spk-l', 'We\'re constantly running at capacity; I can\'t remember the last time things felt sustainable.'),
  clearedUnit(12, 'spk-m', 'Leadership says the right things but nothing changes when you actually speak up.'),
  clearedUnit(13, 'spk-n', 'They keep promising change pero al final todo sigue igual.', 'mixed'),
  clearedUnit(14, 'spk-o', 'Things haven\'t been the same since the reorg.'),
  clearedUnit(15, 'spk-p', 'I used to put in real effort. Two years of it going unnoticed. Now I just do the minimum.'),
  clearedUnit(16, 'spk-q', 'the training got rushed half of us are still just guessing'),
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
    console.log(`  verbatim:   ${finding.verbatim ?? '(none — absence finding)'}`);
    if (finding.translation !== undefined) {
      console.log(`  translation:${finding.translation} [from ${finding.sourceLanguage}]`);
    }
    console.log(`  anchors:    ${finding.evidenceLinks.join(', ') || '(none)'}`);
    console.log(`  support:    ${finding.supportSet.unitCount} units / ${finding.supportSet.sourceCount} sources`);
    console.log(`  clientSafe: ${finding.clearedToClientSafe} (held by default)\n`);
  }
}

await main();
