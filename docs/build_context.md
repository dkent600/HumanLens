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
- **Lens validation method (each lens, on going real).** Fake/unit tests cover only shape and
  mechanics (a finding has the right structure; the seam behaves) — they CANNOT establish whether
  the model surfaces the right *meaning*, which is model judgment. Correctness of meaning is
  established by a **real-model eval run + Doug review + discussion here**: Doug runs `npm run eval
  -- <lens>`, relays the output, and we assess it together against the lens's intended output and
  voice-fidelity, recording findings + any prompt adjustments as calibration. Every lens goes
  through this loop as it goes real; green fake tests are necessary, not sufficient. The eval
  fixture must probe **both** directions: *coverage* (each intended output has at least one clear
  occasion in the fixture) AND *false-positives / over-reach* (control voices — neutral, positive,
  or genuinely context-dependent — where the correct move is restraint: no manufactured category,
  no loaded reading, a flag not a guess). A fixture that only tests coverage rewards over-reading.
- **Relay sheds load (multi-chat transmission hazard).** Knowledge moves between chats by relay; each hop can
  silently drop a load-bearing detail. Proven live: the two completeness attacks that landed (ledger durability,
  finish_reason/truncation) were BOTH in the original research survey and lost across survey→package→spec. So:
  any spec distilled from a source must stay AUDITABLE BACK TO that source, and consolidation of a
  distilled spec includes a deliberate bidirectional traceability pass against the source before it freezes
  (source item → covered-or-consciously-excluded; spec property → traces to source-or-recorded-decision). This
  is a standing hazard for every relay, not a completeness-spec quirk.
- **Disposition totality (relay-sheds-load, applied to reviews).** When dispositioning a review or attack
  packet, walk the **targets REQUESTED**, not just the responses RECEIVED — every requested target ends
  attacked / declined / unaddressed-carry-forward, never silent. Proven live: the concurrent-run seam was in the
  Packet-B target list but never attacked, and the attack-by-attack disposition had no row for un-attacked
  targets, so it fell out unanswered (found only by the parallel traceability walk). The symmetry is the lesson —
  the disposition process itself violated "totality / no silent path," the same completeness property the
  *product* enforces, missing from our *process*. Applies to any review, diff, or packet whose requested scope
  is larger than what came back.
