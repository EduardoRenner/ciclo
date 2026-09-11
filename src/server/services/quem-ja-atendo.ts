import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { dataDaUltimaVez, VALORES_DE_QUANDO, type QuandoFoi } from '@/core/ciclo/quando-foi-a-ultima-vez'
import { preverEPersistirCiclos, type ClienteComUltimaVisita, type PrevisaoDaBase } from '@/server/services/ciclo-de-quem-ja-atende'
import { AppError } from '@/server/http/errors'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A segunda porta de entrada da base: **a memória**.
 *
 * O `#109` consertou a importação por planilha, e isso serve quem tem planilha. Medido contra o
 * público real do produto, essa é a minoria: barbeiro, manicure e depiladora têm a clientela nos
 * contatos do celular e na cabeça — não existe CSV para exportar. Para essas pessoas, o Motor de
 * Ciclo nascia vazio e continuava vazio por meses, que é o mesmo defeito do #109 por outro caminho.
 *
 * ## Por que dá para confiar numa data de memória
 *
 * Está medido em `core/ciclo/quando-foi-a-ultima-vez.ts`: com um só ponto de histórico,
 * `computeCycle` usa `defaultCycleDays` e o estado sai de `hoje − (última visita + ciclo)`. A data
 * exata não muda o ritmo estimado. "Uns 15 dias" responde a mesma pergunta que "12 de agosto".
 *
 * ## O que esta função NÃO faz
 *
 * Não inventa telefone, não inventa serviço e não marca atendimento nenhum. Ela cadastra a pessoa,
 * grava `last_visit_at` e põe no Motor — exatamente o que a importação faz, pela mesma função
 * (`preverEPersistirCiclos`), para as duas portas não divergirem.
 */

/** Teto generoso para digitação à mão: ninguém digita 200 nomes numa sessão, e 200 não dói. */
const MAX_PESSOAS = 200

export const EsquemaQuemJaAtendo = z.object({
  /**
   * Obrigatório aqui, diferente da importação. Lá ele é opcional porque o CSV já existia antes
   * desta regra e quebrar importação antiga seria pior; aqui a tela é nova e o único motivo de ela
   * existir é pôr gente no Motor — sem serviço, ela não faria nada e ninguém entenderia por quê.
   */
  serviceId: z.string().uuid('Escolha o serviço que essas pessoas fazem.'),
  pessoas: z
    .array(
      z.object({
        nome: z.string().trim().min(1, 'Falta o nome.').max(120),
        telefone: z.string().trim().max(20).nullish(),
        quando: z.enum(VALORES_DE_QUANDO as [QuandoFoi, ...QuandoFoi[]]),
      }),
    )
    .min(1, 'Adicione pelo menos uma pessoa.')
    .max(MAX_PESSOAS, `São no máximo ${MAX_PESSOAS} pessoas de uma vez.`),
})

export type EntradaQuemJaAtendo = z.infer<typeof EsquemaQuemJaAtendo>

export type ResultadoQuemJaAtendo = {
  cadastrados: number
  /** Nomes que já tinham ficha com aquele telefone — dito por nome, não por número. */
  jaExistiam: string[]
  previsao: PrevisaoDaBase | null
}

export async function cadastrarQuemJaAtendo(
  db: SupabaseClient<Database>,
  tenantId: string,
  entrada: EntradaQuemJaAtendo,
): Promise<ResultadoQuemJaAtendo> {
  const hoje = Temporal.Now.plainDateISO()

  const normalizadas = entrada.pessoas.map((p) => {
    const e164 = p.telefone ? normalizarTelefoneBR(p.telefone) : null
    return { nome: p.nome, e164, hash: e164 ? hashTelefone(e164) : null, ultimaVisita: dataDaUltimaVez(p.quando, hoje) }
  })

  /*
    Duplicata é conferida antes de escrever, e por TELEFONE — nome repetido num salão é comum
    ("Ana") e recusar por nome esconderia cliente de verdade. Quem não informou telefone entra
    sempre: sem chave, não há como afirmar que é a mesma pessoa, e o erro de criar ficha repetida é
    menos caro que o de engolir uma cliente.
  */
  const hashes = normalizadas.map((n) => n.hash).filter((h): h is string => h !== null)
  const jaNoBanco = new Set<string>()
  if (hashes.length > 0) {
    const { data, error } = await db
      .from('clients')
      .select('phone_hash')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('phone_hash', hashes)
    if (error) throw new AppError('INTERNAL', { cause: error })
    for (const linha of data ?? []) if (linha.phone_hash) jaNoBanco.add(linha.phone_hash)
  }

  const jaExistiam: string[] = []
  const paraCriar = normalizadas.filter((n) => {
    if (n.hash && jaNoBanco.has(n.hash)) {
      jaExistiam.push(n.nome)
      return false
    }
    return true
  })

  if (paraCriar.length === 0) return { cadastrados: 0, jaExistiam, previsao: null }

  const { data: criados, error } = await db
    .from('clients')
    .insert(
      paraCriar.map((n) => ({
        tenant_id: tenantId,
        name: n.nome,
        phone_e164: n.e164,
        phone_hash: n.hash,
        source: 'memoria',
        last_visit_at: n.ultimaVisita.toString(),
      })),
    )
    .select('id')
  if (error) throw new AppError('INTERNAL', { cause: error })

  /*
    O Postgres devolve as linhas de um `insert` de múltiplos valores na ordem do `VALUES`, então o
    índice casa — mas isso é CONFERIDO, não pressuposto: casar errado escreveria o ciclo de uma
    pessoa no nome de outra. Sem o mesmo tamanho, o cadastro fica (já entrou) e só a previsão é
    abandonada, com `cyclesGravados` contando a verdade.
  */
  const comData: ClienteComUltimaVisita[] =
    criados && criados.length === paraCriar.length
      ? paraCriar.map((n, i) => ({ clientId: criados[i]!.id, ultimaVisita: n.ultimaVisita }))
      : []

  const previsao = await preverEPersistirCiclos(db, tenantId, comData, entrada.serviceId)

  return { cadastrados: criados?.length ?? 0, jaExistiam, previsao }
}
