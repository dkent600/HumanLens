# Human Lens — Module 1 (The Listening Brief)

Modeled on an existing DEI consultancy, turned an open-ended qualitative analysis problem into a full-stack web application wrapping a bounded, testable LLM pipeline: staged contracts between components, empirical calibration to reduce output variance, and a client-safe boundary enforced from the pipeline through to the human-review interface.

**"Human Lens" is an internal working name.** It has not been cleared for use and may not ultimately be available — treat it as a placeholder, not a settled product name. It is fine in code, in the npm scope (`@humanlens/*`), and in internal docs; it should not go in front of a client or anywhere public as though it were decided. A rename would touch the package scope and the repo name, so keep it out of anything that would make changing it expensive.

**The authoritative spec lives in [`docs/`](docs/).** `docs/build_approach.md` is the architecture (it wins on any conflict); `docs/build_implementation.md` is the stack and code structure. This README is operational only — how to run and work in the repo — and deliberately does not restate the architecture. Agents should also read [`CLAUDE.md`](CLAUDE.md) first.

## Repo layout

An npm-workspaces monorepo. Two build pipelines stay separate by design — **Vite** for the
browser app, **`tsc`** for the server.

```
packages/
  shared/     @humanlens/shared   — the client-safe contract (the ONLY types that cross
                                    backend → frontend; enforces client-safe ⊆ internal)
  backend/    @humanlens/backend  — Fastify front door + the framework-free pipeline engine
                                    (engine/ · seams/ · routes/ · composition-root.ts)
  frontend/   @humanlens/frontend — Aurelia 2 web app (pages/ · stores/ · seams/ · resources/)
```

Each package documents its own purpose, code structure, and direct dependencies:

- **[`packages/backend/README.md`](packages/backend/README.md)** — the Fastify front door,
  the framework-free engine (de-id gate → the seven lenses in waves → assemble), the seams,
  and the eval harnesses.
- **[`packages/frontend/README.md`](packages/frontend/README.md)** — the Aurelia 2 app, the
  `View → ViewModel → Store → Seam` chain, and why the frontend can only ever see the
  client-safe layer.

## Prerequisites

- **Node.js ≥ 20** and **npm** (uses npm workspaces).

## Install

```bash
npm install      # run once at the repo root; installs all workspaces
```

## Run it locally

```bash
npm run dev      # builds the backend, then starts BOTH servers:
                 #   backend (Fastify)  → http://localhost:3000  (API + /docs)
                 #   frontend (Vite)    → http://localhost:9000
```

Then open **http://localhost:9000/** and click **Brief** (or go straight to
**http://localhost:9000/brief**). The dev server proxies API calls to the backend, which
seeds a **demo fixture engagement** at startup so the brief has something to render.

You can also hit the API directly:

```
GET http://localhost:3000/engagements/eng:fixture-listening-brief/brief
```

### Stopping

- **`Ctrl+C`** in the `npm run dev` terminal stops both servers (the normal way).
- **`npm run stop`** force-frees ports 3000 and 9000 — the escape hatch if you started the
  servers detached and have no terminal to `Ctrl+C`. *(Windows/PowerShell; port-based.)*

### Run a server on its own

```bash
npm run dev:backend     # Fastify only (builds, then runs from dist/)
npm run dev:frontend    # Vite only
```

> The backend dev script builds once and runs; it is not hot-reload. Re-run after backend
> changes.

## Test, lint, build

```bash
npm test                 # all workspaces (Vitest)
npm run test --workspace @humanlens/backend     # one package
npm run test --workspace @humanlens/frontend

npm run lint             # eslint + stylelint, repo-wide

npm run build            # tsc build of shared + backend
npm run build --workspace @humanlens/frontend   # Vite production build of the web app
```

## What works today (V1, in progress)

The first full-stack **read slice** is live: a seeded fixture engagement → `GET …/brief` runs
the staged lens pipeline and returns the **client-safe layer only** → the Aurelia app renders
it. The brief you see is a proper subset of what the engine holds internally (some findings
are held back), demonstrating *client-safe ⊆ internal* on screen. Intake (contributing
material through the UI) and human review are later slices.
