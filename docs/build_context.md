# Build Context (SMI — Module 1 build workstream)

Operational memory for the chat that owns `build_approach.md`. This file is for
resuming cleanly across chats/containers. It is NOT the design deliverable —
`build_approach.md` is. Keep design detail there; keep process, state, and lane
rules here.

## What this workstream is
The engineering/architecture side of Human Lens (SMI's AI-assisted qualitative
synthesis tool for Inclusity). It designs and captures the build, starting with
Module 1, the Listening Brief. Doug engineers; Claude is architect/thinking
partner and the writer of `build_approach.md`.

## File ownership (whole project — one writer per file)
- `build_approach.md` — written ONLY by this build chat. Reference-only elsewhere.
- `build_implementation.md` — written ONLY by this build chat (design-of-
  implementation; the bridge to the eventual code repo, NOT the code itself).
  Reference-only elsewhere. Architecture (`build_approach.md`) wins on conflict.
- `build_context.md` (this file) — written ONLY by this build chat.
- `identification_workflow.md` — written ONLY by this build chat. Boundary-spanning
  workflow spec (Inclusity's process + the Inclusity↔Human Lens contract). Owns
  the Inclusity-side process and the contract; defers to `build_approach.md` on
  Human Lens internals. Reference-only elsewhere.
- `identification_questions_for_inclusity.md` — written ONLY by this build chat.
  Derived artifact: the `identification_workflow.md` open questions translated into
  a plain-language conversation guide for Doug to take to Maria/Mitchell. Outreach-
  facing (no build jargon); not a durable spec — refresh if the open questions change.
- `AI_Development_Plan.md` (the proposal) — written ONLY by the proposal chat.
  Reference-only here; never edit it.
- `SMI_Project_Context.md` (project source of truth) — written/maintained by the
  proposal chat. Reference-only here. Build-side changes are handed to Doug as
  prompts to run in the proposal chat — never edited from here.
- Enforcement is by file, not chat name: each file says who may edit it; a chat
  only edits the file given to it as its working copy. Doug is the only human in
  all chats.

## Working conventions
- Discuss placement before editing; propose specific insertion points first.
- Targeted edits, one at a time, with confirmation between. Never wholesale rewrites.
- Present/show the file after each edit so Doug holds the durable copy (the
  container is ephemeral and can reset).
- Match the doc's existing voice; avoid generic AI/DEI language; preserve the
  "AI surfaces, humans decide" framing throughout.
- House style: "Sasha Markova Inc." (no comma); singular they/them for everyone;
  "first version" not "first MVP"; full name + title at first reference, first
  name after. The word "prompts" must not appear in the client-facing proposal
  (it is fine in the internal build doc).

## State of `build_approach.md` (as of last good edit)
- ~926 lines. New section **"## Module 1 System Architecture"** inserted before
  "## Version Roadmap", with 11 subsections: pipeline spine; engagement & actor
  scoping; identity & authorization seams; de-identification gate; the Unit; lens
  processing (staged pipeline); the Finding; the two-layer output; human review &
  capture; evaluation; open questions & deferred decisions.
- Three Mermaid diagrams now embedded as fenced ```mermaid blocks: (1) macro
  pipeline spine — after the pipeline-spine prose; (2) lens processing, 5
  dependency layers — end of the staged-pipeline subsection; (3) version
  progression V0→V4 — top of "## Version Roadmap". Standalone `.mermaid` copies
  also in `/mnt/user-data/outputs/` (module1_macro_spine, module1_lens_pipeline,
  module1_version_progression). Source carries no theme directive — renders per
  viewer theme; force `neutral`/white at export time if printing.
- Version Roadmap re-derived (V0–V4 revised; V1 retitled "The Trustworthy
  Engine", V2 "Reliability and Refinement").
- Auth/authz seam captured in the V1 text AND now fully designed in its own
  subsection (see locked decision below); deferred register's auth entry updated
  to point at it (only policy behind the seams remains deferred).
- DONE: owner banner stamped as line 1 (`> Edited only in the chat where this
  file is the working copy. All other chats: read-only reference.`).
- NOTE: `/mnt/user-data/uploads` is READ-ONLY this container. Working copies of
  `build_approach.md` and `build_context.md` live in `/mnt/user-data/outputs/`;
  that is the durable copy to re-upload next session.

## State of `identification_workflow.md` (new — boundary-spanning workflow)
- Created this session. Holds the end-to-end identification workflow as a TARGET
  model + open questions — NOT a record of Inclusity's actual practice (unmapped).
- Organizing principle: **re-identification belongs to Inclusity**, via a key held
  OUTSIDE Human Lens; Human Lens stays key-less. Refined guarantee: "Human Lens
  cannot re-identify" (precise) replaces the earlier over-broad "no one ever."
- Pseudonym (`speaker_token`) reframed as Inclusity-supplied/controlled, carried by
  Human Lens (used internally for source relationships, emitted in output so
  Inclusity can map back). PROPOSED, pending open questions.
- Gate's job restated: confirm content is clean AND the pseudonym is opaque (reject
  self-identifying "pseudonyms"). Detector tech (the "stack") still TBD — settle
  AFTER this workflow.
- Open questions for Inclusity (Maria/Mitchell) are load-bearing; the gating one is
  what participants were promised re: confidentiality/re-identification.
- Working copy in `/mnt/user-data/outputs/identification_workflow.md`.
- DERIVED ARTIFACT: `identification_questions_for_inclusity.md` — the open questions
  as a plain-language conversation guide for Doug → Maria/Mitchell (framing to open
  with, 5 question groups, framing to close). The participant-promise question is the
  load-bearing one. Can be recast as an email or split per-person on request.

## State of `build_implementation.md` (new — implementation design)
- Owner banner, framing header (authority = `build_approach.md`; this doc is
  design-of-implementation, NOT the code), and section **"## Fundamental components
  (the stack)"**. TWO organizing views now: a **"### Two stacks at a glance
  (frontend / backend)"** summary (the axis = *where code runs*) sits atop the
  concern-based inventory grouped in four layers (A AI core; B application shell;
  C data layer; D dev & ops).
- STACK NOW LARGELY DECIDED — full detail under "## Locked stack & implementation
  decisions" below. In brief: TypeScript full-stack; Aurelia 2 frontend; Fastify +
  Awilix HTTP/service layer; persistence mocked behind a repository seam (in-memory);
  export via `docx`. STILL TBD: only the de-id detector (parked pending Inclusity).
- A **"### Proposed topology"** subsection is embedded: one fenced ```mermaid
  block showing what-runs-where + payload flow. Framed as proposed/illustrative;
  product boxes are TBD, while the architecture-level facts it depicts are locked
  in `build_approach.md` (see below). Store node now shows in-memory behind the
  repository seam; DAL relabeled "Repository seam." Standalone copy:
  `/mnt/user-data/outputs/module1_topology_proposed.mermaid`.
- No separate context file — this file is tracked here in `build_context.md`
  (one context file per lane, not per deliverable).
- Working copy in `/mnt/user-data/outputs/build_implementation.md`.

## Locked architecture decisions
- Engagement- and actor-scoped on every record. Isolation invariant (engagement
  A never bleeds into B; reviews attributed to actor). Tested with mocked
  engagements/users; NO auth enforcement in V1–V4.
- De-identification is a HARD GATE on the pipeline. Raw material never ingested
  (human de-identifies before entry); the gate is a verifying backstop that
  scans/flags residual identifiers. `deid_status` (pending/cleared/flagged);
  a unit can't reach the lenses unless cleared. Simple first (scan + human-
  confirmed checkpoint).
