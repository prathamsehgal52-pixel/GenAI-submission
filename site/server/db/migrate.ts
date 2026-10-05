import { migrate } from 'drizzle-orm/node-postgres/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './client'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Applies pending SQL migrations. Safe to run on every deploy. */
export async function runMigrations(folder = process.env.MIGRATIONS_DIR ?? path.join(here, 'migrations')) {
  await migrate(db, { migrationsFolder: folder })
}
