import { pool } from './client'
import { runMigrations } from './migrate'

/** CLI entry: `npm run db:migrate` (dev) or `node dist-server/db/migrate-cli.js` (prod). */
runMigrations()
  .then(async () => {
    console.log('migrations applied')
    await pool.end()
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