- Common **Unit** interface (unit_id, engagement_id, ingest actor+time,
  source_ref+position, language, de-identified content, deid_status,
  speaker_token, capabilities) + one type-specific extension per unit declaring
  capabilities. Lenses capability-match (run only over units that support them;
  omit rather than fabricate; no-op + "insufficient material" when too few).
  `speaker_token` keeps support honest: count "N units across M sources/segments",
  never "N people".
- Lens processing = STAGED PIPELINE. The 7 Module-1 lenses form 5 dependency
  layers: Evidence (Listening, Human Meaning) → Aggregate (Culture Pattern,
  Tension) → Interpret (Inclusity Objective) → Guardrail (Facilitator
  Discernment) → Openings (Action Opening). Each lens is a separate, versioned
  prompt. Discernment runs late so it can audit prior findings; its flags drive
  the two-layer split. Independent lenses within a layer may run in parallel.
  (Rejected: single composite call; seven independent passes.)
- Common **Finding** interface (finding_id, lens, content, evidence_links →
  unit_ids, support_set, cleared_to_client_safe, sensitivity, finding_kind,
  parent). Rules:
  interpretive findings MUST be anchored (validation, not a prompt ask;
  unanchored = defect surfaced by Discernment); a sanctioned `absence`
  finding_kind is exempt (findings about silence); strength is DERIVED from the
  support_set, never an asserted confidence label; `sensitivity` (handling) is
  distinct from de-identification (identifiability); `parent` nests subthemes.
  `finding_id` = stable handle (like `unit_id`) for `parent` refs + client-safe
  projection correspondence. `support_set` V1 = distinct sources (by speaker_token)
  + unit count; the segment dimension is deferred with the unit type-specific
  extensions.
