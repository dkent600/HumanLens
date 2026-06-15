> Edited only in the chat where this file is the working copy. All other chats: read-only reference.

# Build Implementation (SMI Internal)

*Design-of-implementation for Human Lens — how the architecture in `build_approach.md` gets built: the stack, the component choices, code-level structure, lens orchestration, and the test approach. This is **not** the source code; the code will live in a repository. This document is the bridge between the architecture and that repository. Where this document and `build_approach.md` ever disagree, the architecture document wins.*

*Owned by the build chat — same lane as `build_approach.md` and `build_context.md`. Reference-only elsewhere.*

---

## Fundamental components (the stack)

An inventory of the parts the Module 1 architecture requires, grouped by layer. Each entry names what the part does and why the architecture needs it. Specific product and version choices are recorded here as they are settled; entries marked **TBD** are still under discussion. (Terminology: the whole project is the *case study*; its first built version is **V1**, "The Trustworthy Engine.")

### Two stacks at a glance (frontend / backend)

A quick view of the decided stack along a second axis — *where the code runs* — complementing the concern-based grouping (A–D) below. The two stacks have separate build pipelines: **Vite** for the browser app, **`tsc`** for the server.

**Frontend — the webapp (browser):**
- Framework: **Aurelia 2** (TypeScript)
- Styling & components: **TailwindCSS** + **Aurelia Headless UI** (DaisyUI fallback)
- HTTP client: **Axios**
- Build & test: **Vite** (7.x) + **Vitest**

**Backend — server-side (Node.js):**
- Runtime: **Node.js** + **TypeScript**
- HTTP/service layer (the front door that serves the webapp): **Fastify** + `@fastify/swagger(-ui)`, **Awilix** DI
- AI core / pipeline engine (the domain logic — see Section A): LLM provider SDK, lens orchestration, prompt / version management, **de-id detector** *(detector choice parked pending the Inclusity conversation)*
- Persistence: **repository seam**, in-memory implementation
- Supporting libraries: **export library** — `docx` (brief model → .docx); PDF out of scope for the case study
- Build & test: **`tsc` → ES modules** + **Vitest**

Both the de-id detector and the export library are backend (server-side), but they play different roles: the detector belongs to the AI-core engine (the hard gate before the lenses), while export is a supporting service invoked to produce the output document. Axios sits on the frontend; server-side outbound calls go through the provider SDK behind the provider seam. This axis answers *where code runs*; it does not flatten the backend — the engine, the service layer, and persistence remain distinct within it.

### A. The AI core — the genuinely new, highest-risk part

