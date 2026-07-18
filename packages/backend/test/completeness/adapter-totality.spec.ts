import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { observeVoiceCall } from '../../src/eval/completeness/voice-call-adapter.js';
import {
  StreamError,
  TeardownError,
  TransportError,
  type FinishReason,
  type RawSdkOutcome,
} from '../../src/eval/completeness/model-call.js';
import { TERMINAL_STATES } from '../../src/eval/completeness/terminal-state.js';
import { MALFORMED_CORPUS } from '../../src/eval/completeness/adversarial-model.js';
import { PROPERTIES } from '../../src/engine/completeness/properties.js';

// The seam adapter is the level P1 is pushed down to. These are the SINGLE-CALL properties
// the acceptance contract names: A9 (adapter totality), G-1(a) (finish-reason routing),
// A7 (4xx routing), and P2/P4 at the call boundary. Property ids are cited from the
// canonical registry so this file cannot silently restate the contract in its own words.

const SENT = 'voice:sent';
const KNOWN = new Set([SENT, 'voice:other']);

// Pinned seeds — a green run reproduces exactly (build-phase governance: green is inspectable).
const SEED_TOTALITY = 5_902_001;
const SEED_GATING = 5_902_002;
const SEED_4XX = 5_902_003;

/** A finding body naming a given voice (mirrors the real per-voice `sourceFindingId` shape). */
function findingBody(voiceId: string): string {
  return JSON.stringify({ findings: [{ sourceFindingId: voiceId, noticing: 'a meaning' }] });
}

describe(`A9 — ${PROPERTIES.A9.title}`, () => {
  // A9: every SDK/network outcome, including exceptions and even non-Error throws, maps to
  // exactly one of the four states; the adapter never throws.
  const outcomeArb: fc.Arbitrary<() => Promise<RawSdkOutcome>> = fc.oneof(
    // responded with an arbitrary finish reason and an arbitrary body (incl. the corpus)
    fc
      .record({
        finishReason: fc.constantFrom<FinishReason>(
          'end_turn',
          'stop_sequence',
          'max_tokens',
          'refusal',
          'pause_turn',
          'tool_use',
        ),
        body: fc.oneof(fc.string(), fc.constantFrom(...MALFORMED_CORPUS), fc.constant(findingBody(SENT))),
      })
      .map((r) => () => Promise.resolve<RawSdkOutcome>({ kind: 'responded', ...r })),
    // any HTTP status
    fc.integer({ min: 100, max: 599 }).map((status) => () => Promise.resolve<RawSdkOutcome>({ kind: 'http-error', status })),
    // known error classes
    fc.constantFrom(
      () => Promise.reject(new TransportError()),
      () => Promise.reject(new StreamError()),
      () => Promise.reject(new TeardownError()),
      // a truly UNEXPECTED throw — an ordinary Error and even a non-Error value
      () => Promise.reject(new Error('boom')),
      () => Promise.reject('a string, not an Error'),
      () => {
        throw new Error('thrown synchronously from the thunk');
      },
    ),
  );

  it('maps every outcome to exactly one terminal state and never throws', async () => {
    await fc.assert(
      fc.asyncProperty(outcomeArb, async (call) => {
        const obs = await observeVoiceCall(SENT, KNOWN, call);
        expect(TERMINAL_STATES).toContain(obs.state);
      }),
      { numRuns: 3000, seed: SEED_TOTALITY },
    );
  });
});

describe(`G-1(a) — ${PROPERTIES['G-1'].title} (routing)`, () => {
  // A non-natural finish is unusable REGARDLESS of body — even a body that would parse as
  // valid findings or a valid empty payload. This is what stops truncated/filtered empties
  // (behaviors i / k) masquerading as chosen silence (P2).
  it('non-natural finish → delivered-but-unusable for ANY body', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<FinishReason>('max_tokens', 'pause_turn', 'tool_use', 'refusal'),
        fc.oneof(
          fc.constant('{"findings":[]}'), // a valid EMPTY payload — must NOT become answered-empty
          fc.constant(findingBody(SENT)), // a valid FINDINGS payload — must NOT become answered-with-findings
          fc.string(),
        ),
        async (finishReason, body) => {
          const obs = await observeVoiceCall(SENT, KNOWN, () =>
            Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason, body }),
          );
          expect(obs.state).toBe('delivered-but-unusable');
        },
      ),
      { numRuns: 1000, seed: SEED_GATING },
    );
  });

  it('natural finish (end_turn) + valid empty payload → answered-empty (the only path to it)', async () => {
    // Natural finish is `end_turn`; the eval adapter does not opt into stop_sequence, so
    // that too routes unusable — the delegation to production routeLlmResponse is authoritative.
    const obs = await observeVoiceCall(SENT, KNOWN, () =>
      Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body: '{"findings":[]}' }),
    );
    expect(obs.state).toBe('answered-empty');
    expect(obs.reasonCode).toBe('chosen-empty');
  });
});

