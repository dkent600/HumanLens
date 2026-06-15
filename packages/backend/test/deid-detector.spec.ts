import { describe, expect, it } from 'vitest';
import { TrivialDeidDetector } from '../src/seams/deid-detector.js';

describe('TrivialDeidDetector (parked stub)', () => {
  it('clears content by default (humans de-identify before entry)', async () => {
    const detector = new TrivialDeidDetector();
    const scan = await detector.scan('a de-identified comment', 'en');
    expect(scan.cleared).toBe(true);
    expect(scan.findings).toHaveLength(0);
  });

  it('flags content matching a configured pattern', async () => {
    const detector = new TrivialDeidDetector({ flagPatterns: [/\bAcme Corp\b/] });
    const scan = await detector.scan('I work at Acme Corp', 'en');
    expect(scan.cleared).toBe(false);
    expect(scan.findings.length).toBeGreaterThan(0);
  });
});
