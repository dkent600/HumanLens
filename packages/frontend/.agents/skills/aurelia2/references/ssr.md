# Aurelia 2 SSR Implementation Guidance

Use this reference whenever the user asks for Aurelia 2 SSR, prerendering, SEO rendering, hydration, preboot, sitemap/robots output, or fixing SSR takeover bugs.

The preferred package is `aurelia2-ssr`, from `Vheissu/aurelia2-plugins/packages/aurelia2-ssr`. Do not create a parallel custom SSR stack when this package fits. Add small app-specific glue around the package instead.

## What `aurelia2-ssr` Provides

- Server-side rendering of an Aurelia 2 root component with `renderAureliaToString(...)`
- Request-scoped DOM globals and storage shims for server rendering
- SEO-first document assembly with `buildSsrDocument(...)`
- Route-level SEO config for title, description, canonical URLs, robots, Open Graph, Twitter cards, JSON-LD, and sitemap data
- Vite manifest support for `modulepreload`, CSS files, CSS modules, and route-priority assets
- Preboot input/event capture before client takeover
- Client takeover helpers that prevent duplicated SSR markup
- True `Aurelia.hydrate(...)` integration when a core-compatible SSR manifest is available
- Router SSR through `ServerLocationManager` via `createSsrRouterRegistrations(...)`
- Declarative Shadow DOM serialization for open shadow roots
- Diagnostics for missing SEO, duplicate hosts, render budgets, HTML byte budgets, missing `h1`, and build-fail decisions
- Helpers for sitemap, robots, route validation, reports, and output file mapping

The package aligns with public Aurelia core SSR APIs:

- `Aurelia.hydrate(...)`
- `ISSRContext`
- `ISSRManifest`, `ISSRScope`, and related SSR types
- `adoptSSRView(...)` and `adoptSSRViews(...)`
- `hydrateSSRDefinition(...)`
- `ServerLocationManager` from `@aurelia/router`

Do not rely on private Aurelia core source-only APIs. If manifest recording is not publicly available in the installed Aurelia version, use remount takeover and keep hydration as a future adapter point.

## First Checks

Before editing, inspect the app:

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `index.html`
- `src/main.ts`
- root component, usually `src/my-app.ts` and `src/my-app.html`
- router setup, if present
- existing build scripts and deploy target
- existing SEO/sitemap/robots setup

Check whether the app already has SSR files such as:

- `src/ssr.config.ts`
- `src/entry-server.ts`
- `src/entry-client.ts`
- `src/ssr/entry-server.ts`
- `scripts/prerender.mjs`
- `vite.ssr.config.ts`
- Firebase/Cloudflare/server-specific SSR code

Work with the existing shape when it is already present.

## Install

For most Aurelia 2 apps:

```bash
npm install aurelia2-ssr jsdom
```

If the app uses the router, ensure `@aurelia/router` is installed. Most apps already have `aurelia` and the core Aurelia packages. If the package manager is strict about peer dependencies, install the peer packages it reports.

For package publishing or shared libraries, prefer peer dependencies for Aurelia packages rather than bundling Aurelia itself.

## Recommended File Shape

Use this shape for Vite apps unless the repo already has a clearer convention:

```text
src/
  main.ts
  my-app.ts
  my-app.html
  ssr.config.ts
  entry-server.ts
scripts/
  prerender.mjs
```

For larger apps, grouping SSR files is fine:

```text
src/
  ssr/
    config.ts
    entry-server.ts
    client-takeover.ts
    routes.ts
scripts/
  prerender.mjs
```

Keep the public client entry separate from server-only imports. Do not import `jsdom`, `node:fs`, or other Node-only modules into `src/main.ts`.

## Site and Route Config

Create a central `SsrSiteConfig`. Keep SEO route-level and explicit. The server should not need the client bundle to produce a useful title, description, canonical, and structured data.

