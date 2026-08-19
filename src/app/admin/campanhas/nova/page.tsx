import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { publicoDaCampanha, SEGMENTOS_CAMPANHA } from '@/server/services/crm'
import { listarModelos } from '@/server/services/mensagens-prontas'

import NovaCampanha from './nova'

export const dynamic = 'force-dynamic'

export default async function PaginaNovaCampanha() {
  const ctx = await contextoAtual(new Request('https://interno/campanhas/nova', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // Os cinco públicos vêm resolvidos de uma vez: a tela precisa mostrar o tamanho de cada grupo
  // ANTES da escolha ("Sumiram · 11 pessoas"), senão a pessoa escolhe às cegas.
  const [modelos, negocio, ...publicos] = await Promise.all([
    listarModelos(db, ctx.tenantId),
    db.from('tenants').select('name').eq('id', ctx.tenantId).single(),
    ...SEGMENTOS_CAMPANHA.map((s) => publicoDaCampanha(db, ctx.tenantId, s.valor)),
  ])

  const porSegmento = Object.fromEntries(SEGMENTOS_CAMPANHA.map((s, i) => [s.valor, publicos[i] ?? []]))

  return (
    <NovaCampanha
      segmentos={[...SEGMENTOS_CAMPANHA]}
      publicoPorSegmento={porSegmento}
      modelos={modelos.filter((m) => m.active)}
      nomeDoNegocio={negocio.data?.name ?? ''}
    />
  )
}
