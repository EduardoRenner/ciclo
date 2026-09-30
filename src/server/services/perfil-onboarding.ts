import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

import { BASES_EM, DORES, SISTEMAS_ANTERIORES, TAMANHOS } from '@/core/onboarding/perfil'
import { avaliarPermissao, type Papel } from '@/server/auth/rbac'
import { AppError } from '@/server/http/errors'
import { definirModulo } from '@/server/services/modulos'
import { registrarEvento } from '@/server/services/product-events'

import type { Database } from '@/server/db/types.gen'

/**
 * `docs/83` §5.1/§9 (P1) — os dois eventos da tela "Pra deixar do seu jeito":
 *
 * - `responder`: grava `perfil_respondido` com `meta = { base_em, sistema? }` — é o que faz o
 *   CICLO responder, pela primeira vez, quantas contas vêm de cada origem de dados.
 * - `pular`: grava `perfil_pulado`, sem meta — tanto faz se veio do "Pular tudo" do topo ou do
 *   "Pular" da própria pergunta; nesta fase (só a Pergunta 1) os dois botões fazem exatamente a
 *   mesma coisa, e a tela mede a taxa de pulo de qualquer jeito que a pessoa saia sem responder.
 *
 * `sistema` só é aceito junto de `base_em: 'outro_sistema'` — o Zod garante isso, não a
 * validação manual, porque é a borda (regra 7 do CLAUDE.md).
 */
export const EsquemaPerfilOnboarding = z
  .discriminatedUnion('acao', [
    z.object({
      acao: z.literal('responder'),
      // P5: a Pergunta 1 pode ser pulada e as outras respondidas — por isso opcional aqui.
      baseEm: z.enum(BASES_EM).optional(),
      sistema: z.enum(SISTEMAS_ANTERIORES).optional(),
      tamanho: z.enum(TAMANHOS).optional(),
      dor: z.enum(DORES).optional(),
    }),
    z.object({ acao: z.literal('pular') }),
  ])
  .refine((v) => v.acao !== 'responder' || v.sistema === undefined || v.baseEm === 'outro_sistema', {
    message: 'Escolha o sistema só faz sentido para quem respondeu "outro sistema".',
    path: ['sistema'],
  })
  .refine((v) => v.acao !== 'responder' || v.baseEm !== undefined || v.tamanho !== undefined || v.dor !== undefined, {
    message: 'Responda pelo menos uma pergunta, ou pule.',
  })

export type EntradaPerfilOnboarding = z.infer<typeof EsquemaPerfilOnboarding>

/**
 * `registrarEvento` nunca lança (é o contrato dele — evento perdido não pode derrubar a tela que
 * observa), então esta função também não lança por causa do evento. O `await` aqui é sobre a
 * escrita terminar antes da função serverless ser encerrada, não sobre propagar erro.
 */
export async function gravarRespostaDePerfil(
  db: SupabaseClient<Database>,
  tenantId: string,
  entrada: EntradaPerfilOnboarding,
  papel?: Papel,
): Promise<{ efeitos: string[] }> {
  if (entrada.acao === 'pular') {
    await registrarEvento(db, tenantId, 'perfil_pulado')
    return { efeitos: [] }
  }

  /*
    P5: os EFEITOS vêm antes do evento. Se o efeito falhar, a rota devolve erro e nada é registrado
    como respondido — nunca um "respondeu" com o painel inalterado.

    E só com `tenant:update`, a MESMA permissão das rotas de módulos e de custo fixo: esta tela
    aparece para a conta nova (quem cria é o dono), mas a rota é pública para qualquer papel, e a
    recepção não pode desligar o módulo de equipe por um caminho lateral. Sem a permissão, a resposta
    ainda conta (é dado de perfil), só não muda nada.
  */
  const efeitos: string[] = []
  const podeAjustar = papel !== undefined && avaliarPermissao(papel, 'tenant:update') !== null

  if (podeAjustar && entrada.dor) {
    const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
    if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })
    const settings = { ...((atual.settings ?? {}) as Record<string, unknown>), dor_principal: entrada.dor }
    const { error } = await db
      .from('tenants')
      .update({ settings: settings as Database['public']['Tables']['tenants']['Update']['settings'] })
      .eq('id', tenantId)
    if (error) throw new AppError('INTERNAL', { cause: error })
    efeitos.push(`dor_principal:${entrada.dor}`)
  }

  if (podeAjustar && entrada.tamanho === 'so_eu') {
    try {
      await definirModulo(db, tenantId, { modulo: 'team', ligado: false })
      efeitos.push('team:desligado')
    } catch (erro) {
      // Módulo que não se aplica ao eixo do negócio (FORBIDDEN) já não aparece — nada a desligar.
      if (!(erro instanceof AppError && erro.code === 'FORBIDDEN')) throw erro
    }
  }

  await registrarEvento(db, tenantId, 'perfil_respondido', {
    ...(entrada.baseEm ? { base_em: entrada.baseEm } : {}),
    ...(entrada.sistema ? { sistema: entrada.sistema } : {}),
    ...(entrada.tamanho ? { tamanho: entrada.tamanho } : {}),
    ...(entrada.dor ? { dor: entrada.dor } : {}),
  })
  return { efeitos }
}
