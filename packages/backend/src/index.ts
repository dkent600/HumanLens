import { buildContainer } from './composition-root.js';
import { buildServer } from './server.js';

// Entry point: wire the container, build the server, listen.
const container = buildContainer();
const app = await buildServer(container);

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
console.log(`Human Lens backend listening on http://localhost:${port} (docs at /docs)`);
