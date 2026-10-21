/// <reference lib="webworker" />
/**
 * O Web Worker da esteira (`docs/103-conversor/00-pesquisa.md` P10): o arquivo é lido FORA da linha
 * principal — planilha grande ou arquivo hostil trava este Worker, não a tela —, e nunca sobe ao
 * servidor cru (`docs/97` §3).
 */
import { processarArquivo, type PedidoDaEsteira } from '@/lib/ingestao/processar-arquivo'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = async (evento: MessageEvent<PedidoDaEsteira>) => {
  self.postMessage(await processarArquivo(evento.data))
}
