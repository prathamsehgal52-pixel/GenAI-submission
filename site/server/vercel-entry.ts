import { handle } from '@hono/vercel'
import { createApp } from './app'
import { initStorage } from './storage'

// Runs once per cold start. The worker process (recognition, discovery,
// scheduled jobs) does not run here — it's deployed separately. This
// function only serves API requests and enqueues jobs for the worker to pick up.
//
// Bundled standalone into api/index.js at build time (see `build:api` in
// package.json): Vercel's Node builder transpiles api/index.ts itself but
// copies sibling imports (../server/*) as raw, unresolved .ts files, which
// Node's native ESM loader can't load at runtime. Pre-bundling avoids that.
await initStorage()

export default handle(createApp())
