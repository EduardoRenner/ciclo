import { describe, expect, it } from 'vitest'

import { decodificar } from '@/core/ingestao/codificacao'
import { farejarFormato } from '@/core/ingestao/formato'

/** CNV-001: E0–E2 da esteira. Os bytes são montados aqui: nenhum arquivo real de cliente. */
const ascii = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)))
const junta = (...partes: (Uint8Array | number[])[]) => Uint8Array.from(partes.flatMap((p) => Array.from(p)))
const zip = (...nomes: string[]) => junta([0x50, 0x4b, 0x03, 0x04], new Array(26).fill(0), ...nomes.map((n) => ascii(n + '\0\0\0\0')))
const utf16 = (s: string) => Array.from(s).flatMap((c) => [c.charCodeAt(0), 0])
const cfb = (...fluxos: string[]) => junta([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], new Array(504).fill(0), ...fluxos.map(utf16))
const cp1252 = (s: string) => Uint8Array.from(Array.from(s, (c) => ({ ã: 0xe3, ç: 0xe7, é: 0xe9, ô: 0xf4, á: 0xe1 })[c] ?? c.charCodeAt(0)))
const formato = (b: Uint8Array, nome?: string) => {
  const r = farejarFormato(b, nome)
  return r.aceito ? r.formato : `recusa:${r.recusa}`
}

