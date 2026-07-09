import type { Ledger } from './ledger.js';
import { TERMINAL_STATES, type ReasonCode, type TerminalState } from './terminal-state.js';

// The inspectable REPORT (build-phase governance: "green is inspectable, not asserted").
// Everything here is DERIVED FROM THE LEDGER — the report accuracy property (P6) is that
// this derivation matches the ledger exactly (states sum to the voice count; the
// attributed-finding count matches persisted findings). The report is what a run prints so
// a reviewer can see WHAT was tested and where the gaps landed, rather than trusting a
// green tick.

export interface CompletenessReport {
  readonly runId: string;
  readonly voiceCount: number;
  readonly byState: Readonly<Record<TerminalState, number>>;
  readonly byReason: Readonly<Record<string, number>>;
  /** Voices that ended in a non-answered state — the surfaced gaps a human would review. */
  readonly gaps: readonly { readonly voiceId: string; readonly state: TerminalState; readonly reasonCode: ReasonCode }[];
  readonly attributedFindingCount: number;
  readonly quarantinedFindingCount: number;
}

export function buildReport(ledger: Ledger, runId: string): CompletenessReport {
  const rows = ledger.allRows(runId);
  const byState: Record<TerminalState, number> = {
    'answered-with-findings': 0,
    'answered-empty': 0,
    'delivered-but-unusable': 0,
    'failed': 0,
  };
  const byReason: Record<string, number> = {};
  const gaps: { voiceId: string; state: TerminalState; reasonCode: ReasonCode }[] = [];

  for (const row of rows) {
    byState[row.state] += 1;
    byReason[row.reasonCode] = (byReason[row.reasonCode] ?? 0) + 1;
    if (row.state === 'delivered-but-unusable' || row.state === 'failed') {
      gaps.push({ voiceId: row.voiceId, state: row.state, reasonCode: row.reasonCode });
    }
  }

  return {
    runId,
    voiceCount: rows.length,
    byState,
    byReason,
    gaps,
    attributedFindingCount: ledger.findingCount(runId),
    quarantinedFindingCount: ledger.quarantineCount(runId),
  };
}

/** A short human-readable rendering — used by the CLI runner and, on failure, test output. */
export function formatReport(report: CompletenessReport): string {
  const lines: string[] = [];
  lines.push(`run ${report.runId} — ${report.voiceCount} voices`);
  for (const state of TERMINAL_STATES) {
    lines.push(`  ${state.padEnd(24)} ${report.byState[state]}`);
  }
  lines.push(`  ${'—'.repeat(24)}`);
  lines.push(`  attributed findings     ${report.attributedFindingCount}`);
  lines.push(`  quarantined findings    ${report.quarantinedFindingCount}`);
  if (report.gaps.length > 0) {
    lines.push(`  gaps (surfaced, ${report.gaps.length}):`);
    for (const gap of report.gaps) {
      lines.push(`    ${gap.voiceId.padEnd(14)} ${gap.state} / ${gap.reasonCode}`);
    }
  }
  return lines.join('\n');
}
