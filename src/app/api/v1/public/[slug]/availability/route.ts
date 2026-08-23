import { z } from 'zod'

import { lerJson } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { ipDe } from '@/server/http/ip'
import { disponibilidadePublica } from '@/server/services/public-booking'
import { limitador } from '@/server/services/rate-limit'

type Ctx = { params: Promise<{ slug: string }> }

const EsquemaQuery = z.object({
  serviceId: z.uuid('Escolha um serviço.'),
  date: z.iso.date('Data inválida.'),
  professionalId: z.uuid().nullish(),
})

/**
 * Auditoria de segurança, achado S4: esta era a única rota pública sem limite próprio — só o teto
 * global de 120/min, que fica em memória por instância. E é justamente a que um scraper lê antes
 * de atacar: varrendo serviço × profissional × dia dá para levantar horário de funcionamento,
 * nome de profissional e a agenda inteira da semana, e é o passo que precede esgotar os horários
 * com reserva fantasma.
 *
 * 60/min é folgado para uma pessoa escolhendo horário (a tela faz uma consulta por dia
 * espiado) e apertado para um script que varre a semana inteira em série.
 */
const LIMITE_CONSULTA = { limite: 60, janelaSegundos: 60 }

export const GET = rota(async (req, ctx) => {
  const { slug } = await (ctx as Ctx).params
  const params = new URL(req.url).searchParams

  const { permitido } = await limitador(`avail:ip:${ipDe(req)}`, LIMITE_CONSULTA)
  if (!permitido) throw AppError.limiteDeTaxa(LIMITE_CONSULTA.janelaSegundos)

  const query = lerJson(EsquemaQuery, {
    serviceId: params.get('serviceId'),
    date: params.get('date'),
    professionalId: params.get('professionalId'),
  })

  const slots = await disponibilidadePublica(slug, query.serviceId, query.date, query.professionalId ?? undefined)
  return { slots }
})
