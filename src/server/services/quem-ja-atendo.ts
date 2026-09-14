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
 *
 * ## `retornos` — a terceira porta, para quem já está na ficha
 *
 * As duas portas acima só sabem CRIAR. Um salão que continua operando noutro sistema (agenda de
 * papel, AppBarber, Trinks — o CICLO entrando só como camada de recuperação) tem clientela que JÁ
 * está cadastrada aqui, e precisa de um jeito leve de dizer "essa pessoa voltou" sem reabrir o
 * cadastro dela. `retornos` é exatamente isso: `clientId` + `quando`, sem nome, sem telefone — a
 * ficha já existe, só o ciclo precisa de um ponto novo. Mesmo `preverEPersistirCiclos` no fim,
 * junto com quem entrou por `pessoas`: um só cálculo, uma só guarda, para as três portas não
 * divergirem entre si.
 */

/** Teto generoso para digitação à mão: ninguém digita 200 nomes numa sessão, e 200 não dói. */
const MAX_PESSOAS = 200

const EsquemaRetorno = z.object({
  clientId: z.string().uuid(),
  quando: z.enum(VALORES_DE_QUANDO as [QuandoFoi, ...QuandoFoi[]]),
})

const EsquemaBase = z.object({
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
    .max(MAX_PESSOAS, `São no máximo ${MAX_PESSOAS} pessoas de uma vez.`)
    .default([]),
  retornos: z.array(EsquemaRetorno).max(MAX_PESSOAS, `São no máximo ${MAX_PESSOAS} pessoas de uma vez.`).default([]),
})

// `pessoas` e `retornos` isolados não bastam — precisa ter gente em pelo menos um dos dois.
// `.refine` no nível do objeto, não em cada array, para a mensagem falar da tela inteira.
export const EsquemaQuemJaAtendo = EsquemaBase.refine((v) => v.pessoas.length + v.retornos.length > 0, {
  message: 'Adicione pelo menos uma pessoa.',
})

// `z.input`, não `z.infer`: os dois campos têm `.default([])` no schema, e o `.parse()` da rota
// aplica isso — mas os testes de integração chamam esta função direto, sem passar pelo Zod, e
// `z.input` é o tipo que reflete o que dá pra digitar sem os defaults (os dois opcionais). O corpo
// da função normaliza com `?? []` logo abaixo, então funciona igual pelos dois caminhos.
export type EntradaQuemJaAtendo = z.input<typeof EsquemaBase>

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
  const pessoas = entrada.pessoas ?? []
  const retornos = entrada.retornos ?? []

  const normalizadas = pessoas.map((p) => {
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

  let comData: ClienteComUltimaVisita[] = []
  let cadastrados = 0

  if (paraCriar.length > 0) {
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
    cadastrados = criados?.length ?? 0
    comData =
      criados && criados.length === paraCriar.length
        ? paraCriar.map((n, i) => ({ clientId: criados[i]!.id, ultimaVisita: n.ultimaVisita }))
        : []
  }

  if (retornos.length > 0) {
    /*
      O `clientId` vem do cliente (a tela de busca) — confere que cada um pertence a ESTE tenant
      antes de gravar ciclo nele. A RLS já impediria a escrita cruzada, mas sem esta conferência o
      `client_cycles.upsert` de `preverEPersistirCiclos` simplesmente não afetaria linha nenhuma
      para o id estranho, e a tela diria "gravado" sobre um retorno que não aconteceu — a mesma
      armadilha do UPDATE de zero linhas que não é erro.
    */
    const idsUnicos = [...new Set(retornos.map((r) => r.clientId))]
    const { data: existentes, error: erroExistentes } = await db
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('id', idsUnicos)
    if (erroExistentes) throw new AppError('INTERNAL', { cause: erroExistentes })
    const idsValidos = new Set((existentes ?? []).map((c) => c.id))

    // Dedup por `clientId`: o mesmo id duas vezes no lote faria o `upsert` de
    // `preverEPersistirCiclos` tentar afetar a MESMA linha duas vezes na mesma instrução, e o
    // Postgres recusa isso (`ON CONFLICT DO UPDATE command cannot affect row a second time`) —
    // improvável vindo da tela, mas um duplo-toque de rede não pode virar erro 500.
    const retornosUnicos = new Map(retornos.filter((r) => idsValidos.has(r.clientId)).map((r) => [r.clientId, r]))
    for (const r of retornosUnicos.values()) {
      comData.push({ clientId: r.clientId, ultimaVisita: dataDaUltimaVez(r.quando, hoje) })
    }
  }

  const previsao = comData.length > 0 ? await preverEPersistirCiclos(db, tenantId, comData, entrada.serviceId) : null

  return { cadastrados, jaExistiam, previsao }
}
