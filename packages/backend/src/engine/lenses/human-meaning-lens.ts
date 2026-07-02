import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type {
  LensPromptPayload,
  LensResponsePayload,
  LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';

// The Human Meaning Lens — the Evidence-wave sibling of the Listening Lens: "what
// might these comments mean at the human level?" (unmet needs, fears, hopes, identity
// and belonging signals, dignity concerns). Like Listening, it reads the cleared
// units DIRECTLY — not prior findings — so it ignores `priorFindings` (there are none
// above the Evidence wave anyway).
//
// As an Evidence sibling it runs against the SAME input (the cleared units) as
// Listening and never sees Listening's output — the orchestrator runs the Evidence
// wave against an empty prior-findings snapshot, so the two stay independent and
// parallelizable (the analog of the Aggregate pair's independence).
//
// Same rules as Listening: it emits findings anchored to the units it read, built
// through the factory (support derived, anchoring enforced); out-of-scope unit ids
// are dropped. Disposition stays HELD — promotion is the Discernment lens / human
// review's affirmative act. Finding ids are deterministic (`meaning:0`, ...).

const INSTRUCTION =
  'Surface what these comments might mean at the human level — unmet needs, fears, hopes, belonging and dignity signals. Return findings; each must cite the unit ids that support it.';

export class HumanMeaningLens implements Lens {
  readonly id = 'meaning';
  readonly wave: Wave = 'evidence';

  // Evidence wave: reads the cleared units directly, so it ignores `priorFindings`.
  async run(
    units: readonly Unit[],
    _priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    const payload: LensPromptPayload = {
      instruction: INSTRUCTION,
      units: units.map((u) => ({
        unitId: u.unitId,
        speakerToken: u.speakerToken,
        content: u.content,
      })),
    };

    const response = await provider.complete({ prompt: JSON.stringify(payload) });
    const parsed = JSON.parse(response.text) as LensResponsePayload;

    // A lens only ever anchors to the cleared units it was given; ignore any unit id
    // the model returned that is not in scope, so a hallucinated anchor cannot smuggle
    // its way in.
    const inScope = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    parsed.findings.forEach((candidate, index) => {
      const evidenceLinks = candidate.evidenceUnitIds.filter((id) => inScope.has(id));
      if (evidenceLinks.length === 0) {
        // No valid anchor — an ordinary finding cannot exist without one. The Human
        // Meaning lens deals only in evidence, so it drops it rather than inventing
        // an absence finding.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'meaning',
          verbatim: candidate.verbatim,
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}
