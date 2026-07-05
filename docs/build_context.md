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
- ~1042 lines. **Reorganized into three Parts** under the title (Option A
  leveling): **Part 1 · The Case** (Why This Plan Fits SMI; Module Development
  Plan; Lens Architecture Across Modules) · **Part 2 · The Build — Module 1** (The
  Seven Lenses; System Architecture) · **Part 3 · The Roadmap — Module 1** (Version
  Roadmap). Front matter is **"## How to Read This Document"** only (Terminology
  eliminated, see below); the six content sections demoted to `###`, subsections to
  `####`, with one `#####` (Client-facing shaping, under the brief §).
- **"## How to Read This Document"** defines the recurring terms once, up front, in
  in order: **Client** (the
  organization Inclusity serves in an engagement; never a user of the system) →
  **Lens** (a distinct
  prompt and response section in one AI pass — where the AI is used) → **Module** (a
  self-contained analysis structured as a pipeline of functional stages, one of
  which runs its lenses — Module 1 has seven) → **Pipeline** (how a module runs:
  intake → normalize → de-identify gate → lens processing → assemble → human review
  → capture; emits a **Brief**; also defines **stage** = one step, **spine** = the
  ordered run of stages) → **Lens wave** (the lens-processing stage's internal
  structure: six ordered waves Evidence→Meaning→Aggregate→Interpret→Guardrail→
  Openings; only Evidence reads the units, later waves read earlier waves' findings
  from one shared pool; units stay in scope as anchor targets; lenses in a wave run
  in parallel; waves are NOT stages) → **Gate** (a stage material must clear; the
  de-identification gate — de-id proper is upstream at Inclusity, the gate verifies)
  → **Brief** (a module's deliverable to Inclusity in two **types**: **internal
  brief** = the complete candid finding set, for facilitator + Dr. Campbell;
  **client-safe brief** = the cleared subset shown to the client, a pure projection
  client-safe ⊆ internal, never a rewrite, the exported deliverable) → **Promotion** (clearing a finding into the client-safe brief — held by default;
  cleared only by being affirmatively promoted and not held back by sensitivity;
  safe failure = silence) → **Seam** (injection boundary; moved here from the deleted Terminology) → **Engine**
  (the software that runs a module's pipeline end to end; what V1–V4 build) →
  **Platform** (wraps the engine: real auth + shared workspaces; deferred beyond V4)
  → **Authentication / Authorization** (the two access checks the platform
  implements, present as seams from V1) → **Version** (orthogonal maturity axis,
  V0–V4, all inside Module 1) → **Parts** (the three parts and their **register**s).
  NOTE: the **Layer** term is retired — output sense → **Brief** (internal/client-safe
  types), processing sense → **Lens wave**; directionality is horizontal
  (earlier/later, never above/below); "Pipeline" is also defined again in prose at
  "The pipeline spine" (Part 2) — intentional overlap for now.
- **Terminology section eliminated.** Its **seam** definition moved into How to Read
  (now the single place seam is defined — the in-context re-definition under
  "Identity and authorization seams" was removed). The **contract** /
  *client-safe contract* definition was removed entirely; its one loose in-text use
  (under Identity & authorization seams) reworded to "the interface is its
  **signature**." `build_approach.md` no longer uses the word "contract" — see the
  open cross-doc item below.
- **Lens Architecture Across Modules lifted** to close Part 1 (was between the
  lenses and System Architecture); lead-ins reframed forward ("the seven lenses,
  defined below").
- **Retitles** (scope inherited from the Part 2 banner): "Prompt Architecture:
  Listening Brief (Module 1)" → **"The Seven Lenses"**; "Module 1 System
  Architecture" → **"System Architecture."**
- **Relocations:** **The Key Design Rule** → into the Seven Lenses framing (before
  lens 1); **Success Criteria** → into System Architecture, right after Evaluation
  (whose "eight success criteria below" now resolves locally). Roadmap ends cleanly
  on V4 · Pilot-Ready.
- **Part 3 strips:** V3/V4 titles lose "Module 1" → "Limited Inclusity Context" /
  "Pilot-Ready"; the four per-version "Still … Module 1" refrains removed, replaced
  by one discipline line under the Part 3 banner.
- **Consistency reconciliation (this session, both files):** the superseded
  "rephrased / voice-calibrated subset" framing of the client-safe projection was
  retired for the settled **pure-filter** framing — in `build_approach.md` at the
  brief prose and the pipeline-diagram label (`filtered subset · shaping
  deferred`), and in this file's locked brief entry below. (Also fixed in this
  file's locked entries: Finding `content` → `verbatim`/`translation`/
  `source_language`; `sourceLanguage`→`source_language` prose casing.) A follow-up
  `voice`/`assemble` sweep then re-pointed three residual "voice applied at Assemble"
  claims to the dedicated, deferred client-facing shaping stage: the Voice-calibration
  open-question bullet and the Assemble node in the pipeline-spine diagram (now
  "mechanical join · no rewording") in `build_approach.md`, and the voice-config
  design constraint in this file. Assemble/projection/lenses are now clean
  everywhere; voice/shaping is located only at the deferred shaping stage.
- **Cross-doc placement (silence-vs-exception & structured-outputs):** the tell is
  *does it survive a stack swap?* **Silence-vs-exception** (unusable model output →
  silence/safe-empty, never fabricate; infrastructure failure → propagate, never
  disguised as silence) survives → **principle** lifted to `build_approach.md` (end
  of "Lens processing: a staged pipeline"), **wiring** (parse tolerance,
  refusal→`{text:''}`, transport retries) left in `build_implementation.md`.
  **Structured-outputs-declined** does *not* survive — it's a seam-signature choice
  (keep `complete()` prompt-in/text-out) — so it stays entirely in
  `build_implementation.md`. Born together, split because they answer the stack-swap
  test oppositely. (Also fixed a residual wave/horizontal miss in `build_approach.md`
  L821: "each stage … the stages above it" → "each wave … earlier waves.")
- System Architecture (Part 2) subsections, in order: pipeline spine; engagement &
  actor scoping; identity & authorization seams; de-identification gate; the Unit;
  lens processing (staged pipeline); the Finding; the brief; human
  review & capture; evaluation; **Success Criteria** (relocated in); open questions
  & deferred decisions.
- Three Mermaid diagrams embedded as fenced ```mermaid blocks: (1) macro pipeline
  spine — after the pipeline-spine prose; (2) lens processing, 6 lens waves
  — end of the staged-pipeline subsection; (3) version progression V0→V4 — top of
  "### Version Roadmap" (Part 3). Standalone `.mermaid` copies also in
  `/mnt/user-data/outputs/` (module1_macro_spine, module1_lens_pipeline,
  module1_version_progression). Source carries no theme directive — renders per
  viewer theme; force `neutral`/white at export time if printing.
- Auth/authz seam captured in the V1 text AND fully designed in its own subsection
  (see locked decision below); deferred register's auth entry points at it (only
  policy behind the seams remains deferred).
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
- Lens processing = STAGED PIPELINE. The 7 Module-1 lenses form 6 lens waves:
  Evidence (Listening) → Meaning (Human Meaning) → Aggregate (Culture Pattern,
  Tension) → Interpret (Inclusity Objective) → Guardrail (Facilitator
  Discernment) → Openings (Action Opening). Only Evidence reads the units; every
  later wave reads the findings of earlier waves (units stay in scope as anchor
  targets, not re-read as input). Each lens is a separate, versioned
  prompt. Discernment runs late so it can audit prior findings; its flags drive
  the internal/client-safe split. Independent lenses within a wave may run in parallel.
  (Rejected: single composite call; seven independent passes.)
- **Evidence funnel — only Listening reads the units (LOCKED, this session).**
  Human Meaning was the lone non-Listening lens reading raw units as input; every
  other interpretive lens already reads prior findings and anchors to the units
  behind them. Since Listening is verbatim (faithful, whole-voice), reading its
  finding ≈ reading the unit, so funneling loses ~nothing. DECISION: Listening alone
  reads units (Evidence wave, now single-lens); Human Meaning moves to its own
  **Meaning** wave — placed between Evidence and Aggregate, its own wave (NOT grouped
  with Aggregate, so Culture Pattern/Tension can still build on its noticings) — and
  reads Listening's findings; all six non-Listening lenses read findings + anchor to
  the units behind them. Units stay universally in scope as ANCHOR TARGETS
  (finding→unit trust guarantee), just not re-read as input. Waves 5→6. Accepted
  cost: Listening's recall becomes the pipeline ceiling (a voice Listening drops is
  invisible downstream) — judged a feature (single evidentiary base; Listening's
  surfacing discipline protects the whole pipeline) over a risk. RECONCILED:
  `build_approach.md` (How-to-Read term; wave list + new Meaning bullet; Aggregate
  "set of findings"; staged-pipeline prose; lens-processing diagram; roadmap V1
  node) and this file (How-to-Read summary, diagram inventory, the wave entry above,
  the Human Meaning build-log entry), plus the standalone
  `module1_lens_pipeline.mermaid` (redrawn, byte-identical to the embedded block).
  DONE (this session): CODE landed — `meaning` added to `WAVE_ORDER`; Human Meaning's
  `wave` → `'meaning'` and input flipped from units to Listening findings. Model B also
  LANDED (see the "Human Meaning REAL" build-log entry below). Single-unit
  cap for Human Meaning: LANDED (structural — `human-meaning-lens.ts` inherits the source
  Listening voice's anchor via `sourceFindingId`). Nothing remaining.
- Common **Finding** interface (finding_id, lens, verbatim/translation/
  source_language, evidence_links → unit_ids, support_set, cleared_to_client_safe,
  sensitivity, finding_kind, parent). Rules:
  interpretive findings MUST be anchored (validation, not a prompt ask;
  unanchored = defect surfaced by Discernment); a sanctioned `absence`
  finding_kind is exempt (findings about silence); strength is DERIVED from the
  support_set, never an asserted confidence label; `sensitivity` (handling) is
  distinct from de-identification (identifiability); `parent` nests subthemes.
  `finding_id` = stable handle (like `unit_id`) for `parent` refs + client-safe
  projection correspondence. `support_set` V1 = distinct sources (by speaker_token)
  + unit count; the segment dimension is deferred with the unit type-specific
  extensions.
- Brief = two PROJECTIONS of one finding set. Internal = full candid
  set. Client-safe = a PURE FILTER over the same findings (cleared_to_client_safe
  + sensitivity), evidence_links preserved — removes findings, never rewords them.
  Integrity guarantee: client-safe ⊆ internal. Voice/shaping is a SEPARATE,
  DEFERRED stage applied over already-filtered findings — NOT part of the
  projection and NOT folded into Assemble (which stays a mechanical join).
  DEFAULT DISPOSITION = HELD: a finding is internal-only unless affirmatively
  promoted (Discernment + human review) to the client-safe brief — safe failure
  mode is silence, not exposure. (Surfaced by the V1 slice plan; model the
  disposition so "held by default" and client-safe-outside-internal-is-impossible
  are both obvious in the type — e.g. a binary held / cleared, not a 3-value enum.)
- Human review by 3 actors (facilitator; Mitchell — internal brief vs evidence;
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
  BRIEF-SCOPED READ (Maria→client-safe; facilitator/Mitchell→internal), the most
  consequential authz in the system; action set NOT enumerated now (over-design
  trap).
  Call sites at ACTOR-INITIATED boundaries only — Intake; brief view/export;
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
  configuration source applied at the dedicated, deferred client-facing shaping
  stage (not Assemble), so self-serve voice editing later is a UI over an existing
  seam — not a rebuild.

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
- **Staged pipeline built (minimal orchestrator → real staged structure).** Waves
  first-class (`Wave` + `WAVE_ORDER`: evidence→aggregate→interpret→guardrail→
  openings); each lens declares its `wave`; `run(units, priorFindings, provider)`.
  Orchestrator groups lenses by wave, iterates WAVE_ORDER, runs each wave against a
  snapshot of **prior-wave findings only** (same-wave lenses never see each other →
  within-wave parallelizability preserved; concurrency deferred, sequential for now),
  accumulates into Assemble. Second lens added: **Tension** (Aggregate wave) — reads
  Evidence findings but anchors back to the units behind them; out-of-scope ids dropped
  (anchoring enforced on interpretive output); held by default; silent without priors.
  One deterministic fake drives both lenses. `shared` boundary untouched. 36/36 Vitest
  green; tsc/eslint/stylelint clean. No `docs/` edits by Claude Code; no spec note.
- **Discernment built — internal/client-safe split now real (Guardrail wave).** The Facilitator
  Discernment Lens runs late, audits accumulated findings, and is the real affirmative
  promoter (sets `cleared_to_client_safe`) and sensitivity-setter — the test's faked
  `promote()` is gone. **Mechanism = B2:** Discernment sets disposition by re-emitting a
  finding under its original `finding_id`, rebuilt through the sanctioned factory
  (`reviseDisposition` → support re-derived, anchoring re-enforced, never hand-set), so
  disposition lives on the finding (one source of truth) and Assemble is untouched
  (client-safe ⊆ internal, held-by-default, sensitivity backstop all hold by
  construction). The orchestrator folds **only the Guardrail wave by supersede-on-
  `finding_id`** (replace in place, preserving position); every other wave stays pure-
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
- **Inclusity Objective lens built (Interpret) — first lens in a new wave.** Reads the
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
  Evidence-wave sibling of Listening: reads cleared units directly (ignores prior
  findings), anchors to units, held by default, silent without units (`meaning:0…`).
  Cleanup: a dangling unused `'human-meaning'` placeholder in `LensId` replaced with
  single-token `'meaning'`, matching the id===lens===namespace convention of every other
  lens (internal identifier only; doc concept "Human Meaning Lens" unchanged, no spec
  impact). Evidence pair (Listening + Human Meaning) run against the same units + empty
  prior snapshot, independent (tested: `[[], []]`). Full set:
  `[listening, humanMeaning, tension, culturePattern, objective, discernment, opening]`.
  69/69 Vitest green; lints clean. No spec note. **SUPERSEDED by the Evidence-funnel
  decision (Locked architecture, above): Human Meaning moves to its own `Meaning` wave
  and its input flips from units to Listening findings; the "Evidence sibling / reads
  units" facts above describe the code as first built. Code change pending — now REALIZED this session (see the "Human Meaning REAL" entry below).** **GRANULARITY LOCKED (this session): Human Meaning is PER-VOICE —
  it interprets each voice (each Listening finding) on its own and does NOT consolidate across
  voices. Each meaning finding is anchored to the single unit of the Listening finding it
  interprets (single-unit `evidence_links`, no finding spans >1 unit); it MAY emit multiple
  noticings per voice (e.g. an unmet need and a fear → `meaning:0`, `meaning:1`, both anchored
  to that one unit — this is what first exercises multi-finding-per-lens, Item 11). Cross-voice
  consolidation stays Aggregate's job (Culture Pattern/Tension). Emits `noticing` (Model B),
  `verbatim` null. To be reflected in the versioned prompt when it goes real.**
- **Human Meaning REAL — Model B + Evidence funnel landed (this session).** Realizes the
  funnel code change and Model B plumbing recorded above. **Model B:** Finding split into a
  discriminated union `SurfacingFinding (verbatim, noticing null) | InterpretiveFinding
  (verbatim null, noticing) | AbsenceFinding (both null)` — the verbatim⊕noticing XOR is now a
  COMPILE-TIME property, not a runtime check (absence exempt). `MissingNoticingError`;
  `makeOrdinaryFinding` takes a discriminated arg; `reviseDisposition` preserves an interpretive
  finding's `noticing` through Discernment revision. Five interpretive fakes migrated to
  `noticing`; Listening stays `verbatim`. Resolver `noticing ?? translation ?? verbatim`.
  Client-safe DTO gains `noticing`; Assemble projects it; frontend renders `noticing ??
  verbatim` (root + subtheme). **Funnel:** `WAVE_ORDER` = evidence → meaning → aggregate →
  interpret → guardrail → openings; Human Meaning `wave='meaning'`, reads Listening findings
  (not units), per-voice, single-unit anchors, may emit multiple noticings per voice; real
  versioned `system` prompt + tolerant defensive parse (malformed → silence; transport →
  propagates). Server/`buildContainer` stay on the fake. **Live real-model eval** (`npm run
  eval -- meaning`, real `claude-opus-4-8`): 17 per-voice findings, each single-unit anchored,
  `noticing` populated; Spanish voices (u5, u8) and mixed (u13) returned as English noticings
  anchored to source units — translation path confirmed end-to-end. **135 green** (backend 116
  + frontend 19); tsc/vite/eslint/stylelint clean. Items 9 (EN/ES) + 11 (multi-finding) closed
  by new automated tests. **Single-unit cap — STRUCTURAL, LANDED (follow-up this session).** The
  model no longer emits unit links; per noticing it names `sourceFindingId` (the one Listening
  voice it interprets) and the lens inherits that voice's anchor (`source.evidenceLinks[0]`,
  sliced to one) → a meaning finding provably carries exactly one unit, cannot consolidate a
  source's units or span voices; an unresolvable/hallucinated `sourceFindingId` → silence.
  Entirely in `human-meaning-lens.ts`; shared factory/validation untouched; only shared-seam
  change is an optional `sourceFindingId?` on `LensResponseCandidate` (fake emits it, so one
  response shape drives every interpretive lens). **136 green** (backend 117 + frontend 19);
  structural "exactly one unit even when the source spans several" + "named source missing →
  silence" tests added; real-model eval hit the multi-noticing case (`meaning:6`+`meaning:7` →
  same unit).
- **Read slice built — first full-stack path; frontend now live.** Seeded fixture
  engagement → `GET /engagements/:id/brief` (runs the pipeline via the self-protecting
  `BriefService`, returns the client-safe brief only) → `AxiosBriefApi` → `BriefStore`
  (group by lens, nest subthemes) → `BriefPage` view-model/view. The fixture's promoting
  fake makes the client see 2 findings while the engine holds 6 — **client-safe ⊊
  internal visible on screen**, not just asserted. Authz lives in `BriefService` (route
  only maps 200/403/404, never re-checks); `buildContainer()` stays pure (silent fake
  default) — promoting fake + fixture seed live only in the dev bootstrap (`index.ts`).
  New shared type `ClientSafeBrief`. Backend 75/75, frontend 8/8 Vitest green; tsc + vite
  build + lints clean. Frontend code structure + read-path route contract recorded in
  build_implementation.md. Temporary couplings: fixture engagement id hardcoded in the
  frontend; stock `welcome` route still the default (retire when real screens land).
- **Frontend folder-by-role reorg (behavior-preserving).** Files grouped by role:
  `pages/` (Aurelia component pairs), `stores/`, `seams/` (`brief-api.ts` +
  `brief-api.fake.ts`), `resources/`; `my-app` + `main.ts` stay at `src/` root. Naming
  convention recorded in build_implementation.md → "Frontend code structure": folder =
  role, filename = resource; outward seams carry a resource-kind suffix (`-api` = HTTP)
  and ship with their fake beside them; **"Service" reserved for backend domain
  operations** (the frontend's outward layer is a *seam*, never "Service"). All tests
  green; no logic changed.
- **Intake slice built — read/write loop closed.** Compose already-de-identified units →
  submit each via `POST …/units` → run `POST …/deid/scan` → render the aggregate outcome
  ("N cleared, M flagged — held back for review"). Cleared units now feed the brief
  read-path automatically (a real flow no longer needs fixture pre-clearing). No backend
  changes (the two existing routes sufficed); **no `deid_status` crosses; no de-id policy
  invented.** New shared DTOs: `UnitSubmission`, `IntakeAck`, `DeidScanSummary` (all
  "no internal type"). Reason set: submit seam → `validation | denied`; **gate-flagged is
  NOT a reason** — it's `summary.flagged`, read as store state (`flaggedHeld`), a normal
  gate verdict, not an error. New frontend: `seams/intake-api.ts` + fake,
  `stores/intake-store.ts`, `pages/intake-page`. Frontend 16/16, backend 75/75 green.
  Deferred: intake→brief nav (would touch `BriefPage`'s hardcoded fixture id). Three
  questions parked — see Open/deferred.
- **Real Listening behind the LLM provider seam (first real model; Listening only).**
  `AnthropicLlmProvider` (`@anthropic-ai/sdk`, model `claude-opus-4-8` as a single named
  constant, Messages API, adaptive thinking) added beside the fake. Listening gains a
  versioned `system` contract + a tolerant defensive parse; the unchanged anchoring guard
  is the hallucinated-id net on the real path. **Silence vs exception:** malformed output
  / refusal → safe-empty; transport errors propagate (not disguised as silence).
  **Selection = Option A:** `buildContainer()` and the running server stay on the fake;
  the real provider is selected only by `selectLlmProvider()` (reads `ANTHROPIC_API_KEY`)
  and exercised only by a dev **eval harness** (`npm run eval -- listening`, parameterized
  for the next lens). No real call in any test. Structured outputs declined (would couple
  the seam to a provider-specific capability; removes only the malformed-JSON failure mode,
  not the parse/guard/refusal/transport handling). Backend 92→103 (+11) green; frontend 19
  untouched; repo-wide 111→122; lint/build clean. Recorded in build_implementation.md →
  "Lens↔model contract." The server goes real only once ALL lenses are defensive.
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
  to platform layer). **Authorization model — design intent (deferred platform layer),
  captured so it isn't re-derived:**
  - **Capability-based, role-blind engine.** The engine/routes ask ONLY capability
    questions — `authorize({ actor, engagementId, action })` → allow/deny. Nothing in
    the engine, routes, or lenses ever asks "what ROLE is this actor?" or names
    "facilitator." Role knowledge lives ONLY behind the authorization seam. (Already
    true today: `BriefService` authorizes `brief.view`, `IntakeService`
    `intake.contribute`; AllowAll in V1.) This is what lets "facilitator" be redefined
    without touching engine code.
  - **Roles vs rights are two layers.** A role (facilitator, voice-reviewer,
    research-reviewer, admin) is a label; rights (read, write/contribute, promote,
    export, grant) are capabilities; a role MAPS to a right-set (policy). "Facilitator"
    has no inherent essence — it means its rights and nothing else. Maria/Mitchell are
    distinct REVIEWER roles, NOT "global facilitators" (keep the three-actor review
    roles distinct).
  - **Assignment primitive = (actor, role, engagement)** — single-target (Option A,
    chosen for SRP). An actor's reach over engagements is the UNION of their
    assignments. "Multiple-but-not-all engagements" = several engagement-scoped
    assignments (no stored set). An assignment may instead carry a broader scope
    (org / global) for genuinely-broad roles (e.g. Maria global voice-reviewer).
  - **Group senses:** the *derived* group (an actor's reachable engagements) is just
    the union — free, always consistent, never materialized; a *named/managed* group
    (e.g. "the Acme account" = N engagements, grant/revoke as a unit) is a stored
    entity with its own lifecycle — DEFERRED convenience, and the same mechanism as
    org-scope. Don't build it until managing sets one-by-one hurts.
  - **Resolver stays one rule regardless of how reach is composed:** "does this actor
    hold any assignment whose scope covers engagement X and whose role grants the
    action?" Global-scope assignments are the high-blast-radius case (esp. global
    `admin`/grant) — constrain who may hold/create them when built.
  - **V1 read-gating (now ruled, recorded in build_approach.md → Engagement and actor
    scoping):** isolation is engagement-level; `actor` scopes provenance + action
    authorization, NOT a read partition within an engagement. Any actor authorized on
    an engagement reads that engagement's brief (shared-workspace review: facilitator /
    Mitchell / Maria share one brief). Repo correctly keys reads by engagement; no
    per-actor read isolation within an engagement in V1. This data-level sharing is
    the V1 half of the platform's deferred **shared workspaces** — the engine enforces
    who-shares-what now; real accounts + workspace machinery come with the platform
    (beyond V4).
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
- **Staff-facing trust zone (PAIRED question)** — two needs share one shape: (a) a
  facilitator-facing **internal-brief** view of the brief, and (b) **per-unit intake
  status** (which unit the gate flagged, needing `deid_status` to cross). Both are
  legitimate staff-only needs the *client-safe* `shared` contract cannot carry (internal
  types / `deid_status` are forbidden from `shared` by design). They are the SAME
  deferred decision: a staff/actor-facing contract or trust-zone distinct from the
  client-safe one. Resolve once, for both — not two ad-hoc breaches.
- Flagged-unit resolution policy (intake): what "resolve a flagged unit" should do is
  unbuilt — both candidates edge into parked de-id policy (human override-clear via the
  un-routed `recordHumanDecision`; correct-and-rescan, which the surface doesn't support:
  no content-update op, `scanPending` only processes `pending`). Parked with the Inclusity
  conversation.
- Detector flag-reasons (intake): the gate discards `DeidDetector`'s `DeidFinding[]`, so
  "why was this flagged" can't be surfaced; would need the gate to persist them. Parked
  with the detector.
- **Deferred test gaps (coverage audit, June 2026 — each with a trigger, so they ride a
  natural increment rather than orphaning):**
  - *Item 5 — sensitive-without-promote + disposition-lowering* (`discernment.ts:77`):
    every sensitive test also promotes; "flag sensitive, don't promote" and revise-
    downward (`promote:false`) unrun. → rides **caution-findings** or the **human-review
    promoter** (both touch Discernment verdict-setting directly).
  - *Item 8 — subtheme hierarchy through the backend* (`assemble.ts:54` parent
    passthrough; frontend dangling-parent→root in `brief-store.ts`): `parent` tested only
    in the frontend grouping; no backend finding carries one. → rides the **real-model /
    prompts** work or the first lens that actually emits a subtheme.
  - *Item 9 — multilingual* — **CLOSED (this session):** EN/ES now exercised end-to-end via the
    Human Meaning real-model eval (Spanish u5/u8 + mixed u13 → English noticings anchored to
    source units) plus new automated tests; the `'es'` fixture landed. (Was: every unit `'en'`,
    the EN/ES-from-the-start constraint unguarded.)
  - *Item 11 — single-vs-multiple per lens* — **CLOSED (this session):** Human Meaning emitting
    multiple noticings per voice (`meaning:0`, `meaning:1`, …) exercises id-suffixing past `:0`,
    multi-finding accumulation, and ordering; covered by new automated tests. (Was: every fake
    emitted one finding per lens.)
  - *Minor / opportunistic:* de-id gate idempotency (`scanPending` skip-non-pending;
    `recordHumanDecision('flagged')` re-flag) and `repository.setDeidStatus` not-found
    branch — low blast radius; pick up when touching the gate/repo.
  - **In the current test-adding increment (Option B):** Tier 1 (absence-through-
    projection; Listening anchoring-drop; units-exist-none-cleared boundary) + Guardrail-
    append + support-text singular + the two write-path HTTP route tests (item 4).
    **DONE (June 2026): +20 tests, 91→111 green (repo-wide: backend 75→92, frontend
    16→19), no production change, no test failed
    against production** (every guarded behavior matched production). Item 8 is now the
    *last* structural-tier uncovered arm — `assemble.ts:54` (projecting a finding that
    carries a `parent`) + the parent ternaries in `finding.ts` (160/184/219/230) — the
    cleanest-isolated remaining structural gap, still deferred to its trigger (model work
    / first lens that emits a subtheme). The append-branch test confirmed the real
    `DiscernmentLens` cannot emit a fresh-id Guardrail finding (auditor's-privilege
    scoping holds); it was driven by a test-construct `FreshIdGuardrailLens`.
- **Eval-set draft retirement (planned, after the next Listening re-run).** `eval_set_draft.md`
  wears two hats: the *fixture units* (now wired into `run-lens.ts` — the harness is the
  source of truth; do not maintain a second copy) and the *case rationale* (L1…L8, D1/D2 +
  what-to-watch — the valuable part, not in the repo). Plan: once the prompt revision +
  re-run settle (so we canonize against a stable prompt, not record-then-amend), **fold the
  case rationale into `build_approach.md`'s evaluation section** as the recorded seeded-eval-set
  definition — beside the §1 contract it tests, so the two move together — and **retire
  `eval_set_draft.md`.** After that: units live in the harness, rationale lives in the contract
  doc, each single-writer; the draft's `_draft` graduates by being folded in (it has proven
  itself — this run used it as intended and surfaced two contract refinements).
- **Two-field (three-field) Finding — `verbatim` / `translation` / `source_language` (in design → build).**
  Replaces the single paraphrased `content`: Listening carries the speaker's words verbatim
  (form intact, first-person) plus a literal English translation only when the original isn't
  English (+ source language name). Removes paraphrase entirely — the model's one sanctioned
  transformation is literal translation. Resolves the surface-form failure (the u16 "and" can't
  happen to a verbatim field) and the downstream-English requirement (lenses read
  `translation ?? verbatim`, resolved in one place in `prompt-projection`). Full spec in
  `two_field_finding_draft.md`; plan approved. **Two deferrals it surfaced (don't rediscover):**
  - *Absence findings have no text field — but absence is NOT fully deferred (REVIEW later).*
    `verbatim: null` for absence (decision 1a) means an absence finding has nowhere to carry its
    descriptive noticing ("no one mentioned X"); how absence carries its text is still open.
    HOWEVER, the infra slice is already coded: `finding_kind: 'absence'` and its exemption from
    the anchoring-validation rule are built and tested (`absence-through-projection`, June 2026).
    The exemption's only current consumer is the Discernment anchoring-audit path (an absence
    finding must not be flagged unanchored). No lens *emits* absence (Listening drops zero-anchor
    candidates). → When an absence-emitting lens lands, REVIEW the existing slice (emission, text
    field, client-safe flow) as one design pass — NOT a clean slate. (Doug flagged: verify "only
    consumer is Discernment" against the source at review time.)
  - *`verbatim` is surfacing-only — RESOLVED (Model B, LOCKED this session).* Interpretive
    lenses produce *noticings* (the model's interpretation), not a speaker's quote. DECISION: a
    distinct `noticing` field carries interpretive text; `verbatim` stays "speaker's exact words"
    and is `null` on interpretive findings. Invariant: `verbatim` XOR `noticing` (exactly one
    populated; surfacing → verbatim, interpretive → noticing). Resolver: `noticing ?? translation
    ?? verbatim` (Doug's order — prefer the finding's own text; also robust if the XOR is ever
    violated). `finding_kind` orthogonally marks the anchoring exemption. Absence-text home stays
    open (deferred, above) — B does NOT lock it. Recorded in build_approach Finding interface.
  - *Edge confirmed:* a real model emitting non-English `verbatim` with no `translation` →
    **keep** the finding (degraded-but-present voice beats a suppressed one), seeded eval catches
    it as a model-quality issue. *§1 reconciled* to first-person + structural flag (was
    "de-personalized frame" + inline "(translated from Spanish)").
- **Does within-unit *splitting* survive in a verbatim world? (open question, surfaced by the
  real run; parked).** L2 (u6, "The new onboarding process is a real improvement, and the
  third-floor kitchen has been out of order for weeks") was designed to test that Listening
  *splits* two genuinely-unrelated things the speaker joined with a bare "and" → two findings.
  Against the real model under the verbatim regime it came back as **one** verbatim finding, not
  two. This may be *correct*, not a miss: keeping the unit whole-and-verbatim adds nothing and
  paraphrases nothing, whereas splitting requires the model to *judge* the two clauses unrelated
  (a small interpretive act) and to emit a partial-span verbatim for each. The two-field decision
  (verbatim, no paraphrase) may have **dissolved** the split case rather than failed it: "carry
  the speaker's words exactly" pulls toward keeping the whole unit and letting downstream lenses
  separate concerns. → **Decide deliberately:** does Listening still split multi-thought units
  (and emit span-verbatim per finding), or does verbatim-fidelity mean one-finding-per-unit with
  separation deferred downstream? Affects the L1/L1c "preserve within-voice structure" framing
  too (structure-preservation and whole-unit-verbatim mostly agree; splitting is where they can
  diverge). Revisit when convenient — not blocking; the current behavior (keep whole) is a
  reasonable default.
- **Questions worth asking — a candidate first-class output type (design thread; not to
  build now).** A *question* (flags what is uncertain / unstated / worth probing; asks,
  asserts nothing) may be a distinct artifact from a *finding* (asserts what is) — the
  purest form of "AI surfaces, humans decide," and the *constructive* form of the
  no-inference restraint (where the model is tempted to infer, the disciplined move can be
  a question, not just silence). Already has scattered partial homes: Action Opening's
  "follow-up inquiries / reflection prompts," Discernment's caution-findings, absence
  findings — which suggests it wants to be one named thing. Subject to the *same*
  boundaries as a finding (no inference smuggled under a question mark; must anchor; must
  earn its place against question-spam). For Listening, only the narrow within-voice sliver
  fits (a voice gestures at something it doesn't name); the broad "this material raises a
  question" is downstream. **Most consequential open question: one lens vs. a cross-cutting
  capability** (many layers can raise a question, so it may be a shared discipline like
  anchoring, or it may consolidate into Action Opening) — answerable only against working
  downstream lenses. → **Trigger: develop when Tension / Discernment / Action Opening go
  real.** Full sketch in `questions_worth_asking_draft.md`.

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
5. Lens orchestration detail (parallelism within a wave, finding-passing between
   stages) — moves from "deferred" toward design when V1 build begins.
6. Whether `build_approach.md` needs its own output (PDF/docx) setup, or stays
   markdown-only as an internal doc.
7. **Layer revisit — COMPLETE (design docs + code).** "Layer" retired in both senses:
   output → **Brief** (internal/client-safe **types**; client-safe is the exported
   deliverable), processing → **Lens wave** (5 ordered waves inside the lens-
   processing stage). Also: **Client** added as a How-to-Read term; **Platform**
   de-parenthesized (the wrapper around the engine); directionality made horizontal
   (earlier/later, never above/below); body sweep complete (residual "layer" = only
   the quoted Inclusity principle + software jargon: platform/web/enforcement layer);
   the How-to-Read term list above is re-synced. RESIDUAL: (a) design-describing
   locked entries — SWEPT to lens-wave / Brief vocab. (b) Cross-doc code vocabulary —
   **Option 1 COMPLETE.** Code relay executed (naming-only, no behavior change):
   `Layer`→`Wave`, `LAYER_ORDER`→`WAVE_ORDER` (order unchanged), `Lens.layer`→
   `Lens.wave` (7 lenses), orchestrator internals (`groupByWave`, `byWave`, snapshot
   of prior-wave findings, same-wave independence, Guardrail wave supersedes, others
   append); the authorization action field `layer`→`briefType` (call site
   `{ type: 'brief.view', briefType: 'client-safe' }` — note the discriminant is
   `type`, not `action`); the Listening lens emission verified already `verbatim`
   (not `content`) with the `translation`/`sourceLanguage` pair for non-English (no
   change). 129 tests green (backend 110, frontend 19); lint/build clean. Docs
   (`build_implementation.md` + this build-log) on `Wave` vocabulary throughout.
   OUTPUT-SIDE RESIDUALS — CLEARED (naming-only, 129 tests green): `BriefLayer`→
   `BriefType` (definition + its one annotation; union values `'internal' |
   'client-safe'` unchanged; was local to `types.ts`, zero other refs;
   `ClientSafeFinding`/`ClientSafeBrief`/`.clientSafe`/`.internal` untouched); and
   the two test-prose strings retired (`assemble.spec` "internal/client-safe split",
   `brief-service.spec` "brief-view read"). Output-side "layer" is now fully retired
   in code. The "Pipeline" defined-up-top-then-elaborated overlap is accepted as
   intentional.
8. Cross-doc **"contract"** vocabulary — **RESOLVED: keep it (option A).**
   `build_approach.md` uses **"signature"** (a seam's interface — the inputs it takes
   and the shape it returns) and retired its one loose "contract" use as redundant
   *there*. `build_implementation.md` and the code keep **"contract"** for a distinct
   concept: the agreed set of shapes / protocol crossing a boundary — the `shared`
   package's client-safe DTO surface, and the Lens↔model prompt-and-parse protocol.
   Signature ≠ contract (one interface's inputs/return vs. a whole boundary's agreed
   shapes), so this is not a vocabulary collision: "contract" is precise, idiomatic
   jargon, kept on the same basis as "web layer" / "enforcement layer." No sweep.
   (The L21–22 "Inclusity↔Human Lens contract" is a third, process-agreement sense —
   also kept.)

## Environment
VSCode on Windows. (Pandoc + MiKTeX / LuaLaTeX / EB Garamond is the *proposal's*
build pipeline; `build_approach.md` may get its own output setup later if needed.)