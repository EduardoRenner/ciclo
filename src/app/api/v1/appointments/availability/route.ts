import { z } from 'zod'

import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerJson } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { disponibilidadeDoPainel } from '@/server/services/disponibilidade'

const EsquemaQuery = z.object({
  serviceId: z.uuid('Escolha um serviço.'),
  date: z.iso.date('Data inválida.'),
  professionalId: z.uuid().nullish(),
})

/**
 * APR-110a: os horários livres de um dia para o "Marcar" do painel, pela mesma conta do agendar
 * público (`slotsLivresDoDia`). Quem marca é quem lê isto (`appointment:create`); com alcance `own`
 * (profissional), só a própria agenda.
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'appointment:create')
  const params = new URL(req.url).searchParams
  const query = lerJson(EsquemaQuery, {
    serviceId: params.get('serviceId'),
    date: params.get('date'),
    professionalId: params.get('professionalId'),
  })
  const db = await criarClienteDoUsuario()

  let professionalId = query.professionalId ?? null
  if (escopo === 'own') {
    const { data: meu, error } = await db.rpc('my_professional_id', { t: ctx.tenantId })
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!meu) throw new AppError('FORBIDDEN', { message: 'Seu acesso não tem agenda própria para marcar.' })
    if (professionalId && professionalId !== meu) throw new AppError('FORBIDDEN', { message: 'Você só marca na sua própria agenda.' })
    professionalId = meu
  }

  return { slots: await disponibilidadeDoPainel(db, ctx.tenantId, { serviceId: query.serviceId, date: query.date, professionalId }) }
})
