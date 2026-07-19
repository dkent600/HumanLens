// The CROSS-VOICE cited-or-residual AUDIT (build_approach.md, "Lens processing" cross-voice
// paragraph; build_implementation.md, "Cross-voice lenses — cited-or-residual audit").
//
// The per-voice lenses prevent the drop by fan-out — one call per voice, no list to skip
// from. Cross-voice lenses cannot work that way: their job is to read the WHOLE finding set
// at once, so the list is unavoidable and so is the risk of skipping. The completeness
// guarantee therefore moves AFTER the call: every emitted pattern cites the finding ids it
// was built on, and this orchestration code subtracts cited from delivered. Whatever was
// never cited lands in a visible RESIDUAL. The model can fail to use a finding; it cannot
// hide one.
//
// TWO LOAD-BEARING RULES (do not violate to make numbers look better):
//   1. A non-empty residual is EXPECTED and correct — a finding no pattern absorbed is
//      legitimately not part of a pattern (a reviewable outlier). It is NEVER a failure, an
//      error state, or a retry trigger. This module returns diagnostics; it decides nothing.
//   2. The audit and the ratio are REVIEW DIAGNOSTICS, never a model target. Nothing here is
//      fed back to the synthesis prompt; the prompt never instructs exhaustive citation.

/**
 * The audit over one cross-voice lens run. `delivered` is the complete, closed set handed
 * to the lens (deduped, order preserved). Every delivered id is in EXACTLY ONE of `cited`
 * or `residual` — the partition the guarantee rests on. `quarantined` holds cited ids that
 * were NOT delivered (hallucinated); they are recorded, never counted as covering anything.
 */
export interface CitationAudit {
  readonly delivered: readonly string[];
  /** Delivered ids some pattern cited — the "woven into a pattern" set. */
  readonly cited: readonly string[];
  /** Delivered ids NO pattern cited — visible outliers for a human's look (expected non-empty). */
  readonly residual: readonly string[];
  /** Cited ids not in the delivered set — hallucinated, quarantined, never cover anything (P3 discipline). */
  readonly quarantined: readonly string[];
  /** cited / delivered ∈ [0,1] — a review diagnostic, NEVER a target. 1 when delivered is empty. */
  readonly coverageRatio: number;
}

/**
 * Compute the cited-or-residual audit: partition the delivered set into cited vs residual by
 * the (raw) cited ids, and quarantine any cited id not delivered. The residual is EXACTLY
 * `delivered − cited`; a hallucinated cited id reduces nothing (it lands in `quarantined`,
 * not `cited`). Pure and total — the same delivered/cited always yield the same audit.
 */
export function computeCitationAudit(
  delivered: Iterable<string>,
  cited: Iterable<string>,
): CitationAudit {
  const deliveredList = [...new Set(delivered)]; // the closed set, deduped, order preserved
  const deliveredSet = new Set(deliveredList);
  const citedSet = new Set(cited);

  const citedValid: string[] = [];
  const residual: string[] = [];
  for (const id of deliveredList) {
    if (citedSet.has(id)) {
      citedValid.push(id);
    } else {
      residual.push(id);
    }
  }
  // Hallucinated citations: cited but never delivered. Recorded, never counted as covering.
  const quarantined = [...citedSet].filter((id) => !deliveredSet.has(id));

  const coverageRatio = deliveredList.length === 0 ? 1 : citedValid.length / deliveredList.length;
  return { delivered: deliveredList, cited: citedValid, residual, quarantined, coverageRatio };
}

/**
 * A short, inspectable rendering of the audit for the eval harness — the residual contents
 * and the coverage ratio per cross-voice lens, the same way the harness prints the ledger.
 * Deliberately minimal: this proves the mechanism and defers the product decision (per-lens
 * residual views vs. one consolidated review view), which is an open design item, not settled here.
 */
export function formatCitationAudit(lensId: string, audit: CitationAudit): string {
  const pct = (audit.coverageRatio * 100).toFixed(0);
  const lines = [
    `cross-voice audit [${lensId}] — ${audit.delivered.length} delivered, ` +
      `${audit.cited.length} cited, ${audit.residual.length} residual  (coverage ${pct}%)`,
  ];
  if (audit.residual.length > 0) {
    lines.push(`  residual (uncited — expected, for a human's look): ${audit.residual.join(', ')}`);
  }
  if (audit.quarantined.length > 0) {
    lines.push(`  quarantined (hallucinated citations, never counted): ${audit.quarantined.join(', ')}`);
  }
  return lines.join('\n');
}