- Two-layer output = two PROJECTIONS of one finding set. Internal = full candid
  set. Client-safe = filtered (cleared_to_client_safe + sensitivity), rephrased, voice-
  calibrated subset, with evidence_links preserved. Integrity guarantee:
  client-safe ⊆ internal. Voice applies at Assemble, on the client-safe layer.
  DEFAULT DISPOSITION = HELD: a finding is internal-only unless affirmatively
  promoted (Discernment + human review) to the client-safe layer — safe failure
  mode is silence, not exposure. (Surfaced by the V1 slice plan; model the
  disposition so "held by default" and client-safe-outside-internal-is-impossible
  are both obvious in the type — e.g. a binary held / cleared, not a 3-value enum.)
- Human review by 3 actors (facilitator; Mitchell — internal layer vs evidence;
  Maria — client-safe voice). Rating signals: useful / generic / overreaching /
  missing nuance / unsafe. Capture keys edits+signals to finding+lens+unit,
  engagement/actor-scoped; keeps learning (patterns), not raw voices.
- Evaluation = two tiers. STRUCTURAL (automated invariants: anchoring,
  projection integrity, sensitivity populated + gate enforced, language tagged /
  no dropped units, subtheme hierarchy, capacity) — regression guards once the
  pipeline exists. QUALITATIVE (Mitchell's rubric, expressed via the rating
  signals; capture and eval are the same data). Criterion 7 (sensitive flagging)
  gets a stricter RECALL regime: seeded known-sensitive cases + conservative
  bias (when in doubt, flag). Seeded reference set (sensitive, bilingual,
  contradictions) built with Mitchell = regression fixtures. V0's true
  deliverable is the rubric, co-defined with Mitchell.
- Re-derived build sequence: V0 prove the thinking + the rubric (manual);
  V1 "The Trustworthy Engine" (spine in code; trust properties present but
  simple); V2 reliability & refinement (stronger de-id, multilingual fidelity,
  eval harness + seeded set, output comparison); V3 Inclusity calibration
  (context → Objective lens & voice); V4 pilot-ready. Platform layer (auth,
  access control, shared workspaces) deferred BEYOND V4.
- Auth/authz: identity + authorization exist as SEAMS from V1, exercised on every
  access path, but resolve trivially (identity assumed, access always granted).
  Callers depend on the abstraction (dependency inversion). Seam inputs committed
  = (actor, engagement, action); policy stays encapsulated/behind the seam and is
  deferred to the platform layer. Tests stub identity/access data and MOCK the
  seams to prove call-site wiring. Guard against over-designing the interface
  SIGNATURE (distinct from hiding policy).
