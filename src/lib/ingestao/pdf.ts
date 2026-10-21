/**
 * CNV-017 · PDF → palavras com posição, pelo pdf.js (Apache-2.0), carregado só quando chega um PDF.
 *
 * Segurança (PDF é entrada hostil, `00c-…` §1): versão 6 (o CVE-2024-4367, JS arbitrário a partir de
 * fonte, era do `eval` que a v4.2+ deixou de usar), sem fontes do sistema, sem formulário XFA, sem
 * buscar nada na rede, teto de páginas.
 * Roda dentro do Worker da esteira: o pdf.js usa o "worker falso" na mesma thread quando o módulo do
 * worker dele já foi carregado — um Worker só, sem segundo download nem `blob:` (a CSP barra).
 */
import type { Palavra } from '@/core/ingestao/pdf-tabela'

export const LIMITE_DE_PAGINAS = 60
/** Página escaneada passa pelo OCR, segundos cada: o teto é menor que o do PDF com texto. */
export const LIMITE_DE_PAGINAS_ESCANEADAS = 10

type ItemDeTexto = { str: string; transform: number[]; width: number; height: number }
type CanvasComContexto = { canvas: OffscreenCanvas | null; context: OffscreenCanvasRenderingContext2D | null }

/**
 * Fábrica de canvas para o navegador: a padrão do pdf.js cria `<canvas>` com `document`, que o Worker
 * da esteira não tem. No Node fica a padrão dele (`@napi-rs/canvas`).
 */
class FabricaDeOffscreenCanvas {
  create(largura: number, altura: number): CanvasComContexto {
    const canvas = new OffscreenCanvas(largura, altura)
    return { canvas, context: canvas.getContext('2d') }
  }
  reset(cc: CanvasComContexto, largura: number, altura: number) {
    if (!cc.canvas) return
    cc.canvas.width = largura
    cc.canvas.height = altura
  }
  destroy(cc: CanvasComContexto) {
    if (cc.canvas) cc.canvas.width = cc.canvas.height = 0
    cc.canvas = null
    cc.context = null
  }
}

async function abrir(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Registra `globalThis.pdfjsWorker`: o pdf.js passa a rodar o parser na mesma thread (já estamos num Worker).
  // @ts-expect-error o módulo do worker não traz tipos: só é importado para registrar o parser.
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  return pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    stopAtErrors: false,
    verbosity: 0,
    ...(typeof OffscreenCanvas === 'undefined' ? {} : { CanvasFactory: FabricaDeOffscreenCanvas as never }),
  })
}

/**
 * CNV-018b · PDF escaneado (sem texto) → uma imagem PNG por página, para o OCR. Escala perto de 220 DPI
 * (A4 vira ~1800 px de largura), que é onde o Tesseract lê bem sem estourar a memória do celular.
 */
export async function paginasComoImagem(bytes: Uint8Array): Promise<{ imagens: Uint8Array[]; paginas: number }> {
  const tarefa = await abrir(bytes)
  const doc = await tarefa.promise
  try {
    const imagens: Uint8Array[] = []
    for (let n = 1; n <= Math.min(doc.numPages, LIMITE_DE_PAGINAS_ESCANEADAS); n++) {
      const pagina = await doc.getPage(n)
      const base = pagina.getViewport({ scale: 1 })
      const viewport = pagina.getViewport({ scale: Math.min(3, 1800 / base.width) })
      const largura = Math.ceil(viewport.width)
      const altura = Math.ceil(viewport.height)
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(largura, altura)
        await pagina.render({ canvas: canvas as never, canvasContext: canvas.getContext('2d') as never, viewport }).promise
        imagens.push(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()))
      } else {
        type CanvasDoNode = { canvas: { encode(f: 'png'): Promise<Uint8Array> }; context: unknown }
        const cc = (doc.canvasFactory as { create(l: number, a: number): CanvasDoNode }).create(largura, altura)
        await pagina.render({ canvas: cc.canvas as never, canvasContext: cc.context as never, viewport }).promise
        imagens.push(new Uint8Array(await cc.canvas.encode('png')))
      }
      pagina.cleanup()
    }
    return { imagens, paginas: doc.numPages }
  } finally {
    await tarefa.destroy()
  }
}

export async function palavrasDoPdf(bytes: Uint8Array): Promise<{ palavras: Palavra[]; paginas: number; lidas: number }> {
  const tarefa = await abrir(bytes)
  const doc = await tarefa.promise
  try {
    const lidas = Math.min(doc.numPages, LIMITE_DE_PAGINAS)
    const palavras: Palavra[] = []
    for (let n = 1; n <= lidas; n++) {
      const pagina = await doc.getPage(n)
      const conteudo = await pagina.getTextContent()
      for (const item of conteudo.items as ItemDeTexto[]) {
        if (typeof item.str !== 'string' || item.str.trim() === '') continue
        palavras.push({ texto: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, largura: item.width, altura: Math.abs(item.height || item.transform[3] || 10), pagina: n })
      }
      pagina.cleanup()
    }
    return { palavras, paginas: doc.numPages, lidas }
  } finally {
    await tarefa.destroy()
  }
}
