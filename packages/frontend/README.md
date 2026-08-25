# `@humanlens/frontend`

The browser app for **Human Lens — Module 1 (the Listening Brief)**: an Aurelia 2 web UI
where an Inclusity actor contributes already-de-identified material and reads back the
assembled brief. No local install — it talks to the Fastify front door over HTTP.

> ⚠️ **This app is a very incomplete draft.** What exists is a thin proving slice — enough
> to demonstrate the architecture end to end (the layering, the seam boundaries, and
> *client-safe ⊆ internal* visible on screen), not a usable product. The UI is unstyled and
> unreviewed, the screens are minimal, there is no engagement selection, no human-review
> surface, no export, and no error/empty-state design worth the name. Expect most of it to
> change. The **structure** below is the part meant to be stable; the screens are not.

> **The authoritative spec lives in [`docs/`](../../docs/).** `docs/build_approach.md` is
> the architecture (it wins on any conflict); `docs/build_implementation.md` is the stack
> and code structure — its *Frontend code structure* section governs this package. This
> README describes what is in the package and how to work in it. Agents should read
> [`CLAUDE.md`](../../CLAUDE.md) first, plus the `aurelia2` and `aurelia2-ex` skills under
> [`.claude/skills/`](.claude/skills/).

## Purpose

Two screens, both actor-facing:

- **Intake** (`/intake`) — compose and submit units of **already-de-identified** material,
  then run the de-id scan and read the **aggregate** outcome. This is a contribution
  surface, *not* a de-identification tool: the actor de-identifies before entry and the
  backend gate is the backstop. Per-unit `deid_status` deliberately never crosses the wire.
- **Brief** (`/brief`) — present the assembled brief: findings grouped by lens, subthemes
  nested, each with its verbatim (or noticing), its evidence links, and its **derived**
  support. Human review is a later slice.

**The frontend can only ever see the client-safe layer.** `@humanlens/shared` is the entire
surface it is able to import, and `shared` publishes client-safe DTOs only — so
*client-safe ⊆ internal* is enforced by the **package boundary**, not by convention. A
facilitator-facing internal-brief view is deferred and would need its own contract; it
cannot be an extension of `BriefStore`.

## Code architecture

Four layers per screen, mirroring the engine's seam discipline:

```
View (.html) → ViewModel (routed component) → Store (DI singleton) → Seam (HTTP)
```

- **View** — presentation only. Formatting lives here, in value converters.
- **ViewModel** — the routed component, **transient** per activation, UI behavior only; it
  holds no durable state.
- **Store** — a plain **concrete** DI singleton: internal state plus *structural*
  derivation (group findings by lens, build the `parent` subtheme tree). The frontend
  analog of the engine's internal coordinators.
- **Seam** — the one outward boundary to the backend, via Axios.

**Folder = role, filename = resource** — the path says what a file is without opening it,
matching the backend's `engine/` · `seams/` · `routes/` · `domain/` layout:

```
src/
  main.ts                 the composition root — registers the router, ILogger,
                          the seams + their implementations, the Stores, and
                          global resources; boots MyApp
  my-app.{ts,html,css}    the app shell + routes; my-app.css is the Tailwind entry

  pages/                  Aurelia routed component pairs (.ts + .html, co-located)
    intake-page · brief-page · welcome-page · about-page

  stores/                 state + structural derivation (concrete DI singletons)
    intake-store.ts       drafts, submission status, the aggregate scan summary
    brief-store.ts        ClientSafeFinding[] → LensGroup[] of nested FindingNodes

  seams/                  the outward boundary + its fake, side by side
    brief-api.ts · brief-api.fake.ts        read path
    intake-api.ts · intake-api.fake.ts      write path

  resources/              Aurelia resources / value converters
    support-text.ts       derived support counts → display text
```

### The rules this package holds to

- **Seam only where substitution earns it.** The *outward* boundary is an interface token
  (`DI.createInterface` + an Axios implementation + a deterministic fake), because the
  external boundary is the one worth substituting — so Store → ViewModel → View all test
  with **no server running**. Stores are *not* interfaces.
- **A seam ships with its fake beside it**, in `src/` and not `test/` — the fake is part of
  the seam's definition, mirroring the backend's `FakeLlmProvider`.
- **Expected outcomes are result values, not exceptions.** A seam returns
  `{ ok: true; … } | { ok: false; reason }`, mirroring the engine's authorization decision
  object. Exceptions are reserved for genuine transport failures. The `reason` cases map
  onto the engine's real semantics (`not-found`, `denied`, `validation`) — never a parallel
  taxonomy. `not-ready` is reserved for when brief generation becomes async.
- **"Service" is a backend word.** The frontend's outward layer is a **seam** layer.
- **Strength is never asserted.** The Store owns structural derivation only; turning the
  backend's derived support counts into words is a View value converter.
- **Logging goes through `ILogger`**, not `console.log` (see the `aurelia2-ex` skill).
- **Lifetimes:** Stores and seams are singletons (they survive navigation); ViewModels are
  transient per route activation.

### Talking to the backend

In dev, Vite proxies `/engagements` to the Fastify backend on `:3000`, so the Axios clients
use **relative** URLs. In production one Fastify process serves both the built UI and the
API on the same origin — the same relative path works, and there is no CORS.

## Direct dependencies

| Package | Role |
| --- | --- |
| **`aurelia`** (2.0.0-rc.1) | the framework — DI, templating, `ILogger` |
| **`@aurelia/router`** | routing for the app shell's `@route` config |
| **`axios`** | the HTTP client, used *only* inside `seams/` |
| **`@humanlens/shared`** | the client-safe contract — the entire surface the frontend may import (workspace package) |

Dev-only:

| Package | Role |
| --- | --- |
| **`vite`** (pinned **7.x**) · **`@aurelia/vite-plugin`** | dev server and production build. The 7.x pin is deliberate — Vite 8 / Rolldown had an Aurelia plugin glitch in beta |
| **`tailwindcss`** (v4) · **`@tailwindcss/vite`** | styling, via the `@import "tailwindcss"` entry in `my-app.css` |
| **`vitest`** · **`@vitest/coverage-v8`** · **`jsdom`** · **`@aurelia/testing`** | tests, over the seam fakes — no server needed |
| **`typescript`** (hoisted to the root) · **`@types/node`** · **`tslib`** · **`rimraf`** | build tooling |

**Aurelia Headless UI** (`@aurelia-ui-toolkits/headless`) is the decided component-primitive
choice with **DaisyUI** as the fallback, but neither is installed yet — the UI surface is
still bespoke Aurelia elements styled by Tailwind directly. Headless / light-DOM is the
deliberate stance; there is no Shadow DOM here.

## Working in this package

```bash
npm run dev   --workspace @humanlens/frontend    # Vite on :9000, proxying to :3000
npm run build --workspace @humanlens/frontend    # production build
npm run test  --workspace @humanlens/frontend    # vitest run (jsdom)
```

From the repo root, `npm run dev` starts this **and** the backend together. The backend
seeds a demo fixture engagement at startup, so <http://localhost:9000/brief> has something
real to render. `BriefPage` hardcodes that fixture id for V1 — there is no engagement
selection UI yet; that arrives with the intake slice, and the coupling goes with it.

`welcome-page` and `about-page` are leftover scaffold pages, kept for now; retiring them is
a deferred cleanup.