```ts
import type { SsrSiteConfig } from 'aurelia2-ssr';

export const ssrSite: SsrSiteConfig = {
  origin: 'https://example.com',
  siteName: 'Example',
  language: 'en-AU',
  themeColor: '#111111',
  defaultTitle: 'Example',
  defaultDescription: 'A short fallback description for Example.',
  defaultOgImage: '/og.png',
  rendering: {
    hostTagName: 'my-app',
    takeoverMode: 'remount',
    settleMs: 50,
    timeoutMs: 5000,
    stripAureliaMarkers: false,
  },
  shadowDom: {
    serialize: true,
    includeSerializableAttribute: true,
    includeAdoptedStyleSheets: true,
  },
  preboot: {
    enabled: true,
    captureInput: true,
    captureSubmit: true,
    replayAfterMs: 250,
  },
  diagnostics: {
    failOnErrors: true,
    budgets: {
      renderMs: 1200,
      htmlBytes: 180000,
      titleMaxLength: 65,
      descriptionMinLength: 50,
      descriptionMaxLength: 170,
      duplicateHostMaxCount: 1,
    },
  },
  routes: [
    {
      path: '/',
      seo: {
        title: 'Example home',
        description: 'A useful page description for search engines and social previews.',
        canonicalPath: '/',
        robots: 'index,follow',
        sitemap: {
          include: true,
          priority: 1,
          changefreq: 'weekly',
        },
      },
      priority: {
        level: 'critical',
        moduleIds: ['src/routes/home.ts'],
        images: [{ href: '/hero.webp', fetchPriority: 'high' }],
      },
    },
  ],
};
```

Route config should include every public route that needs prerendered HTML. Auth-only routes can usually be `mode: 'client'` or omitted from prerender output.

## Server Entry

The server entry renders the root component into a request-scoped DOM.

```ts
import { RouterConfiguration } from '@aurelia/router';
import {
  createSsrRouterRegistrations,
  renderAureliaToString,
  type SsrRouteConfig,
} from 'aurelia2-ssr';
import { MyApp } from './my-app';
import { ssrSite } from './ssr.config';

export { ssrSite } from './ssr.config';

export async function render(url: string, window: Window, route?: SsrRouteConfig) {
  const routerRegistrations = await createSsrRouterRegistrations({
    path: url,
    baseHref: '/',
  });

  return renderAureliaToString({
    window,
    component: MyApp,
    site: ssrSite,
    route,
    registrations: [
      RouterConfiguration.customize({ useUrlFragmentHash: false }),
      ...routerRegistrations,
    ],
    settle: route?.render?.settleMs ?? ssrSite.rendering?.settleMs ?? 50,
  });
}
```

If the app has no router, omit the router imports and registrations.

Use the `settle` callback for explicit app data readiness when possible:

```ts
await renderAureliaToString({
  window,
  component: MyApp,
  site: ssrSite,
  route,
  settle: async context => {
    await context.container.get(MyDataReadyService).ready;
  },
});
```

Prefer explicit readiness over arbitrary sleeps. A small `settleMs` fallback is acceptable for simple pages.

## Prerender Script

Use a prerender script for static hosting and SEO-heavy public pages.

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildSsrDocument,
  createJSDOMEnvironment,
  createPrebootScript,
  createRobotsTxt,
  createSitemapXml,
  createSsrReport,
  outputFileForRoute,
  shouldFailSsrBuild,
  validateSsrConfig,
} from 'aurelia2-ssr';
import { render, ssrSite } from '../dist/server/entry-server.js';

const distDir = path.resolve('dist');
const template = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
const manifest = JSON.parse(await fs.readFile(path.join(distDir, '.vite/manifest.json'), 'utf8'));
const validation = validateSsrConfig(ssrSite);

if (validation.errors.length > 0) {
  throw new Error(validation.errors.join('\n'));
}

const reports = [];

for (const route of ssrSite.routes ?? []) {
  if (route.mode === 'client') {
    continue;
  }

  const url = new URL(route.path, ssrSite.origin).toString();
  const env = await createJSDOMEnvironment({
    html: '<!doctype html><html><head><base href="/"></head><body><my-app></my-app></body></html>',
    url,
  });

  try {
    const renderResult = await render(route.path, env.window, route);
    const documentResult = buildSsrDocument({
      template,
      site: ssrSite,
      route,
      render: renderResult,
      manifest,
      prebootScript: createPrebootScript(ssrSite.preboot),
    });
    const outputFile = outputFileForRoute(route);

    await fs.mkdir(path.dirname(path.join(distDir, outputFile)), { recursive: true });
    await fs.writeFile(path.join(distDir, outputFile), documentResult.html);

    reports.push({
      path: route.path,
      mode: route.mode ?? 'prerender',
      status: renderResult.status ?? 200,
      canonicalUrl: documentResult.canonicalUrl,
      priority: route.priority?.level ?? 'normal',
      renderMs: renderResult.timings?.renderMs ?? 0,
      htmlBytes: Buffer.byteLength(documentResult.html),
      appHtmlBytes: Buffer.byteLength(renderResult.appHtml),
      title: route.seo.title,
      descriptionLength: route.seo.description.length,
      h1Count: documentResult.document.querySelectorAll('h1').length,
      diagnostics: [
        ...(renderResult.diagnostics ?? []),
        ...documentResult.diagnostics,
      ],
    });
  } finally {
    env.close();
  }
}

