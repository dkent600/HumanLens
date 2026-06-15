// @humanlens/backend — the server-side package.
//
// Holds two layers that must stay separated by the seam discipline:
//   - the pipeline ENGINE (lens orchestration, lenses, the de-id gate, assemble)
//     — plain TypeScript, framework-free; must NOT import Fastify, a database,
//     or the LLM provider. Runnable directly from tests with no server.
//   - the HTTP/SERVICE layer (Fastify front door) — thin; calls into the engine.
// Identity / authorization / persistence / LLM provider each sit behind a seam.
//
// Internal folders to come: engine/  service/  seams/. Placeholder for now.
export const BACKEND_PLACEHOLDER = true;
