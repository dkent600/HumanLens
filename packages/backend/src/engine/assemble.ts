import type { ClientSafeFinding } from '@humanlens/shared';
import type { EngagementId } from '../domain/types.js';
import type { Finding } from '../domain/finding.js';

// Assemble produces the deliverable: a brief with two layers that are NOT two
// generations of text but two VIEWS of one set of findings.
//
//   - The INTERNAL layer is the full candid set: every finding.
//   - The CLIENT-SAFE layer is the promoted subset, projected to the shared
//     contract. A finding reaches it only by affirmative promotion
//     (`clearedToClientSafe`) AND only if its `sensitivity` does not hold it back.
//     Disposition defaults to held, so the safe failure mode is silence.
//
// Because the client-safe layer is literally a `.filter(...)` over the internal
// set, `client-safe ⊆ internal` is a property of how the brief is assembled, not
// a manual cleanup step. Findings held back are simply ABSENT — never reworded so
// they can slip through. (Voice calibration also attaches here; deferred.)
//
// Assemble is a machine step inside an already-authorized request: it does not
// call the auth seams. The actor-facing authorization sits at the later
// layer-view / export boundary (deferred), not here.

export interface AssembledBrief {
  readonly engagementId: EngagementId;
  /** The full candid set — every finding. */
  readonly internal: readonly Finding[];
  /** The promoted, projected subset. A subset of `internal` by construction. */
  readonly clientSafe: readonly ClientSafeFinding[];
}

/** Whether a finding is allowed into the client-safe layer. Held by default; sensitivity is a hard backstop. */
export function isClientSafe(finding: Finding): boolean {
  return finding.clearedToClientSafe && finding.sensitivity !== 'sensitive';
}

/**
 * Project an internal finding to its client-safe view. The mapping is EXPLICIT,
 * field by field — never a spread of the internal object — so an internal-only
 * gating field (`clearedToClientSafe`, `sensitivity`) physically cannot ride
 * along. `evidenceLinks` are preserved so traceability survives into the client
 * view; `supportSet` becomes the safe, derived `support`.
 */
export function projectToClientSafe(finding: Finding): ClientSafeFinding {
  return {
    findingId: finding.findingId,
    lens: finding.lens,
    verbatim: finding.verbatim,
    noticing: finding.noticing,
    ...(finding.translation !== undefined
      ? { translation: finding.translation, sourceLanguage: finding.sourceLanguage }
      : {}),
    evidenceLinks: [...finding.evidenceLinks],
    support: {
      sourceCount: finding.supportSet.sourceCount,
      unitCount: finding.supportSet.unitCount,
    },
    findingKind: finding.findingKind,
    ...(finding.parent !== undefined ? { parent: finding.parent } : {}),
  };
}

/** Assemble one finding set into the two-layer brief. */
export function assembleBrief(
  engagementId: EngagementId,
  findings: readonly Finding[],
): AssembledBrief {
  return {
    engagementId,
    internal: findings,
    clientSafe: findings.filter(isClientSafe).map(projectToClientSafe),
  };
}
