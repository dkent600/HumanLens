import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type {
  LensPromptPayload,
  LensResponsePayload,
  LlmProvider,
} from '../../seams/llm-provider.js';
import type { Lens } from './lens.js';

// The Listening Lens — the first Evidence-layer lens: "what are people actually
// saying?" (repeated themes, direct concerns, representative quotes). It reads
// the cleared units directly.
//
// Its job in this slice is to prove the path units -> (model) -> evidence-anchored
// findings, not to be a finished prompt. It:
//   1. serializes the units into the shared lens-prompt convention;
//   2. asks the provider (a real model later; the deterministic fake for now);
//   3. parses the candidates and builds each into an anchored Finding via the
//      domain factory, which DERIVES support and enforces evidence anchoring.
//
// Disposition is left at its default (HELD): an Evidence-layer lens does not
// promote findings to the client-safe layer. That is an affirmative act for the
// Discernment lens / human review (both deferred). Finding ids are deterministic
// (`listening:0`, ...) to keep the slice reproducible.

const INSTRUCTION =
  'Surface what people are actually saying. Return findings; each must cite the unit ids that support it.';

export class ListeningLens implements Lens {
  readonly id = 'listening';

  async run(units: readonly Unit[], provider: LlmProvider): Promise<readonly Finding[]> {
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

    // A lens only ever anchors to the cleared units it was given; ignore any unit
    // id the model returned that is not in scope, so a hallucinated anchor cannot
    // smuggle its way in.
    const inScope = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    parsed.findings.forEach((candidate, index) => {
      const evidenceLinks = candidate.evidenceUnitIds.filter((id) => inScope.has(id));
      if (evidenceLinks.length === 0) {
        // No valid anchor — an ordinary finding cannot exist without one. The
        // Listening lens deals only in evidence, so it drops it rather than
        // inventing an absence finding.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'listening',
          content: candidate.content,
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}