const diagnostics = reports.flatMap(report => report.diagnostics);
await fs.writeFile(path.join(distDir, 'sitemap.xml'), createSitemapXml(ssrSite.routes ?? [], ssrSite));
await fs.writeFile(path.join(distDir, 'robots.txt'), createRobotsTxt(ssrSite));
await fs.writeFile(path.join(distDir, 'ssr-report.json'), JSON.stringify(createSsrReport(ssrSite, reports), null, 2));

if (shouldFailSsrBuild(ssrSite, diagnostics)) {
  throw new Error('SSR diagnostics failed. See dist/ssr-report.json.');
}
```

Adapt output paths to the repo. Some apps use `dist/client` and `dist/server`; others use one `dist`.

## Vite Build Shape

Many apps need both a client build and a server build:

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server && npm run prerender",
    "build:client": "vite build",
    "build:server": "vite build --ssr src/entry-server.ts --outDir dist/server",
    "prerender": "node scripts/prerender.mjs"
  }
}
```

Ensure the client build writes a Vite manifest:

```ts
export default defineConfig({
  build: {
    manifest: true,
  },
});
```

If the app already has a Vite config split, use the existing pattern. Avoid mixing server-only modules into the browser bundle.

## Client Takeover

For most current apps, use remount takeover. This prevents duplicate homepages, duplicate navigation, and unbound SSR markup.

```ts
import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { finishSsrTakeover, prepareSsrHostForTakeover } from 'aurelia2-ssr';
import { MyApp } from './my-app';

const host = prepareSsrHostForTakeover({
  selector: 'my-app',
  mode: 'remount',
});

if (!host) {
  throw new Error('Unable to start app: host was not found.');
}

Aurelia
  .register(RouterConfiguration.customize({ useUrlFragmentHash: false, useHref: false }))
  .app(MyApp)
  .start()
  .then(() => finishSsrTakeover());
```

If there is no SSR marker on the page, `prepareSsrHostForTakeover(...)` returns the host without clearing it.

Keep the same `.app(...)` boot shape that worked before SSR. Many Aurelia Router apps start with `.app(MyApp)` and rely on that root-component startup path for initial viewport activation. Do not switch those apps to `.app({ host, component: MyApp })` just to pass the remount host; it can leave `<au-viewport>` blank after takeover. Use `prepareSsrHostForTakeover(...)` to clear/check the host, then let Aurelia keep its existing boot form.

### No-Flicker Remount Takeover

`prepareSsrHostForTakeover({ mode: 'remount' })` clears the SSR host
synchronously. That prevents duplicate markup, but apps with async route data
can briefly show a blank or loading state while the client route refetches.

For public pages where this flicker matters, keep an inert copy of the SSR HTML
visible until Aurelia has started:

```ts
const ssrPrerendered = document.documentElement.hasAttribute('data-aurelia-ssr-prerendered');
const existingHost = document.querySelector<HTMLElement>('my-app');
const placeholder = ssrPrerendered && existingHost?.hasChildNodes()
  ? document.createElement('div')
  : null;
let originalHostStyle = '';

if (placeholder && existingHost) {
  placeholder.setAttribute('data-aurelia-ssr-placeholder', '');
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.style.display = 'contents';
  placeholder.innerHTML = existingHost.innerHTML;
  existingHost.before(placeholder);

  originalHostStyle = existingHost.getAttribute('style') ?? '';
  existingHost.style.position = 'absolute';
  existingHost.style.visibility = 'hidden';
  existingHost.style.pointerEvents = 'none';
  existingHost.style.inset = '0';
  existingHost.style.width = '100%';
}

const host = prepareSsrHostForTakeover({ selector: 'my-app', mode: 'remount' }) ?? existingHost;

if (!host) {
  throw new Error('Unable to start app: host was not found.');
}

function finishTakeover(): void {
  placeholder?.remove();

  if (existingHost) {
    if (originalHostStyle) {
      existingHost.setAttribute('style', originalHostStyle);
    } else {
      existingHost.removeAttribute('style');
    }
  }

  finishSsrTakeover();
}

Aurelia
  .app(MyApp)
  .start()
  .then(() => finishTakeover());
```

