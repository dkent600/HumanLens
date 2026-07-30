import type { Unit } from '../domain/types.js';

// The deliberate eval fixture — the SINGLE SOURCE OF TRUTH for the sample voices
// (build_context.md: "the harness is the source of truth; do not maintain a second copy").
// Extracted here so both the lens eval harness (run-lens.ts) and the real-model falsifier
// harnesses (eval/completeness/real/*) draw from ONE fixture, u9 included.
//
// 35 de-identified units. Most carry a distinct speaker token; the INTERVIEW passages
// u29-u31 deliberately SHARE one (spk-int1), so honest source-counting ("N units across M
// sources, never N people") has something to bite on. u0-u24 are the original per-voice
// (Human Meaning) fixture, UNCHANGED; u25-u34 were added to exercise the cross-voice
// (Culture Pattern) lens — see the CULTURE PATTERN probe map below.
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
//
// CULTURE PATTERN probes (build_approach.md §3 — the five cross-voice outputs). u25-u34 were
// added so a cross-voice lens has genuine patterns to find AND a testable residual. The five
// outputs, and where each has an occasion:
//   recurring dynamics       workload (u0, u8, u11, u29, u30); effort-unrecognized / pulling
//                            back (u3, u15, u31); leadership-says-not-does (u12, u13, u26, u30)
//   contradictions           EASY/direct (existing): u1 "feel heard, they act" vs u12/u13
//                            "nothing changes". HARDER — the SAME condition experienced
//                            oppositely: u7 (flexibility works for me) vs u28 (flexibility left
//                            me off the radar); u27 (speaking up landed) vs u26 (speaking up went
//                            nowhere). Harder because it is not a counter-statement on one claim.
//   values-vs-lived gaps     STATED value present: u25 quotes the "door is always open / every
//                            voice matters" leadership language; lived experience CONTRADICTS it
//                            (u26 went nowhere; u12, u13) AND is CONSISTENT with it (u27, u1) — the
//                            gap on one side, alignment on the other. (The original corpus had no
//                            unit that STATES a value, so this gap could not exist before.)
//   repeated leadership /    u25 (town-hall "open door" language) is a stated culture signal;
//     culture signals        echoed by u12 ("leadership says the right things"), u13 (promising
//                            change) — a repeated leadership-language signal across voices.
//   experience differs       OUT OF SCOPE — no segment dimension yet (the type-specific extension
//     across groups          hasn't landed; V1 counts sources by speaker_token only). Culture
//                            Pattern should OMIT cross-group comparison on this segment-less
//                            material, per capability-matching — NOT invent one. If a real-model
//                            run invents a cross-group difference here, that is a finding to report.
//
// MULTI-UNIT SPEAKER (honest counting): spk-int1 = u29, u30, u31 (interview passages, one person).
// A pattern citing two of them counts ONE source, not two — e.g. workload across u0/u11/u29/u30 is
// "4 units across 3 sources", never "4 people".
//
// PLANTED ISOLATES (the testable residual): u32 (expense-system friction), u33 (a well-run
// volunteer day), u34 (all-hands scheduled at a bad timezone). Each is substantive and real but
// thematically ALONE — no other voice shares its subject — so it legitimately belongs to no
// pattern and should land in the cited-or-residual RESIDUAL. Documenting them is what lets a
// caught isolate be told apart from an arbitrary omission.

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

  // ── CROSS-VOICE (Culture Pattern) voices — see the CULTURE PATTERN probe map above ──
  // u25 — STATED VALUE (leadership/culture language): the anchor for a values-vs-lived gap and a
  // repeated leadership signal. A real human voice REPORTING the stated commitment (not a policy doc).
  clearedUnit(25, 'spk-z', 'At every town hall, leadership tells us the door is always open and that no concern is too small to raise.'),
  // u26 — LIVED, CONTRADICTS the stated open-door value (a stated intent contradicted by a described
  // CONSEQUENCE, not a counter-statement — the harder shape of contradiction).
  clearedUnit(26, 'spk-aa', 'I took that literally and raised a real problem with my skip-level — it went nowhere and was never mentioned again.'),
  // u27 — LIVED, CONSISTENT with the same open-door value. With u26 this is the SAME commitment
  // experienced oppositely by two people (alignment on one side, gap on the other).
  clearedUnit(27, 'spk-ab', 'When I pushed back in a review, my director actually changed the plan — so where I sit, speaking up does land.'),
  // u28 — HARDER contradiction: the SAME condition (the flexible/remote setup) experienced as good by
  // u7 and as a problem here — no counter-claim, just the same thing landing differently.
  clearedUnit(28, 'spk-ac', 'The flexible remote setup is great for some people, but for me it\'s meant I\'ve quietly dropped off everyone\'s radar.'),
  // u29-u31 — INTERVIEW passages, ONE speaker (spk-int1): multi-unit source for honest counting.
  // They reinforce existing recurrences (workload / leadership-inaction / pulling-back) but as ONE person.
  clearedUnit(29, 'spk-int1', 'Honestly the pace this year has been relentless — we\'ve been two people short since spring and just absorbed it.'),
  clearedUnit(30, 'spk-int1', 'I\'ve raised the staffing gap with my lead more than once; the answer is always that the budget\'s frozen.'),
  clearedUnit(31, 'spk-int1', 'I still care about the work, but I\'ve started protecting my evenings in a way I never used to.'),
  // u32-u34 — PLANTED ISOLATES: substantive and real, but each thematically ALONE (no sibling voice),
  // so they belong to no pattern and should land in the RESIDUAL.
  clearedUnit(32, 'spk-ad', 'The new expense-reporting system takes three times as long as the old one — I dread submitting anything now.'),
  clearedUnit(33, 'spk-ae', 'The volunteer day the company organized last month was genuinely well run and meant a lot to me.'),
  clearedUnit(34, 'spk-af', 'The all-hands keeps getting set for 8am Pacific, so half the East Coast team is checked out before it even starts.'),
];
