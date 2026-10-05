import { config } from 'dotenv'

/** Applies migrations to the test database once per run. */
export default async function setup() {
  config({ path: '.env.test', override: true, quiet: true })
  const { runMigrations } = await import('../../server/db/migrate')
  const { pool } = await import('../../server/db/client')
  await runMigrations()
  await pool.end()
}
