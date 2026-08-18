import { z } from 'zod'

import { lerJson } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { disponibilidadePublica } from '@/server/services/public-booking'

type Ctx = { params: Promise<{ slug: string }> }

const EsquemaQuery = z.object({
  serviceId: z.uuid('Escolha um serviço.'),
  date: z.iso.date('Data inválida.'),
  professionalId: z.uuid().nullish(),
})

export const GET = rota(async (req, ctx) => {
  const { slug } = await (ctx as Ctx).params
  const params = new URL(req.url).searchParams

  const query = lerJson(EsquemaQuery, {
    serviceId: params.get('serviceId'),
    date: params.get('date'),
    professionalId: params.get('professionalId'),
  })

  const slots = await disponibilidadePublica(slug, query.serviceId, query.date, query.professionalId ?? undefined)
  return { slots }
})
