import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CATEGORIAS, conferirArquivo, MIMES_ACEITOS } from '@/core/advocacia/documentos'

const b = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))

describe('conferirArquivo', () => {
  it('reconhece pelos bytes, não pelo que foi declarado', () => {
    expect(conferirArquivo(b('%PDF-1.7\n'), 'image/png')).toEqual({ ok: true, mime: 'application/pdf' })
    expect(conferirArquivo(b(0xff, 0xd8, 0xff, 0xe0, 0, 0x10), null)).toEqual({ ok: true, mime: 'image/jpeg' })
    expect(conferirArquivo(b(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0), null)).toEqual({ ok: true, mime: 'image/png' })
    expect(conferirArquivo(b('RIFF', 0, 0, 0, 0, 'WEBPVP8 '), null)).toEqual({ ok: true, mime: 'image/webp' })
    expect(conferirArquivo(b(0, 0, 0, 0x18, 'ftypheic', 0), null)).toEqual({ ok: true, mime: 'image/heic' })
  })

  it('executável renomeado para .pdf não entra', () => {
    expect(conferirArquivo(b('MZ', 0x90, 0, 3, 0), 'application/pdf')).toMatchObject({ ok: false, motivo: expect.stringContaining('tipo não permitido') })
  })

  it('ZIP só entra como Word, Excel ou ODT declarado; ZIP qualquer é recusado', () => {
    const zip = b(0x50, 0x4b, 0x03, 0x04, 0x14, 0)
    expect(conferirArquivo(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toMatchObject({ ok: true })
    expect(conferirArquivo(zip, 'application/zip')).toMatchObject({ ok: false })
  })

  it('texto puro só se for texto de verdade', () => {
    expect(conferirArquivo(new TextEncoder().encode('Procuração assinada em 08/10.\n'), 'text/plain')).toEqual({ ok: true, mime: 'text/plain' })
    expect(conferirArquivo(b('abc', 0, 'def'), 'text/plain')).toMatchObject({ ok: false })
    expect(conferirArquivo(new TextEncoder().encode('sem tipo declarado'), null)).toMatchObject({ ok: false })
  })

  it('vazio e acima de 50 MB são recusados com a frase', () => {
    expect(conferirArquivo(new Uint8Array(), 'application/pdf')).toEqual({ ok: false, motivo: 'O arquivo está vazio.' })
    expect(conferirArquivo(new Uint8Array(50 * 1024 * 1024 + 1), 'application/pdf')).toEqual({ ok: false, motivo: 'O arquivo passa de 50 MB.' })
  })
})

describe('listas batem com o banco (0107)', () => {
  const sql = readFileSync('supabase/migrations/0107_legal_documentos.sql', 'utf8')
  it('categorias', () => {
    const m = sql.match(/category\s+text[^\n]*check \(category in \(([^)]*)\)/s)
    expect(m, 'check de category não achado').not.toBeNull()
    expect(Object.keys(CATEGORIAS).sort()).toEqual([...m![1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort())
  })
  it('tipos aceitos', () => {
    const m = sql.match(/mime\s+text not null check \(mime in \(([^)]*)\)/s)
    expect(m, 'check de mime não achado').not.toBeNull()
    expect([...MIMES_ACEITOS].sort()).toEqual([...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort())
  })
})
