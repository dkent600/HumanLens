---
name: aurelia2
description: Create new and work with existing Aurelia 2 applications. Use this skill when scaffolding a new Aurelia 2 project, creating components/routes, writing Aurelia 2 code, debugging, adding SSR/prerendering, refactoring, or reviewing existing Aurelia 2 codebases. Covers project setup with Vite, Tailwind CSS v4, Vitest, Playwright, Storybook, SSR, and best practices for templates, routing, DI, observation, and testing.
---

# Aurelia 2 Application Skill

You are an expert in Aurelia 2. Follow these rules strictly when generating or reviewing Aurelia 2 code.

This skill serves two purposes:
1. **Scaffolding new Aurelia 2 projects** with modern tooling (Vite, Tailwind v4, Vitest, Playwright, Storybook).
2. **Working with existing Aurelia 2 codebases** as a best-practice reference for templates, routing, DI, component patterns, observation, and testing. When modifying existing code, respect the project's established conventions while steering toward the patterns documented here.

**Official docs:** https://docs.aurelia.io

## First Step for Real Projects

Before scaffolding or editing a real Aurelia 2 app, inspect the repo first.

- If the user already has another Aurelia 2 + Vite app nearby, read its `package.json`, `tsconfig.json`, `vite.config.ts`, and one or two representative components before proposing structure from memory.
- Prefer matching the established local Aurelia 2 shape over inventing a fresh scaffold.
- Do not add tools or config "just in case". Every plugin or dependency must be justified by an actual app need.
- If the user asks for SSR, prerendering, hydration, SEO rendering, sitemap generation, or fixing SSR takeover bugs, read `references/ssr.md` before editing.

For local Vite apps, a good reference shape is:
- `aurelia` in `dependencies`
- `@aurelia/vite-plugin`, `typescript`, `vite`, `tslib` in `devDependencies`
- `module: "esnext"`, `moduleResolution: "node"`, `target: "ES2022"`, `importHelpers: true`
- `vite.config.ts` with `aurelia({ useDev: true })` and only the plugins the app actually uses

## Non-Negotiables

- If `tsconfig.json` uses `importHelpers: true`, `tslib` must be present in `package.json`. Do not forget this.
- Do not use `vite-plugin-node-polyfills` unless the app genuinely depends on Node built-ins in the browser.
- Do not add router setup if the app spec says no router.
- Do not add Tailwind, Storybook, Playwright, Vitest, or extra tooling unless the user asked for them or the repo already uses them.
- Do not hand-roll Aurelia SSR when `aurelia2-ssr` fits the app. Use the package APIs and only add app-specific glue around them.
- SSR is not complete if the client immediately replaces server-rendered content with a loading or empty state. For stable route data, serialize the server data and initialize the client from it before any first-load fetches.
- After scaffolding or significant Aurelia changes, run a build and fix template/runtime errors instead of assuming the syntax is correct.

## Critical Breaking Changes from Aurelia 1

### 1. NO `.delegate`  -  Use `.trigger`
`.delegate` has been **completely removed** in Aurelia 2. Always use `.trigger`:
```html
<!-- WRONG -->
<button click.delegate="doSomething()">Click</button>

<!-- CORRECT -->
<button click.trigger="doSomething()">Click</button>
```

### 2. NO `@autoinject`  -  Use `resolve()` or `static inject`
`@autoinject` has been **removed**. Aurelia 2 uses TC39 decorators (NOT experimental decorators), which do **not** support decorator metadata. You **cannot** use decorators inline on constructor parameters.

```typescript
// WRONG  -  will not work
@autoinject
export class MyComponent {
  constructor(private api: ApiService) {}
}

// WRONG  -  decorator on constructor param not supported with TC39 decorators
export class MyComponent {
  constructor(@IHttpClient private http: IHttpClient) {}
}

// CORRECT  -  use resolve() function
import { resolve } from 'aurelia';
export class MyComponent {
  private api: ApiService = resolve(ApiService);
}

// ALSO CORRECT  -  static inject
export class MyComponent {
  static inject = [ApiService];
  constructor(private api: ApiService) {}
}
```

### 3. NO `experimentalDecorators` in tsconfig
Aurelia 2 uses the latest TC39 decorators specification. Do **NOT** set `experimentalDecorators: true` or `emitDecoratorMetadata: true` in tsconfig.json.

### 4. `<template>` Element is Optional
In Aurelia 2 templates, the `<template>` wrapper element is **optional**. You can write HTML directly:
```html
<!-- Both are valid in Aurelia 2 -->
<div class="my-component">
  <p>${message}</p>
</div>
```

### 5. NO `.one-way` Binding Command
`one-way` is not valid Aurelia 2 syntax. Do not generate it.

Use these instead:
```html
<!-- WRONG -->
<input value.one-way="message">

<!-- CORRECT -->
<input value.to-view="message">

<!-- ALSO CORRECT -->
<input value.bind="message">
```

Also prefer modern Aurelia 2 binding commands consistently:
- `.trigger` for events
- `.bind` for default binding behavior
- `.to-view`, `.from-view`, `.two-way` when the direction matters explicitly
- Never generate `.delegate`
- Never generate `.one-way`

## Project Scaffolding

To scaffold a new Aurelia 2 project with the official CLI:
```bash
npx makes aurelia <project-name> -s tailwindcss,vitest,playwright,storybook,app-with-router
```

