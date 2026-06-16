import { describe, it, expect } from 'vitest';
import { createFixture } from '@aurelia/testing';
import { MyApp } from '../src/my-app';
// my-app's @route config eagerly kicks off import() of these route modules.
// Import them statically here so they evaluate while the jsdom environment is
// alive — otherwise they resolve after teardown and throw "document is not
// defined".
import '../src/welcome-page';
import '../src/about-page';

describe('my-app', () => {
  it('renders the navigation links', async () => {
    const { appHost } = await createFixture(
      '<my-app></my-app>',
      {},
      [MyApp],
    ).started;

    const links = Array.from(appHost.querySelectorAll('nav a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(links).toContain('Welcome');
    expect(links).toContain('About');
  });
});
