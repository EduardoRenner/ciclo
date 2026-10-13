/**
 * CNV-018 · Print de tela e foto → palavras com posição e confiança, pelo tesseract.js 7 (Apache-2.0) e
 * o português (`por`, LSTM inteiro), NO APARELHO (`docs/97` §6–7): a imagem não sai do navegador.
 *
 * Motor, worker e idioma são servidos do PRÓPRIO domínio (`/ocr/`, copiados no build por
 * `scripts/copiar-ocr.mjs`): nada vem de CDN de terceiros (privacidade e a CSP `worker-src 'self'`).
 * No Node (testes), os mesmos arquivos saem de `node_modules`.
 *
 * Pré-processamento no navegador (OffscreenCanvas): escala para ~300 DPI, cinza, e INVERTE o modo
 * escuro (`core/ingestao/imagem.ts`). Sem OffscreenCanvas, a imagem vai como veio.
 */
import { escalaParaOcr, prepararParaOcr } from '@/core/ingestao/imagem'

import type { Palavra } from '@/core/ingestao/pdf-tabela'

type PalavraDoTesseract = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }
type Bloco = { paragraphs: { lines: { words: PalavraDoTesseract[] }[] }[] }

/** No Node (testes) os arquivos saem de `node_modules`; no navegador (Worker ou janela), de `/ocr/`. */
const ehNode = typeof window === 'undefined' && typeof (globalThis as { importScripts?: unknown }).importScripts === 'undefined' && typeof process !== 'undefined' && Boolean(process.versions?.node)

async function preparar(bytes: Uint8Array): Promise<{ imagem: Uint8Array | Blob; invertida: boolean }> {
  if (ehNode || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return { imagem: bytes, invertida: false }
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]))
  const escala = escalaParaOcr(bitmap.width)
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * escala), Math.round(bitmap.height * escala))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { pixels, invertida } = prepararParaOcr(dados.data)
  ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, canvas.width, canvas.height), 0, 0)
  return { imagem: await canvas.convertToBlob({ type: 'image/png' }), invertida }
}

function caminhos() {
  if (!ehNode) {
    const base = `${globalThis.location.origin}/ocr`
    return { langPath: base, corePath: base, workerPath: `${base}/worker.min.js`, workerBlobURL: false, cacheMethod: 'write' as const }
  }
  return { langPath: `${process.cwd()}/node_modules/@tesseract.js-data/por/4.0.0_best_int`, cacheMethod: 'none' as const }
}

type Lido = { palavras: Palavra[]; invertida: boolean; confiancaMedia: number }

export async function palavrasDaImagem(bytes: Uint8Array): Promise<Lido> {
  return palavrasDasImagens([bytes])
}

/** Várias imagens (páginas de um PDF escaneado) num worker só: cada uma vira a sua página. */
export async function palavrasDasImagens(imagens: Uint8Array[]): Promise<Lido> {
  const { createWorker } = await import('tesseract.js')
  // Sem `errorHandler`, o tesseract.js REJEITA a promessa e ainda LANÇA no evento do worker: uma imagem
  // truncada vira exceção solta (medido no Node: derruba o processo). Com ele, só a rejeição chega a
  // quem chamou, e o `processarArquivo` responde em português.
  const worker = await createWorker('por', 1, { ...caminhos(), gzip: true, errorHandler: () => {} })
  try {
    const palavras: Palavra[] = []
    let invertida = false
    for (const [i, bytes] of imagens.entries()) {
      const preparada = await preparar(bytes)
      invertida ||= preparada.invertida
      const r = await worker.recognize(preparada.imagem as never, {}, { blocks: true })
      const blocos = (r.data.blocks ?? []) as unknown as Bloco[]
      for (const w of blocos.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))) {
        palavras.push({
          texto: w.text,
          // A imagem tem y para BAIXO; o modo stream espera y para CIMA (como o PDF).
          x: w.bbox.x0,
          y: -w.bbox.y1,
          largura: w.bbox.x1 - w.bbox.x0,
          altura: w.bbox.y1 - w.bbox.y0,
          pagina: i + 1,
          confianca: w.confidence / 100,
        })
      }
    }
    const confiancaMedia = palavras.length ? palavras.reduce((s, p) => s + (p.confianca ?? 0), 0) / palavras.length : 0
    return { palavras, invertida, confiancaMedia }
  } finally {
    await worker.terminate()
  }
}