describe('farejarFormato: o formato sai dos bytes, não da extensão (CNV-001)', () => {
  it('planilhas: xlsx, ods, xls e Numbers', () => {
    expect(formato(zip('[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'))).toBe('xlsx')
    expect(formato(junta([0x50, 0x4b, 0x03, 0x04], new Array(26).fill(0), ascii('mimetypeapplication/vnd.oasis.opendocument.spreadsheet')))).toBe('ods')
    expect(formato(cfb('Root Entry', 'Workbook'))).toBe('xls')
    expect(formato(zip('Index/Document.iwa'))).toBe('numbers')
  })

  it('documentos: docx, odt, doc, rtf, html', () => {
    expect(formato(zip('[Content_Types].xml', 'word/document.xml'))).toBe('docx')
    expect(formato(junta([0x50, 0x4b, 0x03, 0x04], new Array(26).fill(0), ascii('mimetypeapplication/vnd.oasis.opendocument.text')))).toBe('odt')
    expect(formato(cfb('Root Entry', 'WordDocument'))).toBe('doc')
    expect(formato(ascii('{\\rtf1\\ansi Clientes'))).toBe('rtf')
    expect(formato(ascii('<table><tr><td>Maria</td></tr></table>'))).toBe('html')
  })

  it('PDF e imagens (print e foto): png, jpeg, webp, heic, gif, tiff', () => {
    expect(formato(ascii('%PDF-1.7\n'))).toBe('pdf')
    expect(formato(junta([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('imagem')
    expect(farejarFormato(junta([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ aceito: true, formato: 'imagem', detalhe: 'jpeg' })
    expect(farejarFormato(junta(ascii('RIFF'), [0, 0, 0, 0], ascii('WEBPVP8 ')))).toEqual({ aceito: true, formato: 'imagem', detalhe: 'webp' })
    expect(farejarFormato(junta([0, 0, 0, 0x18], ascii('ftypheic'), [0, 0, 0, 0]))).toEqual({ aceito: true, formato: 'imagem', detalhe: 'heic' })
    expect(formato(ascii('GIF89a'))).toBe('imagem')
    expect(formato(junta([0x49, 0x49, 0x2a, 0x00]))).toBe('imagem')
  })

  it('texto: vCard, JSON, CSV — e CSV com nome de .xlsx continua texto', () => {
    expect(formato(ascii('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Maria\r\nEND:VCARD'))).toBe('vcard')
    expect(formato(ascii('[{"nome":"Maria"}]'))).toBe('json')
    expect(formato(ascii('nome;telefone\nMaria;11999990000'))).toBe('texto')
    expect(formato(ascii('nome,telefone\nMaria,11999990000'), 'clientes.xlsx')).toBe('texto')
    expect(formato(junta([0xef, 0xbb, 0xbf], ascii('BEGIN:VCARD')))).toBe('vcard')
    expect(formato(junta([0xff, 0xfe], utf16('nome\ttelefone\n')))).toBe('texto')
  })

  it('arquivo .xlsx que é PDF renomeado vira PDF', () => {
    expect(formato(ascii('%PDF-1.4'), 'clientes.xlsx')).toBe('pdf')
  })

  it('recusa com motivo: vazio, programa, macro, senha, compactado estranho, binário', () => {
    expect(formato(new Uint8Array())).toBe('recusa:vazio')
    expect(formato(junta([0x4d, 0x5a, 0x90, 0x00]), 'clientes.csv')).toBe('recusa:executavel')
    expect(formato(junta([0x7f, 0x45, 0x4c, 0x46]))).toBe('recusa:executavel')
    expect(formato(zip('xl/workbook.xml', 'xl/vbaProject.bin'))).toBe('recusa:macro')
    expect(formato(cfb('Root Entry', 'Workbook', '_VBA_PROJECT'))).toBe('recusa:macro')
    expect(formato(cfb('EncryptionInfo', 'EncryptedPackage'))).toBe('recusa:protegido_por_senha')
    expect(formato(junta([0x1f, 0x8b, 0x08]))).toBe('recusa:compactado_desconhecido')
    expect(formato(junta([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0]))).toBe('recusa:binario_desconhecido')
    const r = farejarFormato(junta([0x4d, 0x5a]))
    expect(r.aceito === false && r.mensagem).toMatch(/programa/)
  })

  it('zip qualquer é aceito para abrir e procurar a lista dentro', () => {
    expect(formato(zip('clientes/lista.csv'))).toBe('zip')
  })
})

describe('decodificar: a codificação certa, dita no relatório (CNV-001)', () => {
  it('UTF-8, com e sem BOM', () => {
    const utf8 = new TextEncoder().encode('Maria João;Conceição')
    expect(decodificar(utf8)).toEqual({ texto: 'Maria João;Conceição', codificacao: 'utf-8', corrigidoDuploUtf8: false })
    expect(decodificar(junta([0xef, 0xbb, 0xbf], utf8)).codificacao).toBe('utf-8-bom')
    expect(decodificar(junta([0xef, 0xbb, 0xbf], utf8)).texto).toBe('Maria João;Conceição')
  })

  it('CSV do Excel em Windows-1252 não vira "Jo�o"', () => {
    const r = decodificar(cp1252('nome;cidade\nJoão;São Paulo\nConceição;Ribeirão'))
    expect(r.codificacao).toBe('windows-1252')
    expect(r.texto).toBe('nome;cidade\nJoão;São Paulo\nConceição;Ribeirão')
    expect(r.texto).not.toContain('�')
  })

  it('UTF-16 com e sem BOM (export de alguns sistemas e do Excel "Unicode")', () => {
    expect(decodificar(junta([0xff, 0xfe], utf16('nome\tJoão'))).texto).toBe('nome\tJoão')
    expect(decodificar(Uint8Array.from(utf16('nome\ttelefone\nMaria\t11999990000'))).codificacao).toBe('utf-16le')
  })

  it('"JoÃ£o" (UTF-8 lido duas vezes) volta a "João", e o relatório diz que corrigiu', () => {
    const estragado = new TextEncoder().encode('JoÃ£o;ConceiÃ§Ã£o;SebastiÃ£o')
    const r = decodificar(estragado)
    expect(r).toEqual({ texto: 'João;Conceição;Sebastião', codificacao: 'utf-8', corrigidoDuploUtf8: true })
  })

  it('texto com um "Ã" legítimo isolado não é "consertado"', () => {
    const r = decodificar(new TextEncoder().encode('ÃGUA MINERAL ¿'))
    expect(r.corrigidoDuploUtf8).toBe(false)
  })
})
