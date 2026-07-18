// ─────────────────────────────────────────────────────────────────────────────
// The completeness accounting — CANONICAL property & behavior registry.
//
// WHAT THIS IS. The acceptance contract of the ADOPTED completeness design
// (build_implementation.md → "Completeness — orchestration (adopted)"): every voice
// handed to an LLM call is provably accounted for, never silently dropped. The
// properties were validated by the V-1 adversarial simulation (src/eval/completeness,
// which remains as that validation record) and now govern the PRODUCTION machinery
// (engine/completeness + the run-ledger seam). Both the eval-side and production-side suites cite these
// ids; neither restates them.
//
// GOVERNANCE (build_context.md, "BUILD-PHASE GOVERNANCE"):
//   1. The property list here is the ACCEPTANCE CONTRACT and the single source of
//      truth. Tests import these ids/statements — they do NOT restate properties in
//      their own words, so the canon cannot drift in test code.
//   2. No weakening-to-pass. A failing property is a CODE bug (fix the code) or a
//      genuine SPEC error (route back to the architecture chat via Doug). It is
//      NEVER relaxed in test code to go green.
//   3. New adversarial behavior discovered while building → propose it as a property
//      → the architecture chat records it → Doug approves. Do NOT add a silent new
//      behavior/property straight into test code. See `PROPOSED_BEHAVIORS` below for
//      the place to stage such a find with a note, pending that loop.
//   4. Green is inspectable, not asserted: a run reports what was tested, the seeds,
//      and any shrunk counterexamples (see report.ts / run-completeness.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** A completeness property — the id is canonical; the statement is the contract. */
export interface Property {
  readonly id:
    | 'P1'
    | 'P2'
    | 'P3'
    | 'P4'
    | 'P5'
    | 'P6'
    | 'P7'
    | 'P8'
    | 'P9'
    | 'G-1'
    | 'A9'
    | 'A7';
  readonly title: string;
  readonly statement: string;
}

/**
 * P1–P9 plus the three traceability-pass / Packet-B additions that also gate
 * acceptance (G-1 routing+persistence, A9 adapter totality, A7 4xx routing). Ordered
 * as in the spec. Every assertion in the test suite cites one of these by id.
 */
