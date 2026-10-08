import { corpoComSugestoes, type CasoParaCaptura } from '@/core/advocacia/captura'
import { alvosDaCaptura, chaveDoAlvo, consolidarDia, diasParaCapturar } from '@/core/advocacia/intimacoes'
import { consultarDia, DjenErro, type OpcoesDjen } from '@/server/advocacia/djen'
import { AppError } from '@/server/http/errors'

import type { Rito } from '@/core/advocacia/prazo-calculo'
import type { FeriadoCadastrado } from '@/core/advocacia/prazo-sugestao'
import type { Database, Json } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Servico = SupabaseClient<Database>

export type ResumoDaCaptura = { alvos: number; semOab: number; dias: number; novas: number; falhas: number; lacuna: boolean }

/**
 * docs/101 T4.1: a captura de intimações de UM escritório. Recebe o cliente de SERVIÇO de quem chama (a
 * rota de cron, por `withNovoTenant`): a RLS não vale aqui, então TODA consulta filtra `tenant_id`
 * (guarda `consulta-filtra-tenant`).
 *
 * Por alvo (OAB+UF de cada pessoa da advocacia), os dias que faltam ou não fecharam (`diasParaCapturar`):
 * consulta o DJEN um dia por vez, consolida, calcula a sugestão de prazo de cada item e grava pela RPC da
 * 0113. Falha de rede ou de formato marca o dia vermelho com o motivo e segue para o próximo: um tribunal
 * fora do ar não pode deixar os outros sem captura.
 */
export async function capturarIntimacoesDoEscritorio(
  svc: Servico,
  tenantId: string,
  hoje: string,
  opcoes: OpcoesDjen = {},
): Promise<ResumoDaCaptura> {
  const [equipe, casos, feriados, tenant] = await Promise.all([
    svc.from('professionals').select('id, active, legal_role, oab_number, oab_uf').eq('tenant_id', tenantId),
    svc.from('legal_cases').select('cnj_number, rito, prazo_em_dobro, comarca').eq('tenant_id', tenantId).not('cnj_number', 'is', null).is('archived_at', null),
    svc.from('legal_holidays').select('day, scope, name, tribunal, comarca').or(`tenant_id.eq.${tenantId},tenant_id.is.null`),
    svc.from('tenants').select('settings').eq('id', tenantId).single(),
  ])
  for (const r of [equipe, casos, feriados, tenant]) if (r.error) throw new AppError('INTERNAL', { cause: r.error })

  const { alvos, semOab } = alvosDaCaptura(
    (equipe.data ?? []).map((p) => ({
      id: p.id,
      active: p.active,
      role: p.legal_role === 'advogado' ? 'advogado' : 'outro',
      oabNumber: p.oab_number,
      oabUf: p.oab_uf,
    })),
    [],
  )
  const casosPorNumero = new Map<string, CasoParaCaptura>(
    (casos.data ?? []).map((c) => [c.cnj_number!, { rito: (c.rito as Rito | null) ?? null, emDobro: c.prazo_em_dobro, comarca: c.comarca }]),
  )
  // `forense` não existe no tipo do LUBI: para a contagem é o mesmo que municipal (vale onde a comarca diz)
  const listaDeFeriados: FeriadoCadastrado[] = (feriados.data ?? []).map((f) => ({
    day: f.day,
    scope: (f.scope === 'forense' ? 'municipal' : f.scope) as FeriadoCadastrado['scope'],
    name: f.name,
    tribunal: f.tribunal,
    comarca: f.comarca,
  }))
  // Regras de contagem confirmadas pela direção (T4.6). Sem a tela de configuração, nenhuma: a triagem pede a data.
  const ajustes = (tenant.data?.settings as { advocacia?: { regras_confirmadas?: unknown } } | null)?.advocacia?.regras_confirmadas
  const confirmadas = Array.isArray(ajustes) ? ajustes.filter((x): x is string => typeof x === 'string') : []

  const resumo: ResumoDaCaptura = { alvos: alvos.length, semOab: semOab.length, dias: 0, novas: 0, falhas: 0, lacuna: false }
  for (const alvo of alvos) {
    const chave = chaveDoAlvo(alvo)
    const sync = await svc.from('legal_intimation_sync').select('dia, ok').eq('tenant_id', tenantId).eq('alvo', chave)
    if (sync.error) throw new AppError('INTERNAL', { cause: sync.error })
    const { dias, lacuna } = diasParaCapturar(new Map((sync.data ?? []).map((s) => [s.dia, s.ok])), hoje)
    resumo.lacuna ||= lacuna

    for (const dia of dias) {
      resumo.dias++
      try {
        const { countFonte, brutos } = await consultarDia(alvo, dia, opcoes)
        const corpo = corpoComSugestoes(alvo, dia, consolidarDia(countFonte, brutos, alvo), casosPorNumero, listaDeFeriados, confirmadas)
        // a memória de cálculo é `Record<string, unknown>` no núcleo; no fio é JSON puro (só texto, número e lista)
        const r = await svc.rpc('legal_intimacoes_gravar', { p: { ...corpo, tenant_id: tenantId } as unknown as Json })
        if (r.error) throw new AppError('INTERNAL', { cause: r.error })
        resumo.novas += Number((r.data as { novas?: number } | null)?.novas ?? 0)
      } catch (erro) {
        if (!(erro instanceof DjenErro)) throw erro
        resumo.falhas++
        const f = await svc.rpc('legal_intimacoes_falha', { p: { tenant_id: tenantId, alvo: chave, dia, detalhe: `${erro.tipo}: ${erro.message}` } })
        if (f.error) throw new AppError('INTERNAL', { cause: f.error })
      }
    }
  }
  return resumo
}
