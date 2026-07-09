import {
  answeredEmpty,
  answeredWithFindings,
  deliveredButUnusable,
  failed,
  type QuarantinedFinding,
  type TerminalObservation,
  type VoiceFinding,
} from './terminal-state.js';
import {
  isNaturalFinish,
  StreamError,
  TeardownError,
  TransportError,
  type RawSdkOutcome,
} from './model-call.js';

// The SEAM ADAPTER — a TOTAL function (A9). Every SDK/network outcome, INCLUDING
// exceptions during parse/stream/teardown and any unexpected throw, maps to exactly
// ONE of the four terminal states. Nothing escapes: the adapter never throws. This is
// P1 pushed down a level and made testable — a run's totality rests on the adapter's.
//
// It also houses the routing halves of the spec that are about a SINGLE call:
//   • G-1(a) ROUTING — answered-* only on a natural finish; ANY non-natural finish →
//     delivered-but-unusable, regardless of whether the body would parse.
//   • A7 4xx ROUTING — non-retryable 4xx (except 429) → failed/provider-rejected; 429
//     and 5xx → failed/transport (retryable).
//   • P3 PROVENANCE — each finding's named voice is checked against the voice this call
//     was for; a foreign (g) or unknown (e) id is quarantined, never attributed.
//   • P4 — malformed/refusal → unusable (never answered-empty, never transport).

/** A candidate as it comes off the wire — the model NAMES a voice and gives a noticing. */
interface RawCandidate {
  readonly claimedVoiceId: string;
  readonly noticing: string;
}

type ParseResult =
  | { readonly ok: true; readonly candidates: readonly RawCandidate[] }
  | { readonly ok: false; readonly why: 'malformed' | 'parse-exception' };

/**
 * Observe one voice call and return its terminal disposition. `sentVoiceId` is the voice
 * this call was for (the provenance anchor); `knownVoiceIds` is every voice in the run,
 * used only to tell a FOREIGN valid id (g) from a truly UNKNOWN/hallucinated one (e).
 *
 * The whole body is wrapped so the adapter is total: a thrown TransportError/TeardownError
 * → failed(transport); a thrown StreamError → delivered-but-unusable (a payload we could
 * not consume); ANY other unexpected throw → failed(transport) as the safe infra default,
 * never re-thrown.
 */
export async function observeVoiceCall(
  sentVoiceId: string,
  knownVoiceIds: ReadonlySet<string>,
  call: () => Promise<RawSdkOutcome>,
): Promise<TerminalObservation> {
  try {
    const outcome = await call();
    return route(sentVoiceId, knownVoiceIds, outcome);
  } catch (err) {
    if (err instanceof TransportError) return failed('transport');
    if (err instanceof StreamError) return deliveredButUnusable('parse-exception');
    if (err instanceof TeardownError) return failed('transport');
    // A9: an UNHANDLED path must not exist. An unexpected throw is treated as an infra
    // failure (the conservative default — surfaced, retryable), never propagated.
    return failed('transport');
  }
}

function route(
  sentVoiceId: string,
  knownVoiceIds: ReadonlySet<string>,
  outcome: RawSdkOutcome,
): TerminalObservation {
  if (outcome.kind === 'http-error') {
    // A7: a non-retryable 4xx (except 429) is terminal with no backoff; 429 and every
    // 5xx are retryable transport.
    const nonRetryable4xx = outcome.status >= 400 && outcome.status < 500 && outcome.status !== 429;
    return nonRetryable4xx ? failed('provider-rejected') : failed('transport');
  }

  // G-1(a): a non-natural finish is unusable REGARDLESS of body — do not even look at
  // the body's parseability. This is what stops a truncated/filtered empty payload (i/k)
  // from masquerading as chosen silence.
  if (!isNaturalFinish(outcome.finishReason)) {
    if (outcome.finishReason === 'refusal') return deliveredButUnusable('refusal');
    if (outcome.finishReason === 'content_filter') return deliveredButUnusable('content-filtered');
    return deliveredButUnusable('truncated'); // length
  }

  // Natural finish: now the body's shape decides.
  const parsed = parseFindingsBody(outcome.body);
  if (!parsed.ok) {
    return deliveredButUnusable(parsed.why);
  }

  // Provenance (P3): partition the candidates by whether they name THIS call's voice.
  const attributed: VoiceFinding[] = [];
  const quarantined: QuarantinedFinding[] = [];
  const seen = new Set<string>();
  for (const candidate of parsed.candidates) {
    if (candidate.claimedVoiceId === sentVoiceId) {
      // Duplicate id within the response (f): collapse to one — idempotence at the
      // response level (dedupe key = the noticing, since all name the same voice).
      if (seen.has(candidate.noticing)) continue;
      seen.add(candidate.noticing);
      attributed.push({ voiceId: sentVoiceId, noticing: candidate.noticing });
    } else if (knownVoiceIds.has(candidate.claimedVoiceId)) {
      quarantined.push({ claimedVoiceId: candidate.claimedVoiceId, reason: 'foreign-voice' }); // g
    } else {
      quarantined.push({ claimedVoiceId: candidate.claimedVoiceId, reason: 'unknown-voice' }); // e
    }
  }

  if (attributed.length > 0) {
    return answeredWithFindings(attributed, quarantined);
  }
  // No finding was attributable to this voice. Two very different cases:
  if (parsed.candidates.length === 0) {
    // A genuine empty payload on a natural finish → CHOSEN silence (b). This is the ONLY
    // path to answered-empty (P2 / G-1(a)).
    return answeredEmpty();
  }
  // The model emitted findings, but every one was for another/unknown voice (e / g).
  // That is NOT chosen silence and NOT a valid answer → delivered-but-unusable, with the
  // misattributed findings quarantined, never silently attributed anywhere (P3).
  return deliveredButUnusable('provenance-violation', quarantined);
}

/**
 * Tolerant parse of the response body into candidates. Mirrors the real lens's defensive
 * parse (human-meaning-lens.ts): strip a ```json fence, JSON.parse in try/catch,
 * field-validate each candidate. A THROW (oversized string, encoding garbage, mid-token
 * truncation) → parse-exception; a parse that yields the wrong shape → malformed. Either
 * way the body is unusable — the distinction is only a diagnostic reason code.
 */
function parseFindingsBody(text: string): ParseResult {
  const body = stripFence(text.trim());
  if (body === '') {
    // Empty body on a natural finish is a valid empty payload (no findings array, but
    // nothing to parse either) — treat as chosen-empty at the caller by returning zero
    // candidates. (A truly empty string is a well-formed "nothing".)
    return { ok: true, candidates: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, why: 'parse-exception' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, why: 'malformed' };
  }
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) {
    return { ok: false, why: 'malformed' };
  }
  const candidates: RawCandidate[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null) continue;
    const noticing = (raw as { noticing?: unknown }).noticing;
    const claimedVoiceId = (raw as { sourceFindingId?: unknown }).sourceFindingId;
    if (typeof noticing !== 'string' || noticing.trim() === '') continue;
    if (typeof claimedVoiceId !== 'string' || claimedVoiceId.trim() === '') continue;
    candidates.push({ claimedVoiceId, noticing });
  }
  return { ok: true, candidates };
}

/** Strip a single ```json … ``` (or bare ``` … ```) fence if the model wrapped its JSON. */
function stripFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fence ? fence[1].trim() : text;
}
