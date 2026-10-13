/**
 * E0 + E1 da esteira (`docs/97-PLANO-CONVERSOR-DE-DADOS.md` §5): o formato decidido pelos BYTES,
 * nunca pela extensão — um `.csv` que é planilha, um `.xlsx` que é PDF renomeado e um executável com
 * nome de lista chegam todos aqui. A extensão só desempata o que os bytes não decidem (texto puro).
 *
 * Função pura: roda no Web Worker do navegador e no servidor com o mesmo resultado.
 */

export type Formato =
  | 'xlsx'
  | 'xls'
  | 'ods'
  | 'numbers'
  | 'docx'
  | 'doc'
  | 'odt'
  | 'rtf'
  | 'pdf'
  | 'imagem'
  | 'vcard'
  | 'json'
  | 'html'
  | 'texto'
  | 'zip'

export type Recusa =
  | 'vazio'
  | 'executavel'
  | 'macro'
  | 'protegido_por_senha'
  | 'compactado_desconhecido'
  | 'binario_desconhecido'

export type Farejado =
  | { aceito: true; formato: Formato; detalhe?: string }
  | { aceito: false; recusa: Recusa; mensagem: string }

/** O que a pessoa lê quando o arquivo não entra. Diz o que fazer, não só o que deu errado. */
export const MENSAGEM_DA_RECUSA: Record<Recusa, string> = {
  vazio: 'O arquivo está vazio. Confira se baixou inteiro e tente de novo.',
  executavel: 'Isto é um programa, não uma lista. Por segurança, não abrimos.',
  macro: 'Esta planilha tem macro. Por segurança, não abrimos: salve como .xlsx comum (sem macro) ou como CSV e envie de novo.',
  protegido_por_senha: 'Esta planilha está protegida por senha. Abra no Excel, tire a senha e salve de novo.',
  compactado_desconhecido: 'É um arquivo compactado que não reconhecemos. Envie a planilha, o CSV ou o PDF que está dentro dele.',
  binario_desconhecido: 'Não reconhecemos este tipo de arquivo. Aceitamos planilha, CSV, PDF, contatos (.vcf), documento, texto, print e foto.',
}

const comeca = (b: Uint8Array, ...assinatura: number[]) => assinatura.every((v, i) => b[i] === v)

/** Procura uma sequência ASCII no buffer (nomes de arquivo dentro do zip não são comprimidos). */
function contemAscii(b: Uint8Array, texto: string, limite = b.length): boolean {
  const alvo = Array.from(texto, (c) => c.charCodeAt(0))
  const fim = Math.min(b.length, limite) - alvo.length
  externo: for (let i = 0; i <= fim; i++) {
    for (let j = 0; j < alvo.length; j++) if (b[i + j] !== alvo[j]) continue externo
    return true
  }
  return false
}

function recusa(r: Recusa): Farejado {
  return { aceito: false, recusa: r, mensagem: MENSAGEM_DA_RECUSA[r] }
}

/** Zip: o formato vem dos nomes das entradas (planilha, documento, ODF) — sem descompactar nada. */
function farejarZip(b: Uint8Array): Farejado {
  // Macro primeiro: `.xlsm` e `.docm` carregam o projeto VBA como entrada própria.
  if (contemAscii(b, 'vbaProject.bin')) return recusa('macro')
  // ODF grava `mimetype` sem compressão, logo no começo (a especificação exige).
  if (contemAscii(b, 'mimetypeapplication/vnd.oasis.opendocument.spreadsheet', 200)) return { aceito: true, formato: 'ods' }
  if (contemAscii(b, 'mimetypeapplication/vnd.oasis.opendocument.text', 200)) return { aceito: true, formato: 'odt' }
  if (contemAscii(b, 'xl/workbook.xml') || contemAscii(b, 'xl/worksheets/')) return { aceito: true, formato: 'xlsx' }
  if (contemAscii(b, 'word/document.xml')) return { aceito: true, formato: 'docx' }
  if (contemAscii(b, 'Index/Document.iwa')) return { aceito: true, formato: 'numbers' }
  return { aceito: true, formato: 'zip', detalhe: 'compactado: abrir e procurar a lista dentro' }
}

