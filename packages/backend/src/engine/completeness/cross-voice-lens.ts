import type { Finding } from '../../domain/finding.js';
import type { LensResponseCandidate, LlmProvider } from '../../seams/llm-provider.js';
import { computeCitationAudit, type CitationAudit } from './cross-voice-audit.js';

// The bridge between a CROSS-VOICE lens (Culture Pattern, Tension, …) and the cited-or-
// residual audit. Unlike the per-voice path (fan-out), a cross-voice lens makes ONE call
// over the whole delivered set and emits however many patterns exist. This helper runs that
// call and then runs the audit — collecting the finding ids the patterns cited, subtracting
// from delivered, and returning the residual + coverage as diagnostics.
//
// MACHINERY ONLY: this file provides the abstraction and the audit wiring. It does NOT make
// Culture Pattern / Tension real (their prompts + quality are a separate eval-and-review
// increment); a real cross-voice lens implements `CrossVoiceLens` and plugs in here.

/** Union the finding ids a set of emitted candidates cite — the raw cited set (may include
 *  hallucinated ids; the audit quarantines those). This is the cited-set collection step. */
export function collectCitations(candidates: readonly LensResponseCandidate[]): string[] {
  return [...new Set(candidates.flatMap((c) => c.sourceFindingIds ?? []))];
}

export interface CrossVoiceSynthesis {
  readonly findings: readonly Finding[];
  /** The union of sourceFindingIds across all emitted findings — RAW (may include hallucinated ids). */
  readonly cited: readonly string[];
}

export interface CrossVoiceLens {
  readonly id: string;
  /** The complete, CLOSED delivered set handed to this lens in one call (upstream finding ids). */
  deliveredFindingIds(priorFindings: readonly Finding[]): readonly string[];
  /** One call over the whole set: emit patterns and collect the finding ids they cite. */
  synthesize(priorFindings: readonly Finding[], provider: LlmProvider): Promise<CrossVoiceSynthesis>;
}

export interface CrossVoiceRunResult {
  readonly findings: readonly Finding[];
  readonly audit: CitationAudit;
}

/**
 * Run a cross-voice lens and audit its citations. The lens emits its patterns (and the ids
 * they cite); this computes `delivered − cited` as the residual and the coverage ratio — pure
 * diagnostics. A non-empty residual is expected and is NOT treated as a failure or a retry
 * trigger; the audit is never fed back to the model.
 */
export async function runCrossVoiceLens(
  lens: CrossVoiceLens,
  priorFindings: readonly Finding[],
  provider: LlmProvider,
): Promise<CrossVoiceRunResult> {
  const delivered = lens.deliveredFindingIds(priorFindings);
  const { findings, cited } = await lens.synthesize(priorFindings, provider);
  const audit = computeCitationAudit(delivered, cited);
  return { findings, audit };
}
