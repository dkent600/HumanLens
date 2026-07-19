// The four terminal states of the completeness accounting — PRODUCTION canon
// (build_approach.md "Lens processing"; build_implementation.md "Completeness —
// orchestration (adopted)"). Promoted from the V-1 validator, which property-proved
// this exact shape against a hostile model mock before adoption; the eval-side copy
// under src/eval/completeness remains as that validation record.
//
// The deciding rule (unchanged from V-1): a state earns existence iff it ROUTES
// differently; reason codes annotate but never multiply states. There is deliberately
// no fifth state — a silently dropped voice is not a state a voice can be in; it is
// the hole this accounting closes.

/**
 * Every voice a lens is given ends in exactly ONE of these (P1):
 *  - answered-with-findings — the model usably answered; ≥1 finding attributed.
 *  - answered-empty         — CHOSEN silence: a usable empty body on a NATURAL finish
 *                             (both required — P2/G-1). NEVER retried (P7).
 *  - delivered-but-unusable — a refusal or malformed/non-natural response: the model
 *                             did not usably answer but nothing broke. Retryable at
 *                             the MODEL layer, then surfaced as a gap.
 *  - failed                 — the call could not complete (transport/infra).
 *                             Retryable at the INFRA layer (except a non-retryable
 *                             4xx), then surfaced as a gap.
 */
export type TerminalState =
  | 'answered-with-findings'
  | 'answered-empty'
  | 'delivered-but-unusable'
  | 'failed';

export const TERMINAL_STATES: readonly TerminalState[] = [
  'answered-with-findings',
  'answered-empty',
  'delivered-but-unusable',
  'failed',
];

/**
 * The adopted reason-code set (build_implementation.md: unusable carries
 * `refused | malformed`; exhaustion carries `retries-exhausted`). Richer diagnostic
 * distinctions the V-1 validator drew (parse-exception vs truncated vs provenance) are
 * deliberately COLLAPSED into `malformed` here per the adopted doc — the quarantine
 * records keep the provenance specifics inspectable without multiplying codes.
 */
export type ReasonCode =
  | 'ok' // answered-with-findings
  | 'chosen-empty' // answered-empty
  | 'refused' // delivered-but-unusable: the model declined (finish signal `refusal`)
  | 'malformed' // delivered-but-unusable: truncated / unparseable / out-of-protocol / misattributed
  | 'transport' // failed: network / timeout / retryable HTTP (429, 5xx)
  | 'provider-rejected' // failed: non-retryable 4xx — terminal, no backoff (A7)
  | 'retries-exhausted'; // the layer's retry cap was hit — the surfaced gap (P9)

/**
 * A finding the model emitted for some OTHER voice, or an id never sent — RECORDED so it
 * is inspectable, NEVER attributed (P3). Shape-agnostic: the per-voice operation (which
 * knows the lens's finding shape) performs the check and reports only the claim.
 */
export interface QuarantinedFinding {
  readonly claimedVoiceId: string;
  readonly reason: 'foreign-voice' | 'unknown-voice';
}

/**
 * One voice's terminal disposition. Generic over the lens's finding shape — the
 * orchestrator and ledger never look inside a finding (lens-agnostic machinery).
 * `findings` is non-empty IFF `state === 'answered-with-findings'` (the G-1 persistence
 * half, enforced by `assertObservationInvariant` at the ledger boundary).
 *
 * `invariantViolation` is a PER-LENS COMPLETENESS-INVARIANT breach, recorded ALONGSIDE a
 * truthful terminal state (never replacing it, never triggering a retry). A lens may
 * declare that answered-empty is illegitimate for a voice (Human Meaning: always;
 * Listening: for an authored voice). When such a voice resolves answered-empty, the state
 * stays answered-empty (the model DID usably respond with nothing — truthful), and this
 * field carries the visible defect for review. Critically it is NOT rerouted to
 * delivered-but-unusable and NOT retried: re-asking a voice until it stops coming back
 * empty is manufacturing findings under pressure — the exact failure P7 prevents.
 */
export interface TerminalObservation<TFinding> {
  readonly state: TerminalState;
  readonly reasonCode: ReasonCode;
  readonly findings: readonly TFinding[];
  readonly quarantined: readonly QuarantinedFinding[];
  readonly invariantViolation?: string;
}

/** Attach a completeness-invariant violation to a terminal observation (state unchanged). */
export function withInvariantViolation<TFinding>(
  obs: TerminalObservation<TFinding>,
  violation: string,
): TerminalObservation<TFinding> {
  return { ...obs, invariantViolation: violation };
}

// ── Constructors — the only sanctioned way to build an observation ──────────────

export function answeredWithFindings<TFinding>(
  findings: readonly TFinding[],
  quarantined: readonly QuarantinedFinding[] = [],
): TerminalObservation<TFinding> {
  return { state: 'answered-with-findings', reasonCode: 'ok', findings, quarantined };
}

export function answeredEmpty<TFinding>(): TerminalObservation<TFinding> {
  return { state: 'answered-empty', reasonCode: 'chosen-empty', findings: [], quarantined: [] };
}

export function deliveredButUnusable<TFinding>(
  reasonCode: Extract<ReasonCode, 'refused' | 'malformed'>,
  quarantined: readonly QuarantinedFinding[] = [],
): TerminalObservation<TFinding> {
  return { state: 'delivered-but-unusable', reasonCode, findings: [], quarantined };
}

export function failed<TFinding>(
  reasonCode: Extract<ReasonCode, 'transport' | 'provider-rejected'>,
): TerminalObservation<TFinding> {
  return { state: 'failed', reasonCode, findings: [], quarantined: [] };
}

/**
 * Mark a retryable observation as having exhausted its layer's cap — the state is
 * PRESERVED (it still routed as unusable/failed); the reason code becomes the surfaced
 * gap `retries-exhausted` (P9).
 */
export function exhausted<TFinding>(obs: TerminalObservation<TFinding>): TerminalObservation<TFinding> {
  return { ...obs, reasonCode: 'retries-exhausted', findings: [] };
}

// ── Retry policy, DERIVED from the state (never asserted per call) ───────────────

export interface Retryability {
  readonly modelLayer: boolean;
  readonly infraLayer: boolean;
}

/**
 * The routing table: answered-* are terminal (P7: empty is never retried);
 * delivered-but-unusable retries at the MODEL layer; failed retries at the INFRA layer
 * unless it is a non-retryable 4xx (provider-rejected — A7: terminal, no backoff).
 */
export function retryability(obs: TerminalObservation<unknown>): Retryability {
  switch (obs.state) {
    case 'answered-with-findings':
    case 'answered-empty':
      return { modelLayer: false, infraLayer: false };
    case 'delivered-but-unusable':
      return { modelLayer: true, infraLayer: false };
    case 'failed':
      return { modelLayer: false, infraLayer: obs.reasonCode !== 'provider-rejected' };
  }
}

/**
 * The persistence-boundary invariant (G-1 persistence half): findings ride ONLY on
 * answered-with-findings, which must carry ≥1. The ledger calls this before writing,
 * so no finding can exist that the ledger cannot account for, and a truncated partial
 * can never become authoritative.
 */
export function assertObservationInvariant(obs: TerminalObservation<unknown>): void {
  const hasFindings = obs.findings.length > 0;
  if (obs.state === 'answered-with-findings') {
    if (!hasFindings) {
      throw new Error('answered-with-findings must carry at least one attributed finding');
    }
  } else if (hasFindings) {
    throw new Error(
      `state ${obs.state} must carry no findings (only answered-with-findings persists findings)`,
    );
  }
}
