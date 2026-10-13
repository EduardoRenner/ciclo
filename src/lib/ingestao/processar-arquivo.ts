/**
 * A esteira inteira para UM arquivo: bytes → grades → caixas. É o corpo do Web Worker
 * (`esteira.worker.ts` só liga as mensagens a esta função) e o que roda na linha principal quando o
 * navegador não tem Worker — a mesma função nos dois casos, então não há duas versões da regra.
 */
import { processarGrade, type ContextoDaEsteira, type ResultadoDaEsteira } from '@/core/ingestao/esteira'
import { lerParaGrades } from '@/lib/ingestao/ler'

import type { Formato } from '@/core/ingestao/formato'

export type PedidoDaEsteira = { bytes: Uint8Array; nome: string; contexto: ContextoDaEsteira; aba?: number }

export type RespostaDaEsteira =
  | { ok: true; formato: Formato; abas: string[]; aba: number; grade: string[][]; resultado: ResultadoDaEsteira; avisos: string[] }
  | { ok: false; mensagem: string }

export async function processarArquivo(pedido: PedidoDaEsteira): Promise<RespostaDaEsteira> {
  const lido = await lerParaGrades(pedido.bytes, pedido.nome)
  if (!lido.ok) return lido
  // Sem escolha, a aba com mais linhas: em planilha de verdade é quase sempre a da lista.
  const aba = pedido.aba ?? lido.abas.reduce((melhor, a, i, todas) => (a.grade.length > todas[melhor]!.grade.length ? i : melhor), 0)
  const grade = lido.abas[aba]?.grade ?? []
  try {
    return { ok: true, formato: lido.formato, abas: lido.abas.map((a) => a.nome), aba, grade, resultado: processarGrade(grade, pedido.contexto), avisos: lido.avisos }
  } catch {
    // A invariante não fechou (erro da esteira, não do arquivo): melhor parar do que mostrar
    // uma prévia com linha sumida.
    return { ok: false, mensagem: 'Não consegui conferir este arquivo por inteiro. Nada foi gravado. Envie de novo ou cole a lista.' }
  }
}
