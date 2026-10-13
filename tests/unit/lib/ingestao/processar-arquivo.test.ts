import { describe, expect, it } from 'vitest'

import { escrever, base } from '../../../fixtures/ingestao/gerador'

import { decodificar } from '@/core/ingestao/codificacao'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { processarGrade } from '@/core/ingestao/esteira'
import { gradeDeJson } from '@/core/ingestao/json'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-012: a esteira de um arquivo, igual no Worker e na linha principal. Dados inventados. */
const HOJE = '2026-10-13'
const bytes = (s: string) => new TextEncoder().encode(s)

describe('JSON e NDJSON viram grade (CNV-012)', () => {
  it('lista, envelope, aninhado e NDJSON', () => {
    expect(gradeDeJson('[{"nome":"Maria","tel":"11999990001"},{"nome":"João","email":"j@x.com"}]')).toEqual({
      ok: true,
      grade: [
        ['nome', 'tel', 'email'],
        ['Maria', '11999990001', ''],
        ['João', '', 'j@x.com'],
      ],
    })
    expect(gradeDeJson('{"total":2,"clientes":[{"nome":"Maria","endereco":{"cidade":"Curitiba"},"tags":["vip","barba"]}]}')).toEqual({
      ok: true,
      grade: [
        ['nome', 'endereco.cidade', 'tags'],
        ['Maria', 'Curitiba', 'vip, barba'],
      ],
    })
    expect(gradeDeJson('{"nome":"Maria"}\n{"nome":"João"}\n')).toEqual({ ok: true, grade: [['nome'], ['Maria'], ['João']] })
    expect(gradeDeJson('{"a":1}')).toEqual({ ok: false, motivo: 'sem_lista' })
    expect(gradeDeJson('[{"a":')).toEqual({ ok: false, motivo: 'json_invalido' })
  })
})

describe('processarArquivo: bytes → caixas (CNV-012)', () => {
  it('CSV entra e sai com as pessoas, a contagem e o formato', async () => {
    const r = await processarArquivo({ bytes: bytes('Nome;Telefone\nMaria Souza;11999990001\nJoão Lima;11988880002'), nome: 'lista.csv', contexto: { hoje: HOJE } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.formato).toBe('texto')
    expect(r.resultado.registros.map((x) => x.nome)).toEqual(['Maria Souza', 'João Lima'])
  })

  it('JSON exportado de outro sistema entra pela mesma esteira', async () => {
    const r = await processarArquivo({ bytes: bytes('{"data":[{"name":"Maria Souza","phone":"+5511999990001"},{"name":"João Lima","phone":"+5511988880002"}]}'), nome: 'export.json', contexto: { hoje: HOJE } })
    expect(r.ok && r.resultado.registros.map((x) => x.telefone)).toEqual(['+5511999990001', '+5511988880002'])
  })

  it('formato reconhecido ainda sem leitor responde o que fazer, nunca lixo', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const r = await processarArquivo({ bytes: png, nome: 'print.png', contexto: { hoje: HOJE } })
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/cole a lista/) })
  })

  it('planilha corrompida (cabeçalho de zip sem o resto) vira mensagem, não exceção', async () => {
    const quebrada = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, ...new Array(26).fill(0), ...Array.from('xl/workbook.xml', (c) => c.charCodeAt(0))])
    const r = await processarArquivo({ bytes: quebrada, nome: 'clientes.xlsx', contexto: { hoje: HOJE } })
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/corrompido/) })
  })

  it('programa com nome de planilha é recusado com o motivo', async () => {
    const r = await processarArquivo({ bytes: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]), nome: 'clientes.csv', contexto: { hoje: HOJE } })
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/programa/) })
  })

  it('paridade: o mesmo arquivo dá o mesmo resultado que o caminho do servidor (esteira direta)', async () => {
    const arquivo = escrever(base(8), { separador: ';', codificacao: 'cp1252', titulo: true, filtro: true, total: true, telefone: 0, data: 'excel', cabecalho: 'pt', armadilhas: true, embaralhar: true, grao: 'cliente' })
    const pelaFuncao = await processarArquivo({ bytes: arquivo, nome: 'base.csv', contexto: { hoje: HOJE } })
    const direto = processarGrade(gradeDeTexto(decodificar(arquivo).texto).grade, { hoje: HOJE })
    expect(pelaFuncao.ok && pelaFuncao.resultado).toEqual(direto)
  })
})