describe(`A7 — ${PROPERTIES.A7.title}`, () => {
  it('non-retryable 4xx (except 429) → failed/provider-rejected; 429 & 5xx → failed/transport', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 400, max: 599 }), async (status) => {
        const obs = await observeVoiceCall(SENT, KNOWN, () =>
          Promise.resolve<RawSdkOutcome>({ kind: 'http-error', status }),
        );
        expect(obs.state).toBe('failed');
        const nonRetryable4xx = status >= 400 && status < 500 && status !== 429;
        expect(obs.reasonCode).toBe(nonRetryable4xx ? 'provider-rejected' : 'transport');
      }),
      { numRuns: 500, seed: SEED_4XX },
    );
  });
});

describe(`P3 — ${PROPERTIES.P3.title} (at the adapter)`, () => {
  it('a finding for THIS voice is attributed', async () => {
    const obs = await observeVoiceCall(SENT, KNOWN, () =>
      Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body: findingBody(SENT) }),
    );
    expect(obs.state).toBe('answered-with-findings');
    expect(obs.findings).toEqual([{ voiceId: SENT, noticing: 'a meaning' }]);
  });

  it('a finding for a DIFFERENT valid voice (g) is quarantined, never attributed', async () => {
    const obs = await observeVoiceCall(SENT, KNOWN, () =>
      Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body: findingBody('voice:other') }),
    );
    expect(obs.state).toBe('delivered-but-unusable');
    expect(obs.reasonCode).toBe('provenance-violation');
    expect(obs.findings).toEqual([]);
    expect(obs.quarantined).toEqual([{ claimedVoiceId: 'voice:other', reason: 'foreign-voice' }]);
  });

  it('a hallucinated id (e) is quarantined as unknown, never attributed', async () => {
    const obs = await observeVoiceCall(SENT, KNOWN, () =>
      Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body: findingBody('voice:__nope__') }),
    );
    expect(obs.state).toBe('delivered-but-unusable');
    expect(obs.quarantined).toEqual([{ claimedVoiceId: 'voice:__nope__', reason: 'unknown-voice' }]);
  });

  it('duplicate findings for this voice (f) collapse to one attribution', async () => {
    const body = JSON.stringify({
      findings: [
        { sourceFindingId: SENT, noticing: 'same' },
        { sourceFindingId: SENT, noticing: 'same' },
      ],
    });
    const obs = await observeVoiceCall(SENT, KNOWN, () =>
      Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body }),
    );
    expect(obs.state).toBe('answered-with-findings');
    expect(obs.findings).toEqual([{ voiceId: SENT, noticing: 'same' }]);
  });
});

describe(`P4 — ${PROPERTIES.P4.title} (malformed corpus → unusable, never empty/transport)`, () => {
  it('every malformed-corpus body on a natural finish → delivered-but-unusable', async () => {
    for (const body of MALFORMED_CORPUS) {
      const obs = await observeVoiceCall(SENT, KNOWN, () =>
        Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'end_turn', body }),
      );
      expect(obs.state).toBe('delivered-but-unusable');
      expect(['malformed', 'parse-exception']).toContain(obs.reasonCode);
    }
  });

  it('a refusal → delivered-but-unusable/refusal (never answered-empty)', async () => {
    const obs = await observeVoiceCall(SENT, KNOWN, () =>
      Promise.resolve<RawSdkOutcome>({ kind: 'responded', finishReason: 'refusal', body: '' }),
    );
    expect(obs.state).toBe('delivered-but-unusable');
    expect(obs.reasonCode).toBe('refusal');
  });
});
