import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import { makeOrdinaryFinding } from '../../domain/finding.js';
import {
  routeLlmResponse,
  type LensPromptPayload,
  type LensResponsePayload,
  type LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';

// The Action Opening Lens — the single lens of the terminal Openings wave: "what
// openings for next steps appear?" (possible workshop focus areas, leadership
// conversations, reflection prompts, follow-up inquiries). Not final recommendations
// — intelligent openings, prepared for the facilitator to weigh.
//
// It runs LAST, after the Guardrail wave, so it reads the AUDITED picture: its
// prior-findings snapshot is the full accumulated set as the Discernment Lens left
// it (dispositions already set). Forward-looking openings should be grounded in what
// survived the guardrail. Anchoring is unchanged: follow the prior findings'
// evidence_links back to units, validate against in-scope cleared units, drop
// out-of-scope ids, build through the factory (support derived, anchoring enforced).
//
// DISPOSITION (the deliberate consequence of running last). Because Discernment runs
// at the Guardrail wave — before this one — it never audits these openings, so
// nothing auto-promotes them: an Action Opening finding is HELD internal-only in V1.
// That is intended, not a gap. The disposition model names two affirmative promoters
// — the Discernment Lens OR human review — and openings' promoter is HUMAN REVIEW
// (deferred), not Discernment. The facilitator decides which openings, including any
// "client-safe next steps", to carry to the client; until human review exists, they
// stay held (the model's safe failure mode: silence, not exposure). This lens is NOT
// a promoter — Discernment stays the sole automated one. Finding ids: `opening:0`...

const INSTRUCTION =
  'Surface concrete openings for next steps that the prior findings point toward — not final recommendations. Anchor each opening to the unit ids behind the findings it draws on.';

export class OpeningLens implements Lens {
  readonly id = 'opening';
  readonly wave: Wave = 'openings';

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    // Openings are synthesized FROM prior findings; with none to build on, the lens
    // stays silent rather than straining over the raw units.
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

    // Non-natural finish (refusal / truncation / out-of-protocol) — do not parse.
    // Findings-level silence as ever; the accounting layer records this call
    // delivered-but-unusable, never answered-empty (G-1 routing; see listening-lens).
    if (routeLlmResponse(response).kind === 'unusable') {
      return [];
    }

    const parsed = JSON.parse(response.text) as LensResponsePayload;

    // An opening may only anchor to cleared units actually in scope: a unit id the
    // model invents — or one carried by a prior finding but absent from this run's
    // cleared set — cannot smuggle itself in.
    const inScope = new Set(units.map((u) => u.unitId));

    const findings: Finding[] = [];
    parsed.findings.forEach((candidate, index) => {
      const evidenceLinks = candidate.evidenceUnitIds.filter((id) => inScope.has(id));
      const noticing = candidate.noticing;
      if (evidenceLinks.length === 0 || noticing === undefined) {
        // No valid unit anchor (or no noticing text) — the anchoring invariant forbids
        // an unanchored ordinary finding, so the opening is dropped rather than asserted.
        // An interpretive lens emits its text as `noticing`, not `verbatim` (Model B).
        return;
      }
      findings.push(
        makeOrdinaryFinding({
          findingId: `${this.id}:${index}`,
          lens: 'opening',
          noticing,
          evidenceLinks,
          units,
        }),
      );
    });
    return findings;
  }
}
