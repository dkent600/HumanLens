---
name: aurelia2-ex
description: Project-specific Aurelia 2 conventions for Human Lens that EXTEND (not replace) the vendored aurelia2 skill. Use alongside aurelia2 whenever writing or reviewing frontend (@humanlens/frontend) code. Currently covers application logging via ILogger instead of console.log.
---

# Aurelia 2 — Human Lens project extensions

Project-specific deltas layered on top of the **aurelia2** skill. The aurelia2
skill remains authoritative on framework usage; this skill records only the
conventions this project adds, so the vendored skill is never edited or forked.

## Logging — use `ILogger`, not `console.log`

Application logging goes through Aurelia's built-in **`ILogger`**, not
`console.log`. It is DI-resolvable, supports log levels and scoped child
loggers, and can be routed to custom sinks. (The aurelia2 skill omits logging
and uses `console.log` in its examples; for this project `ILogger` is the
standard.)

Configure logging once in `src/main.ts` with `LoggerConfiguration`:

```typescript
import Aurelia from 'aurelia';
import { LoggerConfiguration, LogLevel, ConsoleSink } from '@aurelia/kernel';
import { MyApp } from './my-app';

Aurelia
  .register(
    LoggerConfiguration.create({
      level: LogLevel.debug, // raise to LogLevel.warn in production
      sinks: [ConsoleSink],
    }),
  )
  .app(MyApp)
  .start();
```

Resolve it as a class field, and prefer a scoped child logger per component or
service so output is attributable:

```typescript
import { resolve } from 'aurelia';
import { ILogger } from '@aurelia/kernel';

export class IntakeForm {
  private readonly log = resolve(ILogger).scopeTo('IntakeForm');

  submit() {
    this.log.debug('submitting intake');
    try {
      // ...
    } catch (err) {
      this.log.error('intake submit failed', err);
    }
  }
}
```

Guidance:
- Do **not** use `console.log`/`console.error` for application logging — use
  `ILogger` (`trace`/`debug`/`info`/`warn`/`error`/`fatal`).
- Always `scopeTo(...)` so log lines carry their origin.
- Set verbosity via `LoggerConfiguration` level, not by commenting calls in/out.

See https://docs.aurelia.io for the current `LoggerConfiguration` / `ILogger` API.
