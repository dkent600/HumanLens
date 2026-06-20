// The internal Finding — the counterpart to a Unit. If a unit is something a
// person said, a finding is something a lens noticed. Every lens, in every layer,
// emits findings of this one common interface, so findings can flow down the
// pipeline and later lenses can read earlier ones.
//
// The trust properties from build_approach.md ("The Finding") are encoded as
// TYPES wherever possible, so the posture is unrepresentable-when-violated rather
// than merely hoped-for:
//
//   1. ANCHORING. An interpretive finding must link to >=1 unit; the sanctioned
//      `absence` finding (the dog that did not bark) is the only exception. This
//      is the discriminated union below: an ordinary finding's `evidenceLinks` is
//      a NON-EMPTY tuple type; an absence finding's is the empty tuple.
//   2. DERIVED STRENGTH. There is no asserted confidence/strength field. A
//      finding's `supportSet` is COMPUTED from its evidence links + the units they
//      cite (see `deriveSupportSet`), counted across distinct sources by speaker
//      token — never inflated into a count of people. A lens cannot hand in a
//      strength; it falls out of the evidence.
//   3. DISPOSITION DEFAULTS TO HELD. Reaching the client-safe layer is an
//      AFFIRMATIVE promotion (`clearedToClientSafe`), not a default. The safe
//      failure mode is silence, not exposure. Because the internal layer is every
//      finding and the client-safe layer is the promoted subset, a boolean that
//      defaults false makes both "held by default" and "client-safe ⊆ internal"
//      obvious in the type.
//   4. SENSITIVITY IS ITS OWN FIELD, distinct from a unit's `deidStatus`. De-id
//      asks whether material could expose who said it (handled upstream at the
//      gate). Sensitivity asks whether a finding, even fully anonymous and true,
//      is charged enough that surfacing it could do harm. It is a backstop on
//      promotion (see assemble.ts).

import type { UnitId } from './types.js';

export type FindingId = string;

/** Which lens produced a finding. Open set; grows as lenses across the layers land. */
export type LensId = 'listening' | 'human-meaning' | 'tension' | 'discernment';

/** A non-empty readonly tuple — at least one element, enforced at the type level. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** Whether a finding needs careful handling — separate from a unit's de-id status. */
export type Sensitivity = 'normal' | 'sensitive';

/**
 * Derived support behind a finding: the distinct sources and the unit count its
 * evidence spans. Computed from the evidence, never asserted — so "how much
 * evidence" is something the system can show and a reviewer can check.
 *
 * (The `segment` dimension named in build_approach.md is deferred with the unit
 * type-specific extensions; sources are counted by `speakerToken` for now.)
 */
export interface SupportSet {
  /** Distinct sources behind the evidence, counted by speaker token. */
  readonly sourceCount: number;
  /** Number of units cited as evidence. */
  readonly unitCount: number;
}

interface FindingCommon {
  readonly findingId: FindingId;
  readonly lens: LensId;
  /** What was noticed (the candid internal phrasing). */
  readonly content: string;
  /** Derived, not asserted — see `deriveSupportSet`. */
  readonly supportSet: SupportSet;
  /** Whether this finding needs careful handling. Backstops promotion at Assemble. */
  readonly sensitivity: Sensitivity;
  /**
   * Affirmative promotion to the client-safe layer. Defaults to false (HELD):
   * a finding is internal-only until something — the Discernment lens or a human
   * reviewer — clears it. The internal layer is every finding regardless.
   */
  readonly clearedToClientSafe: boolean;
  /** The finding this nests under, so themes can carry subthemes. */
  readonly parent?: FindingId;
}

/** An ordinary finding: MUST be anchored to at least one unit. */
export interface OrdinaryFinding extends FindingCommon {
  readonly findingKind: 'ordinary';
  readonly evidenceLinks: NonEmpty<UnitId>;
}

/** The sanctioned exception: a finding about silence/absence, which by nature has no anchor. */
export interface AbsenceFinding extends FindingCommon {
  readonly findingKind: 'absence';
  readonly evidenceLinks: readonly [];
}

export type Finding = OrdinaryFinding | AbsenceFinding;

/** Minimal view of a unit needed to derive support — keeps this module decoupled from the full Unit. */
interface SupportableUnit {
  readonly unitId: UnitId;
  readonly speakerToken: string;
}

/**
 * Compute the support behind a set of evidence links by looking at the units they
 * cite. Sources are distinct speaker tokens, so two passages from one interview
 * count as one source — the honest-counting rule from build_approach.md.
 */
export function deriveSupportSet(
  evidenceLinks: readonly UnitId[],
  units: readonly SupportableUnit[],
): SupportSet {
  const byId = new Map(units.map((u) => [u.unitId, u]));
  const cited = evidenceLinks.map((id) => byId.get(id)).filter((u): u is SupportableUnit => !!u);
  const sources = new Set(cited.map((u) => u.speakerToken));
  return { sourceCount: sources.size, unitCount: cited.length };
}