- **LLM provider + model.** The model behind every lens call — the engine the lenses run on. This is *whose* model: the API vendor (Anthropic, OpenAI, Google, and the like) whose service the lenses send instructions to. *Choice: TBD. Constraint: kept behind a thin, swappable seam, mirroring the auth-seam philosophy, so the provider can change without touching call sites. Caveat: the integration is swappable cheaply (rewrite one adapter), but lens wording and the seeded eval set (the known-hard regression battery — sensitive, bilingual, contradictory — defined in `build_approach.md`'s evaluation section) get tuned to whichever model is actually used, so switching providers means re-validating the lenses against that set — the plumbing is loosely coupled, the behavioral calibration less so.*
- **Lens orchestration.** Runs the seven lens prompts as the staged five-layer pipeline, passing findings between stages and running independent lenses in parallel. The architecture's core control structure. *Choice: TBD.*
- **Prompt / version management.** The lenses are separate, individually versioned artifacts. Per-lens revision, the learning loop, and regression safety all depend on this. *Choice: TBD.*
- **De-identification scanner.** The gate's detector: scans candidate units for residual identifiers and drives `deid_status`. The de-id gate is a hard gate on the pipeline. *Choice: TBD. Architecture says simple first — scan + human-confirmed checkpoint.*

### B. The application shell — standard web-app machinery

- **Language / runtime.** *Decided: **TypeScript**, full-stack.* Chosen on builder fluency and operating model (the deciding factor for a two-person team), not ecosystem hype. Human Lens calls hosted models via the provider seam and does no training, retrieval-pipeline, or custom-ML work, so Python's ML-ecosystem advantage does not apply here. **Deliberately still open:** the **de-identification detector** is the one remaining choice — TBD, parked pending the Inclusity conversation. (Frontend stack and export library now decided; see below.)
- **HTTP/service layer.** The front door that exposes the already-built pipeline as a web-accessible service — receives requests, returns responses, serves the UI, resolves the actor once per request — then calls into the engine. The lens and orchestration logic is **not** here; it lives in the AI core (Section A). This is a thin wrapper around that core: the engine is plain TypeScript exercised directly from tests or a small harness with no server running, so the service layer is chosen late and swapped freely without touching lens code. V1 requires a web-based UI with no local install. *Decided:* **Node.js** runtime; **Fastify** as the API framework, with **`@fastify/swagger` + `@fastify/swagger-ui`** generating the OpenAPI documentation from the route schemas (one source of truth for both validation and docs); **Awilix** for dependency injection — explicit registration, **no decorators or `reflect-metadata`** (keeps the build off the legacy-decorator track entirely), actively maintained, with per-request scoping that suits Fastify; **Vitest** for tests (the same runner as the frontend); and **`tsc` emitting ES modules** as the build (no bundler needed server-side — `"type": "module"` + `NodeNext` resolution + `.js` import specifiers). **Axios** is available as an HTTP client, but server-side outbound calls are mostly the LLM provider, made through the provider's SDK behind the provider seam, so Axios may see little use here. The **Awilix composition root** is the natural home for wiring the seams — repository, identity/authorization, LLM provider — to their concrete implementations. *(TSyringe was considered and rejected: low-maintenance, and it pins the project to legacy `experimentalDecorators` + `emitDecoratorMetadata`.)*
- **Frontend / UI.** The input screen and the review/output screen — editable sections, rating buttons, layer selection, export. Human review is a first-class pipeline stage, not an afterthought. *Decided: **Aurelia 2** (TypeScript) as the framework; **TailwindCSS** for styling with **Aurelia Headless UI** (`@aurelia-ui-toolkits/headless` + its Tailwind companion) for accessible, composable primitives; **Axios** as the HTTP client to the backend. Fallback kept in mind: **DaisyUI** (CSS-only Tailwind plugin, framework-agnostic, mature) if Aurelia Headless UI proves too young.* Headless / light-DOM is the deliberate choice — primitives are styled by Tailwind directly, with no Shadow DOM. (Fluent UI Web Components was dropped precisely for its Shadow-DOM styling friction.) Watch items: Aurelia Headless UI is brand new (1.0.0, small community) — treat it as upside, lean on it where it earns its place rather than depending on it for the whole UI, with DaisyUI as the proven fallback; pin Vite 7.x (Vite 8 / Rolldown had an Aurelia plugin glitch in beta). The UI surface is modest (two screens), so a small set of primitives plus a few bespoke Aurelia custom elements suffices — no large component kit needed.

### C. The data layer

- **Persistence (a repository seam).** The pipeline depends on a repository *interface* — store and fetch units by engagement, persist findings and both output layers, record edits and ratings — not on any database. For this case study the implementation is **in-memory (Map-backed)**: no database, no hosting constraint, nothing to operate. The interface is shaped as if a real store backed it — **async signatures** and **engagement + actor scope carried on every operation** — so a concrete store can drop in later without touching call sites, exactly as the platform layer swaps in behind the auth seams. The in-memory store still **enforces the engagement + actor isolation invariant** (scoping is part of the trust story being demonstrated, not something the mock waves away). *Concrete database deferred — not decided. A durability spectrum sits behind the same interface if a live demo must survive a restart: pure in-memory → JSON-file snapshot → a single SQLite file, each a near-zero-ops step up.*
- **Identity & authorization seams (code).** The call-site abstractions whose signatures are settled in `build_approach.md`; policy is deferred to the platform layer. Present from V1, resolving trivially. *Signatures settled; implementation shape TBD.*

### D. The dev & ops layer

- **Build / test / source control / packages.** *Decided:* **Vite** (build tool/dev server, pin 7.x), **Vitest** (test runner, Vite-native), **GitHub** (source control), **Node.js + NPM** (runtime + package management). Plus the stub/mock discipline for the seams and the structural evaluation tier as regression guards — safe prompt revision rests on this. The Aurelia 2 + TS + Vite + Tailwind + Vitest combination is a supported stock scaffold preset.
- **Hosting / deployment.** Where the application runs. Must be low-maintenance for a roughly 17-person firm with no IT team. *Settled for now as a capability profile, not a product: a host that can run a **long-lived Node process** and serve **public web hosting** (inbound HTTPS), with **outbound HTTPS** to the model API and a place for **secrets**.* With PDF / LibreOffice out of scope, the earlier sidecar-binary and persistent-disk requirements fall away — this is now an ordinary Node-app profile that most container / small-VM / app-platform hosts satisfy. The capabilities and what each fulfills:
  - **Long-lived Node process** (not per-request serverless): runs the Fastify service layer and the pipeline engine, and **holds the in-memory repository's state across requests** — a FaaS that resets each invocation would wipe it. This is now the *only* hard constraint; it still rules out pure serverless / edge while allowing any always-on container, VM, or app service.
  - **Inbound public HTTPS (web hosting):** the web UI with no local install. One Fastify process serves both the built Aurelia assets (`@fastify/static`, same origin — no CORS) and the API on a single port. At the app layer this is just "listen on a port and serve static files"; the host adds public **ingress** and **TLS/HTTPS** (non-negotiable for confidential material) — both configuration, not code, on a typical platform.
  - **Outbound HTTPS (egress):** the engine's calls to the hosted LLM provider through the provider seam / SDK.
  - **Secure config / secrets:** the LLM provider API key and the per-client branding config via env vars / a secret store, never in code.
  - **Controlled, single-tenant environment:** confidential consulting material on a host SMI controls with access controls; favors one controlled instance over shared multitenant FaaS.
  - **Persistent disk — now optional:** needed *only* if a demo opts into the persistence durability spectrum (JSON snapshot / SQLite file) to survive a restart; pure in-memory needs no disk at all.

  *Specific product still deferred; this profile is the requirement set any product must satisfy.*
- **Document export.** Turns a finished brief (held as structured data inside the system) into a file the actor can hand off. Typically only the client-safe layer is exported for sharing; the internal candid layer stays with the team. A V1 output requirement. *Decided:* an **export seam**; its case-study implementation renders the assembled brief model → **.docx**, generated programmatically with the **`docx`** library (dolanmiu — TypeScript-first, zero runtime dependencies, runs in Node/browser/serverless, MIT). Programmatic generation fits the brief's *variable* structure (findings vary in count, sections per domain, the two-layer projection) better than a fixed placeholder template. Branding is **per-client**, applied as a branding config (logo, palette, fonts, header/footer, cover) at generation time — the structure stays uniform, only the brand parameters vary; the adapter reserves that parameter from the start even if the case study ships a single default theme. **PDF is out of scope for the case study** — the seam keeps a docx→PDF stage addable later if the product ever needs it (the faithful path would be headless LibreOffice, dropped here because it pulled a heavy containerized host dependency the case study doesn't need). docx is pure Node and adds no host requirements. Low-stakes and late: export reads the already-assembled brief at the very end, behind the seam, and touches nothing else in the pipeline. (docxtemplater — branded template-fill — was considered and rejected: the variable structure and per-client branding both favor code generation over hand-maintained template files, and its advanced features are paid modules. The seam leaves that route open if Inclusity ever wants client-supplied templates.)

