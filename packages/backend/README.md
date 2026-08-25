# `@humanlens/backend`

The server side of **Human Lens — Module 1 (the Listening Brief)**: a thin Fastify front
door wrapped around a framework-free **pipeline engine** that runs de-identified source
material through the staged lens pipeline and assembles the two-layer brief.

> **The authoritative spec lives in [`docs/`](../../docs/).** `docs/build_approach.md` is
> the architecture (it wins on any conflict); `docs/build_implementation.md` is the stack
> and code structure. This README describes what is in this package and how to work in it —
> it does not restate the architecture. Agents should read [`CLAUDE.md`](../../CLAUDE.md)
> first.

## Purpose

Given an engagement's **already de-identified** units, the backend:

1. holds them behind a **hard de-id gate** (`pending` / `cleared` / `flagged`) — a unit
   that is not `cleared` can never reach a lens;
2. runs the **seven Module-1 lenses** as a staged, wave-ordered pipeline, each lens
   emitting **evidence-anchored findings** whose strength is *derived* from the support
   set, never asserted;
3. **assembles** the one finding set into two layers — the internal candid brief and the
   **client-safe** projection of it (client-safe ⊆ internal);
4. exposes only the client-safe layer over HTTP, to the Aurelia app.

Everything the engine does is plain TypeScript. It runs from a Vitest test or a small
harness with **no server running** — there is no Fastify, no database, and no LLM vendor
inside it.

## How far this is built

**All six waves are structurally complete** — every one of the seven lenses is implemented,
registered, and running in the staged pipeline, each parsing tolerantly, anchoring its
findings to in-scope cleared units, and building through the domain factories. The
structural invariants (anchoring, held-by-default disposition, guardrail supersede-by-id,
engagement/actor scoping, client-safe ⊆ internal) hold across the whole pipeline.

**Prompt work is complete only through the Aggregate wave.** Three lenses are *real on the
production path* — they carry a versioned `SYSTEM` prompt, tuned against the model:

| Wave | Lens | State |
| --- | --- | --- |
| evidence | **Listening** | ✅ real — versioned `SYSTEM` prompt, per-voice fan-out |
| meaning | **Human Meaning** | ✅ real — versioned `SYSTEM` prompt, per-voice fan-out |
| aggregate | **Culture Pattern** | ✅ real — versioned `SYSTEM` prompt, cross-voice |
| interpret | **Tension** | ⬜ structural — instruction-only prompt, no versioned `SYSTEM` yet |
| interpret | **Objective** | ⬜ structural — and its objective frame (survey domains + ADKAR) is an **empty placeholder** until the V3 context work |
| guardrail | **Discernment** | ⬜ structural — the supersede mechanism is real and tested; the audit prompt is not written |
| openings | **Action Opening** | ⬜ structural — instruction-only prompt |

So a run past the Aggregate wave is architecturally honest but not yet behaviorally tuned:
the four remaining lenses exercise the wiring and the invariants, not calibrated judgement.

**Also not built yet:** the **export seam** (brief model → `.docx`), **human review** as a
pipeline stage, and any **internal-brief** read path. `GET …/brief` is the only HTTP route
that runs the pipeline; intake and the de-id scan exist but do not synthesize.

For per-increment progress and the running test count, `docs/build_context.md` is the
operational log — it is more current than this section.

## Code architecture

Seam discipline is enforced by **folders**, not by package boundaries. One package, four
roles:

```
src/
  composition-root.ts   the ONE place seams are wired to implementations (Awilix,
                        explicit registration — no decorators, no reflect-metadata)
  server.ts             Fastify app: OpenAPI from route schemas, resolves the actor
                        once per request via the identity seam, threads it inward
  index.ts              dev bootstrap — seeds the fixture engagement, injects the
                        promoting fake provider, listens on :3000

  domain/               internal domain shapes — never exported to the frontend
    types.ts            Actor · Unit · DeidStatus · EngagementId · BriefType
    finding.ts          the Finding discriminated union + its factories

  engine/               the framework-free pipeline engine
    intake.ts           IntakeService  — self-protecting write operation
    brief-service.ts    BriefService   — self-protecting read operation
    deid-gate.ts        DeidGate       — clearedUnitsForLenses(), the ONE source of
                                         units for lens processing
    lens-pipeline.ts    the staged orchestrator (waves, per-wave snapshot)
    lenses/             the seven lenses + the shared prompt-projection helper
    assemble.ts         projects the finding set → { internal, clientSafe }
    completeness/       per-voice fan-out orchestration + terminal-state accounting

  seams/                every external boundary, behind an interface
    identity.ts         AssumedIdentity (V1: the actor is assumed)
    authorization.ts    AllowAllAuthorization; deny is a first-class decision object
    repository.ts       InMemoryUnitRepository — async, engagement+actor scoped
    deid-detector.ts    TrivialDeidDetector — the parked, swappable detector
    llm-provider.ts     the provider seam + FakeLlmProvider (deterministic)
    anthropic-llm-provider.ts     the real implementation, dev/eval path only
    run-ledger.ts · sqlite-run-ledger.ts    completeness accounting (node:sqlite)

  routes/               the thin front door — HTTP mapping only, no lens logic
  fixture/              the dev demo engagement (dev bootstrap only)
  eval/                 dev harnesses — NOT part of the server
```

