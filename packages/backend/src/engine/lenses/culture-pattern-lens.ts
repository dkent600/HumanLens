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

// The Culture Pattern Lens — the Aggregate-wave sibling of the Tension Lens:
// "what patterns appear across the group or organization?" (recurring dynamics,
// contradictions, gaps between stated values and lived experience). Like Tension,
// it reads the PRIOR (Evidence-wave) findings and works across them.
//
// Same shape, same rules as Tension: it still anchors to UNITS, not to findings —
// it follows each prior finding back to the units behind it and links its pattern
// to those units, so the evidence-anchoring invariant holds for this interpretive
// output too. Out-of-scope unit ids are dropped; findings are built through the
// factory, so support is derived and anchoring enforced.
//
// As an Aggregate sibling it runs against the SAME Evidence snapshot as Tension and
// never sees Tension's output (the orchestrator's snapshot-per-wave semantics) —
// the two stay independent and parallelizable. Disposition stays HELD: promotion is
// Discernment's job. Finding ids are deterministic (`culture:0`, ...).

const INSTRUCTION =
  'Surface a recurring culture pattern across the prior findings — a dynamic, contradiction, or gap between stated values and lived experience. Anchor it to the unit ids behind those findings.';

export class CulturePatternLens implements Lens {
  readonly id = 'culture';
  readonly wave: Wave = 'aggregate';

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    // A pattern is synthesized FROM prior findings; with none to work from, the lens
    // stays silent rather than straining over the raw units. This also makes its
    // dependence on the prior stage observable and deterministic.
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
        // ordinary finding, so the pattern is dropped rather than asserted.
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'culture',
          verbatim: candidate.verbatim,
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}