Use `visibility: hidden`, not `display: none`, on the real host so components
that measure layout during startup still get real dimensions. Remove the
placeholder before `finishSsrTakeover()` so preboot replays against client-owned
DOM.

### Preserve Server Data on Client Boot

SSR is not done if the server renders useful content and the client immediately
replaces it with a loader, empty state, or skeleton while it refetches the same
data. Treat this as a takeover bug, even when the final content eventually
returns.

For stable public data such as navigation, ticket/card options, product lists,
marketing content, docs, public profile shells, or recent winners, render the
HTML on the server and serialize the same data into a small bootstrap payload:

```html
<script id="app-ssr-data" type="application/json">
  {"route":"/","cardTypes":[{"id":"lucky-7s","name":"Lucky 7s"}]}
</script>
```

Escape this JSON safely for HTML. Prefer `type="application/json"` or a
well-escaped `window.__APP_SSR__` assignment. Do not put secrets, private user
data, session tokens, or admin-only fields in this payload.

On the client, read this payload before constructing route state, stores, or
components that can render loading states:

```ts
interface SsrBootstrap {
  route?: string;
  cardTypes?: CardType[];
}

function readSsrBootstrap(): SsrBootstrap {
  const element = document.getElementById('app-ssr-data');
  if (!element?.textContent) return {};

  try {
    return JSON.parse(element.textContent) as SsrBootstrap;
  } catch {
    return {};
  }
}

export class CardTypeStore {
  cardTypes = readSsrBootstrap().cardTypes ?? [];
  hasInitialCardTypes = this.cardTypes.length > 0;

  async loadCardTypes(options: { revalidate?: boolean } = {}) {
    if (this.hasInitialCardTypes && !options.revalidate) {
      return;
    }

    const next = await fetch('/api/card-types').then(r => r.json());
    this.cardTypes = next.cardTypes;
    this.hasInitialCardTypes = this.cardTypes.length > 0;
  }
}
```

The first client render must use the server data as the initial state. If a
freshness check is still useful, do it as stale-while-revalidate: fetch in the
background and swap in new data only after a successful response. Do not set
arrays to `[]`, `loading = true`, or `content = null` on startup when SSR data
already exists. Do not poll stable content on a short interval unless the user
can actually change it from this page; use admin-triggered invalidation, a long
TTL, or manual refresh instead.

Watch for these flash-causing patterns:

- constructors or `attached()` hooks that reset server-populated state to empty
- auth, extension, or config checks that call `render()` before bootstrap data
  has been read
- fetching stable content just to discover config that could be serialized by
  the server
- route loaders that ignore the request path in the bootstrap state and refetch
  the same route immediately
- client-only stores that cannot be seeded from server data

Verify the handoff explicitly. Use `curl` or JS-disabled inspection to confirm
the HTML contains the real content, then delay or block the matching API request
in a browser test. The already-rendered content should remain visible and
interactive; it should not flicker to a loader, empty message, or blank host.

## Hydration Mode

Only use `mode: 'hydrate'` when the build/server pipeline can provide all of these:

- server HTML that preserves Aurelia marker comments
- an `ISSRScope` tree that matches the rendered controller tree
- AOT-ready component definitions, or a serialized SSR definition hydrated with `hydrateSSRDefinition(...)`

Client:

```ts
import { hydrateAureliaSsr } from 'aurelia2-ssr';
import { MyApp } from './my-app';

await hydrateAureliaSsr({
  host: document.querySelector('my-app')!,
  component: MyApp,
  ssrScope: window.__AURELIA_SSR_MANIFEST__,
});
```

Server rendering for hydration should preserve markers:

```ts
await renderAureliaToString({
  window,
  component: MyApp,
  route: {
    ...route,
    render: { preserveMarkers: true, takeoverMode: 'hydrate' },
  },
});
```

Hydration must fail loudly if the HTML, markers, definitions, and manifest do not match. Do not silently fall through to a half-bound DOM.

## Preboot

Enable preboot when users can interact before the client bundle loads.

Preboot can capture:

- input/change values
- checkbox and radio checked state
- selection ranges where supported
- focus
- submits
- clicks
- optional keydown