export const PROPERTIES: Readonly<Record<Property['id'], Property>> = {
  P1: {
    id: 'P1',
    title: 'totality',
    statement:
      'Every voice in a run ends in EXACTLY ONE of the four terminal states ' +
      '(answered-with-findings / answered-empty / delivered-but-unusable / failed). ' +
      'There is no fifth state — the silent drop (UNACCOUNTED) is the hole P1 closes.',
  },
  P2: {
    id: 'P2',
    title: 'no-silent-path',
    statement:
      'answered-empty requires BOTH a usable empty payload AND a natural finish ' +
      '(stop / end_turn). A non-natural finish or an unusable body can never resolve ' +
      'to answered-empty (routing needs response metadata, not just body shape).',
  },
  P3: {
    id: 'P3',
    title: 'provenance integrity',
    statement:
      'Each returned finding is checked against the voice id sent in THAT call. A ' +
      'finding naming a different valid voice (g) or an id never sent (e) is ' +
      'rejected/quarantined — never silently attributed to this voice or to the one ' +
      'it named. Drops are impossible GIVEN this per-call provenance check.',
  },
  P4: {
    id: 'P4',
    title: 'reason routing',
    statement:
      'malformed / refusal / non-natural-finish → delivered-but-unusable (never ' +
      'answered-empty, never conflated with transport). transport/timeout → failed. ' +
      'The state is what routes; the reason code annotates without multiplying states.',
  },
  P5: {
    id: 'P5',
    title: 'idempotent retry',
    statement:
      'Writes are keyed by (run_id, voice_id). Re-driving a voice (retry or resume) ' +
      'never produces a duplicate ledger row or duplicate findings.',
  },
  P6: {
    id: 'P6',
    title: 'report accuracy',
    statement:
      'The report is DERIVED from the ledger and matches it exactly: the per-state ' +
      'counts sum to the voice count, and the attributed-finding count matches the ' +
      'persisted findings. No voice is missing or double-counted.',
  },
  P7: {
    id: 'P7',
    title: 'chosen-empty never retried',
    statement:
      'A voice that resolves answered-empty is terminal on the first such response ' +
      'and is NEVER retried — retrying chosen silence would manufacture findings ' +
      'under retry pressure (the mechanical form of the overreach the lenses refuse).',
  },
  P8: {
    id: 'P8',
    title: 'recoverability',
    statement:
      'After a crash + restart, totality is restorable: every voice is terminal or ' +
      'provably-pending, there are no zombies (no findings without an accounting ' +
      'ledger row), and voices already completed are not re-run.',
  },
  P9: {
    id: 'P9',
    title: 'termination',
    statement:
      'Every voice reaches a terminal state within bounded attempts (caps at BOTH ' +
      'the model layer and the infra layer). The run provably ends; a perpetually ' +
      'poisoned voice (l) exhausts to reason-code retries-exhausted, never loops.',
  },
  'G-1': {
    id: 'G-1',
    title: 'routing + persistence',
    statement:
      '(a) ROUTING: answered-with-findings / answered-empty are reachable ONLY on a ' +
      'natural finish; any non-natural finish → delivered-but-unusable regardless of ' +
      'body parseability. (b) PERSISTENCE: findings are persisted IFF the terminal ' +
      'state is answered-with-findings (truncated partials never become authoritative).',
  },
  A9: {
    id: 'A9',
    title: 'adapter totality',
    statement:
      'The seam adapter is a TOTAL function: every SDK/network outcome — including ' +
      'exceptions during parse/stream/teardown — maps to exactly one of the four ' +
      'states. No unhandled path; the adapter never throws (P1 pushed down a level).',
  },
  A7: {
    id: 'A7',
    title: '4xx routing',
    statement:
      'A non-retryable HTTP 4xx (except 429) → failed, reason-code provider-rejected, ' +
      'terminal, no backoff — distinct from retryable 429 / 5xx / timeout (transport).',
  },
};

/**
 * The adversarial behaviors the model mock produces, a–l (build_context.md V-1
 * spec). Each is exercised, in combination, across the seeded corpus. behavior `g`
 * is PROVENANCE-STAMPED as a spec-drafting invention (the per-voice analogue of the
 * batch drop — no survey source), per the traceability pass, not an orphan.
 */
export const BEHAVIORS: Readonly<Record<string, string>> = {
  a: 'valid findings',
  b: 'schema-valid empty payload, natural finish (chosen silence)',
  c: 'malformed/unparseable body (HTML-in-200, mid-token-truncated JSON, encoding garbage, oversized)',
  d: 'refusal',
  e: 'hallucinated id (a voice id never sent to anyone)',
  f: 'duplicate id within the response',
  g: 'cross-contamination — findings for a DIFFERENT valid voice [spec-drafting invention]',
  h: 'transport failure / timeout',
  i: 'partial-then-truncated (finish_reason = length)',
  j: 'process crash / kill mid-run (harness-level, not a per-call behavior)',
  k: 'schema-valid empty payload with a NON-natural finish (max_tokens / pause_turn / tool_use)',
  l: 'perpetual poison — c/d/h recur indefinitely for one voice',
};

/**
 * Staging area for adversarial behaviors discovered DURING the build that are not yet
 * in the canonical spec. Per governance rule 3, a new find does NOT go straight into
 * BEHAVIORS or the test assertions — it is recorded here with a note and routed to
 * Doug → architecture chat, and only promoted once approved. Empty is the expected
 * state at hand-off; a non-empty entry is a flag FOR DOUG, not a silent addition.
 */
export const PROPOSED_BEHAVIORS: readonly { readonly note: string }[] = [];
