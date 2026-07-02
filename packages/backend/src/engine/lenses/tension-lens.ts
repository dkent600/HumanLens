import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import type {
  LensPromptPayload,
  LensResponsePayload,
  LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';

// The Tension Lens — an Aggregate-wave lens: "what tensions should a facilitator
// notice?" It is the first lens that reads PRIOR findings rather than units alone:
// it works from the findings the Evidence wave produced and surfaces a tension
// between them.
//
// Crucially it still anchors to UNITS, not to findings. It follows each prior
// finding back to the units behind it and links its tension to those units, so the
// evidence-anchoring invariant holds for interpretive output, not just for the
// Evidence lens: an inferred tension with no unit anchor is a defect, never trusted
// for what the prompt "probably did". (Finding→finding provenance is a deferred
// open item in build_context.md; the spec anchors interpretive findings to units.)
//
// Disposition stays HELD: promotion to the client-safe layer is the Discernment
// lens / human review's affirmative act, not a lens concern at this stage. Finding
// ids are deterministic (`tension:0`, ...) to keep the staged pipeline reproducible.

const INSTRUCTION =
  'Surface a tension a facilitator should notice across the prior findings. Anchor it to the unit ids behind those findings.';

export class TensionLens implements Lens {
  readonly id = 'tension';
  readonly wave: Wave = 'aggregate';

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    // A tension is synthesized FROM prior findings; with none to work from, the
    // lens stays silent rather than straining over the raw units. This is also what
    // makes its dependence on the prior stage observable and deterministic.
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
        // ordinary finding, so the tension is dropped rather than asserted.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'tension',
          verbatim: candidate.verbatim,
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}