/** Thrown when an ordinary finding is constructed with no anchors — the runtime mirror of the type. */
export class UnanchoredFindingError extends Error {
  constructor(findingId: FindingId) {
    super(`ordinary finding ${findingId} has no evidence links (only absence findings may be unanchored)`);
    this.name = 'UnanchoredFindingError';
  }
}

interface MakeOrdinaryArgs {
  readonly findingId: FindingId;
  readonly lens: LensId;
  readonly content: string;
  readonly evidenceLinks: readonly UnitId[];
  readonly units: readonly SupportableUnit[];
  readonly sensitivity?: Sensitivity;
  readonly clearedToClientSafe?: boolean;
  readonly parent?: FindingId;
}

/**
 * Build an ordinary (evidence-anchored) finding. Provider output arrives untyped,
 * so this is the single sanctioned construction path: it enforces anchoring at
 * runtime (the type already enforces it at compile time) and DERIVES the support
 * set from the evidence — a caller cannot assert a strength. Disposition defaults
 * to held and sensitivity to normal.
 */
export function makeOrdinaryFinding(args: MakeOrdinaryArgs): OrdinaryFinding {
  if (args.evidenceLinks.length === 0) {
    throw new UnanchoredFindingError(args.findingId);
  }
  const [first, ...rest] = args.evidenceLinks;
  return {
    findingKind: 'ordinary',
    findingId: args.findingId,
    lens: args.lens,
    content: args.content,
    evidenceLinks: [first, ...rest],
    supportSet: deriveSupportSet(args.evidenceLinks, args.units),
    sensitivity: args.sensitivity ?? 'normal',
    clearedToClientSafe: args.clearedToClientSafe ?? false,
    ...(args.parent !== undefined ? { parent: args.parent } : {}),
  };
}

interface MakeAbsenceArgs {
  readonly findingId: FindingId;
  readonly lens: LensId;
  readonly content: string;
  readonly sensitivity?: Sensitivity;
  readonly clearedToClientSafe?: boolean;
  readonly parent?: FindingId;
}

/** Build a sanctioned absence finding — exempt from anchoring; its support is empty by nature. */
export function makeAbsenceFinding(args: MakeAbsenceArgs): AbsenceFinding {
  return {
    findingKind: 'absence',
    findingId: args.findingId,
    lens: args.lens,
    content: args.content,
    evidenceLinks: [],
    supportSet: { sourceCount: 0, unitCount: 0 },
    sensitivity: args.sensitivity ?? 'normal',
    clearedToClientSafe: args.clearedToClientSafe ?? false,
    ...(args.parent !== undefined ? { parent: args.parent } : {}),
  };
}

/** A change to a finding's disposition — the only fields the Discernment audit may revise. */
export interface DispositionChange {
  readonly clearedToClientSafe?: boolean;
  readonly sensitivity?: Sensitivity;
}

/**
 * Rebuild a finding with a revised disposition — the sanctioned path for the
 * Facilitator Discernment Lens to promote a finding to the client-safe layer and/or
 * flag it sensitive WITHOUT mutating it. It is the generalization of the test's old
 * `promote()` helper: a NEW finding is constructed through the same factories, so
 * the support set is RE-DERIVED from the unchanged evidence (never hand-set) and the
 * anchoring invariant is re-enforced. Everything that identifies the finding —
 * `findingId`, `lens`, `content`, `evidenceLinks`, `parent` — is carried verbatim,
 * so the revision shares the original's id and the Guardrail stage can supersede the
 * original in place. Fields the change leaves unset keep the finding's current value.
 */
export function reviseDisposition(
  finding: Finding,
  change: DispositionChange,
  units: readonly SupportableUnit[],
): Finding {
  const clearedToClientSafe = change.clearedToClientSafe ?? finding.clearedToClientSafe;
  const sensitivity = change.sensitivity ?? finding.sensitivity;
  if (finding.findingKind === 'absence') {
    return makeAbsenceFinding({
      findingId: finding.findingId,
      lens: finding.lens,
      content: finding.content,
      sensitivity,
      clearedToClientSafe,
      ...(finding.parent !== undefined ? { parent: finding.parent } : {}),
    });
  }
  return makeOrdinaryFinding({
    findingId: finding.findingId,
    lens: finding.lens,
    content: finding.content,
    evidenceLinks: finding.evidenceLinks,
    units,
    sensitivity,
    clearedToClientSafe,
    ...(finding.parent !== undefined ? { parent: finding.parent } : {}),
  });
}

/**
 * Runtime guard for the anchoring invariant — usable on any finding, however it
 * was constructed. The structural evaluation tier leans on this: an ordinary
 * finding with no evidence is a defect the pipeline catches, not something we
 * trust the prompt to have done well.
 */
export function isEvidenceAnchored(finding: Finding): boolean {
  return finding.findingKind === 'absence' || finding.evidenceLinks.length > 0;
}
