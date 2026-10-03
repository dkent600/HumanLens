# Human Lens

Full-stack web app wrapping a bounded, testable LLM pipeline for open-ended qualitative analysis: staged contracts between components, empirical calibration to reduce output variance, and a client-safe boundary enforced through to the human-review UI. Modeled on an existing DEI consultancy.

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

## Agent skills

Skills are packaged instructions an AI coding agent loads when a task calls for them (for
example, the project's testing standard). Every skill exists **exactly once**, in an
`.agents/skills/` folder, and every agent reads that one copy. Don't copy, mirror, or link a
skill anywhere else: copies drift, and links don't survive a fresh clone on Windows.

| Folder | For | Claude Code plugin |
| :- | :- | :- |
| `.agents/skills/` | the whole repo | `humanlens` |
| `packages/frontend/.agents/skills/` | the Aurelia 2 app | `humanlens-frontend` |
| `packages/backend/.agents/skills/` | the engine and Fastify service | `humanlens-backend` |
| `packages/shared/.agents/skills/` | the client-safe contract | `humanlens-shared` |

An empty folder holds a `.gitkeep` so it exists in a fresh clone. Delete the `.gitkeep` once
the folder has a real skill.

### How each agent finds them

- **Codex** reads `.agents/skills/` natively, from the working directory up to the repo root.
- **Claude Code** doesn't look in `.agents/` itself, so the repo is also a small plugin
  marketplace. [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) declares
  one plugin per `.agents/` folder, and [`.claude/settings.json`](.claude/settings.json)
  registers the marketplace and turns the plugins on for everyone who clones. Each plugin is
  read in place from its `.agents/` folder, with no install step and no cached copy. Its
  skills appear with the plugin's name as a prefix, such as `humanlens:testing-practices`.

### When the skills load in Claude Code

- **At session start**, once you have trusted the folder. A headless `claude -p` run and a
  cloud session don't load project plugins.
- **On a fresh clone**, Claude Code registers the marketplace in the background during the
  first trusted session. The skills arrive after `/reload-plugins` or in the next session.
- **Only each skill's `name` and `description`** are in context all the time. The full
  `SKILL.md` loads when Claude judges the skill relevant from its description, or when you
  type `/<plugin>:<skill>`. That makes the description the part to get right.
- **After you add or edit a skill**, run `/reload-plugins` or start a new session.

### Add a skill

- **For every agent:** create `<folder>/<name>/SKILL.md` in the right folder from the table,
  with `name` and `description` frontmatter. Nothing else needs changing. Keep it portable:
  frontmatter that only Claude Code understands (`disable-model-invocation`,
  `allowed-tools`, `argument-hint`) belongs in a Claude-only skill.
- **For Claude Code only:** use Claude's own folders, where skills load without a plugin or
  prefix: `.claude/skills/<name>/` for this repo, `packages/<pkg>/.claude/skills/<name>/` for
  when Claude works in that package, or `~/.claude/skills/<name>/` for yourself in every
  project.
- **One home per skill.** A skill in both `.agents/skills/` and `.claude/skills/` is a
  duplicate, and Claude Code would load both.
- **A new `.agents/skills/` folder** (another package, say) also needs an entry in
  `.claude-plugin/marketplace.json`, a matching `"<plugin>@humanlens": true` under
  `enabledPlugins` in `.claude/settings.json`, and a `.gitkeep` until it has a skill. Check
  the result with `claude plugin validate .`.

### Check that it's working

- In a Claude Code session, `/plugin` → **Marketplaces** lists `humanlens` as a folder
  source. **In this project** shows 0 installed. That's expected: these plugins load from the
  repo and have no install record.
- The `/plugin` **Errors** tab names any plugin that failed to load, such as one whose
  `.agents/` folder is missing.
- Ask Claude "what skills do you have?" to see the prefixed names.

## What works today (V1, in progress)

The first full-stack **read slice** is live: a seeded fixture engagement → `GET …/brief` runs
the staged lens pipeline and returns the **client-safe layer only** → the Aurelia app renders
it. The brief you see is a proper subset of what the engine holds internally (some findings
are held back), demonstrating *client-safe ⊆ internal* on screen. Intake (contributing
material through the UI) and human review are later slices.
