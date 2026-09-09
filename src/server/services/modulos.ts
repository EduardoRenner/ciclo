import { z } from 'zod'

import { CATALOGO, NOME_DO_PLANO, podeUsarModulo, type ModuloKey, type Veredito } from '@/core/billing/planos'
import { AppError } from '@/server/http/errors'
import { contextoDePlano } from '@/server/services/planos'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * docs/18-MONETIZACAO-PLANO.md §L.2 — a metade "escolha do dono" das duas fontes de verdade.
 *
 * `tenant_modules` existe desde a migration 0025 e ganhou catálogo e chave estrangeira na 0041,
 * mas **nenhuma linha jamais escreveu nela**. Este arquivo é o escritor que faltava.
 *
 * A hierarquia, que é a parte fácil de errar:
 *
 *     tenants.plan    -> o que o plano LIBERA   (o teto)
 *     tenant_modules  -> o que o dono LIGOU     (escolha, sempre DENTRO do teto)
 *
 * O dono só desliga. Ligar além do teto é recusado no servidor — senão `tenant_modules` viraria
 * uma segunda fonte de verdade brigando com a primeira, que é exatamente o que a §L.2 proíbe.
 */

export const EsquemaModulo = z.object({
  modulo: z.enum(CATALOGO.map((m) => m.key) as [ModuloKey, ...ModuloKey[]]),
  ligado: z.boolean(),
})

export type EntradaModulo = z.infer<typeof EsquemaModulo>

export type ModuloNaTela = {
  key: ModuloKey
  label: string
  /** `agenda` e `cycle_engine`: um é o produto, o outro é o diferencial. Não desligam. */
  sempreLigado: boolean
  veredito: Veredito
  /** O estado do interruptor. Bloqueado pelo plano aparece desligado e sem poder ligar. */
  ligado: boolean
}

/**
 * O que esta pessoa deve ver na tela de módulos.
 *
 * Módulo `fora_do_eixo` **não entra na lista** — some, sem oferta nenhuma (§D.5). Um barbeiro que
 * atende no local não deveria ver "Deslocamento e rota" nem para saber que existe; oferecer
 * upgrade para isso seria a regra 5.2 aplicada ao contrário.
 */
export async function listarModulos(db: Cliente, tenantId: string): Promise<ModuloNaTela[]> {
  const ctx = await contextoDePlano(db, tenantId)

  return CATALOGO.map((m) => {
    const veredito = podeUsarModulo(ctx, m.key)
    return {
      key: m.key,
      label: m.label,
      sempreLigado: m.sempreLigado,
      veredito,
      ligado: veredito.estado === 'liberado',
    }
  }).filter((m) => m.veredito.estado !== 'fora_do_eixo')
}

export async function definirModulo(db: Cliente, tenantId: string, entrada: EntradaModulo): Promise<ModuloNaTela[]> {
  const doCatalogo = CATALOGO.find((m) => m.key === entrada.modulo)
  if (!doCatalogo) throw new AppError('NOT_FOUND', { message: 'Esse módulo não existe.' })

  if (doCatalogo.sempreLigado) {
    throw new AppError('VALIDATION_ERROR', {
      message: `"${doCatalogo.label}" não pode ser desligado: é a base do produto.`,
    })
  }

  const ctx = await contextoDePlano(db, tenantId)
  const veredito = podeUsarModulo(ctx, entrada.modulo)

  if (veredito.estado === 'fora_do_eixo') {
    throw new AppError('FORBIDDEN', {
      message: 'Esse recurso não se aplica ao tipo de atendimento do seu negócio.',
    })
  }

  // Ligar o que o plano não libera é a única operação que precisa ser recusada: desligar é sempre
  // permitido, e o plano é teto, nunca piso.
  if (entrada.ligado && veredito.estado === 'bloqueado_pelo_plano') {
    throw new AppError('PLAN_LIMIT', {
      message: `"${doCatalogo.label}" faz parte do plano ${NOME_DO_PLANO[veredito.precisaDo]}. Veja o que muda em Config → Meu plano.`,
      details: { modulo: entrada.modulo, precisaDo: veredito.precisaDo },
    })
  }

  // Desligar o que o plano já não libera não grava nada. A tela mostra cadeado, não interruptor,
  // então só a API direta chega aqui — e registrar "o dono desligou" para algo que ele nunca viu
  // é guardar uma decisão que ninguém tomou. Ela voltaria a morder no dia em que ele subisse de
  // degrau, com o módulo desligado e nenhuma explicação de quando isso teria acontecido.
  //
  // Não confundir com a linha legítima: quem desliga estando NO degrau que libera grava normal, e
  // essa preferência sobrevive a um rebaixamento e ao retorno — que é o comportamento certo.
  if (!entrada.ligado && veredito.estado === 'bloqueado_pelo_plano') {
    return listarModulos(db, tenantId)
  }

  if (entrada.ligado) {
    // Ligar de volta = apagar a escolha de desligar. Deixar uma linha `ligado = true, origem =
    // 'dono'` faria o dono "ligar" algo que o plano já liberava, e no dia em que ele caísse de
    // degrau essa linha diria que ele escolheu ter aquilo — mentira, e conflito com o teto.
    const { error } = await db
      .from('tenant_modules')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('modulo', entrada.modulo)
      .eq('origem', 'dono')
    if (error) throw new AppError('INTERNAL', { cause: error })
  } else {
    const { error } = await db
      .from('tenant_modules')
      .upsert(
        { tenant_id: tenantId, modulo: entrada.modulo, ligado: false, origem: 'dono' },
        { onConflict: 'tenant_id,modulo' },
      )
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return listarModulos(db, tenantId)
}
