import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import type { LlmProvider } from '../../seams/llm-provider.js';

// A lens is one prompt section / output section of the staged pipeline. Each lens
// is a separate, individually versioned artifact, so a single lens can be revised
// or evaluated without disturbing the others. The interface is the seam the staged
// orchestrator runs over.
//
// Capability-matching (each lens declaring which units it accepts) is deferred
// with the unit type-specific extensions, so for now a lens runs over all the
// cleared units handed to it.

// The seven Module-1 lenses are not peers — they form five dependency layers
// (build_approach.md, "Lens processing: a staged pipeline"). A lens declares which
// layer it belongs to; the orchestrator runs the layers in this canonical order,
// and each layer reads the units plus the findings of the layers ABOVE it.
export type Layer = 'evidence' | 'aggregate' | 'interpret' | 'guardrail' | 'openings';

/** The dependency order the staged orchestrator iterates. Earlier layers feed later ones. */
export const LAYER_ORDER: readonly Layer[] = [
  'evidence', // Listening, Human Meaning — read units directly
  'aggregate', // Culture Pattern, Tension — work across the whole set / prior findings
  'interpret', // Inclusity Objective — maps findings to survey domains + ADKAR
  'guardrail', // Facilitator Discernment — audits all prior findings, runs late
  'openings', // Action Opening — points toward possible next steps
];

export interface Lens {
  readonly id: string;
  /** Which dependency layer this lens belongs to — fixes when it runs relative to the others. */
  readonly layer: Layer;
  /**
   * Read the cleared units and the findings of PRIOR layers, then emit findings.
   *
   * `priorFindings` carries only the findings of layers above this one — never the
   * findings of other lenses in the same layer. That keeps within-layer lenses
   * independent (and therefore parallelizable later); the load-bearing property of
   * the staged pipeline is this finding-passing between stages, not concurrency.
   */
  run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]>;
}
