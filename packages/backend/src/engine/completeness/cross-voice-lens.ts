import type { Unit } from '../../domain/types.js';
import type { Finding } from '../../domain/finding.js';
import type {
  LensResponseCandidate,
  LlmProvider,
  LlmStopReason,
  LlmUsage,
} from '../../seams/llm-provider.js';
import { computeCitationAudit, type CitationAudit } from './cross-voice-audit.js';
import type { ReasonCode, TerminalState } from './terminal-state.js';

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

/**
 * How the ONE cross-voice call actually finished — the accounting a cross-voice lens
 * otherwise has nowhere to put. The per-voice path records this per voice in the ledger;
 * the cross-voice path makes a single call and has no ledger, so without this the call's
 * disposition is simply lost.
 *
 * WHY IT EXISTS: an empty pattern set is AMBIGUOUS by itself. Zero patterns / 0% coverage /
 * everything residual / no defects is what BOTH a truncated call and a genuinely
 * pattern-less corpus look like. Reading the first as the second would attribute a token
 * ceiling to the lens's judgment. The finish signal is the only thing that separates them —
 * the same reason the per-voice accounting refuses to infer a state from an empty body.
 *
 * Uses the production four-state vocabulary (terminal-state.ts) rather than a parallel one:
 * one call, one terminal state.
 */
export interface CrossVoiceOutcome {
  readonly state: TerminalState;
  readonly reasonCode: ReasonCode;
  /** The raw finish signal, where the provider carries one. */
  readonly stopReason?: LlmStopReason;
  /** Per-call token usage, where the provider reports it — including thinking tokens. */
  readonly usage?: LlmUsage;
}

export interface CrossVoiceSynthesis {
  readonly findings: readonly Finding[];
  /** The union of sourceFindingIds across all EMITTED findings — RAW (may include hallucinated ids). */
  readonly cited: readonly string[];
  /**
   * The CROSS-VOICE analogue of the per-voice invariant violation: emitted ordinary patterns
   * that cited ZERO existing (delivered) findings — a defect (v1 has no absence findings, so a
   * pattern grounded in nothing is invalid). Recorded here and surfaced by the eval harness,
   * never retried. This also closes a vacuity risk: a lens that never cites would otherwise show
   * 0% coverage with everything in residual and the audit would look healthy while catching nothing.
   */
  readonly uncitedDefects: readonly string[];
  /**
   * How the call finished. OPTIONAL for the same reason `stopReason` is optional on the
   * seam: a lens that reports no disposition simply omits it, and the harness says so
   * rather than inventing one. Culture Pattern always reports it.
   */
  readonly outcome?: CrossVoiceOutcome;
}

export interface CrossVoiceLens {
  readonly id: string;
  /** The complete, CLOSED delivered set handed to this lens in one call (upstream finding ids). */
  deliveredFindingIds(priorFindings: readonly Finding[]): readonly string[];
  /**
   * One call over the whole set: emit patterns and collect the finding ids they cite. `units` are
   * needed to anchor a pattern (inherited from the units behind the findings it cites) and to
   * derive its support honestly.
   */
  synthesize(
    units: readonly Unit[],
    priorFindings: readonly Finding[],
    provider: LlmProvider,
  ): Promise<CrossVoiceSynthesis>;
}

export interface CrossVoiceRunResult {
  readonly findings: readonly Finding[];
  readonly audit: CitationAudit;
  /** Emitted patterns that cited zero existing findings (the surfaced, never-retried defect). */
  readonly uncitedDefects: readonly string[];
  /** How the single cross-voice call finished — what tells a truncation from an honest empty. */
  readonly outcome?: CrossVoiceOutcome;
}

/**
 * Run a cross-voice lens and audit its citations. The lens emits its patterns (and the ids
 * they cite); this computes `delivered − cited` as the residual and the coverage ratio — pure
 * diagnostics. A non-empty residual is expected and is NOT treated as a failure or a retry
 * trigger; the audit is never fed back to the model. The lens's own defect (a pattern citing
 * nothing) is passed through for surfacing.
 */
export async function runCrossVoiceLens(
  lens: CrossVoiceLens,
  units: readonly Unit[],
  priorFindings: readonly Finding[],
  provider: LlmProvider,
): Promise<CrossVoiceRunResult> {
  const delivered = lens.deliveredFindingIds(priorFindings);
  const { findings, cited, uncitedDefects, outcome } = await lens.synthesize(
    units,
    priorFindings,
    provider,
  );
  const audit = computeCitationAudit(delivered, cited);
  return { findings, audit, uncitedDefects, ...(outcome !== undefined ? { outcome } : {}) };
}
