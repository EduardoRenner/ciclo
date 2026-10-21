/**
 * E2 da esteira (`docs/97` §5): bytes de texto → texto, com a codificação certa.
 *
 * O caso que mais estraga importação no Brasil: o Excel salva CSV em Windows-1252, e ler como UTF-8
 * transforma "João" em "Jo�o". O segundo caso: um sistema que já leu errado uma vez e exportou
 * "JoÃ£o" (UTF-8 lido como Latin-1 e gravado de novo). Os dois têm conserto determinístico, e os
 * dois são detectados aqui — nunca adivinhados calados: `codificacao` e `corrigido` vão para o
 * relatório da importação.
 */

export type Codificacao = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'windows-1252'

export type Decodificado = {
  texto: string
  codificacao: Codificacao
  /** "JoÃ£o" consertado para "João" (texto que passou duas vezes pela codificação errada). */
  corrigidoDuploUtf8: boolean
}

const comeca = (b: Uint8Array, ...assinatura: number[]) => assinatura.every((v, i) => b[i] === v)

/** UTF-16 sem BOM: metade dos bytes é zero, sempre na mesma posição (par ou ímpar). */
function utf16SemBom(b: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const n = Math.min(b.length, 4096) & ~1
  if (n < 8) return null
  let zerosPares = 0
  let zerosImpares = 0
  for (let i = 0; i < n; i += 2) {
    if (b[i] === 0) zerosPares++
    if (b[i + 1] === 0) zerosImpares++
  }
  const pares = n / 2
  if (zerosImpares / pares > 0.4 && zerosPares / pares < 0.05) return 'utf-16le'
  if (zerosPares / pares > 0.4 && zerosImpares / pares < 0.05) return 'utf-16be'
  return null
}

/** Padrões que só aparecem quando UTF-8 foi lido como Latin-1: "Ã£", "Ã§", "Ã©", "Ãº", "Ã\u0081"… */
const MOJIBAKE = /Ã[\u0080-¿]|Â[ -¿]/g

/** Desfaz uma volta de "UTF-8 lido como Latin-1". Só aceita se a volta for UTF-8 válido. */
function desfazerDuploUtf8(texto: string): string | null {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    if (c > 0xff) return null
    bytes[i] = c
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function talvezConsertarDuplo(texto: string, codificacao: Codificacao): Decodificado {
  const ocorrencias = texto.match(MOJIBAKE)?.length ?? 0
  // Uma ocorrência isolada pode ser texto legítimo; o conserto exige padrão repetido.
  if (ocorrencias >= 2) {
    const consertado = desfazerDuploUtf8(texto)
    if (consertado !== null && (consertado.match(MOJIBAKE)?.length ?? 0) === 0) {
      return { texto: consertado, codificacao, corrigidoDuploUtf8: true }
    }
  }
  return { texto, codificacao, corrigidoDuploUtf8: false }
}

export function decodificar(bytes: Uint8Array): Decodificado {
  if (comeca(bytes, 0xef, 0xbb, 0xbf)) {
    return talvezConsertarDuplo(new TextDecoder('utf-8').decode(bytes.subarray(3)), 'utf-8-bom')
  }
  if (comeca(bytes, 0xff, 0xfe)) return { texto: new TextDecoder('utf-16le').decode(bytes.subarray(2)), codificacao: 'utf-16le', corrigidoDuploUtf8: false }
  if (comeca(bytes, 0xfe, 0xff)) return { texto: new TextDecoder('utf-16be').decode(bytes.subarray(2)), codificacao: 'utf-16be', corrigidoDuploUtf8: false }

  const semBom = utf16SemBom(bytes)
  if (semBom) return { texto: new TextDecoder(semBom).decode(bytes), codificacao: semBom, corrigidoDuploUtf8: false }

  try {
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return talvezConsertarDuplo(texto, 'utf-8')
  } catch {
    // Não é UTF-8 válido: o que sobra, na prática brasileira, é o Windows-1252 do Excel (superconjunto
    // do Latin-1 com aspas curvas, travessão e o símbolo do euro).
    return { texto: new TextDecoder('windows-1252').decode(bytes), codificacao: 'windows-1252', corrigidoDuploUtf8: false }
  }
}
