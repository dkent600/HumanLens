import { describe, expect, it } from 'vitest';
import {
  FakeLlmProvider,
  routeLlmResponse,
  type LensPromptPayload,
  type LensResponsePayload,
  type LlmStopReason,
} from '../src/seams/llm-provider.js';
import { ListeningLens } from '../src/engine/lenses/listening-lens.js';
import { HumanMeaningLens } from '../src/engine/lenses/human-meaning-lens.js';
import { makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';
import type { Unit } from '../src/domain/types.js';

// The fake-empty-drop seam fix — the four-state read at the seam boundary (the G-1
// routing half; build_implementation.md "Lens↔model contract"). Every stop reason maps
// to exactly one verdict, and the regression that would re-open the drop is pinned
// directly: a refusal NEVER routes to answered-empty. The same expectations were
// validated adversarially by the V-1 completeness eval (test/completeness — P2/P4/G-1);
// this spec is their production-seam counterpart.

describe('routeLlmResponse — every stop reason routes to exactly one verdict', () => {
  it('end_turn (natural) → proceed', () => {
    expect(routeLlmResponse({ stopReason: 'end_turn' })).toEqual({ kind: 'proceed' });
  });

  it('refusal → unusable/refused — never a candidate for answered-empty', () => {
    expect(routeLlmResponse({ stopReason: 'refusal' })).toEqual({ kind: 'unusable', reason: 'refused' });
  });

  it('max_tokens / pause_turn / tool_use (non-natural) → unusable/malformed', () => {
    for (const stopReason of ['max_tokens', 'pause_turn', 'tool_use'] as const) {
      expect(routeLlmResponse({ stopReason })).toEqual({ kind: 'unusable', reason: 'malformed' });
    }
  });

  it('stop_sequence → proceed ONLY where a lens declares it uses one; unexpected → unusable', () => {
    // No current lens configures stop sequences, so an unexpected one is an anomaly.
    expect(routeLlmResponse({ stopReason: 'stop_sequence' })).toEqual({ kind: 'unusable', reason: 'malformed' });
    expect(routeLlmResponse({ stopReason: 'stop_sequence' }, { allowStopSequence: true })).toEqual({
      kind: 'proceed',
    });
  });

  it('absent stopReason (a provider with no finish signal) degrades to proceed', () => {
    expect(routeLlmResponse({})).toEqual({ kind: 'proceed' });
  });
});

// ── Lens-level regression: the drop stays closed at the call sites ──────────────────
// The sharpest way to prove the routing is honored: hand a lens a response that WOULD
// parse into findings, but under a non-natural finish. If the lens ever produced those
// findings — or, for an empty body, ever treated a refusal as a legitimate chosen
// empty — the fake-empty drop would be re-opened.

function clearedUnit(unitId: string, speakerToken: string): Unit {
  return {
    unitId,
    engagementId: 'eng:1',
    ingestedBy: 'actor:test',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    sourceRef: 'src',
    position: 0,
    language: 'en',
    content: `content for ${unitId}`,
    deidStatus: 'cleared',
    speakerToken,
  };
}

const units: readonly Unit[] = [clearedUnit('u1', 'spk-a')];

/** A respond that yields a well-formed, in-scope SURFACING finding — parseable on purpose. */
function surfacingRespond(_payload: LensPromptPayload): LensResponsePayload {
  return { findings: [{ verbatim: 'a surfaced voice', evidenceUnitIds: ['u1'] }] };
}

/** A prior Listening finding for the Human Meaning lens to interpret. */
function listeningFinding(): Finding {
  return makeOrdinaryFinding({
    findingId: 'listening:0',
    lens: 'listening',
    verbatim: 'a surfaced voice',
    evidenceLinks: ['u1'],
    units,
  });
}

describe('lens call sites honor the routing (non-natural finish is never parsed)', () => {
  it('Listening yields findings under end_turn, and NOTHING under refusal — same body', async () => {
    const natural = await new ListeningLens().run(units, [], new FakeLlmProvider(surfacingRespond));
    expect(natural).toHaveLength(1);

    const refused = await new ListeningLens().run(
      units,
      [],
      new FakeLlmProvider(surfacingRespond, 'refusal'),
    );
    expect(refused).toEqual([]); // the parseable body is NOT trusted past a refusal
  });

  it('Human Meaning yields nothing under max_tokens (truncation) even when the body would parse', async () => {
    const respond = (payload: LensPromptPayload): LensResponsePayload => ({
      findings: [
        {
          noticing: 'a meaning',
          sourceFindingId: payload.priorFindings?.[0]?.findingId ?? '',
          evidenceUnitIds: [],
        },
      ],
    });
    const truncated = await new HumanMeaningLens().run(
      units,
      [listeningFinding()],
      new FakeLlmProvider(respond, 'max_tokens'),
    );
    expect(truncated).toEqual([]);
  });

  it('a refusal with an EMPTY body is unusable — never the answered-empty path (the drop, closed)', async () => {
    // The identical empty payload, two finishes. Natural empty = the legitimate chosen
    // silence (no findings, and the route verdict says proceed). Refused empty = the
    // masquerade the fix closes: the route verdict is unusable, so the accounting layer
    // records delivered-but-unusable — never answered-empty.
    const emptyRespond = (): LensResponsePayload => ({ findings: [] });

    const naturalEmpty = new FakeLlmProvider(emptyRespond);
    expect(routeLlmResponse(await naturalEmpty.complete({ prompt: '{"units":[]}' }))).toEqual({
      kind: 'proceed',
    });

    const refusedEmpty = new FakeLlmProvider(emptyRespond, 'refusal');
    expect(routeLlmResponse(await refusedEmpty.complete({ prompt: '{"units":[]}' }))).toEqual({
      kind: 'unusable',
      reason: 'refused',
    });
  });

  it('the fake defaults to end_turn, so every existing test still exercises the natural path', async () => {
    const response = await new FakeLlmProvider().complete({ prompt: '{"units":[]}' });
    expect(response.stopReason).toBe('end_turn' satisfies LlmStopReason);
  });
});
