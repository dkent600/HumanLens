import Aurelia, { Registration } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { LoggerConfiguration, LogLevel, ConsoleSink } from '@aurelia/kernel';
import { MyApp } from './my-app';
import { IBriefApi, AxiosBriefApi } from './seams/brief-api';
import { BriefStore } from './stores/brief-store';
import { SupportTextValueConverter } from './resources/support-text';

Aurelia
  .register(
    RouterConfiguration,
    // Application logging goes through ILogger (project convention), not console.log.
    LoggerConfiguration.create({ level: LogLevel.debug, sinks: [ConsoleSink] }),
    // The Service seam (interface token) + its Axios implementation, and the Store
    // (concrete singleton). Wired here in the composition root.
    Registration.singleton(IBriefApi, AxiosBriefApi),
    Registration.singleton(BriefStore, BriefStore),
    // Global resources so templates can use them without per-template <import>.
    SupportTextValueConverter,
  )
  .app(MyApp)
  .start();