- **Plain-language derivatives over-claim certainty (review heuristic; Fable).** Human-destined glosses of the
  precise design tend to quietly claim certainty the system doesn't have. Proven live: the completeness gloss's
  "what the residual asks of a human" block was corrected TWICE by Doug reading skeptically — first for reading
  delivery as understanding ("the residual is not unprocessed work"), then for reading honestly-sparse output as
  run-failure ("treat the run as incomplete", which excluded the thin-material explanation). Same species both
  times. So: every human-destined derivative of the precise text (onboarding, reviewer material, client-facing)
  gets a deliberate skeptical human read specifically hunting for over-claimed certainty, before it's treated as
  final. The recursion is the point — the product's own thesis is "the machine delivers, the human's skeptical
  look supplies the judgment," and that same skeptical read is the working control on the docs *about* it.

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
- Evaluation = two kinds. STRUCTURAL (automated invariants: anchoring,
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
  green; tsc/eslint/stylelint clean. No `docs/` edits from the implementation side; no spec note.
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
  / refusal → safe-empty; transport errors propagate (not disguised as silence). *(SUPERSEDED
  2026-07-12 by the completeness adoption: refusal now routes to delivered-but-unusable, not safe-empty
  — that collapse was the fake-empty drop; the seam-fix surfaces `stopReason`. See the ADOPTED completeness
  entry + `build_implementation` "Completeness — orchestration.")*
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
- **✅ ADOPTED 2026-07-12 — LLM voice-processing completeness. Design of record now in `build_approach`
  (glossary "Completeness"; "Lens processing" four-state accounting + cross-voice cited-or-residual audit +
  per-lens invariants + plain-language recap) and `build_implementation` ("Completeness — orchestration":
  fan-out, (run_id, voice_id) ledger, P1–P9, adapter totality, cross-voice audit, seam-fix).** What was
  adopted: per-voice **synchronous fan-out** (voice = unit of work and of accounting; batch-API a later
  transport swap behind the same seam; Option 2 not built, kept adoptable); the **four terminal states** (no
  fifth); the cross-voice **cited-or-residual** audit. Unparked by **F1-a 50/50 real-model totality** (below).
  Committed FIRST implementation task: the **fake-empty-drop seam fix** (surface `stopReason`/status; stop
  collapsing refusal → `{text:''}`). STILL OPEN under adoption (adoption did not answer these): **O-1..O-4**
  (Item 4c) and the **Mitchell values-review** (does non-retryable answered-empty match Inclusity's stance on
  silence). The framing below (challenge / requirement / consequence / two forms) is retained as the problem
  statement the adopted design answers.
  - *The challenge (universal).* Any LLM call can silently fail to process a voice it was given —
    the model may emit nothing for an input it received. This applies to **every LLM call in the
    system — every lens, throughout the pipeline**: per-voice lenses (Listening, Human Meaning),
    cross-voice lenses (Culture Pattern, Tension), and the Interpret / Guardrail / Openings lenses
    alike. All LLMs are subject to it. Diagnosed concretely via u9 (submitted in the Human Meaning
    batch, no output emitted; stochastic — dropped/dropped/surfaced across three runs); confirmed
    latent in Listening; inherent to every LLM call.
  - *Requirement (Doug, standing, top priority).* A **deterministic guarantee that every voice is
    processed by the LLM** — submitted *and* accounted for in the output. "Deterministic" governs
    **delivery and accounting only**: every voice provably gets its turn. The **output** of that
    processing is and stays **stochastic** — no guarantee is asked (or possible) about *what* the
    model returns, only that no voice is silently skipped. Solving this comes **first** — ahead of
    new lenses, the Aggregate wave, and the Human Meaning completeness fix (now just one instance of
    this general problem).
  - *A consequence, not a solution.* A bare single batched call can never meet the bar: submission ≠
    processing (the voice is in the prompt but the model emits nothing for it), and it isn't
    verifiable per-voice. So the bar rules out "one batched call, trust the model" — but does NOT
    pick a mechanism. Candidates (per-voice calls, batch + per-voice guard + retry, chunking
    discipline, input formatting, structured decoding) are all **open and unagreed**.
  - *Two forms of the guarantee.* Per-voice lenses: "every voice processed" = every input voice
    yields output, checkable per input id. Cross-voice lenses: one-output-per-voice doesn't apply;
    the guarantee is that the whole set is provably ingested/considered (no silent truncation,
    nothing lost between chunks). Defining the cross-voice form is part of what must be solved, as a
    whole, before any lens is patched.
  - **✅ ADOPTED 2026-07-12 — the block below is now the HISTORICAL RECORD of how the adopted completeness
    design was reached (cold cross-family derivation, adversarial review, traceability audit, validators,
    real-model falsifiers); the live design of record is in `build_approach` + `build_implementation`. Items
    are preserved as the reasoning/validation trail, NOT pending decisions. Two things stay OPEN under adoption:
    O-1..O-4 (Item 4c) and the Mitchell values-review. (Prior header: "PROPOSED — CONVERGED BETWEEN CHATS —
    AWAITING DOUG"; superseded by adoption.)**
    - *GATE (Item 8) — pending external evaluation.* Doug intends to subject this converged package to
      stronger independent evaluation (possibly a different model family / other means) BEFORE approving
      anything below. This gate sits in front of the whole block. Relatedly (Item 7a): two-chat convergence
      is weak independent evidence (same model family, same survey inputs) — the validators of record are
      empirical (the research survey + the u9 eval), not agreement between chats.
    - *Conditions attached (recorded WITH the proposals they gate).*
      - **1a** — if Edit C is ever drafted, the same pass must reconcile Edit A's middle terminal state
        (a voice provably covered that surfaced nothing) with C's ≥1-per-voice invariants: those invariants
        CLOSE that middle state for these two lenses (Listening: survives only for non-authored structural
        emptiness; Human Meaning: never), and the text must present this as a DERIVATION from each lens's
        contract, not an exception to A — else A and C read as contradictory to a careful reader (Mitchell).
      - **1b** — the "residual as facilitator-facing signal / product feature" framing (Edit D) stays in
        internal design docs ONLY; it must not migrate into AI_Development_Plan.md or client-facing material
        without separate Doug approval after the mechanism exists and has been seen working (cf. S4-A/S4-C
        rework + client-facing language discipline).
    - *Item 1 — Edit A (proposed, not landed).* Completeness = accounting property, guaranteed in code,
      never in a prompt; every voice ends in an explicit terminal state, matched by the orchestrator, never
      inferred from the model's claim to be thorough. **TERMINAL-STATE COUNT — resolved (converged both chats)
      toward FOUR, pending cross-family check.** V-1's P4 surfaced that the earlier THREE-state enumeration
      (findings / covered-and-empty / propagated-failure) collapsed two distinct outcomes. Deciding rule: *a
      ledger state earns existence iff it routes differently* (retry semantics or the honest claim), reasons
      annotate but don't multiply states. Four states: (i) answered-with-findings; (ii) **answered-empty
      (chosen silence) — NEVER retried**; (iii) **delivered-but-unusable** (refusal | malformed) — retryable at
      the *model* layer, then surfaces as an explicit gap; (iv) **failed** (transport/infra) — retryable at the
      *infra* layer, then a gap. Plus the excluded fifth: UNACCOUNTED (the silent drop) — not a state, the hole
      P1 closes ("no fifth state"). Key args: retrying chosen-empty = manufacturing findings under retry
      pressure = the mechanical form of the overreach the lenses refuse → (ii) non-retryable *by rule* → its own
      state; four-state leaves the standing trust-boundary paragraph UNCHANGED (it governs lens behavior, which
      is identical; the accounting distinction is new) — a *smaller* canon change than fold-into-propagated,
      which would force rewriting the boundary. Refusal-as-facilitator-signal (surface (iii)-refused to review)
      noted but **GATED by 1b** (product-feature framing; not part of the four-state justification). Edit A's
      proposed text moves to the four-state form + "no fifth state" clause; canonical proposed text lives in the
      Fable→owner relay of this exchange — recorded BY REFERENCE, not pasted here. Proposed placement: "Lens
      processing: a staged pipeline," after the trust-boundary paragraph, before the mermaid. Supersedes both
      the "arithmetic over identifiers…" wording and the three-state wording; nothing is in canon.
      **Fork evidence after V-2 (record precisely):** four-ness + machine-failures-split-in-two = converged
      cross-family (Gemini, cold); A6 (truncated/filtered empty MUST be retryable while chosen-empty must NOT)
      independently FORCES the empty/unusable split — a concrete failure unrouteable under three states. The
      refusal|malformed grouping specifically remains Claude-derived; A7 (provider content-rejection = "a human
      should look") is its first independent adversarial corroboration (still 1b-gated). Not "ratified" — the
      evidence column is materially heavier on four, refusal-grouping still lightest.
    - *Item 2 — Edit B:* proposed DROPPED (absorbed by A's second paragraph); not formally dropped until Doug says so.
    - *Item 3 — Edit C (shape only, no text drafted):* invariant stated in each lens's section AND checked in
      structural evaluation. Listening: every authored voice → ≥1 finding (zero for an authored voice is a
      provable error, not a judgment). Human Meaning: every voice → ≥1 finding (a worth-exploring flag counts).
      "Accounted for" is the universal invariant; ≥1-per-voice is a lens-DERIVED strengthening, never imposed on
      cross-voice lenses; future lenses declare their invariant at design time. Must include the 1a reconciliation.
      Spanish bullet: proposed SPLIT — completeness half folds into the general structural check (parenthetical
      trace that it subsumes the multilingual case, so the client commitment stays easy to point to);
      translation-fidelity half → qualitative evaluation. build_implementation companion (if approved): under any
      batched mechanism, ≥1-per-voice contracts are a termination PRECONDITION for gap-retry (a legitimately
      silent voice is otherwise indistinguishable from a drop; retries never converge).
    - *Item 4 — Edit D (shape only, no text drafted):* Aggregate/Interpret coverage as an ORCHESTRATOR-computed
      audit over existing provenance (sourceFindingId / evidence_links): every upstream finding is either cited
      by some aggregate/interpret finding or in a computed, surfaced residual. Residual computed in code, NEVER
      emitted by the lens. Non-empty residual is EXPECTED and correct — the guarantee is "nothing silently
      uncited," not "residual empty." Residual surfaces to human review as candidate outliers (subject to 1b).
      Placement: principle in the Aggregate-wave description (beside A); check in the structural-eval list;
      mechanics in build_implementation. **Proposed refinement (from the Gemini/Fable V-2 read, below):** residual
      EXISTENCE is legitimate; residual MAGNITUDE is signal — surface the cited/provided inclusion ratio as a
      structural metric to human review alongside the residual contents. **Auto-retry-on-low-ratio is REJECTED**
      (Gemini proposed it): retrying synthesis until more gets cited is citation-under-pressure — the aggregate
      analogue of retrying a chosen-empty voice, hollow citations for hollow findings. (arg #1 applied one level up.)
      *A4 refinement:* the coverage audit + inclusion ratio are orchestrator diagnostics surfaced to REVIEW —
      NEVER stated to the model as a target; the synthesis prompt never instructs exhaustive citation (findings
      cite what they actually use; the residual absorbs the rest legitimately). *A5 refinement:* record a product
      metric — residual triage time must beat reading the raw voices; if it doesn't at pilot scale, hierarchical
      aggregation moves UP the roadmap (the trigger that promotes it from "scale-contingent").
    - *Item 4b — PLAIN-ENGLISH GLOSS "Completeness, both cases" (reviewer-facing companion to Edits A + D;
      PROPOSED with the package).* STATUS/CAUTIONS: build-doc / reviewer-facing (onboarding, plain-language
      sections), NOT client-facing — residual-as-feature framing stays internal per the 1b caution; any
      client-facing derivative passes the language discipline separately. Sits ALONGSIDE the precise text (Edit
      A four-state, Edit D residual), never instead of it — those remain load-bearing; the gloss's vocabulary
      ("genuinely nothing," "uncited") is NOT spec vocabulary. Goes into `build_approach` beside the precise text
      IF/WHEN the package is adopted. This is the sole/superseding version (two earlier in-chat drafts overclaimed
      — discarded). Owner-chat picks exact `build_approach` placement at adoption. VERBATIM (Fable-final):
      > **Completeness, both cases.**
      > *Per-voice lenses: prevent the drop.* Each voice gets its own model call. The model never sees a list, so
      > it cannot skip an item on one. Our code holds the roster, sends one call per voice, and records one of four
      > outcomes for each: findings, genuinely nothing, unusable response, or failure. The run is not done until
      > every voice has an outcome. No fifth state exists; a voice cannot vanish.
      > *Cross-voice lenses: detect the drop.* Pattern-finding requires seeing all findings at once, so these
      > lenses receive the complete, closed set from the prior wave in one call — the list is unavoidable, and so is
      > the risk of skipping. The guarantee therefore moves after the call: every pattern must cite the IDs of the
      > findings it is built on; our code then subtracts cited from sent. Whatever was never cited lands in a
      > visible residual for the reviewer. The model can fail to use a finding; it cannot hide one.
      > *What the residual asks of a human.* The system can prove every finding was delivered to the lens. It cannot
      > prove the model actually weighed each one. So an uncited finding is one of two things, and we can't tell
      > which: considered and set aside, or overlooked. The reviewer's look is what settles it — that look is part of
      > the completeness guarantee, not cleanup after it.
      > *The task:* for each uncited finding, ask does this matter? Either it's worth naming in the brief, or it
      > shows the patterns missed something, or it's peripheral and stays set aside — now by a person's judgment
      > instead of the model's silence.
      > Some findings will always go uncited; that alone means nothing. What matters is the share: the system shows
      > what fraction of the findings ended up in the patterns and what fraction didn't. When most went uncited,
      > don't start triaging item by item — first ask why. Skim a few uncited findings: if they're thin or beside
      > this lens's question, the material simply didn't carry much, and the small pattern set is probably honest. If
      > they're substantive and relevant yet uncited, the run under-delivered and should be redone rather than
      > patched by hand. There's no fixed cutoff; that judgment belongs to the reviewer and sharpens with use.
      > *One sentence:* where the model cannot be given a list, no list exists to drop from; where it must be given
      > one, our code makes everything it left uncited visible — and a human's look is what turns "set aside" into
      > "considered."
    - *Item 4c — OPEN DESIGN ITEMS from the residual's human side (record OPEN via governance; NO answers —
      answers belong to the normal design loop, not conversational drift).* Context: pressing on what a reviewer
      DOES when an uncited finding turns out significant splits the handling into reviewer-promotes (single
      stray) / defect-report (clustered misses → the u9-style fixture loop) / human-decided rerun (whole run
      deficient; automatic-rerun-on-metric stays REJECTED). That walk exposed four unspecified things:
      - **O-1 HUMAN-PROMOTED FINDINGS.** When a reviewer judges an uncited finding significant and names it in
        the brief, how is that represented? The finding model has NO slot for human-authored entries with human
        provenance. Requirement shape (not a design): promotions must be visible AS human-added — never inserted
        among model output as if the model surfaced them; **provenance must not lie.**
      - **O-2 BRIEF FLOW.** How do human-promoted findings flow into the internal brief vs. the client-safe
        brief? Interacts with the LOCKED principle that the client-safe brief is a **pure filter** (removes
        findings, never rewords) — a human-authored finding entering that filter path needs a defined treatment.
      - **O-3 FIXTURE CAPTURE.** When a reviewer finds significant-but-uncited findings (esp. clustered), how
        does that become a recorded test case (the u9 pattern: real miss → named fixture → lens fixed → fixture
        proves it stays fixed) rather than evaporating after the engagement? No capture path exists today.
      - **O-4 RESIDUAL DISPLAY** (flagged earlier, recording now to be safe): per-lens residual views vs. one
        consolidated review view — a product/implementation choice, unmade.
      All four OPEN; no answers proposed; not in canon; do not touch the mechanism decision.
    - *Item 5 — Mechanism — ADOPTED 2026-07-12 (was the TOP-PRIORITY open decision).* The adopted mechanism:
      the voice is the unit of work AND of accounting for the per-voice lenses; both
      per-voice lenses on the same mechanism; first embodiment = synchronous parallel fan-out (one call per
      voice, keyed by voice id — preserves the fast build→look→tune loop); scale swap behind the SAME seam via
      provider batch API (one voice/request, request id = voice id, explicit terminal statuses, `expired`
      retryable) — SAME accounting semantics, DIFFERENT transport AND latency class (A2: "pure transport" struck
      as overclaim — a 24h retry loop is a different product): interactive/eval runs stay sync PERMANENTLY; the
      batch path serves only non-interactive scale runs (acceptance test if/when built: fail 5% of a batch, measure
      time+code to totality). Doesn't touch the lens seam (why this hybrid is OK where structured outputs
      were not); voice-id keying on every call and write from day one; Option 2 (k-voice batching +
      id-reconciliation + retry tiers + dead-letter) NOT built, kept adoptable. Rationale: fan-out REMOVES the
      failure-generating step (vs. detect-and-recover); chosen silence is structurally observable only under
      per-voice semantics; output tokens identical under both options and dominate cost, while prompt caching
      cuts the overhead batching would save; Aggregate reads compact findings → chunking is scale-contingent and
      reuses none of voice-batch reconciliation, so consistency doesn't tip the choice.
    - *Item 6 — u9: RESOLVED per the adoption (2026-07-12).* Decision half CLOSED — mechanism adopted (fan-out).
      Defect half → **fix-decided / implementation-pending**: the fake-empty-drop seam fix is the committed first
      task; F1-a (Falsifier 1) PASSED 50/50 on the real model (u9 answered every run under fan-out), so the
      structural-impossibility claim held empirically. The defect fully closes when the seam fix lands and ships.
    - *Item 7 — Falsifiers (epistemics of the proposal).* (a) two-chat convergence = weak evidence (above).
      (b) Falsifier 1: once per-voice calls exist, repeated u9 re-runs must show the silent drop is STRUCTURALLY
      IMPOSSIBLE, not merely rarer — any unaccounted voice under fan-out falsifies the analysis. (c) Falsifier 2:
      real token counts from first runs must confirm output-token dominance; if input overhead dominates at
      actual prompt sizes, the Option-2 cost question legitimately reopens.
  - **▶ VALIDATION PLAN — AUTHORIZED TO BUILD (validators only; NOT package approval).** Doug authorizes
    building the VALIDATORS below; this does NOT approve the architectural package (Edits A–D, mechanism).
    The minimal orchestrator skeleton V-1 needs is **eval-tier scaffolding, not adoption** — a passing V-1
    does NOT auto-promote the skeleton to the chosen mechanism; the decision still routes through Doug after
    V-1/V-2/V-3. Validators produce inputs to Doug's decision, not substitutes for it. Nothing here lands in
    `build_approach.md`; u9 stays open. (Full V-1 spec is BY REFERENCE — the Fable→owner validation relay;
    it drafts into `build_implementation.md` as a PROPOSED eval-spec only on Doug's separate go, then relays
    to Claude Code.)
    - *Governance rule (adopt into the V-1 spec):* new adversarial behavior found in implementation →
      proposed property → owner-chat records → Doug approves. The property list stays canonical in the spec,
      never drifts in test code.
    - *V-1 — adversarial simulation (build first).* Minimal per-voice fan-out orchestrator behind the lens↔model
      seam (one call per voice, keyed by voice id, run ledger) + a hostile behavioral model mock producing, per
      call, seeded/reproducible (fast-check): valid / empty / malformed / refusal / hallucinated-id /
      duplicate / **cross-voice (g: findings for a DIFFERENT valid voice)** / transport-fail / truncation.
      Properties P1–P7: P1 totality (every id in exactly one of the four states); P2 no-silent-path — **now:
      resolved-empty requires a USABLE response** (four-state); P3 provenance integrity — **each finding's id
      checked against the id sent in THAT call** (this is what catches (g); qualifies "drops impossible" →
      "impossible *given the per-call provenance check*"); P4 — **rewritten: malformed/refusal → (iii)
      delivered-but-unusable, never resolved-empty, never conflated with transport; transport → (iv) failed**;
      P5 idempotent retry; P6 report accuracy; **P7 (new) — chosen-empty is NEVER retried** (the anti-fabrication
      rule as a testable property). Acceptance: hold across thousands of seeded runs; shrunk counterexamples
      become fixtures.
      **Packet-B strengthenings (adopted PROPOSED — the two [ACCEPTANCE] items change V-1 ACCEPTANCE CRITERIA, don't miss them
      at build greenlight):** [ACCEPTANCE] *A3 durability* — the ledger is PERSISTENT from V-1 (SQLite suffices); ledger
      write precedes/atomic-with finding persistence (no finding may exist the ledger can't account for);
      + behavior **j** (crash/kill mid-run); + **P8 recoverability** (after crash+restart, totality restorable —
      every voice terminal or provably-pending, no zombies, completed voices not re-run); acceptance test:
      SIGKILL at 50% → restart → perfect resume. [ACCEPTANCE] *A6 finish_reason gating* — answered-empty requires BOTH a
      usable empty payload AND natural completion. **Natural-finish set (Anthropic-precise, per Fable; Claude
      Code credited for the vocabulary catch):** natural = `end_turn` (+ `stop_sequence` ONLY if the lens
      deliberately uses stop sequences, else treat as unexpected); **`max_tokens` / `refusal` / `pause_turn` /
      `tool_use` → delivered-but-unusable** (a lens producing findings should never stop for a tool). + behavior
      **k** (schema-valid empty payload with non-natural finish);
      P2 strengthened (routing needs response metadata, not just body shape — this STRENGTHENS four-state, adds
      no fifth). *A9 adapter totality* — the seam adapter is a TOTAL function: every SDK/network outcome
      (incl. exceptions in parse/stream/teardown) maps to exactly one of the four states, no unhandled path
      (P1 pushed down a level, testable); behavior-c corpus extended (HTML-in-200, mid-token JSON truncation,
      encoding garbage, oversized). *A7 4xx routing row* — non-retryable HTTP 4xx → terminal, reason-code
      `provider-rejected`, surfaced to review, no backoff (distinct from retryable 429/5xx/timeout).
      **Traceability-pass additions (PROPOSED via governance; three reconciled gaps — full detail in the pass
      result under V-2):** *P9 TERMINATION* (+ behavior **l** perpetual-poison) — every voice reaches a terminal
      state within bounded attempts, run provably ends, exhaustion → reason-code `retries-exhausted`, never
      loops. *Run-scoping* — key = **run_id + voice_id**, one writer per run, P1/P5/P6/P8 asserted per-run (or
      single-active-run lock) — closes concurrent-run ledger corruption P5 alone doesn't. *G-1 property (routing
      + persistence)* — answered-with-findings/answered-empty reachable only on natural finish (non-natural →
      unusable regardless of parse); findings persisted IFF terminal state is answered-with-findings (truncated
      partials never authoritative). *Provenance:* behavior **g** stamped as a spec-drafting invention (per-voice
      analogue of the batch drop; no survey source), not an orphan.
    - *V-2 — cross-family derivation (run in parallel; validates reasoning, not the guarantee).* Packet A
      (requirement-only, **REVISED** — state set derived by the other family, NOT handed; see the drafted
      revision) run clean in the other provider's own interface → **capture, stop, look** → Packet B
      (adversarial critique, ≥8 attack attempts) shaped by A's actual landing. Both responses recorded as
      reference, not canon. Landing on four-with-reason-codes = cross-lineage signal on the fork; landing
      elsewhere = the difference is the artifact to study.
      - *Packet A RESULT — Gemini (cross-family, cold), REFERENCE only; nothing promoted, still under the gate.*
        **Mechanism: strong independent convergence.** Gemini landed cold on "Strict 1:1 Execution Mapping
        (one voice = one prompt)" with our exact reasoning — remove routing from the model; drops
        structurally impossible; **provenance attached by the application, not trusted from the model**; total
        per-voice isolation. Reached sync fan-out first with a concurrency limiter (`p-limit`) + defer heavy
        orchestration (queues/Temporal/Kafka), and independently named the **"System Prompt Tax"** as the real
        cost (our output-dominates / caching point from the other side). Its "A+B+C+D must equal input voices"
        is our P1 totality, independently derived. Q5/Edit D: clean convergence — traceability via citation,
        audit cited-vs-provided IDs, inclusion ratio, non-full-coverage expected-and-inspectable (not a hard
        guarantee). **The fork (Q4): partial.** Gemini produced FOUR outcomes — findings / genuinely-empty /
        formatting-parsing-error / infra-error — and folds *refusal into malformed* (agrees refusal isn't its
        own state, matching our reason-code call). BUT it did **NOT** independently surface our load-bearing
        arg #1 — that genuinely-empty must be **non-retryable by rule** to avoid fabrication-under-retry. So
        four-state *structure* gets outside support; our strongest *justification* did not replicate → flag as
        possibly Claude-native, one for Mitchell/Packet B. **Caught overreach (values-relevant):** Gemini's
        proof-of-empty = "instruct the model to output `[]` and trust it looked" — the exact model-attestation
        trap Edit A forbids ("never inferred from the model's claim to be thorough"). Accounting stays safe
        under fan-out (the call resolved, keyed to the voice), but the *interpretation* overreaches; good
        concrete illustration of why we drew the observable-not-attested line. → Packet B should concentrate
        fire on (a) the un-replicated non-retryable-empty argument, (b) the `[]`-attestation trap (does the
        package anywhere lean on model-attested emptiness?), (c) cost arithmetic + sync-vs-batch sequencing
        Gemini didn't examine — not on re-litigating fan-out (cross-family converged).
      - *Fable's cold read of the same Gemini response (owner + Fable agree on what it means → Packet B safe to shape).*
        Fable independently confirmed the two flags above — the **anti-fabrication (non-retryable-empty) argument
        did not replicate** in Gemini, and the **caching claim has NO independent validation** (Gemini named the
        system-prompt tax, never mentioned caching — so F2 is load-bearing, not confirmatory). **Sharpened fork
        line (record precisely):** cross-family confirms *four-ness* AND *machine-failures split into two states*
        (findings / empty / machine-unusable / infra) — but Gemini folds refusal INTO parse-error, so the
        specific **refusal|malformed grouping (and refusal-as-facilitator-signal) is still Claude-only, unconfirmed.**
        So: "four, machine-split confirmed cross-family; the refusal grouping is not," NOT "our four-state ratified."
        **Residual-semantics divergence Fable caught (owner had glossed as convergence):** Gemini treats a low
        cited/provided inclusion ratio as FAILURE → auto-retry the synthesis; the package treats non-empty residual
        as expected/reviewable. → proposed Edit-D refinement (see Item 4): residual EXISTENCE legitimate, residual
        MAGNITUDE = signal surfaced to review; **auto-retry-on-low-ratio REJECTED** as citation-under-pressure (the
        aggregate-stage analogue of retrying a chosen-empty voice — hollow citations for hollow findings; arg #1 one
        level up). All reference/proposed; nothing promoted.
      - *Packet B RESULT — Gemini adversarial review (10 attacks) + Fable scorecard, REFERENCE; PROPOSED via governance.*
        Verdict: **directionally right, operationally fragile** — the architecture SURVIVED (fan-out, four-state
        ledger, cited-or-residual audit all stand), but two attacks LANDED at spec level. **Meta-finding (the real
        headline):** both LANDS were things the original research survey ALREADY KNEW (persistent ledger =
        survey Technique 8; "check stop reason / truncation-masquerading-as-completion" = a listed failure mode),
        lost in transmission survey→package→spec. The process caught its own transcription losses. **LANDS:** A3
        crash-wipes-in-memory-ledger (→ durability/P8/j, above; also retroactively validates the
        skeleton≠mechanism firewall — Packet A's p-limit framing had drifted toward in-memory); A6 truncated/
        filtered empty recorded as chosen-empty & never retried = permanent drop (→ finish_reason gating/k/P2,
        above; independently FORCES the empty/unusable split → strengthens four-state on the open fork).
        **PARTIAL/refinement (adopted):** A1 cache-miss-under-burst (real; magnitude = F2's question; → F2 upgrade
        + pre-warm note, below); A2 "pure transport" overclaim (→ struck, Item 5); A4 hollow-citation incentive
        (→ Edit-D "audit never a model target", Item 4); A5 residual-at-scale (partly misreads — reviewers triage
        compact grouped residual, don't read raw — but → residual-triage-time product metric + roadmap trigger
        for hierarchical aggregation, Item 4); A7 provider-rejected 4xx (→ routing row, above; also **first
        independent adversarial corroboration of refusal-as-signal** — provider content-rejection on a listening
        voice IS the "a human should look" case → refusal-as-signal moves from Claude-only-unconfirmed to
        Claude-derived-with-one-adversarial-corroboration, still 1b-gated). A8 refusal-classification brittleness
        CONFIRMS reason-code (not state) placement (misclassification costs diagnostics, never a voice). A9
        200-with-HTML-body (→ adapter totality, above). **REJECTED (with reason):** batch-reconciliation day-one
        (A2 — contradicts deferral + two-person constraint); Toxiproxy chaos tier (A9 — over-tooling at this
        scale; F1-real-provider is live-fire); auto-retry-on-ratio (re-rejected — citation-under-pressure);
        A10's "make models build a prompt-guarantee, else it's echo" settling test (epistemically backwards —
        echoing well-evidenced literature is what correct answers look like). **UNCHANGED:** four terminal
        states; reason-code placement (A7+A8 strengthen it); residual semantics; sync-first; fan-out mechanism.
        **1b-critical sentence (record against client-facing discipline):** the accounting guarantees DELIVERY,
        never UNDERSTANDING — and must never be described, internally or to the client, as guaranteeing
        understanding (A10's surviving caution; convergence validates the engineering pattern, not the fit of
        accounting-thinking to qualitative synthesis — which is why the aggregate answer is "audit PLUS human
        judgment," the product's own posture). V-2 stage now COMPLETE: cold-derivation convergence (A) +
        adversarial review absorbed (B).
    - *V-3 — empirical falsifiers (defined now, owners; run when V-1 skeleton + real model exist).* F1
      silent-drop-impossibility (≥50 u9 runs; pass = ledger totality every run, i.e. drops manifest as
      (iii)/(iv), never unaccounted). **F2 (UPGRADED per A1):** instrument cache_read / cache_write / miss tokens
      under a REAL CONCURRENT burst (not sequential — cold-start fan-out can all pay cache writes); report the
      measured hit rate AND the worst-case 0%-hit arithmetic alongside the actual; pass = the cost case survives
      at the MEASURED hit rate and the team knows the break-even hit rate. (Impl note: pre-warm the cache with a
      `max_tokens:0` request before each fan-out burst; consider 1h TTL for spaced runs.) F3 eval-loop latency
      (wall-clock a full per-voice pass under sync fan-out; pass = interactive, target single minutes).
    - *V-4 — human review (opportunistic).* 4a: ~1h with a distributed-systems/data engineer on pattern
      hygiene (idempotent keyed writes, terminal-state ledger, retry semantics) — uncorrelated priors,
      highest signal/hour. 4b: Mitchell on the 1a readability question, once drafted text exists — the one
      qualified validator for "does A's four states + C's invariants read as coherent derivation."
    - *Excluded:* custom/fine-tuned "never-drop" model — unsolved research problem, and forbidden by the
      package's own principle (never trust model behavior as the guarantee).
    - *TRACEABILITY PASS — the defined final step of spec consolidation; PREREQUISITE of spec freeze (owner-chat runs).*
      Prompted by A3/A6 (both were survey knowledge lost survey→package→spec). Before the V-1 spec can freeze,
      the owner-chat walks it **bidirectionally**: (forward) every item on the survey's "failure modes,
      consolidated" list is either covered by a V-1 behavior/property or consciously excluded with reason — no
      dropped load; (reverse) every V-1 property traces back to a survey failure mode or an explicitly-recorded
      design decision — no invented/orphan load. "Spec freeze" = "audited complete in both directions." The pass
      is an audit that PRODUCES findings — expect it to surface ≥1 more A3-shaped gap (new gaps → PROPOSED via
      governance); "found nothing" is the surprising outcome, not the default. Runs AFTER the Packet-B
      dispositions above are recorded (so it audits the complete proposed spec), BEFORE freeze.
      - *TRACEABILITY PASS — COMPLETE & RECONCILED (two independent walks, owner-chat + Fable, diffed by Doug;
        Fable confirmed the reconciliation, one mechanism corrected. All PROPOSED via governance; not in canon.)*
        Both walked the 11 survey failure modes + reverse trace. **Agreement on 8+ rows** (same dispositions,
        reasons, gates). **RECONCILED GAP SET = THREE** (was two before the diff):
        (1) **P9 TERMINATION** (disclosed via Doug's note, NOT independent in either walk) — P1 totality is
        evaluated at run END, so an unbounded retry loop never *fails* P1, it never *reaches* end; a poison voice
        (always c/d/h) loops unnoticed. Property: every voice reaches a terminal state within bounded attempts
        (caps at both layers: model-layer unusable-retries, infra-layer failure-backoff); run provably ends;
        exhaustion → reason-code `retries-exhausted` on unusable/failed, surfaced, never silent. + mock behavior
        **l** (perpetual poison).
        (2) **RUN-SCOPING / concurrent-run isolation** (INDEPENDENT — Fable's FM7 walk; owner-chat MISSED it).
        P5 covers *within-run* retry; but two overlapping runs of one engagement produce DIFFERENT stochastic
        findings for the same voice, and voice-id-only-keyed writes interleave two accountings into one corrupted
        ledger. Fix: key = **run_id + voice_id**, one writer per run, P1/P5/P6/P8 asserted per-run (or a
        single-active-run-per-engagement lock; impl-level choice). **Mechanism corrected by Fable:** the seam did
        NOT come from Gemini (its attack 3 was crash-only) — it was in Fable's own Packet-B target list T1,
        *never attacked*, and Fable's disposition had no row for un-attacked targets, so it fell out unanswered
        (not transcribed away). → generalized lesson recorded (Working conventions).
        (3) **G-1 → GAP-CLOSED-BY-PROPERTY** (INDEPENDENT — owner-chat; Fable agrees, label sharpened: pre-diff
        P2 genuinely did NOT cover the non-empty case, so record it as a real gap now closed, not "needs a test").
        One property, two enforceable halves: (a) ROUTING — answered-with-findings and answered-empty reachable
        only on NATURAL finish; any non-natural finish → unusable regardless of body parseability (generalizes
        strengthened-P2 past the empty case); (b) PERSISTENCE — findings persisted IFF the call's terminal state
        is answered-with-findings (partial findings from truncated responses never become authoritative — closes
        a leak P5 doesn't cover).
        **Reverse-trace correction (owner-chat missed; Fable caught; confirmed):** behavior **g**
        (cross-contamination) has NO survey source — invented in Fable's V-1 drafting as the per-voice analogue
        of the batch drop; justified invented load, now **provenance-stamped as a spec-drafting decision** (owner-
        chat's "no orphans" was wrong — exactly the invented load the reverse walk exists to catch).
        **Method note (record — evidence the two-walk method is load-bearing, not ceremonial):** Fable's walk
        caught two things owner-chat missed (run-scoping; the behavior-g orphan); owner-chat raised G-1. A single
        walk would have shipped without run-scoping. Pass now COMPLETE; the three properties fold into the V-1
        spec (above) on Doug's freeze go.
    - *GATE:* package → decidable when V-1 green (**DONE ✓ — with the fake-empty-drop prerequisite**) + V-2 captured/reconciled
      (DONE ✓) + V-3 defined-with-owners (DONE) +
      **the traceability pass complete (DONE — three gaps reconciled)**. Spec is freezable/relayable to Claude Code only after the pass. Doug
      then decides with evidence. Nothing before that gate lands in canon.
    - *BUILD-PHASE GOVERNANCE (in effect before the V-1 relay goes out — the guardrail for the phase we're
      entering).* (1) **Epistemic rule.** V-1 is CODE-validated, not opinion-validated: seeded property tests +
      fast-check counterexamples have no training bias, so the two-Claude-correlation concern that dominated the
      *design* phase relaxes for a CLEAN GREEN run — two Claudes may settle that. But model-family correlation can
      creep back at the *interpretation of ambiguous results*: **any asterisk — a flaky property, a shrunk
      counterexample debatably "mock-infidelity," a property someone wants to relax — routes to DOUG; two Claudes
      must NOT agree it's benign.** That is the exact spot the whole validation architecture exists to protect.
      (2) **Properties are the acceptance contract; no weakening-to-pass.** A failing property is either a code
      bug (fix the code) or a genuine spec error (→ back through governance to Doug) — NEVER edited/relaxed in
      test code to go green. (3) **Green is inspectable, not asserted.** A green run reports what was tested, the
      seeds, and any shrunk counterexamples-turned-fixtures — the "don't trust a 200" discipline applied to our
      own test run. (4) **F1–F3 raw to both chats**, not summarized; F2 reports THREE numbers — measured hit
      rate, break-even hit rate, worst-case 0%-hit arithmetic — so pass/fail is legible, not a verdict.
    - *V-1 RESULT — BUILT, CLEAN GREEN (eval-scaffolding; NOT mechanism adoption; production seam/engine/server
      untouched; u9 open). All PROPOSED.* P1–P9 + G-1 + A9 + A7 green across ~7,000 seeded runs (pinned,
      reproducible); crash acceptance (SIGKILL @ 50% → restart → totality restored, 0 re-execution) ran 3×,
      non-flaky; no shrunk counterexamples (clean). Choices reported: run-scoping = composite `(run_id, voice_id)`
      + one-writer-per-run (not the lock); behavior g stamped in code as spec-drafting invention; ledger =
      `node:sqlite` (eval-tier needs Node ≥22.5; server/engine still ≥20). No asterisks; PROPOSED_BEHAVIORS
      empty (no new behavior found). **FAKE-EMPTY DROP — HIGHEST-SIGNAL FINDING — a first-class MECHANISM-ADOPTION PREREQUISITE
      (do not lose):** the production `AnthropicLlmProvider` **discards `stop_reason`** (collapses refusal →
      `{text:''}`, returns only `{text}`). So G-1 / finish-reason gating is **unenforceable on the REAL path**
      until the lens↔model seam surfaces `stop_reason` (+ HTTP status): a truncated/filtered empty arrives as
      `{text:''}`, indistinguishable from chosen-empty → recorded answered-empty → P7 never-retry → **permanent
      silent drop** = exactly the A6 failure, on the real path. V-1 proved the accounting sound in simulation AND
      discovered the real seam can't yet supply the inputs it depends on — found in scaffolding at zero
      production risk. IF the mechanism is adopted, surfacing `stop_reason`/status is the FIRST required change.
      **Fake-empty drop NARROWED by F1-b real run (`claude-opus-4-8`, 2 real calls, `max_tokens` 16 then 8; disposition-total
      harness — flagged non-divergence, did not dress up):** attempting to reproduce the silent drop via
      `max_tokens` truncation FAILED to fire it (2/2 YES/YES — both paths correctly routed to
      delivered-but-unusable). Why: `max_tokens` truncation yields a **partial, UNPARSEABLE** body
      (`{"findings":[{"…`), which the production seam's existing **parse-exception guard already catches** →
      retryable, correct. Lowering `max_tokens` gives *more*-broken JSON, not clean-empty, so the drop is NOT
      reproducible this way (mechanism-explained, not luck). → **the fake-empty drop is smaller and more precise than first
      stated:** the `max_tokens` variant is **self-mitigating** (parse guard catches it); the residual risk is
      the **`refusal` variant** (corrected from "content_filter" — Anthropic has NO `content_filter` stop_reason;
      set = end_turn / max_tokens / stop_sequence / tool_use / pause_turn / **refusal**). The production seam has
      an actual line `stop_reason === 'refusal' → { text: '' }` that collapses a refusal to a **clean, parseable
      empty** with no signal — nothing for the parse guard to catch (unlike truncation's broken JSON) → reads as
      chosen-empty → P7 never-retry → silent drop. So the residual fake-empty drop is **reproducible against a named production
      line**, not hypothetical — *sharper* than the original framing (Claude Code caught the error and routed it
      up rather than silently editing). **The prerequisite STANDS** (seam still discards `stop_reason`; surfacing
      it is what guards the refusal variant) — generalize the trigger as "**refusal / any non-natural finish the
      seam empties to clean text**." Behavioral reproduction NOT pursued
      (Doug's call — option 1): conclusion unchanged (fix stays on the list), no adoption
      happening now. This is the falsifier working: it falsified the easy fake-empty drop and sharpened the claim.
      **Decision-frame (Fable): the fake-empty-drop seam fix is owed under ANY mechanism, so it does NOT tip the mechanism
      choice** — it's a build prerequisite either way. Under batching it's strictly WORSE: a single refusal
      collapses an ENTIRE multi-voice call to clean empty (all those voices silently dropped), vs. one voice
      under fan-out. So the fix gates the build regardless of per-voice-vs-batch; it's owed, not a factor in the
      decision.
      **A9 exception-mapping — reasonable V-1 default, recorded as an OPEN sub-decision (Doug), not silently
      locked:** Claude Code mapped StreamError(payload-decode)→delivered-but-unusable (⇒ model-layer retry) and
      TransportError/TeardownError/unexpected→failed (⇒ infra backoff). Underdetermined by the spec and has
      retry-semantics consequences (a decode error that's really transport corruption should backoff, not
      re-ask) → accept as V-1 default, revisit at mechanism adoption. **Meta (four layers, four catches — the
      closing evidence the layered validation was load-bearing, not over-process):** survey caught the
      phenomenon; adversarial review caught durability + truncation (survey knowledge lost in transmission);
      the traceability pass caught termination + run-scoping (spec gaps); the BUILD caught the production seam
      discarding `stop_reason` (an implementation-reality gap no analysis layer could see). Each catch was
      invisible to the layer above it.
      - *F2 cost — PASS (pricing-corrected; raw, real `claude-opus-4-8`, 25-concurrent burst + prewarm).*
        Raw: `cache_read`=`cache_creation`=0 (the ~250-token shared prefix is below Anthropic's ~1024 cache
        minimum — caching didn't engage; harness reported zeros honestly, did NOT pad the prefix to fake a hit
        rate). input 11,932 / output 5,850 over 25 = ~477 in : ~234 out per call. **CORRECTION (Fable caught;
        owner-chat concedes):** the earlier "2:1 input-heavy → output doesn't dominate" read compared *tokens*;
        the question is *cost*, and Anthropic prices output ≈5× input. Repriced: 477 + 5×234 = **1,647
        input-equivalents/call, output = 71% of COST → cost-dominance HOLDS.** My token-based alarm was the error;
        the original premise was fine. **F2 pass criterion AMENDED: cost-dominance, not token-dominance** (so
        future measurements don't re-trip on wording). Consequence: the cacheable/batchable prefix is ≈**15.2% of
        per-call cost** — so the `prefix>1024`/caching question guards a **≤15% cost band, NOT the decision**;
        break-even 21.7%, verify OPPORTUNISTICALLY when the real per-voice prompt exists (not a gate; don't chase
        a padded number). **Option-2 consequence (re-buries batching on cost):** batching's entire savings ceiling
        IS that ~15% band (~13.7% at k=10), and caching captures ~12–13% of it WITHOUT reconciliation machinery —
        so the last cost argument that could favor Option 2 is quantified as too small to matter.
      - *F3 latency — PASS (raw).* 25 voices: sequential 113.8s, **concurrent (≤8) 18.2s** — comfortably
        interactive (single-minutes target met), ~6× speedup; sync fan-out keeps the build→look→tune loop fast.
        Bonus real-path corroboration: all 25 → answered-with-findings, 0 empty/unusable/failed, 52 findings
        attributed, **0 quarantined** (totality held, provenance clean, no cross-contamination) — a live sighting
        of the ledger behaving, not a substitute for the F1-a totality run (still un-run; ~300 calls).
      - *MEASUREMENT PHASE COMPLETE → ADOPTED.* Gate items: V-1 green ✓ (with the fake-empty drop, narrowed to the refusal variant),
        V-2 ✓, V-3 falsifiers all run — F1-b ✓ narrowed the fake-empty drop; F2 ✓ PASS pricing-corrected; F3 ✓;
        **F1-a ✓ RUN before adoption (Doug's call): real-model totality 50/50 reps, 0 unaccounted, u9
        answered-with-findings all 50** (the "validated in simulation" caveat upgraded to validated on the real
        model; note all 300 calls landed answered-with-findings, so unusable/failed routing stays
        simulation-validated). The package was DECIDABLE, and **Doug adopted it 2026-07-12** — design written into
        `build_approach` + `build_implementation`; TOP-PRIORITY entry above flipped to ADOPTED; seam-fix is the
        committed first task; O-1..O-4 + Mitchell carried open.
      - *BUILD — fake-empty-drop seam fix LANDED 2026-07-12 (the committed first task).* Seam now
        `complete(...) → {text, stopReason?, httpStatus?}`; `AnthropicLlmProvider` passes `stop_reason` through and
        the `refusal → {text:''}` collapse is REMOVED (the deliberate reversal); `routeLlmResponse()` does the G-1
        routing (natural = `end_turn`, + `stop_sequence` only under an explicit `allowStopSequence` opt-in;
        `refusal`→unusable/refused; `max_tokens`/`pause_turn`/`tool_use`→unusable/malformed; absent→proceed
        degraded); all 7 lens call sites gate on natural-finish before parsing. Regression pin in place: a refusal
        with an empty body routes unusable, **never answered-empty**. Backend 162 / frontend 19 green. **tool_use →
        unusable RATIFIED (Doug):** the earlier vocabulary NOTE (which had listed tool_use natural) is SUPERSEDED;
        the doc stands (a findings lens stopping for a tool went off-script). u9 defect-half now closer to closed
        (fully closes when the fix ships). CARRY-FORWARD to the orchestrator task: the V-1 validator's own
        `FinishReason` type is still non-Anthropic-native (`'stop'/'length'/'content_filter'`) — align it, and fold
        the eval bridge's usage-capture onto the production seam, when the orchestrator lands. Next build tasks:
        fan-out orchestrator + (run_id, voice_id) ledger + P1–P9 + cross-voice audit.
- Learning loop mechanism (S5-2): human-authored prompt edits; prompts as
  versioned, engagement-aware artifacts. Auto-vs-manual unresolved.
- Scope of a learned edit: engagement-scoped vs graduates to baseline
  ("starts smarter than the last"). Unresolved.
- De-identification detector sophistication (gate position fixed).
- Voice-calibration mechanism (single-source constraint noted above).
- **Human Meaning — interpretive-depth calibration (eval-rubric work w/ Maria [voice-fidelity]
  + Mitchell [rubric]; NOT a code matter).** First real-model run (18-unit eval) confirmed the
  mechanics (single-unit anchors, translation, silence, per-voice multi-noticing) but surfaced
  the live frontier — *how much* Meaning should read into *thin* material:
  - *Depth on thin utterances.* From near-empty voices ("things are fine, I guess"; "No
    comment.") Meaning reached fairly loaded, hedged readings (e.g. "a lack of safety to
    speak"). Doing its job + double-hedged + anchored — but the amount of inference-from-little
    is the judgment to calibrate.
  - *Doug's call — DECIDED + LANDED in code (this session):* certain answers ("n/a," "idk,"
    "no comment," and the like) are **answers whose potential meaning and importance are best
    understood contextually — worth exploring as such**, not empty and not to be assigned a known
    meaning (not even "expresses uncertainty" — that itself assumes a meaning). CHANGE (now): a
    Human Meaning prompt rule — where a response's meaning can't be grounded in the words
    themselves, Meaning names it as an answer worth exploring contextually and stops, without
    characterizing it or classifying token type. Prompt-only; no new capability; shape unchanged
    (normal noticing, per-voice, single-unit, held). The actual exploration, if feasible, is
    deferred to **ensuing lenses** (may or may not be the deferred questions-worth-asking
    capability — separate open thread). Trigger = the epistemic condition (meaning not readable
    from the unit alone), not a token list. See build_approach §2. LANDED: prompt rule added to
    `human-meaning-lens.ts` + two shape-pinning tests (a flag noticing yields the ordinary held
    single-unit shape; a readable answer is still interpreted); backend 120 green. **Testability
    boundary:** the flag-vs-interpret decision is *model judgment* driven by the prompt — fake
    tests pin only the shape, not the judgment — so behavioral correctness (does the model
    actually flag "n/a" vs. read it?) is confirmable only by a real-model `npm run eval -- meaning`
    (paid; not yet run). No separate Meaning eval fixture — the runner reuses the shared sample
    where u17 already flows through.
  - *Frame-vocabulary flattening (watch).* "recognition / psychological safety / burnout" recur;
    often faithful, but thin voices pulled toward a small set of house frames risks collapsing
    distinct voices. Name in the rubric to watch over time.
  - *The eight outputs — RESOLVED by eval: keep prescriptive/closed; coverage confirmed.*
    build_approach §2 lists eight interpretive outputs (unmet needs, fears, hopes, identity,
    belonging, trust, dignity, pain/aspiration) — prompt *scope* realized by model judgment, not
    typed fields. The Human Meaning prompt states them as a **prescriptive/closed enumeration**
    ("notice what it may reveal about:" + closed bulleted list; only "may reveal" as epistemic
    softening). The open worry was that a closed menu drives false-positives (a model handed a fixed
    list feels it must pick). RESOLVED by the real-model eval (u0–u24): the restraint controls all
    held — u20 (bus/hours) → "not carried by the words… better understood in context" (NO
    manufactured category); u21 (coffee machine) → "low-stakes satisfaction" (no invented concern);
    u4 (hedged) → flagged-for-exploration, not "lack of safety" (vs. the *first* eval, where the
    equivalent thin voice read "not feeling safe"); u10/u17 (No comment / n/a) → clean flag phrasing.
    So the closed list did NOT drive over-reach → **keep prescriptive/closed; illustrative not
    warranted on this data.** COVERAGE confirmed: all eight surfaced on their clean singles (hope
    u18, aspiration u19, identity u22, belonging u23, dignity u24, etc.); u6 held both halves in one
    finding (within-voice binding intact). WATCH (not acted on): "unmet need" / "dignity" recur
    across findings — the frame-flattening item above, rubric-radar. Entanglement caveat still
    stands: identity/belonging/dignity intertwine in real data, so discrete per-category attribution
    may itself be the wrong frame for the eventual rubric.
  - *u9 silent-drop — DIAGNOSED: stochastic model-side batch-completeness (fix under decision).*
    u9 ("After I disclosed a health condition…") intermittently omitted — dropped, dropped, surfaced
    across three runs, same priors each time. Trace (Claude Code): Listening is clean (all 25 units
    surface; `eval-u9 → listening:9`, so u9 reliably reaches Human Meaning); the drop is **model-side
    (case 1)** — in the batched Human Meaning call the model returned candidates for a subset,
    `listening:9` simply absent from the `sourceFindingId` sequence (no candidate for u9 at all). NOT
    mechanical (when the candidate exists, parse/anchor/`sourceFindingId` all work) and NOT
    flag-over-fire (when emitted, u9 is a real grounded dignity/trust reading, never flagged). ROOT:
    interpreting many voices in one batched call — the model occasionally skips one. → **GENERAL
    risk, not u9-specific:** any batched lens has it, incl. **Listening** (clean this run, same latent
    skip; a Listening skip = silent invisibility everywhere). Fix space = completeness (not parse/
    anchor, not the flag/prompt rules). Recommendation under discussion: **per-voice calls**
    (structural — no batch to skip) **+ a completeness guard** (every input voice → ≥1 finding, else
    a flagged defect — visible, not silent). Fix relay pending Doug's direction.
  - *"n/a" boundary — RESOLVED (surface).* Any authored token, however brief (n/a, idk, no comment, a
    bare ".") surfaces — the bar is "did the person author an utterance?", drop = non-authored
    structural emptiness only (build_approach L573 rewritten to this general framing; auto-fill is
    irrelevant under the Inclusity data contract — every unit is a real human voice — an ingestion
    concern if ever). **LANDED (in code): Listening surfaces authored tokens.** Drop
    point confirmed *prompt-side* — the lens code only drops empty/whitespace (kept "n/a"); the
    model dropped it solely because the system prompt named "a pure form-artifact" contentless
    (the de-id gate never runs in the eval). Fix is the Listening system prompt: binary bar "did
    the person author an utterance?", no token-type classification. Tests updated (structural-
    emptiness drops; authored tokens surface, verbatim intact); u17 now surfaces (real-model
    confirmed); backend 118 green. **Interim gap — prompt rule landed; behavioral confirmation
    pending:** the loaded readings Meaning gave these surfaced answers are addressed by the Human
    Meaning prompt rule (above, landed in code). Whether the model actually complies is model
    judgment, confirmable only via a real-model `npm run eval -- meaning` (not yet run). Until
    confirmed, any residual loaded readings remain held-by-default / internal, an eval/review
    matter, not client-facing.
- When structural eval gets automated (depends on pipeline existing).
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
  - **In the current test-adding increment (Option B):** Batch 1 (absence-through-
    projection; Listening anchoring-drop; units-exist-none-cleared boundary) + Guardrail-
    append + support-text singular + the two write-path HTTP route tests (item 4).
    **DONE (June 2026): +20 tests, 91→111 green (repo-wide: backend 75→92, frontend
    16→19), no production change, no test failed
    against production** (every guarded behavior matched production). Item 8 is now the
    *last* structural uncovered arm — `assemble.ts:54` (projecting a finding that
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

## Quality levers (cross-voice attention) — considered and shelved
A **shelf**, not a to-do list — reach for these the day cross-voice *results* need improving; they are
deliberately NOT mixed into the O-1..O-4 open items (which stay a live to-do list). Recorded from a Fable relay.

**BOUNDARY (read first, so these are never misread as completeness changes).** Every lever below raises the
*probability* each finding is weighed; **none makes it provable.** They do NOT change the adopted completeness
guarantee: delivery is already guaranteed (fan-out / audit); consideration stays **audited-not-guaranteed**
under every variant; the cited-or-residual audit is unchanged; and the **residual review by a person remains the
completing step**. Attention operates inside the forward pass, where no instrument reaches — the design's final
layer for the cross-voice case is, and stays, a human.

**PROVENANCE (why these and not others).** Doug probed a sequence of alternatives for the cross-voice case —
agent loop → accumulate-then-process → shared pre-populated memory — each declined as dominated (prior relays);
the walk converged on the underlying truth: **the cross-voice gap is ATTENTION, not delivery**, and attention
has no external control surface (no storage/delivery mechanism reaches it). Four levers *influence* it: reduce
what competes (fewer items co-present), obligate speech (generation forces attention), sample lapses away
(stochastic misses don't repeat), serial room (extended thinking — already on). The items below are the
actionable residue. (No prior two-pass entry existed in this doc to merge — Q-1 enters fresh.)

- **Q-1 — TWO-PASS AGGREGATION (obligated noting before synthesis).** A model can *read* a finding without
  registering it, but can't *write* about one without registering it. Pass 1: the model jots a brief note on
  every finding — run through the same per-item fan-out machinery the per-voice lenses use, so code confirms a
  note exists for each finding and nothing skips. Pass 2: one synthesis call carrying the full finding set PLUS
  the notes. Effect: every finding provably passed through full model attention at least once before
  pattern-finding. Cost: one extra noting call per chunk. *Status: candidate, undecided.*
- **Q-2 — K-RUN SHUFFLED SYNTHESIS with union-cited residual.** The model's misses are random — the same task
  run twice overlooks *different* items. Run the synthesis k times (e.g. 3), shuffling finding order each run
  (shuffling matters: mid-list items are the usual victims; shuffling buries different ones each time); code
  takes the **union** of cited IDs across runs — a finding lands in the residual only if EVERY run left it
  uncited. Independent-ish misses multiply down (~10%/run → ~0.1% jointly), so the reviewer's leftover pile gets
  smaller and purer ("nothing found a home for this," not "one run happened to skip it" — a stronger outlier
  signal). Cost: ~k× the synthesis step. **Caveat:** union-of-citations inherits the hollow-citation leak k
  times over, so the semantic spot-checks stay load-bearing. *Status: candidate, undecided.* (Provenance: the
  ensembling result from the batch-prompting literature, transplanted to the aggregate case — new to our record.)
- **Q-3 — EMPIRICAL QUESTION: the chunk-size floor.** Fewer findings per look = more attention per finding, but
  pattern-finding needs findings side by side — a model that only ever sees ten at a time may never spot a theme
  living across forty. Somewhere between "all at once" and "ten at a time," comparison goes blind. The floor
  can't be derived; it must be **measured** (same finding set, several group sizes, judge where pattern quality
  collapses). Relevant to any future chunked aggregation AND to choosing co-presence size for Q-1/Q-2. *Status:
  open empirical question; no eval designed yet.*

**COMPOSABILITY.** Q-1 and Q-2 stack (noted-then-sampled synthesis), and both compose with the existing
cited-or-residual audit unchanged — they shrink and purify what reaches the reviewer; they do not replace it.

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
   deliverable), processing → **Lens wave** (6 ordered waves inside the lens-
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
9. **Human Meaning — real-model review run (DONE; reviewed).** Ran `npm run eval -- meaning` on
   the u0–u24 fixture (24 findings). OUTCOME: coverage confirmed (all eight surfaced on their clean
   singles); restraint controls all held (u20/u21 clean, u4 flagged not over-read, u10/u17 clean
   flags) → **prescriptive/closed kept** (see calibration note above); within-voice binding intact
   (u6). ONE MISS caught: **u9 (health disclosure) silent-dropped** — a false-negative, now OPEN
   under diagnosis (calibration note + relay out). First application of the standing lens-validation
   method (Working conventions) — worked as intended: fakes were green, the real run surfaced a real
   behavioral miss the tests could not.

## Environment
VSCode on Windows. (Pandoc + MiKTeX / LuaLaTeX / EB Garamond is the *proposal's*
build pipeline; `build_approach.md` may get its own output setup later if needed.)