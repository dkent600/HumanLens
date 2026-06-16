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
// For now this carries a single placeholder value so the cross-package import
// is exercised end-to-end; real contract types replace it as the model lands.

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
