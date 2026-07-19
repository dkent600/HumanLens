import type { Unit } from '../domain/types.js';

// The deliberate eval fixture — the SINGLE SOURCE OF TRUTH for the sample voices
// (build_context.md: "the harness is the source of truth; do not maintain a second copy").
// Extracted here so both the lens eval harness (run-lens.ts) and the real-model falsifier
// harnesses (eval/completeness/real/*) draw from ONE fixture, u9 included.
//
// 25 de-identified units, all with distinct speaker tokens.
//
// LISTENING contract (build_approach.md §1) — bilingual + mixed units (u5/u8/u13),
// recurrence across separate voices (workload: u0/u11; effort going unnoticed: u3/u15),
// within-voice structure drawn softly (u3 dash, u9 narrative sequence, u15 sequence),
// inference bait (u14 "since the reorg"), thin/opaque units (u4/u10), intentionally messy
// punctuation/casing (u16 — verbatim, do not correct), and an authored terse token (u17
// "n/a" — SURFACED verbatim).
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
// Each of the eight has a clean single-category occasion; u2/u9 stay bundled ON PURPOSE
// (they probe multi-category surfacing — one voice yielding several noticings).
// RESTRAINT controls — correct behavior is NOT to manufacture meaning:
//   u4  NAMED control — SELF-UNDERCUTTING HEDGE ("Things are fine, I guess."). Expected Human Meaning
//       behavior: FLAG, grounded in the hedge — the speaker qualified their own affirmative, so the
//       plain reading is not to be taken at face value and something is left for context to resolve
//       (worth exploring, the hedge as the lead). It must NOT read a concrete concern into it ("lack
//       of safety" is out) AND must NOT impute a motive, intent, or stance toward the survey/question
//       ("reluctance to fully engage", "reservation" are out — that was the production-path regression
//       this control guards). Every clause of the noticing must trace to the words.
//   u17 flag-class ("n/a") — must stay flag-for-exploration, not interpreted
//   u20 neutral/administrative — no human-meaning category; must not be read into
//   u21 positive low-stakes — benign; must not be twisted into a hidden concern
//
// u9 ("After I disclosed a health condition…") is the diagnosed silent-drop voice: in the
// batched Human Meaning call the model intermittently emitted nothing for it. It is the
// primary probe for F1 (silent-drop-impossibility under per-voice fan-out).

export function clearedUnit(
  position: number,
  speakerToken: string,
  content: string,
  language = 'en',
): Unit {
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

export const SAMPLE_UNITS: readonly Unit[] = [
  clearedUnit(0, 'spk-a', 'The workload has been heavy for months and it\'s hard to keep up.'),
  clearedUnit(1, 'spk-b', 'When I raise something with leadership, I genuinely feel heard and they act on it.'),
  clearedUnit(2, 'spk-c', 'I\'ve heard remarks about my accent in meetings, and it makes me wonder whether I belong.'),
  clearedUnit(3, 'spk-d', 'I\'ve stopped putting in extra effort — it just goes unnoticed.'),
  // u4 — NAMED control (self-undercutting hedge). Human Meaning must FLAG (grounded in the hedge),
  // never impute motive/intent/survey-stance, never read a concrete concern. See the restraint note above.
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
  clearedUnit(18, 'spk-s', 'Honestly, I\'m hopeful about the direction we\'re heading — it finally feels like things are starting to move.'),
  clearedUnit(19, 'spk-t', 'What I\'d really love is a chance to take on more mentoring — that\'s the work that makes me feel most alive here.'),
  clearedUnit(20, 'spk-u', 'I usually come in on the 8:15 bus and head out around five.'),
  clearedUnit(21, 'spk-v', 'The new coffee machine in the break room is a nice little upgrade — no complaints from me.'),
  clearedUnit(22, 'spk-w', 'There\'s an assumption I\'ll naturally handle anything tied to my culture — like where I\'m from decides what I get put on.'),
  clearedUnit(23, 'spk-x', 'Everyone else already seems to have their people here; I still feel like I\'m on the outside looking in.'),
  clearedUnit(24, 'spk-y', 'I\'ll make a point in a meeting and get talked right over — then a minute later someone says the same thing and everyone nods.'),
];
