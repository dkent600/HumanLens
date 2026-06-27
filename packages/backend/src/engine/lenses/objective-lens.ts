import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type {
  LensPromptPayload,
  LensResponsePayload,
  LlmProvider,
  ObjectiveFrame,
} from '../../seams/llm-provider.js';
import type { Layer, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';

// The Inclusity Objective Lens — the first lens in the Interpret layer: "why does
// this matter for Inclusity's work?" It maps what earlier layers found onto
// Inclusity's objectives (the climate-survey domains and the PROSCI/ADKAR change
// vocabulary). It is one half of the cross-module shared core (Objective +
// Discernment) that keeps the whole system Inclusity-specific rather than generic.
//
// Its real dependency is the AGGREGATE layer: it interprets the patterns and
// tensions those lenses surfaced. Structurally its prior-findings snapshot is
// Evidence + Aggregate (every layer above it), and its output is a function of what
// is in that snapshot — add an Aggregate finding and the interpretation reaches the
// units behind it. Anchoring is unchanged: follow the prior findings' evidence_links
// back to units, validate against in-scope cleared units, drop out-of-scope ids,
// build through the factory (support derived, anchoring enforced).
//
// The objective context it calibrates against is a PLACEHOLDER in V1 — the real
// Inclusity objectives (survey domains + ADKAR values) arrive with the V3 context
// work. The frame's shape is wired through the prompt now so the Interpret layer is
// proven structurally; its values are filled later. Disposition stays HELD —
// promotion is Discernment's job. Finding ids are deterministic (`objective:0`, ...).

const INSTRUCTION =
  'Interpret the prior findings — especially the patterns and tensions — against the Inclusity objective frame. Anchor each interpretation to the unit ids behind the findings it draws on.';

// Empty stub: objectives are not wired until V3. Carried through the prompt so the
// Interpret layer threads the objective context structurally even while empty.
const PLACEHOLDER_OBJECTIVE_FRAME: ObjectiveFrame = {
  surveyDomains: [],
  adkarDimensions: [],
};

export class ObjectiveLens implements Lens {
  readonly id = 'objective';
  readonly layer: Layer = 'interpret';

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    // The interpretation is synthesized FROM prior findings; with none to interpret,
    // the lens stays silent rather than straining over the raw units.
    if (priorFindings.length === 0) {
      return [];
    }

    const payload: LensPromptPayload = {
      instruction: INSTRUCTION,
      units: units.map((u) => ({
        unitId: u.unitId,
        speakerToken: u.speakerToken,
        content: u.content,
      })),
      priorFindings: priorFindings.map(toPromptFinding),
      objectiveFrame: PLACEHOLDER_OBJECTIVE_FRAME,
    };

    const response = await provider.complete({ prompt: JSON.stringify(payload) });
    const parsed = JSON.parse(response.text) as LensResponsePayload;

    // Even an interpretive lens may only anchor to cleared units actually in scope:
    // a unit id the model invents — or one carried by a prior finding but absent
    // from this run's cleared set — cannot smuggle itself in.
    const inScope = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    parsed.findings.forEach((candidate, index) => {
      const evidenceLinks = candidate.evidenceUnitIds.filter((id) => inScope.has(id));
      if (evidenceLinks.length === 0) {
        // No valid unit anchor — the anchoring invariant forbids an unanchored
        // ordinary finding, so the interpretation is dropped rather than asserted.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'objective',
          verbatim: candidate.verbatim,
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}
