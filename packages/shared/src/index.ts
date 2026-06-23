// @humanlens/shared — the client-safe contract shared by frontend and backend.
//
// The client-safe layer is a filtered, voice-calibrated projection of the
// internal finding set (client-safe ⊆ internal), with evidence links preserved.
// The DTO / contract types that cross the wire from backend to frontend will
// live here so both sides import one definition.
//
// ┌─ INVARIANT — DO NOT BREACH ────────────────────────────────────────────┐
// │ ONLY client-safe DTOs belong in this package. The `client-safe ⊆        │
// │ internal` guarantee is realized IN CODE by `shared` publishing          │
// │ client-safe shapes only: if the frontend can't import an internal type, │
// │ it can't leak one. Internal-layer domain types (Unit, deid_status, the  │
// │ internal Finding, ...) live in backend (`domain/types.ts`) and must     │
// │ NEVER be imported into — or redefined within — `shared`, however        │
// │ convenient. A lint rule (root eslint.config.mjs) forbids `shared` from  │
// │ importing backend/frontend to keep this honest; the rule is a backstop, │
// │ not a substitute for not adding internal shapes here in the first place.│
// └─────────────────────────────────────────────────────────────────────────┘
//
// Real contract types are filled in as the model lands; the placeholder below
// remains so the cross-package import stays exercised end-to-end.

export interface ContractInfo {
  /** The Human Lens module this contract serves. */
  readonly module: string;
  /** Contract revision — bumped when the wire shape changes. */
  readonly contractVersion: string;
}

export const CONTRACT_INFO: ContractInfo = {
  module: 'listening-brief',
  contractVersion: '0',
};

/** Derived support behind a finding — how much evidence, counted honestly. */
export interface ClientSafeSupport {
  /** Distinct sources behind the evidence (counted by speaker token — never "N people"). */
  readonly sourceCount: number;
  /** Number of units cited as evidence. */
  readonly unitCount: number;
}

/**
 * The client-safe projection of a finding — the only finding shape that crosses
 * to the frontend, and ultimately into a client-safe brief.
 *
 * This is a DELIBERATELY NARROWED view of the internal finding. It carries what a
 * client may see and NOTHING that governs the internal/client-safe split:
 *   - `clearedToClientSafe` and `sensitivity` are internal gating signals — a
 *     finding's disposition is decided inside the engine, never shipped outward.
 *   - `content` here is the (eventually voice-calibrated) client-facing phrasing.
 *   - `evidenceLinks` ARE preserved, so traceability survives into the client view.
 *
 * Because the internal layer is *every* finding and the client-safe layer is the
 * promoted subset of it, this projection can only ever describe a finding that
 * already exists internally — `client-safe ⊆ internal`, realized in the types.
 */
export interface ClientSafeFinding {
  readonly findingId: string;
  /** Which lens produced it. */
  readonly lens: string;
  /** Client-facing phrasing of what was noticed. */
  readonly content: string;
  /** Unit ids supporting the finding — preserved so a quote can be traced back. */
  readonly evidenceLinks: readonly string[];
  /** Derived strength; safe to show because it falls out of the evidence. */
  readonly support: ClientSafeSupport;
  /** Ordinary finding, or the sanctioned finding about silence/absence. */
  readonly findingKind: 'ordinary' | 'absence';
  /** The finding this nests under, if any (so subthemes survive the projection). */
  readonly parent?: string;
}

/**
 * The wire shape of a brief read — what `GET /engagements/:id/brief` returns and
 * the frontend Service mirrors. It carries the CLIENT-SAFE layer ONLY: a brief's
 * findings here are the promoted, projected subset, never the internal candid set.
 * The engagement id rides along so a consumer can key/cache the brief without
 * parsing it out of a finding.
 *
 * Only client-safe shapes belong on this envelope — `engagementId` is a primitive
 * and `findings` are `ClientSafeFinding`s, so no internal-layer type can ride in.
 */
export interface ClientSafeBrief {
  readonly engagementId: string;
  readonly findings: readonly ClientSafeFinding[];
}