- Auth/authz SEAM SIGNATURES (now designed; four scoping Qs resolved):
  (1) TWO separate seams — identity ("who is acting?", returns assumed actor in
  this cycle) and authorization ("is actor allowed this action in this
  engagement?", always allows this cycle). Design as a pair, settle IDENTITY
  FIRST (it produces the actor authz consumes). Committed inputs = (actor,
  engagement, action), nothing more.
  (2) SHAPES NOW, CONCRETE TYPES LATER — fields + meaning fixed, not bound to
  language types yet (stack not settled; shape ripples through call sites, type
  doesn't).
  (3) DENY is a first-class return value — small decision object (allow/deny +
  reason slot), NOT a bare boolean (loses the why) or exception (deny is normal,
  not a breakage). Every call site branches + has a real deny path even though
  this cycle always allows; test by MOCKING the seam to return deny and asserting
  the call site refuses to proceed.
  (4) `action` = structured identifier (not free string), expressive enough for
  LAYER-SCOPED READ (Maria→client-safe; facilitator/Mitchell→internal), the most
  consequential authz in the system; action set NOT enumerated now (over-design
  trap).
  Call sites at ACTOR-INITIATED boundaries only — Intake; layer view/export;
  human review & capture. Machine steps (Normalize, de-id gate, lens processing,
  Assemble) run inside an already-authorized request, stamp engagement+actor
  (scoping invariant — separate mechanism), do NOT re-call the seams. Identity
  resolves once per request, threaded through. Framing principle: get the
  interfaces right the FIRST time — a wrong shape forces every call site to
  change; that (not the policy) is the rework to avoid.
- Seam PLACEMENT (settled while building the topology diagram; refines the above):
  the two seams sit in DIFFERENT places. IDENTITY (authn) is resolved at the WEB
  layer — once per request, from the session/credential → actor, threaded inward
  (the engine never parses HTTP/sessions). AUTHORIZATION (authz) is enforced by
  the ENGINE at each operation boundary, so the engine is SELF-PROTECTING (the
  check holds regardless of caller; the web layer does NOT make authz decisions).
  Rejected: front-door-only authz (engine would trust its caller) and a separate
  service-facade layer (re-introduces "trusts its caller" one level up). NOTE:
  `build_approach.md`'s seam subsection is currently silent on web-vs-engine
  placement — DONE: reconciled in the seam subsection (a "Where each seam is
  invoked" paragraph now states identity-at-web / authz-at-engine, self-protecting).
- Voice calibration design constraint (from A2): a single, swappable voice-
  configuration source applied at Assemble, so self-serve voice editing later is
  a UI over an existing seam — not a rebuild.

Terminology agreed: a *stub* supplies fake data/state; a *mock* stands in for a
collaborator's interface and carries behavioral expectations. You can only mock
an interface that exists — so authn/authz mocking becomes possible once the seam
exists (V1), enforcement testing once the platform layer exists.

## Locked stack & implementation decisions
The stack settled this session — *product/library* choices (sibling to the *design*
invariants above). The whole project is the **case study**; its first built version is
**V1** ("The Trustworthy Engine"). Only the de-identification detector remains open
(parked — see queue).
- **Language / runtime:** **TypeScript**, full-stack. Builder fluency + operating model
  decide it; Human Lens does no training/retrieval/custom-ML, so Python's ML edge
  doesn't bind.
- **Frontend (the webapp):** **Aurelia 2** (TS); **TailwindCSS** + **Aurelia Headless
  UI** (`@aurelia-ui-toolkits/headless` + Tailwind companion) for accessible,
  headless/light-DOM primitives (Tailwind styles directly, no Shadow DOM); **DaisyUI**
  as the mature framework-agnostic FALLBACK; **Axios** HTTP client; **Vite** (pin 7.x);
  **Vitest**. The combination is a stock scaffold preset. Fluent UI Web Components
  DROPPED (Shadow-DOM styling friction). Watch: Aurelia Headless UI is brand new (1.0.0,
  small community) — lean where it earns its place, DaisyUI is the net; pin Vite 7.x
  (Vite 8 / Rolldown had an Aurelia plugin glitch in beta).
- **HTTP/service layer (backend front door):** **Node.js**; **Fastify** +
  **@fastify/swagger(-ui)** (OpenAPI from route schemas); **Awilix** DI (explicit
  registration, NO decorators / reflect-metadata — off the legacy-decorator track,
  actively maintained, per-request scoping suits Fastify; the **composition root wires
  the seams** — repository, identity/authz, provider); **Vitest**; **tsc → ES modules**
  (no server-side bundler; type:module + NodeNext + .js specifiers). A thin wrapper
  around the engine, NOT the lenses (those are the AI core, built first). TSyringe
  considered + REJECTED (low-maintenance; pins to legacy experimentalDecorators /
  emitDecoratorMetadata).
- **Persistence:** a **repository seam** with an **in-memory (Map-backed)**
  implementation — NOT a database (AI-focused case study; persistence proves nothing
  about the core claim). Interface real-DB-ready (async + engagement/actor scope on
  every op); the mock still ENFORCES the engagement+actor isolation invariant. Concrete
  DB DEFERRED — the SQLite-vs-Postgres question dissolves. Durability spectrum behind the
  same interface if a demo must survive a restart: in-memory → JSON snapshot → single
  SQLite file. PARKED ANALYSIS (preserved, NOT the path): SQLite-now→Postgres-later was
  the prior lean — SQLite fits relational / low-concurrency / single-host / low-ops but
  needs a durable disk (poor on serverless) and is single-writer; managed Postgres
  avoids a future migration and is stronger on security; either way an ORM targeting
  both (Drizzle lean — type inference off the schema, no codegen) makes the swap cheap.
- **Export:** an **export seam**; case-study implementation renders the assembled brief
  model → **.docx** via **`docx`** (dolanmiu — TS-first, zero deps, MIT). Programmatic
  generation over template-fill (variable brief structure); **per-client branding as a
  config** (logo / palette / fonts / header-footer / cover) at generation, structure
  uniform, branding param reserved from the start. **PDF out of case-study scope** (was
  a docx→PDF stage via headless LibreOffice; dropped — pulled a heavy containerized host
  dependency the case study doesn't need); seam keeps it addable later. docx is pure
  Node, adds NO host requirements. docxtemplater considered + rejected (variable
  structure + per-client branding favor code generation; advanced features paid).
- **Hosting:** a **capability profile, not a product**: a host that runs a **long-lived
  Node process** + **public web hosting (inbound HTTPS)** + **outbound HTTPS** to the
  model API + a place for **secrets**. The long-lived process is the only hard
  constraint (holds in-memory repo state across requests; FaaS would reset it — rules
  out pure serverless / edge, allows any always-on container / VM / app service). One
  Fastify process serves Aurelia static assets (@fastify/static) + API on one
  port/origin; host adds ingress + TLS. Persistent disk now OPTIONAL (only for the
  durability-spectrum JSON/SQLite to survive a restart). PDF/LibreOffice being out of
  scope is what relaxed this from the earlier sidecar-binary + persistent-disk profile.
  Specific PRODUCT deferred.
- **Repository layout (settled) + V1 skeleton scaffolded — coding has begun.**
  npm-workspaces monorepo (`dkent600/HumanLens`): packages `frontend` / `backend` /
  `shared`, where **`shared` = the client-safe contract and enforces client-safe ⊆
  internal at the package boundary** (internal types stay in `backend`). `backend` is
  one package; seam discipline via folders (`engine/` framework-free + `seams/` + thin
  Fastify `routes/`+`server.ts` + Awilix `composition-root.ts`). De-id gate is an engine
  step; `clearedUnitsForLenses` is the hard gate; detector parked behind its seam.
  Scaffold: 3 seams + gate implemented, 11 Vitest green, root ESLint+Stylelint clean,
  smoke test passes. Full detail in `build_implementation.md` → "Repository layout &
  code structure."
- **Vertical slice built (cleared units → one lens → findings → Assemble →
  client-safe).** `Finding` (held-by-default `cleared_to_client_safe` binary; support
  derived, never asserted), LLM provider seam + deterministic fake, Listening lens
  (Evidence), Assemble (client-safe = `.filter()` over internal; sensitivity kept as a
  hard backstop), client-safe DTO (omits internal-only fields). Both review
  adjustments landed (held-by-default; disposition unrepresentable-when-violated).
  Tests green: held-by-default end-to-end, promote-one-finding, projection ⊆ internal,
  anchoring, honest-counting support.
- **Staged pipeline built (minimal orchestrator → real staged structure).** Layers
  first-class (`Layer` + `LAYER_ORDER`: evidence→aggregate→interpret→guardrail→
  openings); each lens declares its `layer`; `run(units, priorFindings, provider)`.
  Orchestrator groups lenses by layer, iterates LAYER_ORDER, runs each layer against a
  snapshot of **prior-layer findings only** (same-layer lenses never see each other →
  within-layer parallelizability preserved; concurrency deferred, sequential for now),
  accumulates into Assemble. Second lens added: **Tension** (Aggregate layer) — reads
  Evidence findings but anchors back to the units behind them; out-of-scope ids dropped
  (anchoring enforced on interpretive output); held by default; silent without priors.
  One deterministic fake drives both lenses. `shared` boundary untouched. 36/36 Vitest
  green; tsc/eslint/stylelint clean. No `docs/` edits by Claude Code; no spec note.
- **Discernment built — two-layer split now real (Guardrail layer).** The Facilitator
  Discernment Lens runs late, audits accumulated findings, and is the real affirmative
  promoter (sets `cleared_to_client_safe`) and sensitivity-setter — the test's faked
  `promote()` is gone. **Mechanism = B2:** Discernment sets disposition by re-emitting a
  finding under its original `finding_id`, rebuilt through the sanctioned factory
  (`reviseDisposition` → support re-derived, anchoring re-enforced, never hand-set), so
  disposition lives on the finding (one source of truth) and Assemble is untouched
  (client-safe ⊆ internal, held-by-default, sensitivity backstop all hold by
  construction). The orchestrator folds **only the Guardrail stage by supersede-on-
  `finding_id`** (replace in place, preserving position); every other layer stays pure-
  append — revision is the auditor's privilege, and a stray id collision elsewhere is a
  visible append, not a silent drop. Seam stayed domain-agnostic (`complete()→{text}`;
  task/verdict types in the lens↔model convention). Default fake = empty verdicts
  (silence). Also: shared `toPromptFinding` extracted to `prompt-projection.ts`
  (Tension + Discernment), behavior-preserving. 46/46 Vitest green; lints clean.
  (Rejected: verdicts-only-at-Assemble = two sources of truth; general upsert = supersede
  too broad.) Recorded in build_approach.md → staged-pipeline (Discernment bullet).
- **Culture Pattern lens built (Aggregate) — breadth, no new mechanism.** Sibling of
  Tension: reads Evidence findings, anchors back to their units, held by default, silent
  without priors (`culture:0…`); `'culture'` added to `LensId`. Both Aggregate siblings
  run against the same Evidence-only snapshot and never see each other (tested). Pipeline
  now `[listening, tension, culturePattern, discernment]`. 52/52 Vitest green; lints
  clean. No docs/spec changes.
- **Inclusity Objective lens built (Interpret) — first lens in a new layer.** Reads the
  Evidence+Aggregate snapshot, interprets it against the objective frame, anchors back to
  units, held by default, silent without priors (`objective:0…`); `'objective'` added to
  `LensId`. Pipeline now `[listening, tension, culturePattern, objective, discernment]`;
  Discernment audits Objective automatically. Differential test proves it reads **Aggregate**
  output (a `tension:0` finding makes the interpretation reach u2/u3 that Evidence alone
  never supplies). 58/58 Vitest green; lints clean.
  **Decision — objective-frame V1 placeholder shape:** a structured `ObjectiveFrame
  { surveyDomains: readonly string[]; adkarDimensions: readonly string[] }`, empty in V1
  (`{ [], [] }`), threaded through the lens↔model convention. Grounded directly in
  build_approach.md → "The Inclusity Objective Lens" (the two named calibration
  vocabularies: Inclusity's climate survey domains + PROSCI/ADKAR change-readiness), so it
  mirrors the spec rather than inventing ahead of it. Reserving the shape means **V3
  ("Limited Inclusity Context") fills values rather than reshaping the convention**; the
  frame's source (a module placeholder constant now) is the V3 injection point (likely
  config/seam). Provisional/forward-compatible — V3 may extend additively; blast radius
  contained to the Objective lens + convention + fake. Remaining breadth lens: **Action
  Opening** (Openings — runs after Discernment; watch ordering vs disposition).
- **Action Opening lens built (Openings, terminal) — pipeline structurally complete,
  6 of 7 lenses.** Reads the post-Guardrail audited snapshot, anchors openings back to
  units, held by default, silent without priors (`opening:0…`); `'opening'` added to
  `LensId`. Pipeline now `[listening, tension, culturePattern, objective, discernment,
  opening]`. 64/64 Vitest green; lints clean. Dispositional proof test: a pipeline where
  Discernment promotes everything it audits still leaves `opening:0` held and absent from
  client-safe — proving Discernment runs before Opening and never sees it.
  **Clarification (spec note) — Action Opening disposition (V1):** openings are held
  internal-only in V1 BY DESIGN, not a gap. The disposition model names two affirmative
  promoters — Discernment (automated) and human review (deferred); Action Opening runs
  after Guardrail so Discernment cannot audit it, making **human review its promoter**.
  The facilitator weighs openings and decides which (incl. "possible client-safe next
  steps") to carry to the client — that act is the human-review promotion. Until human
  review exists, openings stay internal-only (safe failure mode). Discernment stays the
  sole AUTOMATED promoter; held-by-default, client-safe ⊆ internal, sensitivity backstop
  all intact. Recorded in build_approach.md → "The Action Opening Lens."
- **Human Meaning lens built (Evidence) — Module-1 lens set COMPLETE (7 of 7).**
  Evidence-layer sibling of Listening: reads cleared units directly (ignores prior
  findings), anchors to units, held by default, silent without units (`meaning:0…`).
  Cleanup: a dangling unused `'human-meaning'` placeholder in `LensId` replaced with
  single-token `'meaning'`, matching the id===lens===namespace convention of every other
  lens (internal identifier only; doc concept "Human Meaning Lens" unchanged, no spec
  impact). Evidence pair (Listening + Human Meaning) run against the same units + empty
  prior snapshot, independent (tested: `[[], []]`). Full set:
  `[listening, humanMeaning, tension, culturePattern, objective, discernment, opening]`.
  69/69 Vitest green; lints clean. No spec note.
- **Still open (stack):** only the **de-identification detector** — parked pending the
  Inclusity conversation (see queue + Open / deferred).

## Handoff decisions (locked)
- A1 access control: PHASE IT — full per-engagement access model arrives as the
  tool moves from pilot to firm-wide; proposal reframes accordingly.
- A2 voice: SOFTEN — Maria reviews voice, SMI recalibrates; self-serve voice is a
  clearly-intended later option (pilot designed so it's not hard to add later).
- A3 "starts smarter than the last": tied to open S5-2; don't harden.
- A4: verify bios/attributed quotes against the live Inclusity site.
- A5: optional — soften the "twenty minutes" performance number.
- B1 (context doc): module numbers — William White 7→8, Terrance Collins 6→7.

## Open / deferred (resume triggers)
- Learning loop mechanism (S5-2): human-authored prompt edits; prompts as
  versioned, engagement-aware artifacts. Auto-vs-manual unresolved.
- Scope of a learned edit: engagement-scoped vs graduates to baseline
  ("starts smarter than the last"). Unresolved.
- De-identification detector sophistication (gate position fixed).
- Voice-calibration mechanism (single-source constraint noted above).
- When the structural eval tier gets automated (depends on pipeline existing).
- Lens orchestration detail (parallelism, finding-passing) — implementation.
- Auth/authz IMPLEMENTATION (seam settled; real login/roles/grant-revoke deferred
  to platform layer).
- Finding→finding provenance: interpretive findings anchor to UNITS (the trust
  guarantee) and the pipeline passes prior findings live via staging, so no stored
  "synthesized-from" field exists (only `parent` for subtheme nesting). Whether to
  add finding→finding lineage is a possible future spec decision — surface it if
  explainability ("this tension came from these themes") or Discernment's audit /
  the review UI needs it. Not added speculatively.
- Discernment's own **caution-findings** (internal notes on overreach / uncertainty /
  "should not be overstated") — deferred follow-on, held back from this increment to
  keep it on the disposition mechanism. `DiscernmentResponsePayload` reserves room to
  carry them later without disturbing the disposition path; they'd be internal-only
  findings anchored to the concerned finding's units (the already-proven pattern).
- Openings conditioning on disposition: the prompt projection (`toPromptFinding`)
  carries content + anchors, not disposition, so Action Opening can't currently see
  whether a prior finding was held/sensitive. If openings ever need to condition on that
  (e.g. an opening built on a sensitive finding inheriting caution), thread disposition
  into the lens↔model projection — additive, out of V1 scope.

## Queued next steps (immediate)
Stack decisions from this session now live under "## Locked stack & implementation
decisions" above. Genuinely-open work remaining:
1. Identification workflow: confirm the open questions with Inclusity (Maria/
   Mitchell) — esp. what participants were promised re: re-identification — then
   firm up the `identification_workflow.md` model from TARGET to agreed.
2. De-identification gate STACK — EXPLORED, now PARKED pending the Inclusity
   conversation (gate strength depends on how thorough Inclusity's upstream manual
   de-id is). Leaning: a layered detector behind ONE swappable interface — L1
   regex/patterns (structured identifiers + the pseudonym-opacity check), L2 a
   LOCAL TS NER lib (PII-PALADIN / openredaction style, offline), recall-biased +
   human checkpoint; LLM pass as an OPTIONAL reviewer-assist on flagged units only;
   self-hosted Presidio (Python) behind the seam as the multilingual/strengthening
   edge. Two decisions left open: (a) BOUNDARY — keep verification fully local
   (provider only ever sees CLEARED content) vs. allow an LLM pass (sends
   human-de-identified-but-unverified content out); (b) SPANISH — local TS NER is
   English-centric, so multilingual needs the LLM pass, a transformers.js
   multilingual model, or the Presidio service earlier than V2. Steer away from
   cloud PII APIs (a new external boundary; wrong for a confidentiality-critical
   tool). Nothing recorded in `build_implementation.md` yet.
3. Reconcile docs to the re-identification model once agreed: `speaker_token` def
   in `build_approach.md`; topology framing line in `build_implementation.md`
   (add "within Human Lens"); locked de-id entry in `build_context.md`; proposal
   prompt for precise confidentiality language.
4. Seam IMPLEMENTATION shape against the settled signatures: exact decision-object
   fields; where identity is resolved/threaded; the deny-path test scaffolding.
5. Lens orchestration detail (parallelism within a layer, finding-passing between
   stages) — moves from "deferred" toward design when V1 build begins.
6. Whether `build_approach.md` needs its own output (PDF/docx) setup, or stays
   markdown-only as an internal doc.

## Environment
VSCode on Windows. (Pandoc + MiKTeX / LuaLaTeX / EB Garamond is the *proposal's*
build pipeline; `build_approach.md` may get its own output setup later if needed.)