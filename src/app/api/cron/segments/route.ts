import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { registrarHeartbeat } from '@/server/services/health'
import { recalcularSegmentosDoTenant } from '@/server/services/segmentos'

/**
 * TICKET-040. O filtro de hora local (era 4h) **saiu em 2026-08-30 pelo mesmo motivo medido em
 * `recompute-cycles/route.ts`** — leia lá o histórico das três rodadas. Resumo: o atraso real do
 * `schedule` do GitHub nesta base é de 5 a 6,5 horas, e nenhuma janela razoável sobrevive a isso.
 *
 * Segue seguro: recalcular segmento é upsert idempotente, não lê `client_cycles` (as duas rotas
 * não disputam dado), e não fala com ninguém de fora.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    let processados = 0
    for (const tenant of tenants ?? []) {
      await recalcularSegmentosDoTenant(svc, tenant.id)
      processados++
    }

    /*
     * O heartbeat existe porque, sem ele, esta rota rodava SEIS VEZES POR DIA sem ninguém olhando.
     * `/api/health` só cobra os `kind` que conhece, e `segments` não estava no mapa — então das
     * duas rotas do `schedule`, só `recompute-cycles` era vigiada. Se esta aqui começasse a falhar
     * todo disparo, o endpoint de saúde continuaria verde para sempre: a AUSÊNCIA de sinal era
     * lida como "está tudo bem", que é o mesmo defeito de 25 e 26/08 pelo avesso.
     *
     * `> 0` pela mesma razão escrita em `recompute-cycles`: "a rota foi chamada" já era verdade
     * nos cinco disparos zerados daquele dia. O que precisa ser observável é que algum tenant teve
     * segmento recalculado.
     *
     * Não derruba a rota se falhar — heartbeat perdido não desfaz trabalho que já aconteceu.
     */
    if (processados > 0) {
      await registrarHeartbeat(svc, 'recompute_segments').catch((erro: unknown) => {
        console.error(JSON.stringify({ level: 'error', event: 'heartbeat_recompute_segments_falhou' }), erro)
      })
    }

    return { tenantsProcessados: processados }
  })
})
