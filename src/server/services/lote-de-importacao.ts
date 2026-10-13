import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { instanteDoDiaInformado } from '@/core/tempo/data-informada'
import { AppError } from '@/server/http/errors'
import { preverEPersistirCiclos, type ClienteComUltimaVisita, type PrevisaoDaBase } from '@/server/services/ciclo-de-quem-ja-atende'
import { hashTelefone } from '@/server/services/telefone'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * docs/103 CNV-020 · A carga da esteira em pedaços (E10). A esteira roda no aparelho e manda o que já
 * entendeu, ~500 fichas por vez; aqui só se confere e grava. O arquivo nunca chega ao servidor.
 *
 * Idempotente pela LINHA, não pelo telefone: cada ficha leva `(import_batch_id, import_row)`, único no
 * banco (0128). Reenviar o mesmo pedaço (rede ruim, toque duplo, aba fechada e reaberta) não cria
 * ninguém de novo, tenha a pessoa telefone ou não (D5). `rows_written` é recontado do banco a cada
 * pedaço, nunca somado: somar contaria duas vezes o pedaço reenviado.
 *
 * Fora daqui, de propósito: caixa, comissão, estoque e atendimentos (Onda F, com revisão).
 */

type Db = SupabaseClient<Database>

export const LINHAS_POR_PEDACO = 500
/** `.in()` vai na URL: 100 hashes de 64 caracteres cabem com folga no gateway (S13, `importacao-clientes`). */
const POR_CONSULTA = 100

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const EsquemaAbrirLote = z.object({
  fileSha256: z.string().regex(/^[0-9a-f]{64}$/),
  formato: z.string().regex(/^[a-z]{2,12}$/),
  origem: z.enum(['arquivo', 'colado', 'contatos', 'imagem']),
  nivel: z.enum(['N0', 'N1', 'N2', 'N3']),
  counts: z.object({
    lidas: z.number().int().min(0),
    ouro: z.number().int().min(0),
    comAviso: z.number().int().min(0),
    quarentena: z.number().int().min(0),
    ignoradas: z.number().int().min(0),
  }),
  rowsExpected: z.number().int().min(1).max(50_000),
  declarationVersion: z.string().max(40).nullish(),
})

export const EsquemaLinha = z.object({
  linha: z.number().int().min(1),
  nome: z.string().trim().min(1).max(120),
  telefone: z.string().regex(/^\+\d{10,15}$/).nullish(),
  email: z.string().email().max(254).nullish(),
  nascimento: DIA.nullish(),
  ultimaVisita: DIA.nullish(),
  observacao: z.string().max(2000).nullish(),
  etiquetas: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
})

export const EsquemaPedaco = z.object({
  linhas: z.array(EsquemaLinha).min(1).max(LINHAS_POR_PEDACO),
  /** O último pedaço fecha o lote: `concluido`. */
  ultimo: z.boolean().default(false),
})

export type Lote = { id: string; status: string; rowsExpected: number; rowsWritten: number }
export type LinhaPulada = { linha: number; motivo: string }
export type ResultadoDoPedaco = {
  gravadas: number
  /** Já estavam gravadas por este mesmo lote (pedaço reenviado): não é erro, não é nova. */
  jaGravadas: number
  puladas: LinhaPulada[]
  erros: LinhaPulada[]
  previsao: PrevisaoDaBase | null
  lote: Lote
}

const paraLote = (r: { id: string; status: string; rows_expected: number; rows_written: number }): Lote => ({
  id: r.id,
  status: r.status,
  rowsExpected: r.rows_expected,
  rowsWritten: r.rows_written,
})

/** Abre o lote. O mesmo arquivo com lote vivo devolve o que já existe, para continuar de onde parou. */
export async function abrirLote(db: Db, tenantId: string, userId: string, e: z.infer<typeof EsquemaAbrirLote>): Promise<{ lote: Lote; jaExistia: boolean }> {
  const novo = await db
    .from('import_batches')
    .insert({
      tenant_id: tenantId,
      file_sha256: e.fileSha256,
      formato: e.formato,
      origem: e.origem,
      nivel: e.nivel,
      counts: e.counts,
      rows_expected: e.rowsExpected,
      declaration_version: e.declarationVersion ?? null,
      created_by: userId,
    })
    .select('id, status, rows_expected, rows_written')
    .single()
  if (!novo.error) return { lote: paraLote(novo.data), jaExistia: false }
  if (novo.error.code !== '23505') throw new AppError('INTERNAL', { cause: novo.error })

  const vivo = await db
    .from('import_batches')
    .select('id, status, rows_expected, rows_written')
    .eq('tenant_id', tenantId)
    .eq('file_sha256', e.fileSha256)
    .in('status', ['aberto', 'concluido'])
    .maybeSingle()
  if (vivo.error || !vivo.data) throw new AppError('INTERNAL', { cause: vivo.error })
  return { lote: paraLote(vivo.data), jaExistia: true }
}

