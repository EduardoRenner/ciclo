/**
 * Documentos do pacote Advocacia (docs/101 T2.3, anexo 02 §3.4). Puro.
 *
 * O tipo do arquivo é decidido pelos PRIMEIROS BYTES, nunca pelo nome nem pelo `Content-Type` que o
 * navegador manda: um executável renomeado para "contrato.pdf" não entra. Formatos do pacote Office e
 * ODT são ZIP por dentro; para eles o declarado desempata, mas só entre os três da família ZIP.
 */

export const MIMES_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'text/plain',
] as const
export type MimeAceito = (typeof MIMES_ACEITOS)[number]

const FAMILIA_ZIP: readonly MimeAceito[] = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
]

export const TAMANHO_MAXIMO = 50 * 1024 * 1024

const comeca = (b: Uint8Array, assinatura: readonly number[], deslocamento = 0) => assinatura.every((x, i) => b[deslocamento + i] === x)
const ascii = (b: Uint8Array, de: number, ate: number) => String.fromCharCode(...b.slice(de, ate))

export type Conferencia = { ok: true; mime: MimeAceito } | { ok: false; motivo: string }

export function conferirArquivo(bytes: Uint8Array, mimeDeclarado: string | null): Conferencia {
  if (bytes.length === 0) return { ok: false, motivo: 'O arquivo está vazio.' }
  if (bytes.length > TAMANHO_MAXIMO) return { ok: false, motivo: 'O arquivo passa de 50 MB.' }
  if (comeca(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true, mime: 'application/pdf' } // %PDF-
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return { ok: true, mime: 'image/jpeg' }
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, mime: 'image/png' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { ok: true, mime: 'image/webp' }
  if (ascii(bytes, 4, 8) === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1'].includes(ascii(bytes, 8, 12))) return { ok: true, mime: 'image/heic' }
  if (comeca(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const declarado = FAMILIA_ZIP.find((m) => m === mimeDeclarado)
    return declarado ? { ok: true, mime: declarado } : { ok: false, motivo: 'Este arquivo compactado não é um documento aceito (Word, Excel ou ODT).' }
  }
  if (mimeDeclarado === 'text/plain' && textoSimples(bytes)) return { ok: true, mime: 'text/plain' }
  return { ok: false, motivo: 'Este arquivo não pôde ser aceito: tipo não permitido.' }
}

/** Texto puro: sem byte nulo nem controle (fora tab e quebras) nos primeiros 4 KB, e UTF-8 válido. */
function textoSimples(bytes: Uint8Array): boolean {
  const amostra = bytes.slice(0, 4096)
  for (const b of amostra) if (b === 0 || (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(amostra.length < bytes.length ? amostra.slice(0, ultimoInicioDeCaractere(amostra)) : amostra)
    return true
  } catch {
    return false
  }
}

/** Corta a amostra antes de um caractere multibyte pela metade, para não reprovar UTF-8 válido. */
function ultimoInicioDeCaractere(b: Uint8Array): number {
  let i = b.length
  while (i > 0 && (b[i - 1]! & 0xc0) === 0x80) i--
  return i > 0 && b[i - 1]! >= 0xc0 ? i - 1 : b.length
}

export const CATEGORIAS = {
  identificacao_pessoal: 'Identificação pessoal',
  certidao_civil: 'Certidão civil',
  pacto_antenupcial: 'Pacto antenupcial',
  comprovante_endereco: 'Comprovante de endereço',
  contrato_social: 'Contrato social',
  alteracao_contratual: 'Alteração contratual',
  ata_assembleia: 'Ata de assembleia',
  acordo_socios: 'Acordo de sócios',
  cartao_cnpj: 'Cartão CNPJ',
  procuracao: 'Procuração',
  matricula_imovel: 'Matrícula de imóvel',
  escritura: 'Escritura',
  iptu_itr_ccir: 'IPTU, ITR ou CCIR',
  contrato: 'Contrato',
  declaracao_ir: 'Declaração de IR',
  extrato_bancario: 'Extrato bancário',
  contrato_bancario: 'Contrato bancário',
  testamento: 'Testamento',
  peticao_decisao: 'Petição ou decisão',
  laudo_avaliacao: 'Laudo de avaliação',
  comprovante_pagamento: 'Comprovante de pagamento',
  outro: 'Outro',
} as const
export type CategoriaDoDocumento = keyof typeof CATEGORIAS

export const ROTULO_DO_STATUS_DO_DOCUMENTO = {
  recebido: 'Recebido, a conferir',
  em_conferencia: 'Em conferência',
  aceito: 'Aceito',
  recusado: 'Recusado',
} as const

/** Uma linha da lista de documentos, como a tela recebe do servidor. */
export type DocumentoNaLista = {
  id: string
  titulo: string
  categoria: string
  status: string
  origem: string
  versao: number
  rowVersion: number
  validade: string | null
  casoId: string | null
}