This will scaffold a new Aurelia 2 project with Tailwind, Vitest, Vite for the Bundler, Playwright for e2e testing, Storybook and an example app with routing (to show how routing works). The app will be a starting point to build on, but clean up any demo data prior.

Do not blindly use the full scaffold. If the app does not need routing, Storybook, Playwright, or Tailwind, omit them.

### Required Files for Manual Setup

The examples below are a baseline plus optional feature-specific additions. Do not treat every dependency shown here as mandatory for every Aurelia app.

**package.json**  -  Key dependencies:
```json
{
  "type": "module",
  "dependencies": {
    "aurelia": "latest"
  },
  "devDependencies": {
    "@aurelia/vite-plugin": "latest",
    "@aurelia/testing": "latest",
    "@aurelia/storybook": "^2.2.1",
    "storybook": "^10.1.11",
    "@storybook/builder-vite": "^10.1.11",
    "@storybook/addon-links": "^10.1.11",
    "tailwindcss": "^4.1.10",
    "@tailwindcss/vite": "^4.1.10",
    "vite": "^7.3.1",
    "vitest": "^2.1.8",
    "jsdom": "^25.0.1",
    "@playwright/test": "^1.49.1",
    "typescript": "^5.7.2",
    "tslib": "^2.8.1",
    "eslint": "^9.17.0",
    "globals": "^15.14.0",
    "typescript-eslint": "^8.18.1",
    "stylelint": "^16.12.0",
    "stylelint-config-standard": "^36.0.1"
  }
}
```

**tsconfig.json**  -  NO experimentalDecorators:
```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "node",
    "skipLibCheck": true,
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "importHelpers": true,
    "sourceMap": true
  },
  "include": ["src"],
  "files": ["src/resource.d.ts"]
}
```

**vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    open: !process.env.CI,
    port: 9000,
  },
  esbuild: { target: 'es2022' },
  plugins: [
    aurelia({ useDev: true }),
    tailwindcss(),
  ],
});
```

For a plain Aurelia 2 + Vite app, prefer the minimal config above. Only add extra Vite plugins when the repo already uses them or the spec requires them.

**index.html**  -  Vite-style with direct TS module import:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>My App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <my-app></my-app>
</body>
</html>
```

**src/resource.d.ts**  -  Required for TypeScript HTML/CSS module support:
```typescript
declare module '*.html' {
  import { IContainer, PartialBindableDefinition } from 'aurelia';
  export const name: string;
  export const template: string;
  export default template;
  export const dependencies: string[];
  export const containerless: boolean | undefined;
  export const bindables: Record<string, PartialBindableDefinition>;
  export const shadowOptions: { mode: 'open' | 'closed' } | undefined;
  export function register(container: IContainer): void;
}

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.css';
```

## Application Bootstrap

**src/main.ts**:
```typescript
import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import './styles/app.css'; // Tailwind entry point

Aurelia
  .register(RouterConfiguration.customize({ useUrlFragmentHash: false, useHref: false }))
  .app(MyApp)
  .start();
```

### SVG Support

SVG element attribute bindings (e.g. `cx`, `cy`, `d`, `viewBox`) require registering `SVGAnalyzer`. Without it, Aurelia does not know how to handle SVG-specific attributes and bindings will silently fail.

```typescript
import { SVGAnalyzer } from '@aurelia/runtime-html';

Aurelia
  .register(SVGAnalyzer)
  // ...other registrations
```

**Always register `SVGAnalyzer` if the app uses SVG with bindings.** This is a one-time registration in `main.ts`.

### Global Component/Resource Registration

Register components, value converters, binding behaviors, or custom attributes globally in `main.ts` so they are available everywhere without `<import>` tags:

```typescript
import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { DateFormatValueConverter } from './resources/date-format';
import { LoadingSpinner } from './components/loading-spinner';
import './styles/app.css';

Aurelia
  .register(
    RouterConfiguration.customize({ useUrlFragmentHash: false, useHref: false }),
    DateFormatValueConverter,
    LoadingSpinner,
  )
  .app(MyApp)
  .start();
```

You can also register an entire module of exports at once:
```typescript
import * as GlobalComponents from './components';
Aurelia.register(GlobalComponents).app(MyApp).start();
```

## Server-Side Rendering and Prerendering

When adding SSR, prerendering, SEO rendering, sitemap/robots generation, preboot input capture, or fixing client takeover/hydration issues, use `aurelia2-ssr`.

Before making changes, read `references/ssr.md`. It contains the implementation workflow, file patterns, edge cases, and verification checklist for:

- `renderAureliaToString(...)`
- `buildSsrDocument(...)`
- `createSsrRouterRegistrations(...)`
- `prepareSsrHostForTakeover(...)`
- `finishSsrTakeover()`
- `hydrateAureliaSsr(...)` when a core-compatible manifest is available
- SEO route config, Vite manifest assets, preboot, Shadow DOM serialization, browser globals, diagnostics, sitemap, and robots output

Default to prerender plus `mode: 'remount'` takeover unless the app already has a matching Aurelia SSR manifest and AOT-ready definitions. Do not use `mode: 'hydrate'` just because server HTML exists. True hydration requires matching marker comments, an `ISSRScope` tree, and compatible component definitions.

When adding remount takeover, preserve the browser app's existing `.app(...)` startup form. If a router app currently starts with `.app(MyApp)`, do not switch it to `.app({ host, component: MyApp })`; clear/check the SSR host with `prepareSsrHostForTakeover(...)`, then start with the same root-component boot shape and call `finishSsrTakeover()` after startup.

