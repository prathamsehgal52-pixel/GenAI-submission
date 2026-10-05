import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import sharp from 'sharp'

export const FIXTURES = path.resolve('tests/fixtures')

/**
 * Prepares a clean e2e database and synthetic garment photos. The fixture AI
 * provider (test-only) reads category from aspect ratio and colour from the
 * mean pixel colour, so these images produce known garments.
 */
export default async function setup() {
  const client = new pg.Client({ connectionString: 'postgres://armoire:armoire@localhost:5433/armoire_e2e' })
  await client.connect()
  await client.query(`DO $$ BEGIN
    IF to_regclass('public."user"') IS NOT NULL THEN
      TRUNCATE "user", products, rate_limits, integration_status, ai_usage CASCADE;
    END IF;
  END $$;`)
  await client.end()

  fs.mkdirSync(FIXTURES, { recursive: true })
  const make = async (name: string, w: number, h: number, rgb: [number, number, number]) => {
    const file = path.join(FIXTURES, name)
    if (!fs.existsSync(file)) await sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).jpeg().toFile(file)
  }
  await make('white-top.jpg', 600, 600, [240, 240, 236])
  await make('grey-top.jpg', 600, 600, [150, 150, 150])
  await make('navy-bottom.jpg', 420, 720, [30, 42, 70])
  await make('black-bottom.jpg', 420, 720, [20, 20, 20])
  await make('brown-shoes.jpg', 720, 420, [120, 80, 50])
}
