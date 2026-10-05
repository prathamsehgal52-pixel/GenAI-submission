import { handle } from '@hono/vercel'
import { createApp } from '../server/app'
import { initStorage } from '../server/storage'

// Runs once per cold start. The worker process (recognition, discovery,
// scheduled jobs) does not run here — it's deployed separately. This
// function only serves API requests and enqueues jobs for the worker to pick up.
await initStorage()

export default handle(createApp())