After adding SSR, verify:

- `npm run build` or the repo's equivalent SSR build command passes.
- Generated HTML contains exactly one app host, e.g. one `<my-app>`.
- The document has `data-aurelia-ssr-prerendered` before takeover and `data-aurelia-taken-over` after client startup.
- Top-level navigation, mobile navigation, route data loading, and other event handlers work after takeover in a real browser.
- Route HTML contains meaningful `<title>`, meta description, canonical URL, and one useful `h1`.
- `sitemap.xml`, `robots.txt`, and any SSR diagnostics/report files are generated when configured.
- For Fastify-hosted SSR/SPAs, scanner-style requests such as `POST /` and `POST /login` return 404s without process errors. Async fallback or not-found handlers must `return reply.code(...).send(...)`; do not send a reply and then let the handler continue.

## Routing

Use the `@route` decorator on the root component with **dynamic `import()`** for lazy loading:

```typescript
import { route } from '@aurelia/router';

@route({
  routes: [
    {
      path: ['', 'home'],
      component: import('./routes/home/home'),
      title: 'Home',
    },
    {
      path: 'about',
      component: import('./routes/about/about'),
      title: 'About',
    },
    {
      path: 'product/:id',
      component: import('./routes/product/product'),
      title: 'Product',
    },
    {
      path: 'product/:id?',
      component: import('./routes/product/product'),
      title: 'Product',
    },
    {
      path: 'files/*path',
      component: import('./routes/files/files'),
      title: 'Files',
    },
    { path: 'not-found', component: import('./routes/not-found/not-found'), title: 'Not Found' },
    // In scoped/nested routing contexts, this is more reliable than fallback-only handling.
    { path: '*path', component: import('./routes/not-found/not-found'), title: 'Not Found' },
  ],
})
export class MyApp {}
```

### Route Parameter Types

- **Required:** `path: 'product/:id'`  -  must be provided
- **Optional:** `path: 'product/:id?'`  -  can be omitted
- **Wildcard:** `path: 'files/*path'`  -  captures everything after
- **Constrained:** `path: 'product/:id{{^\\d+$}}'`  -  must match regex
- **Multiple paths:** `path: ['', 'home']`  -  matches either

### Route Configuration Options

- `redirectTo`  -  redirect to another route path
- `fallback`  -  component/path for unmatched routes (optional; prefer explicit `*path` route in scoped/nested routing contexts)
- `data`  -  arbitrary metadata (e.g. `{ requiresAuth: true }`)
- `caseSensitive`  -  whether path matching is case-sensitive
- `id`  -  unique route identifier for programmatic use

### Navigation in Templates

Aurelia provides two ways to navigate in templates: the `load` attribute and standard `href`. The `load` attribute is the more fully featured option, supporting parameter binding and route names. Plain `href` also works and is fine for simple cases. Both receive the `active` CSS class when their route is active.

For top-level app navigation when scoped/nested routing may be active, force root-context resolution with `context.bind: null`.

```html
<!-- load attribute (recommended, more features) -->
<a load="route: home; context.bind: null">Home</a>
<a load="route: product/42; context.bind: null">View Product</a>
<a load="route: product/${productId}; context.bind: null">Dynamic Product</a>
<a load="../details">Relative route (intentional scoped navigation)</a>

<!-- Plain href also works for simple navigation -->
<a href="home">Home</a>
<a href="about">About</a>

<!-- External links are auto-detected by the router. For edge cases, use the external attr -->
<a href="https://example.com">External (auto-detected)</a>
<a href="/api/download" external>API endpoint (forced external)</a>

<!-- The router automatically adds an "active" CSS class to active route links -->
<au-viewport></au-viewport>
```

### Programmatic Navigation

```typescript
import { resolve } from 'aurelia';
import { IRouter } from '@aurelia/router';

export class MyComponent {
  private router = resolve(IRouter);

  async goToProduct(id: number) {
    await this.router.load(`/product/${id}`);
  }

  async goWithOptions() {
    await this.router.load('product', {
      parameters: { id: '42' },
      title: 'Product 42',
    });
  }
}
```

### Route Lifecycle Hooks

Routed components can implement `IRouteViewModel` for route-specific lifecycle hooks. These are separate from component lifecycles:

```typescript
import { IRouteViewModel, Params, RouteNode } from '@aurelia/router';

export class ProductDetail implements IRouteViewModel {
  product: any;

  // Guard: can we load this route? Return false or a redirect path to prevent.
  async canLoad(params: Params, next: RouteNode, current: RouteNode | null) {
    this.product = await this.api.getProduct(params.id);
    if (!this.product) {
      return '/not-found'; // redirect
    }
    return true;
  }

  // Load data after canLoad passes. View renders even if this is still loading.
  async loading(params: Params, next: RouteNode, current: RouteNode | null) {
    this.relatedProducts = await this.api.getRelated(params.id);
  }

  // Runs after the component is fully loaded and activated. Good for analytics,
  // scroll restoration, or post-load side effects.
  loaded(params: Params) {
    analytics.track('page_view', { page: 'product', id: params.id });
    window.scrollTo(0, 0);
  }

  // Guard: can the user leave? Good for unsaved changes warnings.
  canUnload(next: RouteNode | null, current: RouteNode): boolean | Promise<boolean> {
    if (this.hasUnsavedChanges) {
      return confirm('You have unsaved changes. Leave?');
    }
    return true;
  }

  // Cleanup when navigating away.
  unloading(next: RouteNode | null, current: RouteNode): void {
    this.cleanup();
  }
}
```