/** Erros da função `desfazer_lote_de_importacao` (0129), com a mensagem que ela mesma escreveu. */
const ERRO_DO_DESFAZER = { IMP01: 'NOT_FOUND', IMP02: 'FORBIDDEN', IMP03: 'CONFLICT', IMP04: 'CONFLICT' } as const

/**
 * docs/103 CNV-022 · Desfaz o lote em até 7 dias: tira as fichas que ele criou e ninguém usou, mantém
 * as usadas (e diz quantas). Uma transação só, no banco.
 */
export async function desfazerLote(db: Db, loteId: string): Promise<{ removidas: number; mantidas: number }> {
  const { data, error } = await db.rpc('desfazer_lote_de_importacao', { p_batch: loteId }).single()
  if (error) {
    const codigo = ERRO_DO_DESFAZER[error.code as keyof typeof ERRO_DO_DESFAZER]
    if (codigo) throw new AppError(codigo, { message: error.message, cause: error })
    throw new AppError('INTERNAL', { cause: error })
  }
  return { removidas: data.removidas, mantidas: data.mantidas }
}

export async function gravarPedaco(db: Db, tenantId: string, loteId: string, pedaco: z.infer<typeof EsquemaPedaco>): Promise<ResultadoDoPedaco> {
  const { data: lote, error } = await db
    .from('import_batches')
    .select('id, status, rows_expected, rows_written')
    .eq('id', loteId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!lote) throw new AppError('NOT_FOUND', { message: 'Não achei esta importação. Comece de novo pelo arquivo.' })
  if (lote.status === 'desfeito') throw new AppError('CONFLICT', { message: 'Esta importação foi desfeita. Para trazer de novo, envie o arquivo outra vez.' })
  if (lote.status === 'concluido') throw new AppError('CONFLICT', { message: 'Esta importação já terminou. Nada foi gravado em dobro.' })

  const foraDoLote = pedaco.linhas.filter((l) => l.linha > lote.rows_expected).map((l) => l.linha)
  if (foraDoLote.length) throw AppError.validacao({ linhas: `Linha ${foraDoLote[0]} passa do total combinado (${lote.rows_expected}).` })

  const puladas: LinhaPulada[] = []
  const erros: LinhaPulada[] = []

  // 1. O que este lote já gravou (pedaço reenviado).
  const numeros = [...new Set(pedaco.linhas.map((l) => l.linha))]
  const jaNoLote = new Set<number>()
  for (let i = 0; i < numeros.length; i += POR_CONSULTA * 2) {
    const r = await db.from('clients').select('import_row').eq('tenant_id', tenantId).eq('import_batch_id', loteId).in('import_row', numeros.slice(i, i + POR_CONSULTA * 2)).limit(POR_CONSULTA * 2)
    if (r.error) throw new AppError('INTERNAL', { cause: r.error })
    for (const x of r.data ?? []) if (x.import_row) jaNoLote.add(x.import_row)
  }
  const vistas = new Set<number>()
  const novas = pedaco.linhas.filter((l) => {
    if (jaNoLote.has(l.linha) || vistas.has(l.linha)) return false
    vistas.add(l.linha)
    return true
  })

  // 2. Telefone que já é de outra ficha do salão: não cria a segunda (a junção com a ficha existente é da prévia).
  const hashes = new Map<string, number>()
  const semRepetido = novas.filter((l) => {
    if (!l.telefone) return true
    const h = hashTelefone(l.telefone)
    if (hashes.has(h)) {
      puladas.push({ linha: l.linha, motivo: `Mesmo telefone da linha ${hashes.get(h)}.` })
      return false
    }
    hashes.set(h, l.linha)
    return true
  })
  const existentes = new Set<string>()
  const lista = [...hashes.keys()]
  for (let i = 0; i < lista.length; i += POR_CONSULTA) {
    const r = await db.from('clients').select('phone_hash').eq('tenant_id', tenantId).is('deleted_at', null).in('phone_hash', lista.slice(i, i + POR_CONSULTA)).limit(POR_CONSULTA)
    if (r.error) throw new AppError('INTERNAL', { cause: r.error })
    for (const x of r.data ?? []) if (x.phone_hash) existentes.add(x.phone_hash)
  }
  const paraGravar = semRepetido.filter((l) => {
    if (l.telefone && existentes.has(hashTelefone(l.telefone))) {
      puladas.push({ linha: l.linha, motivo: 'Já existe uma ficha com esse telefone.' })
      return false
    }
    return true
  })

  // 3. Grava. `ignoreDuplicates` no par do lote: a corrida de dois envios do mesmo pedaço vira no-op.
  const ficha = (l: (typeof paraGravar)[number]) => ({
    tenant_id: tenantId,
    name: l.nome,
    phone_e164: l.telefone ?? null,
    phone_hash: l.telefone ? hashTelefone(l.telefone) : null,
    email: l.email ?? null,
    birth_date: l.nascimento ?? null,
    notes: l.observacao ?? null,
    tags: l.etiquetas,
    source: 'csv_import',
    last_visit_at: l.ultimaVisita ? instanteDoDiaInformado(Temporal.PlainDate.from(l.ultimaVisita)) : null,
    import_batch_id: loteId,
    import_row: l.linha,
  })
  const criadas: { id: string; linha: number }[] = []
  if (paraGravar.length) {
    const r = await db.from('clients').upsert(paraGravar.map(ficha), { onConflict: 'import_batch_id,import_row', ignoreDuplicates: true }).select('id, import_row')
    if (!r.error) {
      for (const x of r.data ?? []) if (x.import_row) criadas.push({ id: x.id, linha: x.import_row })
    } else {
      // Corrida rara: outra porta criou o mesmo telefone entre a conferência e a escrita. Linha a linha,
      // só neste pedaço, para isolar quem e não perder o resto.
      for (const l of paraGravar) {
        const um = await db.from('clients').upsert(ficha(l), { onConflict: 'import_batch_id,import_row', ignoreDuplicates: true }).select('id, import_row').maybeSingle()
        if (um.error?.code === '23505') puladas.push({ linha: l.linha, motivo: 'Já existe uma ficha com esse telefone.' })
        else if (um.error) erros.push({ linha: l.linha, motivo: 'Não consegui salvar esta linha. Envie de novo.' })
        else if (um.data?.import_row) criadas.push({ id: um.data.id, linha: um.data.import_row })
      }
    }
  }

  // 4. O ciclo de quem veio com a última visita: o Motor já sabe quem está sumido.
  const porLinha = new Map(paraGravar.map((l) => [l.linha, l]))
  const comData: ClienteComUltimaVisita[] = criadas.flatMap((c) => {
    const dia = porLinha.get(c.linha)?.ultimaVisita
    return dia ? [{ clientId: c.id, ultimaVisita: Temporal.PlainDate.from(dia) }] : []
  })
  const previsao = await preverEPersistirCiclos(db, tenantId, comData, null)

  // 5. Estado honesto: recontado do banco, e "concluído" só no último pedaço.
  const { count, error: erroConta } = await db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('import_batch_id', loteId)
  if (erroConta) throw new AppError('INTERNAL', { cause: erroConta })
  const atualizado = await db
    .from('import_batches')
    .update({ rows_written: count ?? 0, ...(pedaco.ultimo ? { status: 'concluido', completed_at: new Date().toISOString() } : {}) })
    .eq('id', loteId)
    .eq('tenant_id', tenantId)
    .eq('status', 'aberto')
    .select('id, status, rows_expected, rows_written')
    .maybeSingle()
  if (atualizado.error) throw new AppError('INTERNAL', { cause: atualizado.error })
  // Zero linhas: outro envio concluiu o lote no meio deste. O que este gravou já está contado lá.
  const final = atualizado.data ?? { ...lote, rows_written: count ?? lote.rows_written }

  return {
    gravadas: criadas.length,
    jaGravadas: numeros.filter((n) => jaNoLote.has(n)).length,
    puladas,
    erros,
    previsao,
    lote: paraLote(final),
  }
}
