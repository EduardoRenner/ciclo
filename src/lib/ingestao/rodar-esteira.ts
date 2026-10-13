/**
 * Roda a esteira num Web Worker criado sob demanda e encerrado no fim (`docs/103-conversor/00-pesquisa.md`
 * P10): o `new URL(...)` fica LITERAL dentro do `new Worker` — é o que o webpack reconhece —, o buffer
 * é transferido (não copiado) e o Worker morre ao responder. Sem `Worker` no navegador, a mesma função
 * roda na linha principal.
 */
import type { PedidoDaEsteira, RespostaDaEsteira } from '@/lib/ingestao/processar-arquivo'

/** Limite de espera: arquivo patológico não pode deixar a tela "carregando" para sempre. */
const LIMITE_MS = 120_000

export async function rodarEsteira(pedido: PedidoDaEsteira): Promise<RespostaDaEsteira> {
  if (typeof Worker === 'undefined') {
    const { processarArquivo } = await import('@/lib/ingestao/processar-arquivo')
    return processarArquivo(pedido)
  }
  const worker = new Worker(new URL('./esteira.worker.ts', import.meta.url), { type: 'module' })
  try {
    return await new Promise<RespostaDaEsteira>((resolver) => {
      const relogio = setTimeout(() => resolver({ ok: false, mensagem: 'O arquivo demorou demais para ser lido. Tente um arquivo menor ou separe em partes.' }), LIMITE_MS)
      worker.onmessage = (e: MessageEvent<RespostaDaEsteira>) => {
        clearTimeout(relogio)
        resolver(e.data)
      }
      worker.onerror = () => {
        clearTimeout(relogio)
        resolver({ ok: false, mensagem: 'Não consegui ler este arquivo. Nada foi gravado. Confira se ele abre no seu computador e envie de novo.' })
      }
      const copia = pedido.bytes.slice()
      worker.postMessage({ ...pedido, bytes: copia }, [copia.buffer])
    })
  } finally {
    worker.terminate()
  }
}
