// The FOUR terminal states and their reason codes (build_context.md, "TERMINAL-STATE
// COUNT — resolved toward FOUR"). The deciding rule: a state earns existence IFF it
// routes differently (retry semantics or the honest claim it makes); reason codes
// annotate but never multiply states. There is deliberately no fifth state — the
// silent drop (UNACCOUNTED) is the hole P1 closes, not a value we can represent.

/**
 * The four terminal states every voice must land in exactly one of (P1):
 *  - answered-with-findings — the model answered this voice; ≥1 finding is attributed.
 *  - answered-empty         — CHOSEN silence: a usable empty payload on a natural
 *                             finish. NEVER retried (P7) — retrying it would
 *                             manufacture findings under pressure.
 *  - delivered-but-unusable — the model delivered something we cannot use (malformed,
 *                             refusal, non-natural finish, or findings we could not
 *                             attribute). Retryable at the MODEL layer, then a gap.
 *  - failed                 — transport/infra failure. Retryable at the INFRA layer
 *                             (except a non-retryable 4xx), then a gap.
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
 * A reason code annotates a terminal state with WHY, without being a state of its own.
 * Grouped by the state it may accompany.
 */
export type ReasonCode =
  // answered-with-findings
  | 'ok'
  // answered-empty
  | 'chosen-empty'
  // delivered-but-unusable
  | 'malformed' // body present, not parseable/well-shaped as findings
  | 'parse-exception' // parsing the body threw (oversized, garbage, truncated JSON)
  | 'refusal' // finish_reason = refusal
  | 'truncated' // finish_reason = length (i) — non-natural, so unusable regardless of body (G-1)
  | 'content-filtered' // finish_reason = content_filter (k)
  | 'provenance-violation' // findings present but none attributable to this voice (e / g)
  // failed
  | 'transport' // network failure / timeout / 429 / 5xx
  | 'provider-rejected' // non-retryable 4xx (A7) — terminal, no backoff
  // set by the orchestrator on exhaustion of the layer's retry cap (P9)
  | 'retries-exhausted';

/**
 * One finding ATTRIBUTED to a voice — minimal shape mirroring the real per-voice lens
 * contract (human-meaning-lens.ts): the model names, in `sourceFindingId`, the single
 * prior voice it interprets, and carries its `noticing`. In the validator the voice id
 * IS that source id. `voiceId` here is always the id sent in the call the finding came
 * back on — the provenance check has already confirmed it.
 */
export interface VoiceFinding {
  readonly voiceId: string;
  readonly noticing: string;
}

/**
 * A finding the model emitted for some OTHER voice, or an id never sent to anyone —
 * RECORDED (so it is inspectable, never silently lost) but NEVER attributed to a
 * voice. This is what makes P3 observable rather than merely asserted.
 */
export interface QuarantinedFinding {
  /** The voice id the model NAMED (which is not the one this call was for). */
  readonly claimedVoiceId: string;
  readonly reason: 'foreign-voice' | 'unknown-voice';
}

/**
 * The adapter's verdict for one voice call — the shape the ledger records. `findings`
 * is non-empty IFF `state === 'answered-with-findings'` (G-1 persistence half, enforced
 * by `assertObservationInvariant` at the persistence boundary). `quarantined` may be
 * present on any state where the model emitted misattributed findings (e / g).
 */
export interface TerminalObservation {
  readonly state: TerminalState;
  readonly reasonCode: ReasonCode;
  readonly findings: readonly VoiceFinding[];
  readonly quarantined: readonly QuarantinedFinding[];
}

// ── Constructors (the only sanctioned way to build an observation) ──────────────

export function answeredWithFindings(
  findings: readonly VoiceFinding[],
  quarantined: readonly QuarantinedFinding[] = [],
): TerminalObservation {
  return { state: 'answered-with-findings', reasonCode: 'ok', findings, quarantined };
}

export function answeredEmpty(): TerminalObservation {
  return { state: 'answered-empty', reasonCode: 'chosen-empty', findings: [], quarantined: [] };
}

export function deliveredButUnusable(
  reasonCode: Extract<
    ReasonCode,
    'malformed' | 'parse-exception' | 'refusal' | 'truncated' | 'content-filtered' | 'provenance-violation'
  >,
  quarantined: readonly QuarantinedFinding[] = [],
): TerminalObservation {
  return { state: 'delivered-but-unusable', reasonCode, findings: [], quarantined };
}

export function failed(
  reasonCode: Extract<ReasonCode, 'transport' | 'provider-rejected'>,
): TerminalObservation {
  return { state: 'failed', reasonCode, findings: [], quarantined: [] };
}

/**
 * Mark a retryable observation (delivered-but-unusable or failed/transport) as having
 * exhausted its retry cap — the state is PRESERVED (it still routed as unusable/failed);
 * only the reason code becomes `retries-exhausted`, the surfaced gap (P9).
 */
export function exhausted(obs: TerminalObservation): TerminalObservation {
  return { ...obs, reasonCode: 'retries-exhausted', findings: [], quarantined: obs.quarantined };
}

// ── Retry policy, DERIVED from the state (not asserted per call) ────────────────

/** Which layer(s) may retry a given terminal observation, before exhaustion. */
export interface Retryability {
  readonly modelLayer: boolean;
  readonly infraLayer: boolean;
}

/**
 * The routing table in one place: answered-* are terminal (never retried — P7 for
 * empty); delivered-but-unusable retries at the model layer; failed retries at the
 * infra layer UNLESS it is a non-retryable 4xx (provider-rejected — A7).
 */
export function retryability(obs: TerminalObservation): Retryability {
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
 * The persistence-boundary invariant (G-1 persistence half): findings may ride ONLY on
 * answered-with-findings, and that state must carry ≥1. The ledger calls this before
 * writing, so "no finding the ledger can't account for" holds by construction, and a
 * truncated partial can never sneak in as authoritative.
 */
export function assertObservationInvariant(obs: TerminalObservation): void {
  const hasFindings = obs.findings.length > 0;
  if (obs.state === 'answered-with-findings') {
    if (!hasFindings) {
      throw new Error('answered-with-findings must carry at least one attributed finding');
    }
  } else if (hasFindings) {
    throw new Error(`state ${obs.state} must carry no findings (only answered-with-findings persists findings)`);
  }
}
