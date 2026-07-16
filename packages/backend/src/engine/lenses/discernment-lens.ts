import type { Unit } from '../../domain/types.js';
import type { DispositionChange, Finding } from '../../domain/finding.js';
import { reviseDisposition } from '../../domain/finding.js';
import {
  routeLlmResponse,
  type DiscernmentResponsePayload,
  type LensPromptPayload,
  type LlmProvider,
} from '../../seams/llm-provider.js';
import type { Wave, Lens } from './lens.js';
import { toPromptFinding } from './prompt-projection.js';

// The Facilitator Discernment Lens — the Guardrail-wave lens. It runs LATE, after
// Evidence and Aggregate, so it can audit the findings they accumulated, and it is
// the thing that AFFIRMATIVELY promotes findings to the client-safe layer and flags
// findings as sensitive. After this, disposition comes from Discernment, not from a
// test helper.
//
// Mechanism (a Guardrail-stage privilege). Discernment does not mutate prior
// findings. It returns REVISED findings that reuse the prior finding_id, rebuilt
// through the domain factory (`reviseDisposition`), which re-derives the support set
// from the unchanged evidence and re-enforces anchoring — disposition is never
// hand-set. The staged orchestrator supersedes by finding_id ONLY for this stage;
// every other wave is pure-append, so revising another lens's finding stays the
// auditor's privilege rather than a general pipeline capability.
//
// Held-by-default is preserved as the ABSENCE of a verdict: a finding Discernment
// does not name keeps its held/normal disposition. Sensitivity remains a hard
// backstop at Assemble — a sensitive finding is held even when promoted.
//
// (Discernment's own caution-findings — internal notes about overreach or
// uncertainty — are a follow-on; this increment lands the disposition mechanism.)

const INSTRUCTION =
  'Audit the prior findings. Return a verdict only for a finding you clear to the client-safe layer or judge sensitive; leave the rest untouched (held by default).';

export class DiscernmentLens implements Lens {
  readonly id = 'discernment';
  readonly wave: Wave = 'guardrail';

  async run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]> {
    // Nothing accumulated yet -> nothing to audit (and nothing to promote: silence).
    if (priorFindings.length === 0) {
      return [];
    }

    const payload: LensPromptPayload = {
      task: 'disposition',
      instruction: INSTRUCTION,
      units: units.map((u) => ({
        unitId: u.unitId,
        speakerToken: u.speakerToken,
        content: u.content,
      })),
      priorFindings: priorFindings.map(toPromptFinding),
    };

    const response = await provider.complete({ prompt: JSON.stringify(payload) });

    // Non-natural finish (refusal / truncation / out-of-protocol) — do not parse. For
    // the audit this means NO revisions: every finding stays held by default, the safe
    // failure mode. The accounting layer records the call delivered-but-unusable,
    // never answered-empty (G-1 routing; see listening-lens).
    if (routeLlmResponse(response).kind === 'unusable') {
      return [];
    }

    const parsed = JSON.parse(response.text) as DiscernmentResponsePayload;

    const byId = new Map(priorFindings.map((f) => [f.findingId, f]));

    // One revised finding per verdict that names a finding actually in scope. A
    // verdict for an unknown id is ignored — it cannot conjure a finding. Each
    // revision reuses the prior finding_id, so the Guardrail-stage fold supersedes
    // the original in place; findings Discernment never names stay held by default.
    const revised: Finding[] = [];
    for (const verdict of parsed.verdicts) {
      const prior = byId.get(verdict.findingId);
      if (!prior) {
        continue;
      }
      const change: DispositionChange = {
        clearedToClientSafe: verdict.promote === true ? true : undefined,
        sensitivity: verdict.sensitive === true ? 'sensitive' : undefined,
      };
      revised.push(reviseDisposition(prior, change, units));
    }
    return revised;
  }
}
