// The de-identification detector — the gate's scanner. This is ONE swappable
// interface behind which the real detector is deliberately PARKED (pending the
// Inclusity conversation). The case-study stub resolves trivially and is
// configurable; a real detector (incl. cross-language) drops in here without
// changing the gate or its position in the pipeline.

export interface DeidFinding {
  /** What kind of residual identifier was suspected (e.g. a name, an org, an email). */
  readonly kind: string;
  readonly note?: string;
}

export interface DeidScan {
  readonly cleared: boolean;
  readonly findings: readonly DeidFinding[];
}

export interface DeidDetector {
  scan(content: string, language: string): Promise<DeidScan>;
}

export interface TrivialDeidDetectorOptions {
  /**
   * Patterns that, if found in content, cause a flag. Default: none — so the
   * stub clears everything (humans de-identify before entry; this is a backstop).
   * Tests and demos can configure flagging without touching the gate.
   */
  readonly flagPatterns?: readonly RegExp[];
}

export class TrivialDeidDetector implements DeidDetector {
  constructor(private readonly options: TrivialDeidDetectorOptions = {}) {}

  scan(content: string, _language: string): Promise<DeidScan> {
    const findings: DeidFinding[] = (this.options.flagPatterns ?? [])
      .filter((pattern) => pattern.test(content))
      .map((pattern) => ({ kind: 'pattern-match', note: `matched ${String(pattern)}` }));
    return Promise.resolve({ cleared: findings.length === 0, findings });
  }
}
