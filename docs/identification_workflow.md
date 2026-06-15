> Edited only in the chat where this file is the working copy. All other chats: read-only reference.

# Identification Workflow (SMI Internal)

*How identity, de-identification, pseudonymity, and re-identification are handled end to end — across the boundary between Inclusity's own process and Human Lens. This workflow deliberately spans more than the tool: part of it is Inclusity's practice, which lives entirely outside Human Lens, and part of it is the contract Human Lens binds to at the boundary. It is documented separately for exactly that reason — `build_approach.md` describes Human Lens internals and is the wrong home for a process that is mostly not Human Lens.*

---

## Status and authority

- **Status: TARGET model + open questions.** This is the model SMI intends to design to. The Inclusity-side process is **not yet mapped** — nothing here about how Inclusity works *today* should be treated as established fact until confirmed with Inclusity (Maria Arcocha White, CEO; Dr. Mitchell Campbell, Director of Research and Evaluation). The open questions in the final section are load-bearing, not housekeeping.
- **Authority.** Where this document touches Human Lens internals (the gate, units, the pseudonym's in-system use), `build_approach.md` is authoritative. The Inclusity-side process and the Inclusity↔Human Lens contract are this document's own domain; no other doc owns them.
- **Vocabulary** (settled): **actor** = the Inclusity staff member operating Human Lens; **client** = Inclusity's customer organization; **participant** = an individual person in the source material whose words are analyzed and whose identity is protected.

## The organizing principle: re-identification belongs to Inclusity

The earlier framing — "no one can ever re-identify" — was true of the *system* but naïve about the *practice*. A culture consultancy plausibly must sometimes act on what it hears (duty of care, follow-up, a deletion request, longitudinal tracking), which requires knowing who said something. The resolution is a boundary, not a capability inside the tool:

**Re-identification is Inclusity's, performed through a key Inclusity holds outside Human Lens. Human Lens stays key-less.**

This *refines* the confidentiality guarantee rather than weakening it. The load-bearing part is intact and becomes more precise:

> **Human Lens cannot re-identify anyone.** It never receives, stores, or derives the mapping from a pseudonym to a real person. Any re-identification happens on Inclusity's side, by Inclusity, using a key Human Lens never sees.

What we stop claiming is the over-broad "no one, ever." What we keep — and can now state exactly — is that the tool itself holds nothing that could expose a participant.

## The two sides of the boundary

**Inclusity's side (outside Human Lens).**
- Holds participants' real identities and the pseudonym ↔ identity mapping (the "key").
- Assigns each source a pseudonym before material is entered.
- Is the **sole** custodian of the key and the **only** party able to re-identify — deliberately, when their practice and their promises to participants allow it.
- De-identifies the raw material (today: by hand; see open questions).

**Human Lens's side.**
- Receives material that is *already de-identified*, plus an *opaque pseudonym* per source.
- Uses the pseudonym internally only to keep relationships straight — which units share a source, so support is counted as "N units across M sources," never "N people," and so a single interviewee's many passages are not counted as many voices.
- Emits the pseudonym in its output, so Inclusity can map findings back to a real person *on their side* when they legitimately need to.
- Never receives, stores, or derives the key. The pseudonym is meaningless to Human Lens beyond "same source / different source."

## End-to-end workflow (who does what, when)

Each step is tagged with the side it lives on.

1. **[Inclusity]** Collect raw qualitative material (survey comments, interviews, listening-session notes), which names real participants.
2. **[Inclusity]** De-identify the material and assign each source an opaque pseudonym; record the pseudonym ↔ identity mapping in Inclusity's own key, held outside Human Lens. *(This is the primary de-identification. Method today: to confirm.)*
3. **[Boundary → Human Lens]** The actor brings the de-identified material and its pseudonyms into Human Lens at Intake. Identified material never crosses this boundary.
4. **[Human Lens]** Normalize turns the input into units; each unit starts at `deid_status = pending` and carries its pseudonym.
5. **[Human Lens]** The de-identification **gate** verifies each unit — see *What the gate must verify*. Outcome: `cleared` or `flagged`.
6. **[Human Lens + actor]** A `flagged` unit is held for human correction of residual identifiers, then re-checked. A unit cannot proceed until `cleared`.
7. **[Human Lens]** Cleared units flow to lens processing. The pseudonym is used to keep within-source relationships honest; the lenses never see anything uncleared.
8. **[Human Lens]** Assemble produces the two-layer brief. The pseudonym travels through to the output where relevant, so relationships remain legible to Inclusity.
9. **[Boundary → Inclusity]** Output is returned to Inclusity carrying pseudonyms (not identities).
10. **[Inclusity]** When their practice and their promises to participants allow it, Inclusity uses their key to map a pseudonym back to a real person — entirely on their side.

## The pseudonym (today: `speaker_token`)

`build_approach.md` currently describes `speaker_token` as something Human Lens generates internally. Under this model it is better understood as **supplied or controlled by Inclusity** and merely *carried* by Human Lens: assigned outside, opaque inside, emitted in output. The in-system *use* is unchanged (grouping a source's units, honest counting); what changes is its *origin* and the fact that it is the deliberate hook Inclusity uses to map back.

*Proposed, pending the open questions* — in particular whether Inclusity assigns pseudonyms themselves, and whether a pseudonym must be stable only within one engagement or also across engagements/waves (which determines whether Human Lens can treat it as engagement-scoped or must preserve a cross-engagement identifier).

## What the gate must verify

Given this contract, the gate's job is twofold, and both parts are about *confirming de-identification succeeded* — it does not de-identify:

1. The unit's **content** carries no residual identifiers a human missed.
2. The **pseudonym is genuinely opaque** — a token, not something self-identifying. A "pseudonym" of `j.doe@firm.com` or `Jane D.` would re-identify on its own and must be rejected at the gate.

The gate's *position* is fixed (hard gate, before the lenses) and its guarantees are locked in `build_approach.md`. The **detector technology** behind it — the "de-identification stack" — is still open and is the decision to settle *after* this workflow: see the de-identification scanner entry in `build_implementation.md`. (Working direction: TypeScript regex/pattern checks plus a model pass, with a Python Presidio-style service available behind a seam as a heavier-NER future option.)

## Open questions — to confirm with Inclusity (Maria / Mitchell)

These gate the model above. We are currently designing against assumptions.

- **Current de-identification method.** How does Inclusity de-identify today — by hand, with tooling, at what stage? Does SMI need to provide any assist, or does it stay entirely on Inclusity's side?
- **Do they retain a mapping today, and how is it governed?** If a key exists, where does it live, who can access it, and under what controls?
- **When and why do they legitimately re-identify?** Duty of care, participant follow-up, deletion requests, longitudinal/wave-over-wave tracking — which of these are real needs?
- **Participant promises (the gating ethics/policy question).** What were participants actually told about confidentiality and re-identification? A retained re-identification key is only legitimate if it sits inside that promise. This is an Inclusity policy matter, not a Human Lens feature, and it constrains everything above.
- **Pseudonym assignment and scope.** Does Inclusity assign the pseudonym (proposed), or expect Human Lens to? Must it be stable only within an engagement, or also across engagements/waves?
- **Format/validation of the pseudonym** the gate should accept as "opaque."

## Reconciliations pending elsewhere (once this model is agreed — not yet done)

- `build_approach.md` — refine the `speaker_token` definition from "generated internally" to "supplied/controlled by Inclusity, carried by Human Lens."
- `build_implementation.md` — the topology framing line "no path from de-identified content back to a participant" → "…within Human Lens" (the precise claim).
- `build_context.md` — refine the locked de-identification / no-trace-back entry to the key-held-by-Inclusity statement.
- Proposal (proposal chat) — a prompt to make the confidentiality language precise ("Human Lens cannot re-identify") rather than over-claiming, and to reflect Inclusity's role; hand to Doug, never edited from here.