**Route lifecycle order:** `canLoad` -> `loading` -> `loaded` -> (user navigates away) -> `canUnload` -> `unloading`

**When to use each hook:**
- `canLoad` -- the page is useless without the data (blocks rendering). Can redirect or deny.
- `loading` -- you want the view to appear immediately and load secondary data in the background.
- `loaded` -- component is fully active. Use for analytics, scroll position, post-load effects.
- `canUnload` -- prompt the user before leaving (unsaved changes, confirmations).
- `unloading` -- teardown and cleanup before navigating away.

### Accessing Current Route Info

```typescript
import { resolve } from '@aurelia/kernel';
import { ICurrentRoute } from '@aurelia/router';

export class MyComponent {
  private currentRoute = resolve(ICurrentRoute);

  logRoute() {
    console.log(this.currentRoute.path);
    console.log(this.currentRoute.parameterInformation);
  }
}
```

### Reading Query Parameters

Inside `canLoad` or `loading`, access query params from the `next` RouteNode:
```typescript
canLoad(params: Params, next: RouteNode) {
  const foo = next.queryParams.get('foo'); // /product/42?foo=bar
  return true;
}
```

## Component Patterns

### Convention-Based Components
Aurelia 2 uses convention: `my-component.ts` + `my-component.html` are automatically paired.

**my-component.ts**:
```typescript
import { bindable } from 'aurelia';

export class MyComponent {
  @bindable label = '';
  @bindable count = 0;
}
```

**my-component.html**:
```html
<div class="p-4">
  <span>${label}: ${count}</span>
</div>
```

### Using Components in Templates

Components must be made available before use. Three ways to do this:

**1. `<import>` tag (local, per-template):**
```html
<import from="./components/my-component"></import>
<my-component label="Hello" count="5"></my-component>
```

**2. `dependencies` array on `@customElement` (local, per-component):**
```typescript
import { customElement } from 'aurelia';
import { MyComponent } from './components/my-component';

@customElement({
  name: 'parent-widget',
  dependencies: [MyComponent],
})
export class ParentWidget {}
```

**3. Global registration in `main.ts`** (see Application Bootstrap section).

### HTML-Only Components

Create simple components with just an HTML file (no TypeScript needed):

**status-badge.html**:
```html
<bindable name="status"></bindable>
<bindable name="message"></bindable>
<span class="badge badge-${status}">${message}</span>
```

Usage:
```html
<import from="./status-badge.html"></import>
<status-badge status="success" message="Complete"></status-badge>
```

### Explicit Component Definition with `@customElement`

```typescript
import { customElement } from 'aurelia';

@customElement({
  name: 'user-card',
  template: `
    <div class="user-card">
      <h3>\${name}</h3>
      <p>\${email}</p>
    </div>
  `,
})
export class UserCard {
  name = 'John Doe';
  email = '[email protected]';
}
```

### Dependency Injection
Always use `resolve()`:
```typescript
import { resolve } from 'aurelia';
import { MyService } from '../services/my-service';

export class MyComponent {
  private myService: MyService = resolve(MyService);
}
```

### Component Lifecycle Hooks

Full lifecycle order: `constructor` -> `define` -> `hydrating` -> `hydrated` -> `created` -> `binding` -> `bound` -> `attaching` -> `attached` -> `detaching` -> `unbinding` -> `dispose`

All hooks are optional. Implement only what you need. Hooks like `binding`/`unbinding` and `attaching`/`detaching` are typically used in pairs for setup/cleanup.

```typescript
export class MyComponent {
  // constructor  -  inject services, basic setup
  constructor() {}

  // created  -  component fully constructed, children resolved. Runs once.
  created() {}

  // binding  -  bindable properties assigned, but view bindings not yet connected.
  //           Runs parent -> child. Return a Promise to block children.
  binding() {}

  // bound  -  view bindings active; ref, let, and from-view values available.
  //         Runs parent -> child.
  bound() {}

  // attaching  -  DOM insertion starting. Runs parent -> child.
  attaching() {}

  // attached  -  component and all children are in the DOM. Safe for DOM APIs.
  //            Runs child -> parent.
  attached() {}

  // detaching  -  before removal from DOM. Clean up DOM listeners, 3rd-party libs.
  //             Runs parent -> child.
  detaching() {}

  // unbinding  -  bindings disconnected. Clean up subscriptions.
  //             Runs child -> parent.
  unbinding() {}

  // dispose  -  permanent teardown (removed from repeater, app shutdown).
  //           Prevent memory leaks here.
  dispose() {}
}
```

**Key guidance:**
- Use `attached()` for DOM-dependent work (3rd-party library init, measuring elements).
- Use `detaching()` to tear down what you set up in `attached()`.
- Use `binding()` for async data loading that should block rendering (return a Promise).
- Use `bound()` when you need `ref` values or from-view bindings.
- Use `unbinding()` to dispose subscriptions set up in `binding()` or `bound()`.

### Bindable Properties

```typescript
import { bindable, BindingMode } from 'aurelia';

export class UserCard {
  @bindable user: any;
  @bindable isActive = false;

  // Explicit two-way binding mode
  @bindable({ mode: BindingMode.twoWay }) selectedId = '';

  // Change callback  -  convention: propertyName + "Changed"
  userChanged(newUser: any, oldUser: any) {
    console.log('User changed:', newUser);
  }

  isActiveChanged(newValue: boolean, oldValue: boolean) {
    console.log('Active changed:', newValue);
  }
}
```

