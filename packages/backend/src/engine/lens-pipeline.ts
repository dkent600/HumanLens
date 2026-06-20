import type { Finding } from '../domain/finding.js';
import type { LlmProvider } from '../seams/llm-provider.js';
import type { Scope } from '../seams/repository.js';
import type { DeidGate } from './deid-gate.js';
import { LAYER_ORDER, type Layer, type Lens } from './lenses/lens.js';
import { assembleBrief, type AssembledBrief } from './assemble.js';

// The lens-processing spine as a STAGED pipeline (build_approach.md, "Lens
// processing: a staged pipeline"):
//
//   gate.clearedUnitsForLenses
//     -> layer by layer in LAYER_ORDER
//          each lens reads (cleared units, findings of PRIOR layers)
//          findings accumulate across stages
//     -> Assemble
//
// It sources units EXCLUSIVELY from the de-id gate, so material that went around
// the gate can never reach the lenses. The lenses are grouped by their declared
// layer and the layers run in the fixed dependency order — so the structure is the
// real five-layer staging, not a flat pass, even though only the Evidence and
// Aggregate layers are populated so far.
//
// The load-bearing detail is the SNAPSHOT taken per layer: every lens in a layer
// reads the same prior-layer findings and never each other's output. That is what
// keeps within-layer lenses independent and (later) parallelizable; for now they
// run sequentially — concurrency is deferred, finding-passing between stages is the
// point. Findings accumulate into the brief in layer order.
//
// One stage folds differently: the GUARDRAIL stage (the Facilitator Discernment
// Lens) may REVISE a prior finding's disposition, which it expresses by emitting a
// finding that reuses the prior finding_id. So Guardrail output supersedes by
// finding_id (replace in place; a new id still appends), while every other layer is
// pure-append. Revising another lens's finding is the auditor's privilege, not a
// general pipeline capability — scoping it here keeps an accidental id collision
// elsewhere a visible append rather than a silent drop on the path that gates
// client exposure. (The revision itself is a new object built through the domain
// factory, so findings stay immutable and support stays honest.)
//
// This is plain TypeScript — no Fastify, no DB, no provider concretion — runnable
// directly from a test or a small harness with no server running.

export class LensPipeline {
  constructor(
    private readonly gate: DeidGate,
    private readonly provider: LlmProvider,
    private readonly lenses: readonly Lens[],
  ) {}

  /** Run the cleared units through the staged lenses and assemble the two-layer brief. */
  async synthesize(scope: Scope): Promise<AssembledBrief> {
    const units = await this.gate.clearedUnitsForLenses(scope);
    const byLayer = this.groupByLayer();

    const findings: Finding[] = [];
    for (const layer of LAYER_ORDER) {
      const lensesInLayer = byLayer.get(layer);
      if (!lensesInLayer || lensesInLayer.length === 0) {
        continue;
      }

      // The findings of the layers ABOVE this one, frozen for the whole layer so no
      // lens here sees a sibling's output — only prior stages'.
      const priorFindings: readonly Finding[] = [...findings];

      const produced: Finding[] = [];
      for (const lens of lensesInLayer) {
        // Sequential for now; independent lenses in a layer MAY run in parallel
        // later (build_approach.md). The snapshot above is what makes that safe.
        produced.push(...(await lens.run(units, priorFindings, this.provider)));
      }

      if (layer === 'guardrail') {
        supersedeByFindingId(findings, produced);
      } else {
        findings.push(...produced);
      }
    }

    return assembleBrief(scope.engagementId, findings);
  }

  /** Group the registered lenses by their declared layer, preserving registration order within a layer. */
  private groupByLayer(): Map<Layer, Lens[]> {
    const byLayer = new Map<Layer, Lens[]>();
    for (const lens of this.lenses) {
      const group = byLayer.get(lens.layer);
      if (group) {
        group.push(lens);
      } else {
        byLayer.set(lens.layer, [lens]);
      }
    }
    return byLayer;
  }
}

/**
 * Fold the Guardrail stage's output into the accumulated findings: a produced
 * finding that reuses an existing finding_id REVISES it in place (preserving its
 * position, so layer order is kept and the run stays deterministic); a new id
 * appends. This is the Discernment audit's privilege and is applied only here.
 */
function supersedeByFindingId(accumulated: Finding[], produced: readonly Finding[]): void {
  for (const finding of produced) {
    const index = accumulated.findIndex((f) => f.findingId === finding.findingId);
    if (index >= 0) {
      accumulated[index] = finding;
    } else {
      accumulated.push(finding);
    }
  }
}
