/**
 * CNV-016 · Abrir zip com segurança: `.docx`, `.odt`, `.ods` são zip com XML dentro, e o `.zip`
 * genérico (a conversa do WhatsApp "com mídia", uma pasta compactada) traz a lista dentro.
 *
 * E0 da esteira (`docs/97` §5), contra zip-bomb: o filtro do `fflate` decide ANTES de descompactar,
 * pelo tamanho declarado de cada entrada e pelo total, e só a entrada que interessa é aberta. Roda no
 * Worker: o pior caso trava a aba de quem enviou, nunca o servidor.
 */
import { unzipSync } from 'fflate'

/** Tetos do que se descompacta (declarado na entrada do zip). */
export const LIMITE_POR_ENTRADA = 30 * 1024 * 1024
export const LIMITE_TOTAL = 60 * 1024 * 1024

export type EntradaDoZip = { nome: string; bytes: Uint8Array }

/**
 * Abre só as entradas que `quer` aceitar e que cabem nos tetos. `'grande'` se o zip passa do teto
 * (o arquivo é recusado inteiro, com motivo, em vez de abrir pela metade); `'corrompido'` se não é um
 * zip legível — vira mensagem, nunca exceção na tela.
 */
export function abrirZip(bytes: Uint8Array, quer: (nome: string) => boolean): EntradaDoZip[] | 'grande' | 'corrompido' {
  let total = 0
  let estourou = false
  let abertos: Record<string, Uint8Array>
  try {
    abertos = unzipSync(bytes, {
    filter: (f) => {
      if (!quer(f.name)) return false
      if (f.originalSize > LIMITE_POR_ENTRADA) {
        estourou = true
        return false
      }
      total += f.originalSize
      if (total > LIMITE_TOTAL) {
        estourou = true
        return false
      }
      return true
    },
    })
  } catch {
    return 'corrompido'
  }
  if (estourou) return 'grande'
  return Object.entries(abertos).map(([nome, b]) => ({ nome, bytes: b }))
}

const texto = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)

/** O XML principal de um documento de escritório (Word ou LibreOffice). */
export function xmlDoDocumento(bytes: Uint8Array, caminho: 'word/document.xml' | 'content.xml'): { xml: string } | 'grande' | 'corrompido' {
  const entradas = abrirZip(bytes, (n) => n === caminho)
  if (typeof entradas === 'string') return entradas
  if (entradas.length === 0) return 'corrompido'
  return { xml: texto(entradas[0]!.bytes) }
}

/** Nomes das abas de um `.ods` (`table:name`), na ordem. */
export function nomesDasAbasOdf(contentXml: string): string[] {
  return [...contentXml.matchAll(/<table:table\s[^>]*table:name="([^"]*)"/g)].map((m) => m[1]!)
}

/** Arquivos que valem a pena dentro de um zip genérico: a lista, não a mídia. */
export const DENTRO_DO_ZIP = /\.(csv|tsv|txt|vcf|json|ndjson|ods|odt|docx|xlsx|html?)$/i