Usage in templates:
```html
<user-card
  user.bind="currentUser"
  is-active.bind="userIsActive"
  selected-id.two-way="selectedUserId">
</user-card>
```

Note: bindable property names use camelCase in TypeScript but kebab-case in HTML attributes.

## Template Syntax

### Event Binding  -  Always `.trigger`
```html
<button click.trigger="handleClick()">Click</button>
<input input.trigger="onInput($event)">
<form submit.trigger="onSubmit()">
```

### Property Binding & Binding Modes
```html
<!-- .bind  -  auto-detects mode (two-way on form elements, to-view otherwise) -->
<input value.bind="name">
<div class.bind="isActive ? 'active' : ''">

<!-- Explicit binding modes -->
<input value.two-way="name">
<span textcontent.to-view="message"></span>
<span>${count | numberFormat}</span>
<input value.one-time="initialValue">
<custom-el value.from-view="outputValue"></custom-el>
```

### Conditional Rendering
```html
<!-- if.bind removes/adds DOM elements -->
<div if.bind="showContent">Conditional content</div>
<div else>Fallback content</div>

<!-- show.bind toggles visibility (keeps element in DOM) -->
<div show.bind="isVisible">Shown or hidden via CSS</div>

<!-- switch (template controller) -->
<template switch.bind="status">
  <span case="active">Active</span>
  <span case="inactive">Inactive</span>
  <span default-case>Unknown</span>
</template>
```

### List Rendering
```html
<div repeat.for="item of items">${item.name}</div>

<!-- With index -->
<div repeat.for="item of items">
  ${$index}: ${item.name}
</div>

<!-- Keyed rendering for performance -->
<div repeat.for="item of items" key="id">${item.name}</div>
```

### Lambda Expressions in Templates
```html
<!-- Filter and sort directly in templates -->
<ul>
  <li repeat.for="user of users.filter(u => u.isActive)">
    ${user.name}
  </li>
</ul>

<!-- Sort -->
<li repeat.for="item of items.sort((a, b) => a.name.localeCompare(b.name))">
  ${item.name}
</li>
```

### Template References (`ref`)
```html
<input type="text" ref="nameInput" placeholder="Enter name">
<canvas ref="myCanvas"></canvas>
```

```typescript
export class MyComponent {
  nameInput: HTMLInputElement;  // Type it explicitly
  myCanvas: HTMLCanvasElement;

  // Refs are available from bound() onward (NOT in constructor or binding)
  bound() {
    console.log(this.nameInput); // HTMLInputElement
  }

  attached() {
    // Best place for DOM operations
    this.nameInput.focus();
  }
}
```

For custom element references:
```html
<!-- Get the view-model instance -->
<my-widget component.ref="widgetVm"></my-widget>

<!-- Get the Aurelia controller (advanced) -->
<my-widget controller.ref="widgetController"></my-widget>
```

### Template Variables (`<let>`)
```html
<!-- Declare variables directly in templates -->
<let full-name="${firstName} ${lastName}"></let>
<p>${fullName}</p>

<!-- Bind to view-model properties -->
<let total.bind="price * quantity"></let>
<p>Total: ${total}</p>
```

Note: Variable names use kebab-case in the `<let>` element but camelCase when referenced (`full-name` becomes `fullName`).

### CSS Class Binding
```html
<!-- Conditional class (individual) -->
<div active.class="isActive">Toggle active class</div>
<div loading.class="isLoading">Toggle loading class</div>

<!-- Expression-based -->
<div class="${isActive ? 'active' : 'inactive'}">Interpolated</div>
<div class.bind="computedClasses">Bound</div>
```

### Style Binding
```html
<div style="color: ${textColor}">Interpolated</div>
<div style.bind="styleObject">Bound</div>
```

### Content Projection with `<au-slot>`

Use `<au-slot>` for content projection (NOT native `<slot>` unless using Shadow DOM):

**card.html:**
```html
<div class="card">
  <div class="card-header">
    <au-slot name="header">
      <h3>Default Header</h3>
    </au-slot>
  </div>
  <div class="card-body">
    <au-slot>
      Default body content
    </au-slot>
  </div>
</div>
```

Usage:
```html
<card>
  <span au-slot="header">Custom Header</span>
  <p>Custom body content goes in the default slot</p>
</card>
```

### Attribute Binding (`& attr`)

Use `& attr` when you need to bind to the HTML attribute rather than the DOM property (useful for ARIA attributes, custom attributes, non-standard attributes):

```html
<div aria-busy.bind="isLoading & attr"></div>
<div data-id.bind="itemId & attr"></div>
```

## Value Converters

Value converters transform data in template bindings. They use the pipe `|` syntax.

```typescript
import { valueConverter } from 'aurelia';

@valueConverter('currency')
export class CurrencyValueConverter {
  toView(value: number, currencyCode = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  }

  // Optional: transform user input back to model value
  fromView(value: string): number {
    return parseFloat(value.replace(/[^0-9.-]+/g, ''));
  }
}
```

Usage in templates:
```html
<!-- Import locally -->
<import from="./converters/currency"></import>
<span>${price | currency}</span>
<span>${price | currency:'EUR':'de-DE'}</span>

<!-- Chaining converters -->
<span>${amount | currency | uppercase}</span>
```