Use stable selectors on important fields:

```html
<input data-ssr-key="signup-email" value.bind="email">
```

Call `finishSsrTakeover()` after Aurelia starts. That replays captured values and events.

Avoid placing destructive click replay behind generic click capture. Keep `preventDefaultFor` focused on submits unless the app specifically needs click prevention.

## SEO Model

SSR SEO should be route config, not a browser-side side effect.

Each public route should define:

- `seo.title`
- `seo.description`
- `seo.canonicalPath` or `seo.canonicalUrl`
- `seo.robots`
- `seo.sitemap`

Add Open Graph, Twitter, and JSON-LD where the page benefits from rich previews or structured data.

Diagnostics should fail the build for missing required metadata on public routes.

## Assets, CSS, and Third-Party Scripts

Use `priority.moduleIds` so `buildSsrDocument(...)` can resolve the Vite manifest for route entries, imports, CSS, and CSS modules.

Use route-level `assets` for route-only scripts/styles and site-level `assets` for shared scripts/styles.

Third-party script strategies:

- `head-start`
- `head-end`
- `before-preboot`
- `before-client`
- `after-client`
- `body-end`

Default third-party scripts to `body-end` or another non-blocking strategy. Use `before-client` only when the script must exist before Aurelia starts.

If the app uses CSP, pass `security.nonce` so inline preboot/context/scripts can receive the nonce.

## Shadow DOM

Open shadow roots can be serialized as Declarative Shadow DOM:

```html
<template shadowrootmode="open" shadowrootserializable>
  <style>:host{display:block}</style>
  ...
</template>
```

Readable `adoptedStyleSheets` can be copied into a `<style data-aurelia-ssr-adopted>` element.

Closed shadow roots cannot be inspected with normal DOM APIs. If a component uses closed Shadow DOM and must render on the server, expose SSR-friendly light DOM or provide explicit server-rendered markup.

## Browser Globals and Request Isolation

SSR often breaks when code reads browser globals:

- `window`
- `document`
- `navigator`
- `location`
- `localStorage`
- `sessionStorage`
- `requestAnimationFrame`
- `matchMedia`
- `ResizeObserver`
- `IntersectionObserver`

`renderAureliaToString(...)` installs and restores DOM globals by default. For custom render steps, use:

```ts
import { installDomGlobals } from 'aurelia2-ssr';

const restore = installDomGlobals(window);
try {
  await render();
} finally {
  restore();
}
```

Do not share one storage object, DOM, route state, or user state across requests.

When app or dependency code reads `window` at import time, prefer moving that read behind `attached()`, route hooks, or an injected browser adapter. If a dependency cannot be changed, import it after DOM globals are installed on the server path.

## Common Bugs and Fixes

### Duplicated Page After SSR

Cause: the client mounted into a host that still contained prerendered markup.

Fix: use remount takeover:

```ts
prepareSsrHostForTakeover({ selector: 'my-app', mode: 'remount' });
```

Also verify generated HTML has exactly one app host.

### Hamburger or Click Handlers Do Not Work

Cause: the browser is showing server HTML that Aurelia has not bound, or the client app mounted beside/inside stale SSR markup.

Fix: in remount mode, clear the SSR host before starting Aurelia and call `finishSsrTakeover()` after startup. In hydrate mode, verify marker comments and manifest scopes match.

### Blank Viewport After Client Takeover

Cause: SSR integration changed the browser startup shape, commonly from `.app(MyApp)` to `.app({ host, component: MyApp })`. Some routed apps then start the shell but never activate the initial `<au-viewport>`.

Fix: preserve the app's existing `.app(...)` form. In remount mode, call `prepareSsrHostForTakeover(...)` before start to clear prerendered markup, then call `finishSsrTakeover()` after `start()` resolves. Verify with a real browser that market/list/detail routes load data after JavaScript starts and top navigation changes routes.

### SSR Page Flickers During Takeover

Cause: remount takeover clears the SSR host before Aurelia starts, then the
client app renders its initial loading state while async route data refetches.

Fix: use the no-flicker remount pattern above: insert an `aria-hidden` placeholder
copy of the SSR host, hide the real host with `visibility: hidden`, remount the
client into the real host, then remove the placeholder after `start()` resolves.
Test with delayed API responses in Playwright or a real browser.

### Browser-Only Widget Errors During SSR

