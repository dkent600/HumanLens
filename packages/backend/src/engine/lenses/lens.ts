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

// The seven Module-1 lenses are not peers — they form five dependency waves
// (build_approach.md, "Lens processing: a staged pipeline"). A lens declares which
// wave it belongs to; the orchestrator runs the waves in this canonical order,
// and each wave reads the units plus the findings of the waves ABOVE it.
export type Wave = 'evidence' | 'aggregate' | 'interpret' | 'guardrail' | 'openings';

/** The dependency order the staged orchestrator iterates. Earlier waves feed later ones. */
export const WAVE_ORDER: readonly Wave[] = [
  'evidence', // Listening, Human Meaning — read units directly
  'aggregate', // Culture Pattern, Tension — work across the whole set / prior findings
  'interpret', // Inclusity Objective — maps findings to survey domains + ADKAR
  'guardrail', // Facilitator Discernment — audits all prior findings, runs late
  'openings', // Action Opening — points toward possible next steps
];

export interface Lens {
  readonly id: string;
  /** Which dependency wave this lens belongs to — fixes when it runs relative to the others. */
  readonly wave: Wave;
  /**
   * Read the cleared units and the findings of PRIOR waves, then emit findings.
   *
   * `priorFindings` carries only the findings of waves above this one — never the
   * findings of other lenses in the same wave. That keeps within-wave lenses
   * independent (and therefore parallelizable later); the load-bearing property of
   * the staged pipeline is this finding-passing between stages, not concurrency.
   */
  run(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<readonly Finding[]>;
}
