import { describe, expect, it } from 'vitest';
import {
  assembleBrief,
  isClientSafe,
  projectToClientSafe,
} from '../src/engine/assemble.js';
import { makeOrdinaryFinding, type Finding } from '../src/domain/finding.js';

// Structural guards for the two-layer output: client-safe ⊆ internal, held by
// default, sensitivity as a backstop, evidence links preserved, and no
// internal-only field crossing into the projection.

const units = [
  { unitId: 'u1', speakerToken: 'spk-a' },
  { unitId: 'u2', speakerToken: 'spk-b' },
];

function finding(
  id: string,
  overrides: Partial<Pick<Finding, 'clearedToClientSafe' | 'sensitivity'>> = {},
): Finding {
  return makeOrdinaryFinding({
    findingId: id,
    lens: 'listening',
    verbatim: `finding ${id}`,
    evidenceLinks: ['u1', 'u2'],
    units,
    clearedToClientSafe: overrides.clearedToClientSafe,
    sensitivity: overrides.sensitivity,
  });
}

// The fields that govern the internal/client-safe split and must NEVER cross out.
const INTERNAL_ONLY_KEYS = ['clearedToClientSafe', 'sensitivity', 'supportSet'] as const;

describe('Assemble — the two-layer split', () => {
  it('holds findings by default: an unpromoted finding is internal-only', () => {
    const held = finding('listening:0'); // default held
    const brief = assembleBrief('eng:1', [held]);

    expect(brief.internal).toHaveLength(1); // internal = every finding
    expect(brief.clientSafe).toHaveLength(0); // safe failure mode is silence
  });

  it('admits a finding only by affirmative promotion', () => {
    const promoted = finding('listening:0', { clearedToClientSafe: true });
    const brief = assembleBrief('eng:1', [promoted]);

    expect(brief.clientSafe.map((f) => f.findingId)).toEqual(['listening:0']);
  });

  it('holds a sensitive finding back even when promoted (sensitivity is a backstop)', () => {
    const sensitivePromoted = finding('listening:0', {
      clearedToClientSafe: true,
      sensitivity: 'sensitive',
    });
    expect(isClientSafe(sensitivePromoted)).toBe(false);

    const brief = assembleBrief('eng:1', [sensitivePromoted]);
    expect(brief.clientSafe).toHaveLength(0);
  });

  it('client-safe is a subset of internal — every client-safe finding exists internally', () => {
    const held = finding('listening:0');
    const promoted = finding('listening:1', { clearedToClientSafe: true });
    const brief = assembleBrief('eng:1', [held, promoted]);

    const internalIds = new Set(brief.internal.map((f) => f.findingId));
    for (const cs of brief.clientSafe) {
      expect(internalIds.has(cs.findingId)).toBe(true);
    }
    expect(brief.clientSafe.length).toBeLessThanOrEqual(brief.internal.length);
  });
});

describe('Assemble — projection integrity', () => {
  it('carries no internal-only field into the client-safe projection', () => {
    const projected = projectToClientSafe(
      finding('listening:0', { clearedToClientSafe: true }),
    );
    for (const key of INTERNAL_ONLY_KEYS) {
      expect(projected).not.toHaveProperty(key);
    }
  });

  it('every projected key is one the internal finding also has (client-safe ⊆ internal)', () => {
    const internal = finding('listening:0', { clearedToClientSafe: true });
    const projected = projectToClientSafe(internal);
    // `support` is the projected name for the derived `supportSet`; allow that rename.
    const internalKeys = new Set([...Object.keys(internal), 'support']);
    for (const key of Object.keys(projected)) {
      expect(internalKeys.has(key)).toBe(true);
    }
  });

  it('preserves evidence links and the derived support into the client view', () => {
    const projected = projectToClientSafe(
      finding('listening:0', { clearedToClientSafe: true }),
    );
    expect(projected.evidenceLinks).toEqual(['u1', 'u2']);
    expect(projected.support).toEqual({ sourceCount: 2, unitCount: 2 });
  });
});