Register globally in `main.ts` to avoid `<import>` everywhere.

## Binding Behaviors

Binding behaviors modify how bindings work at runtime. Use the `&` syntax.

```html
<!-- Debounce input (default 200ms) -->
<input value.bind="search & debounce">
<input value.bind="search & debounce:500">

<!-- Throttle updates -->
<input value.bind="data & throttle:300">

<!-- Signal-based refresh -->
<span>${price | currency & signal:'refresh-prices'}</span>

<!-- Force binding mode -->
<input value.bind="name & oneTime">
<input value.bind="name & twoWay">
<input value.bind="name & toView">
<input value.bind="name & fromView">

<!-- Bind to attribute instead of property -->
<div data-value.bind="val & attr">
```

## Observation and Reactivity

### `@watch` Decorator

React to property changes with automatic dependency tracking:

```typescript
import { watch } from '@aurelia/runtime-html';

export class UserProfile {
  firstName = 'John';
  lastName = 'Doe';

  @watch('firstName')
  firstNameChanged(newValue: string, oldValue: string) {
    console.log(`First name: ${oldValue} -> ${newValue}`);
  }

  // Watch a computed expression with a function
  @watch(vm => `${vm.firstName} ${vm.lastName}`)
  fullNameChanged(newFullName: string) {
    console.log('Full name is now:', newFullName);
  }
}
```

Watchers activate after binding and deactivate before unbinding.

### `@observable` Decorator

Similar to `@bindable` change callbacks, but for internal (non-bound) properties:

```typescript
import { observable } from 'aurelia';

export class Car {
  @observable color = 'blue';

  // Convention: propertyName + "Changed"
  colorChanged(newValue: string, oldValue: string) {
    console.log(`Color changed: ${oldValue} -> ${newValue}`);
  }
}
```

The callback only fires when the value actually changes (no duplicate calls for same value).

## Event Aggregator

Lightweight pub/sub for cross-component communication:

```typescript
import { IEventAggregator, resolve } from 'aurelia';

export class Publisher {
  private ea = resolve(IEventAggregator);

  save() {
    this.ea.publish('item:saved', { id: 1 });
  }
}

export class Subscriber {
  private ea = resolve(IEventAggregator);
  private subscription: any;

  bound() {
    this.subscription = this.ea.subscribe('item:saved', (payload: any) => {
      console.log('Item saved:', payload);
    });
  }

  unbinding() {
    this.subscription.dispose(); // Always dispose to prevent memory leaks
  }
}
```

Type-safe events with classes:
```typescript
export class UserSaved {
  constructor(public readonly userId: string) {}
}

// Publishing
this.ea.publish(new UserSaved('abc'));

// Subscribing
this.ea.subscribe(UserSaved, ({ userId }) => {
  console.log('User saved:', userId);
});
```

## Dependency Injection (Advanced Patterns)

### Creating Interfaces

```typescript
import { DI } from '@aurelia/kernel';

export interface IApiService {
  get(url: string): Promise<any>;
}

export const IApiService = DI.createInterface<IApiService>('IApiService', x =>
  x.singleton(ApiService)
);

export class ApiService implements IApiService {
  async get(url: string) { /* ... */ }
}
```

### Registration Types

```typescript
import { Registration } from '@aurelia/kernel';

// Singleton  -  one instance shared across the container
Registration.singleton(IApiService, ApiService);

// Transient  -  new instance per injection
Registration.transient(IApiService, ApiService);

// Instance  -  use a pre-created instance
Registration.instance(IApiService, myApiInstance);

// Callback  -  factory function called each time
Registration.callback(IApiService, container => new ApiService(container.get(ILogger)));

// CachedCallback  -  factory called once, then cached
Registration.cachedCallback(IApiService, container => new ApiService());
```

### Resolve Modifiers

```typescript
import { resolve, all, lazy, newInstanceOf } from 'aurelia';

export class MyComponent {
  // Resolve all registered implementations of an interface
  private plugins: IPlugin[] = resolve(all(IPlugin));

  // Lazy resolution (factory function)
  private getService: () => IService = resolve(lazy(IService));

  // New isolated instance (not the shared singleton)
  private privateEa = resolve(newInstanceOf(IEventAggregator));
}
```

## Custom Attributes

Create reusable behavior that can be applied to any element:

```typescript
import { customAttribute, INode, bindable } from 'aurelia';
import { resolve } from '@aurelia/kernel';

@customAttribute('tooltip')
export class TooltipCustomAttribute {
  @bindable text = '';

  private element: HTMLElement = resolve(INode) as HTMLElement;

  attached() {
    this.element.title = this.text;
  }

  textChanged(newValue: string) {
    this.element.title = newValue;
  }
}
```

Usage:
```html
<import from="./attributes/tooltip"></import>
<button tooltip="Click to save">Save</button>
<button tooltip.bind="dynamicTooltip">Dynamic</button>
```

## Tailwind CSS v4 Setup

Use `@import "tailwindcss"` and `@theme` in your CSS entry point:

```css
@import "tailwindcss";

@theme {
  --color-primary: #your-color;
  --font-sans: 'Inter', sans-serif;
}
```

Tailwind v4 uses the `@tailwindcss/vite` plugin  -  no PostCSS config needed.

## Testing Setup

**vitest.config.ts**:
```typescript
import { fileURLToPath } from "node:url";
import { mergeConfig, defineConfig, configDefaults } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      watch: false,
      exclude: [...configDefaults.exclude, "e2e/*"],
      root: fileURLToPath(new URL("./", import.meta.url)),
      setupFiles: ["./test/setup.ts"]
    },
  }),
);
```