/** OLE2/CFB (Excel 97–2003, Word antigo). Planilha com senha guarda o fluxo `EncryptionInfo`. */
function farejarCfb(b: Uint8Array): Farejado {
  const utf16 = (s: string) => Array.from(s).flatMap((c) => [c.charCodeAt(0), 0])
  const tem = (s: string) => {
    const alvo = utf16(s)
    externo: for (let i = 0; i <= b.length - alvo.length; i++) {
      for (let j = 0; j < alvo.length; j++) if (b[i + j] !== alvo[j]) continue externo
      return true
    }
    return false
  }
  if (tem('EncryptionInfo') || tem('EncryptedPackage')) return recusa('protegido_por_senha')
  if (tem('_VBA_PROJECT')) return recusa('macro')
  if (tem('Workbook') || tem('Book')) return { aceito: true, formato: 'xls' }
  if (tem('WordDocument')) return { aceito: true, formato: 'doc' }
  return recusa('binario_desconhecido')
}

/** Fração de bytes de controle (fora de tab, CR, LF): texto de verdade quase não tem. */
function pareceTexto(b: Uint8Array): boolean {
  const amostra = b.subarray(0, Math.min(b.length, 8192))
  if (amostra.length === 0) return false
  // UTF-16 com BOM é texto, mesmo cheio de zeros.
  if (comeca(amostra, 0xff, 0xfe) || comeca(amostra, 0xfe, 0xff)) return true
  let controle = 0
  for (const v of amostra) if (v < 0x09 || (v > 0x0d && v < 0x20) || v === 0x7f) controle++
  return controle / amostra.length < 0.01
}

function primeiroTextoUtil(b: Uint8Array): string {
  let inicio = 0
  if (comeca(b, 0xef, 0xbb, 0xbf)) inicio = 3
  let s = ''
  for (let i = inicio; i < Math.min(b.length, inicio + 512); i++) {
    const v = b[i]!
    if (v === 0) continue // UTF-16: o zero de cada par sai, sobra o ASCII
    s += String.fromCharCode(v)
  }
  return s.replace(/^[\s﻿￾ÿþ]+/, '')
}

export function farejarFormato(bytes: Uint8Array, nome = ''): Farejado {
  const b = bytes
  if (b.length === 0) return recusa('vazio')

  if (comeca(b, 0x4d, 0x5a) || comeca(b, 0x7f, 0x45, 0x4c, 0x46) || comeca(b, 0xcf, 0xfa, 0xed, 0xfe) || comeca(b, 0xfe, 0xed, 0xfa, 0xcf)) {
    return recusa('executavel')
  }
  if (comeca(b, 0x50, 0x4b, 0x03, 0x04) || comeca(b, 0x50, 0x4b, 0x05, 0x06)) return farejarZip(b)
  if (comeca(b, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return farejarCfb(b)
  if (comeca(b, 0x25, 0x50, 0x44, 0x46, 0x2d)) return { aceito: true, formato: 'pdf' }
  if (comeca(b, 0x89, 0x50, 0x4e, 0x47)) return { aceito: true, formato: 'imagem', detalhe: 'png' }
  if (comeca(b, 0xff, 0xd8, 0xff)) return { aceito: true, formato: 'imagem', detalhe: 'jpeg' }
  if (comeca(b, 0x47, 0x49, 0x46, 0x38)) return { aceito: true, formato: 'imagem', detalhe: 'gif' }
  if (comeca(b, 0x42, 0x4d) && b.length > 26 && nome.toLowerCase().endsWith('.bmp')) return { aceito: true, formato: 'imagem', detalhe: 'bmp' }
  if (comeca(b, 0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { aceito: true, formato: 'imagem', detalhe: 'webp' }
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const marca = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!)
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc', 'avif'].includes(marca)) return { aceito: true, formato: 'imagem', detalhe: marca === 'avif' ? 'avif' : 'heic' }
  }
  if (comeca(b, 0x49, 0x49, 0x2a, 0x00) || comeca(b, 0x4d, 0x4d, 0x00, 0x2a)) return { aceito: true, formato: 'imagem', detalhe: 'tiff' }
  if (comeca(b, 0x1f, 0x8b) || comeca(b, 0x52, 0x61, 0x72, 0x21) || comeca(b, 0x37, 0x7a, 0xbc, 0xaf)) return recusa('compactado_desconhecido')

  if (!pareceTexto(b)) return recusa('binario_desconhecido')

  const inicio = primeiroTextoUtil(b)
  const minusculo = inicio.toLowerCase()
  if (minusculo.startsWith('{\\rtf')) return { aceito: true, formato: 'rtf' }
  if (/^begin:vcard/i.test(inicio)) return { aceito: true, formato: 'vcard' }
  if (/^(<!doctype html|<html|<table|<meta|<body|<div)/i.test(inicio)) return { aceito: true, formato: 'html' }
  if (/^[[{]/.test(inicio)) return { aceito: true, formato: 'json' }
  return { aceito: true, formato: 'texto' }
}
