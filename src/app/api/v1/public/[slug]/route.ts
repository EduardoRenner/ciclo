import { rota } from '@/server/http/handler'
import { perfilPublico } from '@/server/services/public-booking'

type Ctx = { params: Promise<{ slug: string }> }

export const GET = rota(async (_req, ctx) => {
  const { slug } = await (ctx as Ctx).params
  return perfilPublico(slug)
})
