import type { Unit } from '../domain/types.js';
import type { UnitRepository } from '../seams/repository.js';
import {
  FakeLlmProvider,
  defaultFakeResponse,
  type LensPromptPayload,
  type FakeLensResponse,
} from '../seams/llm-provider.js';
import { ASSUMED_ACTOR } from '../composition-root.js';

// The dev/demo fixture. It exists ONLY to give the read slice something to render
// before an intake path exists. It is imported by the bootstrap (`index.ts`) and
// NOTHING else — in particular never by `composition-root.ts`, so `buildContainer()`
// stays the silent default and the held-by-default proofs keep passing.
//
// This grows NO intake path: no POST units, no draft units, no de-id scan. It seeds
// already-de-identified, already-CLEARED units straight into the repository (the
// human-confirmed de-id checkpoint is assumed done upstream), which is all the read
// path needs.

/** The single demo engagement the read slice renders. The frontend hardcodes this same id (temporary, until intake/selection lands). */
export const FIXTURE_ENGAGEMENT_ID = 'eng:fixture-listening-brief';

// A handful of de-identified comments. Two share a speaker token (spk-a), so support
// counts honestly as "N units across M sources" with M < N — never "N people".
const FIXTURE_COMMENTS: readonly { speakerToken: string; content: string }[] = [
  { speakerToken: 'spk-a', content: 'The workload has been heavy lately and it is hard to keep up.' },
  { speakerToken: 'spk-b', content: 'I do not feel comfortable raising concerns with my manager.' },
  { speakerToken: 'spk-a', content: 'Leadership talks about inclusion but I do not see it in daily decisions.' },
  { speakerToken: 'spk-c', content: 'My team genuinely supports each other, which makes a real difference.' },
  { speakerToken: 'spk-d', content: 'There is not much follow-through after the feedback sessions.' },
];

/** Seed the fixture engagement's cleared units into the repository. */
export async function seedFixtureEngagement(repo: UnitRepository): Promise<void> {
  const scope = { engagementId: FIXTURE_ENGAGEMENT_ID, actor: ASSUMED_ACTOR };
  let position = 0;
  for (const comment of FIXTURE_COMMENTS) {
    const unit: Unit = {
      unitId: `fixture-u${position}`,
      engagementId: FIXTURE_ENGAGEMENT_ID,
      ingestedBy: ASSUMED_ACTOR.id,
      ingestedAt: '2026-01-01T00:00:00.000Z',
      sourceRef: 'fixture-survey',
      position,
      language: 'en',
      content: comment.content,
      deidStatus: 'cleared', // seeded already-cleared; the gate's checkpoint is assumed done
      speakerToken: comment.speakerToken,
    };
    await repo.saveUnit(scope, unit);
    position += 1;
  }
}

// The findings these fixture comments synthesize into. Per-voice fan-out: Listening emits
// one finding PER unit (listening:0-0 … listening:4-0) and Human Meaning one per voice
// (meaning:0-0 …); the Aggregate+ lenses are batched (tension:0, culture:0, objective:0,
// opening:0). We promote the first per-voice pair plus tension:0 to demo a proper subset.
const FIXTURE_PROMOTE: readonly string[] = ['listening:0-0', 'meaning:0-0', 'tension:0'];
const FIXTURE_SENSITIVE: readonly string[] = ['meaning:0-0'];

/**
 * The fixture's promoting fake. It drives the emit lenses with the default behavior,
 * but scripts the Discernment audit to demonstrate a PROPER-SUBSET client-safe layer:
 *
 *   - promotes listening:0-0, meaning:0-0, tension:0;
 *   - flags meaning:0-0 sensitive — so it is promoted BUT held back by the sensitivity
 *     backstop at Assemble;
 *   - leaves every other finding held (held by default).
 *
 * Result: the engine holds many findings internally (5 Listening + 5 Meaning + the batched
 * Aggregate/Interpret/Openings); the client sees 2 (listening:0-0, tension:0). The render
 * visibly shows client-safe ⊊ internal — the client sees fewer than the engine holds.
 *
 * Lives here, not in `buildContainer`: the bootstrap passes it in explicitly.
 */
export function fixtureLlmProvider(): FakeLlmProvider {
  return new FakeLlmProvider((payload: LensPromptPayload): FakeLensResponse => {
    if (payload.task === 'disposition') {
      return {
        verdicts: (payload.priorFindings ?? [])
          .filter((f) => FIXTURE_PROMOTE.includes(f.findingId) || FIXTURE_SENSITIVE.includes(f.findingId))
          .map((f) => ({
            findingId: f.findingId,
            promote: FIXTURE_PROMOTE.includes(f.findingId),
            sensitive: FIXTURE_SENSITIVE.includes(f.findingId),
          })),
      };
    }
    return defaultFakeResponse(payload);
  });
}
