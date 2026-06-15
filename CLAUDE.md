# CLAUDE.md — Human Lens (SMI, Module 1)

Guidance for AI coding agents working in this repository. **Read this first, then read the design docs in `docs/` before writing any code.** Do not re-derive the architecture — it is already specified.

## What this is
Human Lens is Sasha Markova Inc.'s AI-assisted qualitative-synthesis tool, built for **Inclusity** (the firm that will use it). This repo initially builds **Module 1 — the Listening Brief**, the first of several modules the project will ultimately comprise; each module has a frontend and a backend layer. The whole project is the **case study**; Module 1's first coded version is **V1** ("The Trustworthy Engine").

## Authoritative design docs (the spec)
- `docs/build_approach.md` — **the architecture. Authoritative. Where anything conflicts, this document wins.**
- `docs/build_implementation.md` — the stack and implementation design: the bridge from architecture to code. Names every component and the decided product/library for each.
- `docs/build_context.md` — decisions, conventions, the locked stack, and what is still open or parked.
- `docs/identification_workflow.md` — the de-identification / re-identification workflow (target model + open questions; informs the de-id gate).
- Diagrams are embedded as fenced `mermaid` blocks inside the docs above (topology, pipeline spine, lens pipeline, version progression). Standalone `.mermaid` copies, if present, live in `docs/diagrams/`.

## The stack (decided — see `build_implementation.md` for the reasoning)
- **Language:** TypeScript, full-stack. **ES modules** throughout (`"type": "module"`, `NodeNext` resolution, explicit `.js` import specifiers). Server builds with `tsc` — no server-side bundler.
- **Frontend (browser):** Aurelia 2 + TailwindCSS + Aurelia Headless UI (DaisyUI as fallback) + Axios. Build/test: Vite (pin **7.x**) + Vitest.
- **HTTP/service layer (backend front door):** Node.js + Fastify + `@fastify/swagger(-ui)` (OpenAPI generated from route schemas) + Awilix DI. Test: Vitest.
- **Dependency injection:** Awilix — **explicit registration, no decorators, no `reflect-metadata`.** The composition root wires the seams. Do **not** introduce decorator-based DI (e.g. TSyringe/Inversify).
- **Persistence:** a **repository seam** with an **in-memory (Map-backed)** implementation. **No database.** The interface is **async** and carries **engagement + actor scope on every operation**; the in-memory store still enforces the engagement+actor isolation invariant.
- **Export:** an **export seam** that renders the assembled brief model → **`.docx`** via the `docx` library (dolanmiu). PDF is out of scope. Per-client branding is a config applied at generation time.
- **Source control:** GitHub. **Packages:** npm.

## Architectural rules (do not violate)
- **Seams everywhere.** The pipeline **engine** (lens orchestration, lenses, the de-id gate, assemble) is plain TypeScript and must **not** depend on the web framework, a database, or the LLM provider. Identity, authorization, persistence, and the LLM provider are each behind a seam.
- The **HTTP/service layer is a thin front door** that calls into the engine. Lens/orchestration logic does **not** live there. The engine must be runnable directly from tests or a small harness with no server running.
- **Identity** is resolved at the web layer once per request and threaded inward. **Authorization** is enforced by the **engine** at each operation boundary (the engine is self-protecting). Both seams resolve trivially in V1 (identity assumed; access always granted) but **deny is a first-class return value** (a small decision object with a reason) — every call site branches and has a **tested deny path**.
- **De-identification is a hard gate** before the lenses. Humans de-identify before entry; the gate is a verifying backstop (`deid_status`: pending / cleared / flagged). A unit cannot reach the lenses unless **cleared**.
- **Two-layer output:** client-safe ⊆ internal. The client-safe layer is a filtered, voice-calibrated projection of the internal finding set, with evidence links preserved.
- **Findings are evidence-anchored:** interpretive findings must link to units (a sanctioned `absence` finding is the exception). Strength is **derived from the support set**, never an asserted confidence label.

## Deferred / not yet decided — stub behind the seam, do not invent
- **LLM provider + model:** TBD. Keep behind a thin provider seam; do not hard-wire a vendor.
- **De-identification detector:** parked pending an external (client) conversation. Stub the gate so it resolves trivially and is configurable, behind one swappable interface.
- **Concrete database:** deferred. Use the in-memory repository; do not add a database.
- **Platform layer** (real login, roles, per-engagement access, shared workspaces): deferred beyond V4. Do not build it.

## Vocabulary (use precisely, in code and comments)
- **Actor** = the Inclusity staff member operating the tool (logs in; known by design).
- **Client** = Inclusity's customer organization (the org being studied).
- **Participant** = a person in the source material — de-identified before entry, never identified by the system.

## Working discipline
- Tests with **Vitest**. Structural-invariant checks (evidence anchoring, projection integrity client-safe ⊆ internal, gate enforcement, engagement/actor scoping) are regression guards — keep them green.
- When a design decision changes, update the relevant doc in `docs/` and note it in `build_context.md`. **The docs are the source of truth, not chat history.**
