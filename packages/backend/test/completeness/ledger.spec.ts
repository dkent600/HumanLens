import { describe, expect, it } from 'vitest';
import { Ledger } from '../../src/eval/completeness/ledger.js';
import {
  answeredEmpty,
  answeredWithFindings,
  deliveredButUnusable,
  failed,
  type TerminalObservation,
} from '../../src/eval/completeness/terminal-state.js';
import { PROPERTIES } from '../../src/engine/completeness/properties.js';

// The ledger holds the G-1 PERSISTENCE half and the P5 idempotency guarantee at the write
// boundary. In-memory ledgers keep these fast; the durability half (WAL survives a crash)
// is exercised by crash-acceptance.spec.ts against a real file.

const RUN = 'run:test';

describe(`G-1(b) — ${PROPERTIES['G-1'].title} (persistence)`, () => {
  it('findings persist IFF the terminal state is answered-with-findings', () => {
    const ledger = new Ledger(':memory:');
    ledger.recordTerminal(RUN, 'v0', answeredWithFindings([{ voiceId: 'v0', noticing: 'a meaning' }]));
    ledger.recordTerminal(RUN, 'v1', answeredEmpty());
    ledger.recordTerminal(RUN, 'v2', deliveredButUnusable('malformed'));
    ledger.recordTerminal(RUN, 'v3', failed('transport'));

    expect(ledger.findingsFor(RUN, 'v0')).toEqual([{ voiceId: 'v0', noticing: 'a meaning' }]);
    // No other state persists a finding — a truncated partial can never become authoritative.
    expect(ledger.findingsFor(RUN, 'v1')).toEqual([]);
    expect(ledger.findingsFor(RUN, 'v2')).toEqual([]);
    expect(ledger.findingsFor(RUN, 'v3')).toEqual([]);
    ledger.close();
  });

  it('no finding exists that the ledger cannot account for (every findings row → an answered row)', () => {
    const ledger = new Ledger(':memory:');
    ledger.recordTerminal(RUN, 'v0', answeredWithFindings([{ voiceId: 'v0', noticing: 'm' }]));
    ledger.recordTerminal(RUN, 'v1', deliveredButUnusable('refusal'));
    for (const voiceId of ledger.voicesWithFindings(RUN)) {
      const row = ledger.getRow(RUN, voiceId);
      expect(row?.state).toBe('answered-with-findings');
    }
    ledger.close();
  });

  it('rejects an observation that carries findings on a non-answered state (persistence-boundary guard)', () => {
    const ledger = new Ledger(':memory:');
    // Hand-forge an illegal observation — the ledger must refuse it, not silently store it.
    const illegal = {
      state: 'answered-empty',
      reasonCode: 'chosen-empty',
      findings: [{ voiceId: 'v0', noticing: 'smuggled' }],
      quarantined: [],
    } as unknown as TerminalObservation;
    expect(() => ledger.recordTerminal(RUN, 'v0', illegal)).toThrow();
    ledger.close();
  });
});

describe(`P5 — ${PROPERTIES.P5.title} (idempotent, keyed writes)`, () => {
  it('re-recording the same voice replaces, never duplicates (ledger + findings)', () => {
    const ledger = new Ledger(':memory:');
    const obs = answeredWithFindings([{ voiceId: 'v0', noticing: 'm' }]);
    ledger.recordTerminal(RUN, 'v0', obs);
    ledger.recordTerminal(RUN, 'v0', obs); // idempotent re-write (e.g. a resume that re-drove it)
    expect(ledger.allRows(RUN)).toHaveLength(1);
    expect(ledger.findingCount(RUN)).toBe(1);
    ledger.close();
  });

  it('two runs share a voice id without corrupting each other (run-scoping)', () => {
    const ledger = new Ledger(':memory:');
    ledger.recordTerminal('run:A', 'v0', answeredWithFindings([{ voiceId: 'v0', noticing: 'from A' }]));
    ledger.recordTerminal('run:B', 'v0', answeredEmpty());
    expect(ledger.getRow('run:A', 'v0')?.state).toBe('answered-with-findings');
    expect(ledger.getRow('run:B', 'v0')?.state).toBe('answered-empty');
    expect(ledger.findingCount('run:A')).toBe(1);
    expect(ledger.findingCount('run:B')).toBe(0);
    ledger.close();
  });
});