**test/setup.ts**:
```typescript
import { BrowserPlatform } from '@aurelia/platform-browser';
import { setPlatform, onFixtureCreated, type IFixture } from '@aurelia/testing';
import { beforeAll, beforeEach, afterEach } from 'vitest';

// Node 22+ ships an experimental `globalThis.localStorage` without `clear()`.
// Provide a full Storage polyfill so tests can call `localStorage.clear()`.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  [name: string]: any;
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true, configurable: true });
}

function bootstrapTestEnv() {
  const platform = new BrowserPlatform(window);
  setPlatform(platform);
  BrowserPlatform.set(globalThis, platform);
}

const fixtures: IFixture<object>[] = [];
beforeAll(() => {
  bootstrapTestEnv();
  onFixtureCreated(fixture => { fixtures.push(fixture); });
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  for (const f of fixtures) {
    try { await f.stop(true); } catch { /* ignore */ }
  }
  fixtures.length = 0;
});
```

**Example test** — use `appHost` (not `host`) for DOM queries:
```typescript
import { describe, it, expect } from 'vitest';
import { createFixture } from '@aurelia/testing';
import { MyComponent } from '../src/components/my-component';

describe('my-component', () => {
  it('should render', async () => {
    const { appHost, assertText } = await createFixture(
      '<my-component label="Test" count="5"></my-component>',
      {},
      [MyComponent],
    ).started;

    // assertText for simple text checks
    assertText('Test: 5', { compact: true });

    // appHost for DOM queries
    expect(appHost.querySelector('my-component')).not.toBeNull();
  });
});
```

### Testing with Mocked Dependencies

Use the 4th argument of `createFixture` to register mock services:
```typescript
import { createFixture } from '@aurelia/testing';
import { Registration } from 'aurelia';
import { MyComponent } from '../src/components/my-component';
import { IApiService } from '../src/services/api-service';

it('renders with mocked service', async () => {
  const mockApi = { get: vi.fn().mockResolvedValue({ name: 'Test' }) };

  const { appHost, assertText } = await createFixture(
    '<my-component></my-component>',
    {},
    [MyComponent],
    [Registration.instance(IApiService, mockApi)],
  ).started;

  assertText('Test', { compact: true });
  expect(appHost.querySelector('.result')).not.toBeNull();
});
```

### Accessing Component ViewModels in Tests

Use `CustomElement.for()` to access a component's viewmodel for method calls:
```typescript
import { CustomElement } from 'aurelia';
import { MyComponent } from '../src/components/my-component';

it('calls a method on the viewmodel', async () => {
  const { appHost, container } = await createFixture(
    '<my-component></my-component>',
    {},
    [MyComponent],
  ).started;

  const el = appHost.querySelector('my-component')!;
  const vm = CustomElement.for<MyComponent>(el).viewModel;
  vm.someMethod();

  const settings = container.get(SettingsService);
  expect(settings.getSomeValue()).toBe('expected');
});
```

## Storybook Setup

**.storybook/main.ts**:
```typescript
import type { StorybookConfig } from 'storybook/internal/types';
import { mergeConfig, type InlineConfig } from 'vite';

const config: StorybookConfig & { viteFinal?: (config: InlineConfig) => InlineConfig | Promise<InlineConfig> } = {
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx|mdx)'],
  addons: ['@storybook/addon-links'],
  framework: { name: '@aurelia/storybook', options: {} },
  core: { builder: '@storybook/builder-vite' },
  viteFinal: async (viteConfig) => {
    viteConfig.optimizeDeps = viteConfig.optimizeDeps || {};
    viteConfig.optimizeDeps.exclude = viteConfig.optimizeDeps.exclude || [];
    if (!viteConfig.optimizeDeps.exclude.includes('@aurelia/runtime-html')) {
      viteConfig.optimizeDeps.exclude.push('@aurelia/runtime-html');
    }
    return mergeConfig(viteConfig, {});
  },
};
export default config;
```

**.storybook/preview.ts**:
```typescript
export { render, renderToCanvas } from '@aurelia/storybook';
```

## Common Mistakes to Avoid

1. **Do NOT use `.delegate`**  -  It's removed. Use `.trigger`.
2. **Do NOT use `@autoinject`**  -  It's removed. Use `resolve()`.
3. **Do NOT set `experimentalDecorators: true`**  -  Aurelia 2 uses TC39 decorators.
4. **Do NOT use webpack**  -  Use Vite with `@aurelia/vite-plugin`.
5. **Do NOT use PostCSS for Tailwind**  -  Use `@tailwindcss/vite` plugin directly.
6. **Do NOT use `@inject` on constructor params**  -  TC39 decorators don't support parameter decorators. Use `resolve()` as a class field initializer instead.
7. **Do NOT wrap templates in `<template>`** unless needed  -  it's optional in Aurelia 2.
8. **Do NOT use `static routes`** on the component class for routing  -  Use the `@route` decorator.
9. **Do NOT import routes eagerly**  -  Use dynamic `import()` for lazy loading in route config.
10. **Do NOT use `<slot>`** without Shadow DOM  -  Use `<au-slot>` for content projection in light DOM.
11. **Do NOT forget to dispose subscriptions**  -  Always clean up EventAggregator subscriptions and observers in `unbinding()` or `detaching()`.
12. **Do NOT forget `<import>`**  -  Components must be imported locally, registered in `dependencies`, or registered globally in `main.ts` before use.
13. **Do NOT use `bind()` / `unbind()` / `attached()` / `detached()`** as Aurelia 1 hook names - The v2 hooks are `binding()`, `unbinding()`, `attached()`, `detaching()`.
14. **Do NOT use SVG bindings without `SVGAnalyzer`**  -  SVG attribute bindings (`cx`, `cy`, `d`, etc.) require `SVGAnalyzer` from `@aurelia/runtime-html` to be registered in `main.ts`. Without it, bindings silently fail.
15. **Do NOT name class properties with the same name as lifecycle methods** - Aurelia 2 has both component lifecycle hooks (`binding`, `bound`, `attaching`, `attached`, `detaching`, `unbinding`) and route lifecycle hooks (`canLoad`, `loading`, `loaded`, `canUnload`, `unloading`). If you define a class property with the same name (e.g. `loading = true`), it **overwrites** the lifecycle method and Aurelia will never call it. This is an extremely common mistake with the `loading` route lifecycle hook. Use a different name like `isLoading` instead.

