import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { perfilPublico } from '@/server/services/public-booking'

type Ctx = { params: Promise<{ slug: string }> }

export const GET = rota(async (req, ctx) => {
  const { slug } = await (ctx as Ctx).params
  // O perfil inteiro sai em várias consultas por chamada, e os slugs são enumeráveis pelo
  // sitemap — sem teto compartilhado, varrer a plataforma inteira sai de graça.
  await limitarRotaPublica(req, 'perfil')
  return perfilPublico(slug)
})
