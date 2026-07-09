import type { Unit } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';
import type { LlmProvider } from '../seams/llm-provider.js';
import { ANTHROPIC_MODEL } from '../seams/anthropic-llm-provider.js';
import { hasAnthropicKey, selectLlmProvider } from '../seams/select-llm-provider.js';
import { ListeningLens } from '../engine/lenses/listening-lens.js';
import { HumanMeaningLens } from '../engine/lenses/human-meaning-lens.js';

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

// The deliberate eval fixture: 25 de-identified units, all with distinct speaker tokens.
//
// LISTENING contract (build_approach.md §1) — bilingual + mixed units (u5/u8/u13),
// recurrence across separate voices (workload: u0/u11; effort going unnoticed: u3/u15),
// within-voice structure drawn softly (u3 dash, u9 narrative sequence, u15 sequence),
// inference bait (u14 "since the reorg"), thin/opaque units (u4/u10), intentionally messy
// punctuation/casing (u16 — verbatim, do not correct), and an authored terse token (u17
// "n/a" — SURFACED verbatim). The surfacing bar is "did the person author an utterance?",
// so ONLY non-authored structural emptiness (empty/whitespace) drops — of which this
// fixture has none; every authored voice surfaces.
//
// HUMAN MEANING probes (build_approach.md "The Human Meaning Lens" — the eight outputs +
// the flag-don't-read principle). The eight, and where each has a clear occasion:
//   unmet needs        u0, u3, u8, u11, u12, u16
//   fears              u5, u9, u16
//   hopes              u18 (clean) — was thin (u1/u6/u13 lean trust/mixed/fading)
//   identity concerns  u22 (clean); u2 (bundled w/ belonging+dignity)
//   belonging signals  u23 (clean); u2 (bundled)
//   trust signals      u1, u7 (+), u12, u13 (−)
//   dignity concerns   u24 (clean); u9, u2 (bundled)
//   pain / aspiration  pain: u0, u8, u11, u15; ASPIRATION: u19 (clean) — u15 entangles pain+aspiration
// Each of the eight now has a clean single-category occasion; u2/u9 stay bundled ON PURPOSE
// (they probe multi-category surfacing — one voice yielding several noticings).
// RESTRAINT controls — correct behavior is NOT to manufacture meaning:
//   u4  mildly hedged ("things are fine, I guess") — must NOT become "lack of safety"
//   u17 flag-class ("n/a") — must stay flag-for-exploration, not interpreted
//   u20 neutral/administrative — no human-meaning category; must not be read into
//   u21 positive low-stakes — benign; must not be twisted into a hidden concern
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
  clearedUnit(17, 'spk-r', 'n/a'),
  // ── Human Meaning coverage voices (clean, largely single-category) ──
  // u18 — HOPE (forward-looking optimism, not entangled with a concern).
  clearedUnit(18, 'spk-s', 'Honestly, I\'m hopeful about the direction we\'re heading — it finally feels like things are starting to move.'),
  // u19 — ASPIRATION (a moment of aspiration: a personal desire to grow, not pain-entangled like u15).
  clearedUnit(19, 'spk-t', 'What I\'d really love is a chance to take on more mentoring — that\'s the work that makes me feel most alive here.'),
  // ── Human Meaning restraint / over-reach controls (correct behavior is NOT to manufacture meaning) ──
  // u20 — NEUTRAL / ADMINISTRATIVE: readable but carries no human-meaning-level category; must not be
  // read into (e.g. "logistics focus signals disengagement" would be over-reach).
  clearedUnit(20, 'spk-u', 'I usually come in on the 8:15 bus and head out around five.'),
  // u21 — POSITIVE, LOW-STAKES: genuinely benign; must not be twisted into a hidden concern.
  clearedUnit(21, 'spk-v', 'The new coffee machine in the break room is a nice little upgrade — no complaints from me.'),
  // ── Clean singles for the bundled three (dominant target, minimal spillover; u2/u9 stay bundled) ──
  // u22 — IDENTITY concerns (assumptions tied to who someone is / where they're from).
  clearedUnit(22, 'spk-w', 'There\'s an assumption I\'ll naturally handle anything tied to my culture — like where I\'m from decides what I get put on.'),
  // u23 — BELONGING signals (being on the inside or outside; fitting in).
  clearedUnit(23, 'spk-x', 'Everyone else already seems to have their people here; I still feel like I\'m on the outside looking in.'),
  // u24 — DIGNITY concerns (being talked over / treated as less-than).
  clearedUnit(24, 'spk-y', 'I\'ll make a point in a meeting and get talked right over — then a minute later someone says the same thing and everyone nods.'),
];

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
