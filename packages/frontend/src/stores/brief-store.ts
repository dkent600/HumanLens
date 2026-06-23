import { resolve } from 'aurelia';
import { ILogger } from '@aurelia/kernel';
import type { ClientSafeFinding } from '@humanlens/shared';
import { IBriefApi, type BriefReason } from '../seams/brief-api';

// BriefStore — the review screen's state + structural derivation, between the
// view-model and the Service. It is a plain concrete DI singleton (not a seam):
// the analog of the engine's internal coordinators, tested for real over a fake
// Service. It holds the CLIENT-SAFE findings only and owns the structural transforms
// (group by lens, nest subthemes); presentational formatting stays in the view
// (a value converter), not here.

export type BriefStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** A finding plus its nested subtheme findings (by `parent`). */
export interface FindingNode {
  readonly finding: ClientSafeFinding;
  readonly children: readonly FindingNode[];
}

/** Findings of one lens, as a subtheme forest. */
export interface LensGroup {
  readonly lens: string;
  readonly roots: readonly FindingNode[];
}

export class BriefStore {
  private readonly api: IBriefApi = resolve(IBriefApi);
  private readonly log = resolve(ILogger).scopeTo('BriefStore');

  status: BriefStatus = 'idle';
  engagementId: string | null = null;
  reason: BriefReason | null = null;
  groups: readonly LensGroup[] = [];

  async load(engagementId: string): Promise<void> {
    this.status = 'loading';
    this.reason = null;
    this.engagementId = engagementId;
    this.log.debug('loading brief', engagementId);

    const result = await this.api.getBrief(engagementId);
    if (result.ok) {
      this.groups = groupByLens(result.brief.findings);
      this.status = 'loaded';
      this.log.debug('brief loaded', `${result.brief.findings.length} client-safe finding(s)`);
    } else {
      this.groups = [];
      this.reason = result.reason;
      this.status = 'error';
      this.log.warn('brief unavailable', result.reason);
    }
  }
}

/**
 * Group findings by the lens that produced them (preserving first-seen lens order),
 * and within each group nest subthemes under their parent. Pure structural
 * derivation — no formatting, no display strength (that is the view's value converter).
 */
export function groupByLens(findings: readonly ClientSafeFinding[]): LensGroup[] {
  const order: string[] = [];
  const byLens = new Map<string, ClientSafeFinding[]>();
  for (const finding of findings) {
    let bucket = byLens.get(finding.lens);
    if (!bucket) {
      bucket = [];
      byLens.set(finding.lens, bucket);
      order.push(finding.lens);
    }
    bucket.push(finding);
  }
  return order.map((lens) => ({ lens, roots: buildSubthemeTree(byLens.get(lens)!) }));
}

/**
 * Build the parent -> child forest within one lens group. A finding whose `parent`
 * is absent from the group (or undefined) is a root. Child arrays are shared by
 * reference, so nesting is correct regardless of finding order.
 */
function buildSubthemeTree(findings: readonly ClientSafeFinding[]): FindingNode[] {
  const childrenOf = new Map<string, FindingNode[]>();
  for (const finding of findings) {
    childrenOf.set(finding.findingId, []);
  }
  const roots: FindingNode[] = [];
  for (const finding of findings) {
    const node: FindingNode = { finding, children: childrenOf.get(finding.findingId)! };
    if (finding.parent !== undefined && childrenOf.has(finding.parent)) {
      childrenOf.get(finding.parent)!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
