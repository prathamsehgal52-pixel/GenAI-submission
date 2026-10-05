import { Hono } from 'hono'
import { styleRequestSchema } from '../../shared/schemas'
import { requireUser, type Env } from '../context'
import { parseJson } from '../http'
import { rateLimit } from '../rateLimit'
import { generateOutfits } from '../services/styling'

export const stylingRoutes = new Hono<Env>()
stylingRoutes.use('*', requireUser)

/** Generate outfits from the user's own wardrobe for a brief. */
stylingRoutes.post('/', async (c) => {
  const u = c.get('user')
  const body = await parseJson(c, styleRequestSchema)
  await rateLimit(`style:${u.id}`, 40, 3600)
  return c.json(await generateOutfits(u.id, body))
})
