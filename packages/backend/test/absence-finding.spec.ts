import { describe, expect, it } from 'vitest';
import {
  assembleBrief,
  isClientSafe,
  projectToClientSafe,
} from '../src/engine/assemble.js';
import { makeAbsenceFinding, reviseDisposition } from '../src/domain/finding.js';

// Absence findings are the sanctioned exception to evidence anchoring ("the dog that
// did not bark"). The factory is unit-tested in finding.spec; these guard the
// exemption PAST the factory — a named structural-tier criterion that was unguarded
// end to end:
//   1. an absence finding survives Assemble -> projection as a client-safe finding
//      (findingKind 'absence', empty evidenceLinks, no internal-only field crossing);
//   2. a PROMOTED absence finding reaches the client-safe layer;
//   3. the sensitivity backstop still holds for an absence finding;
//   4. reviseDisposition rebuilds an absence finding through its own (absence) branch.

// The fields that govern the internal/client-safe split and must NEVER cross out.
const INTERNAL_ONLY_KEYS = ['clearedToClientSafe', 'sensitivity', 'supportSet'] as const;

describe('Absence finding — through Assemble and projection', () => {
  it('a held absence finding is internal-only (held by default, like any finding)', () => {
    const absence = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
    });
    const brief = assembleBrief('eng:1', [absence]);
    expect(brief.internal.map((f) => f.findingId)).toEqual(['listening:abs']);
    expect(brief.clientSafe).toHaveLength(0); // safe failure mode is silence
  });

  it('projects to a client-safe finding: absence kind, empty links, no internal-only fields', () => {
    const promoted = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
      clearedToClientSafe: true,
    });
    const projected = projectToClientSafe(promoted);

    expect(projected.findingKind).toBe('absence');
    expect(projected.evidenceLinks).toEqual([]); // unanchored by nature, and that survives
    expect(projected.support).toEqual({ sourceCount: 0, unitCount: 0 });
    for (const key of INTERNAL_ONLY_KEYS) {
      expect(projected).not.toHaveProperty(key);
    }
  });

  it('a promoted absence finding appears in the client-safe layer', () => {
    const promoted = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
      clearedToClientSafe: true,
    });
    expect(isClientSafe(promoted)).toBe(true);

    const brief = assembleBrief('eng:1', [promoted]);
    expect(brief.clientSafe.map((f) => f.findingId)).toEqual(['listening:abs']);
    expect(brief.clientSafe[0]?.findingKind).toBe('absence');
    expect(brief.clientSafe[0]?.evidenceLinks).toEqual([]);
  });

  it('holds a sensitive absence finding back even when promoted (backstop holds)', () => {
    const sensitivePromoted = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
      clearedToClientSafe: true,
      sensitivity: 'sensitive',
    });
    expect(isClientSafe(sensitivePromoted)).toBe(false);
    expect(assembleBrief('eng:1', [sensitivePromoted]).clientSafe).toHaveLength(0);
  });
});

describe('Absence finding — reviseDisposition (the absence branch)', () => {
  it('promotes an absence finding, rebuilt through the absence factory', () => {
    const held = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
    });

    const revised = reviseDisposition(held, { clearedToClientSafe: true }, []);

    expect(revised.findingKind).toBe('absence');
    expect(revised.findingId).toBe('listening:abs'); // identity preserved -> supersedes in place
    expect(revised.lens).toBe('listening');
    expect(revised.verbatim).toBeNull(); // absence has no source to quote
    expect(revised.evidenceLinks).toEqual([]); // still unanchored by nature
    expect(revised.supportSet).toEqual({ sourceCount: 0, unitCount: 0 }); // re-derived, empty
    expect(revised.clearedToClientSafe).toBe(true);
    expect(revised.sensitivity).toBe('normal'); // unchanged
  });

  it('flags an absence finding sensitive without promoting, leaving it held', () => {
    const held = makeAbsenceFinding({
      findingId: 'listening:abs',
      lens: 'listening',
    });

    const revised = reviseDisposition(held, { sensitivity: 'sensitive' }, []);

    expect(revised.findingKind).toBe('absence');
    expect(revised.sensitivity).toBe('sensitive');
    expect(revised.clearedToClientSafe).toBe(false); // unchanged -> held
    expect(isClientSafe(revised)).toBe(false);
  });
});
