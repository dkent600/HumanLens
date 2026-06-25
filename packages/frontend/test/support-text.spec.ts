import { describe, it, expect } from 'vitest';
import { SupportTextValueConverter } from '../src/resources/support-text';

// Honest-counting wording. A finding's support is derived ("N comments across M
// sources"), and the SINGULAR form matters: a finding anchored to exactly one unit from
// one source must read "1 comment across 1 source", not "1 comments across 1 sources".
// The existing render tests only ever exercise the plural path (count 2), so the
// singular branches in the converter were never run.

describe('SupportTextValueConverter', () => {
  const converter = new SupportTextValueConverter();

  it('uses singular nouns for a count of one (1 comment across 1 source)', () => {
    expect(converter.toView({ unitCount: 1, sourceCount: 1 })).toBe(
      'appears in 1 comment across 1 source',
    );
  });

  it('uses plural nouns for counts above one', () => {
    expect(converter.toView({ unitCount: 3, sourceCount: 2 })).toBe(
      'appears in 3 comments across 2 sources',
    );
  });

  it('chooses singular vs plural independently for units and sources', () => {
    expect(converter.toView({ unitCount: 2, sourceCount: 1 })).toBe(
      'appears in 2 comments across 1 source',
    );
    expect(converter.toView({ unitCount: 1, sourceCount: 2 })).toBe(
      'appears in 1 comment across 2 sources',
    );
  });
});
