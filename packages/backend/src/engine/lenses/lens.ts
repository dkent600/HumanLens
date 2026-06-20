import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import type { LlmProvider } from '../../seams/llm-provider.js';

// A lens is one prompt section / output section of the staged pipeline. Each lens
// is a separate, individually versioned artifact, so a single lens can be revised
// or evaluated without disturbing the others. This slice implements one lens from
// the Evidence layer; the interface is the seam the staged orchestrator runs over.
//
// Capability-matching (each lens declaring which units it accepts) is deferred
// with the unit type-specific extensions, so for now a lens runs over all the
// cleared units handed to it.

export interface Lens {
  readonly id: string;
  /** Read the cleared units (and, for later layers, prior findings) and emit findings. */
  run(units: readonly Unit[], provider: LlmProvider): Promise<readonly Finding[]>;
}
