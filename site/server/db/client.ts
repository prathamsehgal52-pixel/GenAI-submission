import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { config } from '../config'
import * as schema from './schema'

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  statement_timeout: 30_000,
})

export const db = drizzle(pool, { schema, casing: 'snake_case' })
export type DB = typeof db
export { schema }