### The lens pipeline

`LensPipeline.synthesize(scope)` sources units *exclusively* from the de-id gate, then runs
the lenses grouped by their declared wave, in the fixed order:

```
evidence  → Listening            reads the cleared units, surfaces each voice verbatim
meaning   → Human Meaning        reads Listening's findings, interprets per voice
aggregate → Culture Pattern      open-ended finding across the whole prior set
interpret → Tension · Objective  named against declared vocabularies
guardrail → Discernment          audits all prior findings (may supersede by id)
openings  → Action Opening       runs last, so its findings are never audited
                                 → assemble → { internal, clientSafe }
```

Each wave reads a **snapshot** of prior-wave findings only, so lenses within a wave stay
independent (and later, parallelizable). Every wave appends; **only** the guardrail wave may
supersede a finding by id.

### The rules this package holds to

- **The engine depends on abstractions only.** No route, no Fastify type, no database, no
  vendor SDK is reachable from `engine/`. The provider seam is the *only* path to a model.
- **The service layer is thin.** `routes/` maps a discriminated engine result onto an HTTP
  status and never re-checks a decision the engine already made.
- **Authorization lives in the engine.** Every *actor-facing* operation (intake, view
  brief, …) asks the authorization seam at its own boundary, so the engine is
  self-protecting; internal pipeline steps do not each check. `deny` is a returned value
  with a reason, and every call site has a tested deny path — dormant under `AllowAll` in
  V1, but built.
- **The de-id gate is a machine step, not an auth call site.** `clearedUnitsForLenses` is
  the single sanctioned source of units for the lenses.
- **Findings are immutable and evidence-anchored.** Disposition (`cleared_to_client_safe`,
  held by default) and support are set only through the domain factories, never by hand.
  The `verbatim ⊕ noticing` XOR is a compile-time property of the union (absence findings
  exempt).
- **Internal types never enter `shared`.** That package boundary is what enforces
  client-safe ⊆ internal — don't breach it for convenience.

### HTTP surface

| Route | Purpose |
| --- | --- |
| `GET /health` | liveness |
| `POST /engagements/:engagementId/units` | intake — submit one de-identified unit |
| `POST /engagements/:engagementId/deid/scan` | run the gate; returns the aggregate summary |
| `GET /engagements/:engagementId/brief` | run the pipeline; return the **client-safe** brief (`403` deny · `404` nothing in scope) |
| `GET /docs` | Swagger UI, generated from the route schemas |

## Direct dependencies

| Package | Role |
| --- | --- |
| **`fastify`** (5.x) | the HTTP front door |
| **`@fastify/swagger`** · **`@fastify/swagger-ui`** | OpenAPI + `/docs`, generated from the route schemas — one source of truth for validation and documentation |
| **`awilix`** (13.x) | dependency injection; explicit registration in the composition root, **no decorators / no `reflect-metadata`** |
| **`@anthropic-ai/sdk`** | the real LLM provider behind the provider seam (model id a single named constant). Selected only on the dev/eval path — the server and the tests run the deterministic fake |
| **`@humanlens/shared`** | the client-safe wire contract (workspace package) |

Dev-only:

| Package | Role |
| --- | --- |
| **`vitest`** · **`@vitest/coverage-v8`** | the test runner (the same runner as the frontend) |
| **`fast-check`** | property-based testing for the completeness invariants |
| **`typescript`** (hoisted to the root) · **`@types/node`** | the build — `tsc -b` emitting **ES modules**; no server-side bundler |

Also used: **`node:sqlite`** (a Node ≥ 22.5 builtin) for the durable run ledger, loaded via
`createRequire` so the builtin is touched only where a durable ledger is actually wired.

## Working in this package

```bash
npm run build --workspace @humanlens/backend    # tsc -b
npm run dev   --workspace @humanlens/backend    # tsc -b --watch
npm run test  --workspace @humanlens/backend    # vitest run

npm run dev:backend                             # from the repo root: run dist/index.js
```

The server runs from `dist/`, so build before starting it — there is no hot reload.

The harnesses under `src/eval/` are **not** part of the server, and are the only path that
can select the real model. They read `packages/backend/.env` if present
(`--env-file-if-exists`); with no `ANTHROPIC_API_KEY` they fall back to the fake and still
run end to end.

```bash
npm run eval -- listening      # eyeball one lens against the real model
npm run completeness           # demonstrative fan-out / terminal-state report
npm run cross-voice            # cited-or-residual citation audit
```

> Running the eval harness against the real model costs money — it is a deliberate,
> human-initiated step, never something to kick off in passing.

## Deferred — stub behind the seam, do not invent

A concrete **database** (use the in-memory repository), the **de-identification detector**
(parked pending the client conversation), the **export seam** (brief model → `.docx`), and
the **platform layer** (real login, roles, per-engagement access).