Cause: a chart, canvas, map, editor, media, or DOM-heavy library initialises in
SSR and touches browser APIs that JSDOM does not implement.

Fix: keep useful SSR HTML/data, but guard the widget initialisation with an app
SSR flag or `typeof window` check. Initialise the browser-only widget from
`attached()` only when not server rendering. Treat this as app integration unless
the SSR package itself is touching that library.

### Fastify Root Returns 403

Cause: `@fastify/static` can treat `/` as a directory request when registered with `index: false`, returning 403 before the SSR fallback gets a chance to render the app.

Fix: register an explicit `GET /` SSR/app route before `@fastify/static`, or allow the static plugin to serve `index.html` and reserve the fallback for non-file app routes. Missing hashed assets should still be real 404s, not app HTML.

### Fastify Fallback Crashes on POST or Missing Routes

Cause: an async Fastify SSR fallback or not-found handler sends a 404 response
but does not return the reply. Fastify can continue the reply lifecycle and
throw `ERR_HTTP_HEADERS_SENT`, especially when scanners hit app-looking paths
with non-navigation methods such as `POST /` or `POST /login`.

Fix: make every branch that sends a response return it:

```ts
function sendRouteNotFound(req: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.code(404).send({
    message: `Route ${req.method}:${req.url} not found`,
    error: 'Not Found',
    statusCode: 404,
  });
}

app.setNotFoundHandler(async (req, reply) => {
  if (req.url.startsWith('/api')) {
    return sendRouteNotFound(req, reply);
  }

  const isHtmlNav = (req.method === 'GET' || req.method === 'HEAD')
    && acceptsHtmlOrAppPath(req);

  if (!isHtmlNav) {
    return sendRouteNotFound(req, reply);
  }

  return renderOrSendIndex(req, reply);
});
```

Do not SSR or serve `index.html` for non-GET/HEAD requests. If the app uses
Fastify hooks such as `onSend`, preserve Fastify's payload flow by accepting and
returning the payload from async hooks.

### Missing Styles

Cause: route modules were not mapped into the Vite manifest, CSS modules were not collected, or Shadow DOM styles were not serialized.

Fix: set `build.manifest = true`, add correct `priority.moduleIds`, enable `site.assets.manifestStyles`, and configure `shadowDom.includeAdoptedStyleSheets` when needed.

### `window` Is Undefined During Build

Cause: app code or a dependency reads browser globals during server import/render.

Fix: move the read to `attached()` or inject an adapter. For hard dependencies, install DOM globals before importing the server entry.

### Async Data Missing From HTML

Cause: SSR rendered before route data was ready.

Fix: move essential data loading into route `canLoad` or `loading`, or pass an explicit `settle` callback that waits for the app's data readiness signal.

## Verification Checklist

After implementation, run the repo's real verification commands. At minimum:

- package install completed without peer dependency surprises
- TypeScript build passes
- client build passes
- server build passes, if present
- prerender script passes
- tests pass or targeted SSR tests pass
- generated HTML contains meaningful content for every public route
- each generated page has exactly one app host
- each public route has title, description, canonical, and one useful `h1`
- `sitemap.xml` and `robots.txt` exist when configured
- `ssr-report.json` has no build-blocking diagnostics
- delayed API responses do not cause SSR content to disappear during remount takeover
- browser console and server logs have no SSR-only widget errors
- Fastify fallback probes such as `POST /`, `POST /login`, and missing asset/API
  routes return 404s without `ERR_HTTP_HEADERS_SENT` or process restarts
- mobile navigation works after takeover
- form input entered before takeover survives after startup when preboot is enabled

For browser smoke checks, use Playwright or the available browser tool:

```ts
expect(await page.locator('my-app').count()).toBe(1);
await expect(page.locator('html')).toHaveAttribute('data-aurelia-taken-over', '');
```

Also inspect the built HTML directly. Do not only test the live client-rendered DOM.

## Tests to Add

For apps with SSR, add focused tests around:

- route config validation
- canonical URL generation
- sitemap/robots output
- document SEO tags
- Vite manifest CSS/modulepreload injection
- duplicate host detection
- preboot replay for important forms
- Shadow DOM serialization if the app uses Shadow DOM
- client takeover path
- Fastify SSR fallback/not-found handlers, including non-GET scanner probes
  like `POST /` and `POST /login`

Use the package's own tests as examples when available in `packages/aurelia2-ssr/test/ssr.spec.ts`.
