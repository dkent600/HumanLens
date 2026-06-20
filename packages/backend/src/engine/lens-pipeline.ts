import type { Finding } from '../domain/finding.js';
import type { LlmProvider } from '../seams/llm-provider.js';
import type { Scope } from '../seams/repository.js';
import type { DeidGate } from './deid-gate.js';
import type { Lens } from './lenses/lens.js';
import { assembleBrief, type AssembledBrief } from './assemble.js';

// The lens-processing spine, minimal but end-to-end for this slice:
//
//   gate.clearedUnitsForLenses -> lens(es) -> evidence-anchored findings -> Assemble
//
// It sources units EXCLUSIVELY from the de-id gate, so material that went around
// the gate can never reach the lenses. The staged five-layer structure and
// in-layer parallelism (build_approach.md) land as more lenses arrive; with one
// Evidence-layer lens the orchestration is a single pass. Findings accumulate so
// later layers can read earlier ones once they exist.
//
// This is plain TypeScript — no Fastify, no DB, no provider concretion — runnable
// directly from a test or a small harness with no server running.

export class LensPipeline {
  constructor(
    private readonly gate: DeidGate,
    private readonly provider: LlmProvider,
    private readonly lenses: readonly Lens[],
  ) {}

  /** Run the cleared units through the lenses and assemble the two-layer brief. */
  async synthesize(scope: Scope): Promise<AssembledBrief> {
    const units = await this.gate.clearedUnitsForLenses(scope);

    const findings: Finding[] = [];
    for (const lens of this.lenses) {
      const produced = await lens.run(units, this.provider);
      findings.push(...produced);
    }

    return assembleBrief(scope.engagementId, findings);
  }
}