```typescript
// WRONG  -  property overwrites the route lifecycle method, Aurelia never calls it
export class Markets implements IRouteViewModel {
  loading = true;  // This shadows the lifecycle hook!
  async loading(params: Params) { ... }  // Never called!
}

// CORRECT  -  use a different property name
export class Markets implements IRouteViewModel {
  isLoading = true;
  async loading(params: Params) { ... }  // Works correctly
}
```

## Working with Existing Aurelia 2 Codebases

When reviewing, refactoring, or extending an existing Aurelia 2 project, check for the following patterns and steer toward best practices.

### Code Review Checklist

**DI and services:**
- Prefer `resolve()` class field initializer over `static inject` + constructor. Both work, but `resolve()` is more concise and avoids parameter ordering bugs.
- Verify services that should be singletons are registered as singletons (not accidentally transient).
- Check for `resolve()` calls inside methods (should only be used at class field level or constructor time, not at runtime).

**Templates:**
- Confirm `.trigger` is used, never `.delegate`.
- Look for missing `<import>` tags when components, value converters, or custom attributes are used but not registered globally.
- Check that `<au-slot>` is used for content projection in light DOM (not native `<slot>` unless Shadow DOM is enabled).
- Verify `ref` values are only accessed from `bound()` onward, never in `constructor` or `binding()`.
- Look for `show.bind` vs `if.bind` usage. Use `if.bind` when the element can be fully removed for performance. Use `show.bind` when you need to preserve component state or avoid re-initialization.

**Routing:**
- Verify route components implement `IRouteViewModel` to get proper TypeScript intellisense for `canLoad`, `loading`, `loaded`, `canUnload`, `unloading`.
- Check that routes use dynamic `import()` for lazy loading, not eager imports.
- Look for data fetching in component lifecycle hooks (`attached`, `binding`) that should be in route lifecycle hooks (`canLoad`, `loading`) instead.
- Verify `canUnload` is implemented for pages with forms or unsaved state.
- **Check for property/lifecycle name collisions**: A class property named `loading`, `bound`, `attached`, etc. will shadow the lifecycle method and prevent Aurelia from calling it. Common trap: `loading = true` as a boolean property overwrites the `loading()` route lifecycle hook. Use `isLoading` instead.

**Observation and state:**
- Check for manual DOM manipulation that could be replaced with bindings.
- Verify `@observable` or `@watch` is used instead of manual setInterval/polling for reactive updates.
- Look for EventAggregator subscriptions without matching `dispose()` calls in `unbinding()`.
- Check for array mutations using methods that Aurelia can observe (`.push()`, `.splice()`, `.pop()`, etc.) rather than direct index assignment (`arr[0] = x`), which is not observable without `@observable`.

**Lifecycle management:**
- Every `attached()` should have a corresponding `detaching()` for cleanup.
- Every `binding()`/`bound()` subscription should have a corresponding `unbinding()` disposal.
- Watch for 3rd-party library initialization in `binding()` or `bound()` that should be in `attached()` (DOM is not ready until `attached()`).
- Look for async work in `attached()` that should return a Promise from `binding()` or `attaching()` instead (to block rendering until ready).

**Performance:**
- Large lists should use `key` attribute on `repeat.for` for efficient DOM recycling.
- Heavy components behind conditional rendering should use `if.bind` (removes from DOM) rather than `show.bind` (keeps in DOM).
- Check for unnecessary two-way bindings on display-only data (use `.to-view` or `.one-time` where appropriate).
- Verify lazy loading is used for routes and heavy dependencies.

### Migrating Aurelia 1 Patterns

If the codebase has remnants of Aurelia 1 patterns (common during migration), look for and fix:

- `.delegate` -> `.trigger`
- `@autoinject` / `@inject` on constructor params -> `resolve()` class fields
- `bind()` / `unbind()` lifecycle hooks -> `binding()` / `unbinding()`
- `detached()` -> `detaching()`
- `activate()` / `deactivate()` router hooks -> `canLoad()` / `loading()` / `canUnload()` / `unloading()`
- `<slot>` in light DOM -> `<au-slot>`
- `<compose>` -> `<au-compose>`
- `PLATFORM.moduleName()` -> direct `import()` calls
- `experimentalDecorators: true` in tsconfig -> remove it
- `<require from="...">` -> `<import from="...">`