### Proposed topology (illustrative — product-agnostic by design)

This shows how the inventoried components fit together: what runs where, and what travels along each connection. The diagram is kept **product-agnostic by design** — the boxes name *roles* (the host, the HTTP/service layer), not products. The stack behind them is now largely settled (see above); only the hosting product and the de-id detector remain open. Persistence is deliberately *not* a database here but a **repository seam with an in-memory implementation**, with a concrete store deferred. The *architecture-level* facts the diagram depicts are already locked in `build_approach.md` and will not change with the stack: de-identification happens before entry so identified participant material never crosses into the application; the identity and authorization seams are split — identity resolved at the web layer once per request, authorization enforced by the engine at each operation boundary, so the engine is self-protecting; the platform layer swaps real policy in behind both seams without touching call sites; and there is no path from de-identified content back to a participant.

Each line is one fixed combination of payloads (colored by combination, described in the legend); the two senses of "who" — the **actor** (operating staff member) and the **participants** (the de-identified people in the material) — are called out in the note, since de-identification protects the participants, not the actor.

```mermaid
---
title: "Proposed topology — identity resolved at the web layer; authorization enforced by the engine"
---
flowchart TB
    subgraph OUT["Outside the application — the consultant's own environment"]
        SRC["Source material<br/>transcripts · survey comments · notes<br/>(names real participants)"]
        DEIDH["Consultant de-identifies participants by hand<br/>(before anything is entered)"]
    end

    subgraph BROWSER["Frontend (the browser) — used only by Inclusity staff (actors); clients and participants never log in"]
        UI["Web UI<br/>input screen · review screen<br/>(editable sections, rating buttons,<br/>layer selection, export)"]
    end

    subgraph HOST["Application server — the host; runs ALL the backend (server-side) code below"]
        WEB["HTTP/service layer<br/>front door: receives requests, returns responses,<br/>serves the UI, resolves the actor once per request"]
        IDENTITY["Identity seam<br/>resolves the actor (operating staff member) from the request<br/>used by the web layer; trivial in V1 (assumed actor)"]
        ENGINE["Pipeline engine<br/>• lens orchestration (plain explicit code)<br/>• lenses (versioned prompt files)<br/>• de-identification scanner (the gate)<br/>• assemble (two-layer projection + voice)<br/>self-protecting: checks authz at each operation boundary"]
        AUTHZ["Authorization seam<br/>may this actor take this action in this engagement?<br/>called by the engine; trivial in V1 (always allows; deny is first-class)"]
        DAL["Repository seam<br/>(persistence access)"]
    end

    DB[("Persistence — behind the repository seam<br/>in-memory (Map-backed) for the case study; in-process<br/>concrete external store deferred — not decided<br/>units · findings · both layers · edits · ratings<br/>every record engagement + actor scoped")]

    LLM["LLM provider — EXTERNAL API<br/>called behind a thin swappable seam"]

    PLATFORM["Platform layer — DEFERRED until after V4<br/>real login · roles · per-engagement grant/revoke · shared workspaces<br/>swaps real policy in behind BOTH seams; no call-site changes"]

    SRC --> DEIDH
    DEIDH --> UI
    UI <--> WEB
    WEB <--> IDENTITY
    WEB <--> ENGINE
    ENGINE <--> AUTHZ
    ENGINE <--> DAL
    DAL <--> DB
    ENGINE <--> LLM
    PLATFORM -.-> IDENTITY
    PLATFORM -.-> AUTHZ

    subgraph KEY["Legend — each line is one fixed combination of payloads"]
        direction TB
        lr1[" "] -->|"identified participant material — original transcripts/comments naming real people; exists only outside the application, never enters"| lr2[" "]
        lg1[" "] -->|"request/response bundle — de-identified participant content + the actor (operating staff member) + engagement scope, traveling together"| lg2[" "]
        lp1[" "] -->|"de-identified participant content ONLY — what crosses to the external model; the actor's identity and the engagement never leave the system"| lp2[" "]
        lb1[" "] -->|"access context ONLY — the actor (operating staff member) + engagement + action, for identity/authorization checks; carries no participant content"| lb2[" "]
        lo1[" "] -.->|"deferred until after V4"| lo2[" "]
        NOTE["Two unrelated senses of who: the ACTOR is the Inclusity staff member operating the tool (logs in, known by design). PARTICIPANTS are the people in the source material — de-identified before entry, never identified by the system. De-identification protects participants, not the actor."]
    end

    classDef postv4 fill:#fae5d3,stroke:#e67e22,color:#000,stroke-dasharray:6 4;
    class PLATFORM postv4;

    linkStyle 0,11 stroke:#c0392b,stroke-width:2.5px;
    linkStyle 1,2,4,6,7,12 stroke:#1e8449,stroke-width:2.5px;
    linkStyle 3,5,14 stroke:#2471a3,stroke-width:2.5px;
    linkStyle 8,13 stroke:#8e44ad,stroke-width:2.5px;
    linkStyle 9,10,15 stroke:#e67e22,stroke-width:2.5px;
```

---

*Decisions below are filled in one at a time as they are settled, with rationale, in the same discuss-then-record discipline used for the architecture.*
