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

type ItemDeTexto = { str: string; transform: number[]; width: number; height: number }

export async function palavrasDoPdf(bytes: Uint8Array): Promise<{ palavras: Palavra[]; paginas: number; lidas: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Registra `globalThis.pdfjsWorker`: o pdf.js passa a rodar o parser na mesma thread (já estamos num Worker).
  // @ts-expect-error o módulo do worker não traz tipos: só é importado para registrar o parser.
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const tarefa = pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    stopAtErrors: false,
    verbosity: 0,
  })
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
