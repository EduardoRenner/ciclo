import { describe, expect, it } from 'vitest'

import { desfazerNeutralizacao, neutralizarFormula, paraCsv, textoDaCelula } from '@/core/exportacao/csv'
import { descritor, montarPacote } from '@/core/exportacao/pacote'
import { RECURSOS } from '@/core/exportacao/recursos'
import { decodificar } from '@/core/ingestao/codificacao'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { processarGrade } from '@/core/ingestao/esteira'

/** CNV-009/010: a exportação aberta e reimportável. Dados inventados. */
const CLIENTES = [
  { id: 'c1', name: '=HYPERLINK("http://x","clique")', phone_e164: '+5511999990001', email: 'maria@exemplo.com', birth_date: '1990-08-25', tags: ['vip', 'cabelo'], last_visit_at: '2026-08-15T12:00:00.000Z', notes: null },
  { id: 'c2', name: '-Ana Paula', phone_e164: '+5521988887777', email: null, birth_date: null, tags: [], last_visit_at: '2026-09-02T12:00:00.000Z', notes: '+ gosta de franja' },
  { id: 'c3', name: 'Conceição Ávila', phone_e164: '+554133334444', email: 'conceicao@exemplo.com.br', birth_date: '1985-12-31', tags: ['barba'], last_visit_at: null, notes: 'linha 1\nlinha 2; com ponto e vírgula, e "aspas"' },
  { id: 'c4', name: '＝1+1 Silva', phone_e164: null, email: 'ff@exemplo.com', birth_date: null, tags: [], last_visit_at: '2026-07-20T12:00:00.000Z', notes: null },
]
const clientes = RECURSOS.find((r) => r.nome === 'clientes')!

describe('neutralizar fórmula sem estragar a ida e volta (CNV-010, D17)', () => {
  it('todo gatilho ganha o TAB; o resto fica igual', () => {
    for (const v of ['=SUM(A1)', '+55', '-Ana', '@x', '\tx', '\rx', '\nx', '＝x', '＋x', '－x', '＠x']) expect(neutralizarFormula(v), JSON.stringify(v)).toBe(`\t${v}`)
    expect(neutralizarFormula('Maria')).toBe('Maria')
  })

  it('o inverso devolve o original, e entende o "\'" antigo', () => {
    for (const v of ['=SUM(A1)', '-Ana', '＝x', 'Maria', "D'Ávila"]) expect(desfazerNeutralizacao(neutralizarFormula(v))).toBe(v)
    expect(desfazerNeutralizacao("'-Ana")).toBe('-Ana')
    expect(desfazerNeutralizacao("'Maria")).toBe("'Maria")
  })

  it('no Excel: telefone (11) 99999-0001 (o + viraria fórmula, D16), reais com vírgula, data dd/mm/aaaa', () => {
    expect(textoDaCelula('+5511999990001', 'telefone', 'excel')).toBe('(11) 99999-0001')
    expect(textoDaCelula('+554133334444', 'telefone', 'excel')).toBe('(41) 3333-4444')
    expect(textoDaCelula(123456, 'centavos', 'excel')).toBe('1.234,56')
    expect(textoDaCelula(-500, 'centavos', 'excel')).toBe('-5,00')
    expect(textoDaCelula('1990-08-25', 'date', 'excel')).toBe('25/08/1990')
    expect(textoDaCelula(null, 'string', 'excel')).toBe('')
    expect(textoDaCelula(true, 'boolean', 'excel')).toBe('sim')
  })

  it('no aberto: dado cru (E.164, ISO, centavos), sem BOM; no Excel: BOM e ponto e vírgula', () => {
    const aberto = paraCsv(clientes.colunas, CLIENTES.map((c) => ({ id: c.id, name: c.name, phone: c.phone_e164 })), 'aberto')
    expect(aberto.startsWith('id,name,phone')).toBe(true)
    expect(aberto).toContain('+5511999990001')
    const excel = paraCsv(clientes.colunas, [], 'excel')
    expect(excel.startsWith('﻿ID;Nome;Telefone')).toBe(true)
  })
})

describe('ida e volta: exportar e importar de novo dá as mesmas pessoas (CNV-009)', () => {
  for (const dialeto of ['aberto', 'excel'] as const) {
    it(dialeto, () => {
      const linhas = CLIENTES.map((c) => Object.fromEntries(clientes.colunas.map((col) => [col.nome, (c as Record<string, unknown>)[col.de] ?? null])))
      const csv = paraCsv(clientes.colunas, linhas, dialeto)
      const bytes = new TextEncoder().encode(csv)
      const { grade } = gradeDeTexto(decodificar(bytes).texto)
      const r = processarGrade(grade, { hoje: '2026-10-13' })
      const c = r.contagem
      expect(c.ouro + c.comAviso + c.quarentena + c.ignoradas).toBe(c.lidas)
      expect(r.registros.map((x) => x.nome)).toEqual(CLIENTES.map((x) => x.name))
      expect(r.registros.map((x) => x.telefone)).toEqual(CLIENTES.map((x) => x.phone_e164))
      expect(r.registros.map((x) => x.email)).toEqual(CLIENTES.map((x) => x.email))
      expect(r.registros.map((x) => x.nascimento)).toEqual(CLIENTES.map((x) => x.birth_date))
      expect(r.registros.map((x) => x.ultimaVisita)).toEqual(CLIENTES.map((x) => x.last_visit_at?.slice(0, 10) ?? null))
      expect(r.registros.map((x) => x.etiquetas)).toEqual(CLIENTES.map((x) => x.tags))
      expect(r.registros.map((x) => x.observacao)).toEqual(CLIENTES.map((x) => x.notes))
    })
  }
})

describe('reimportar um export ANTIGO (com o apóstrofo da regra velha) devolve o nome certo (D17)', () => {
  it("\"'-Ana\" volta \"-Ana\"", () => {
    const csv = ['nome;telefone', "'-Ana Paula;11999990001", "'=Maria;11999990002", 'Rita;11999990003'].join('\n')
    const r = processarGrade(gradeDeTexto(csv).grade, { hoje: '2026-10-13' })
    expect(r.registros.map((x) => x.nome)).toEqual(['-Ana Paula', '=Maria', 'Rita'])
  })
})

describe('o pacote inteiro (CNV-009)', () => {
  it('cada recurso sai nos dois dialetos, com datapackage.json e LEIA-ME', () => {
    const arquivos = montarPacote({ clients: CLIENTES }, 'Salão Exemplo', '2026-10-13T12:00:00Z')
    const caminhos = arquivos.map((a) => a.caminho)
    for (const r of RECURSOS) {
      expect(caminhos).toContain(`${r.nome}.csv`)
      expect(caminhos).toContain(`excel/${r.titulo}.csv`)
    }
    expect(caminhos).toContain('datapackage.json')
    const leia = arquivos.find((a) => a.caminho === 'LEIA-ME.txt')!.conteudo
    expect(leia).toMatch(/clientes\.csv \(Clientes\): 4 linha/)
    expect(leia).toMatch(/saúde/)
  })

  it('o datapackage descreve exatamente as colunas de cada CSV (Data Package v2)', () => {
    const d = descritor(RECURSOS, '2026-10-13T12:00:00Z', 'Salão Exemplo')
    expect(d.$schema).toBe('https://datapackage.org/profiles/2.0/datapackage.json')
    const arquivos = montarPacote({}, 'Salão Exemplo', '2026-10-13T12:00:00Z')
    for (const res of d.resources) {
      expect(res.name).toMatch(/^[a-z0-9_]+$/)
      const cabecalho = arquivos.find((a) => a.caminho === res.path)!.conteudo.split('\r\n')[0]!.split(',')
      expect(cabecalho, res.name).toEqual(res.schema.fields.map((f) => f.name))
      expect(res.schema.fields.map((f) => f.name)).toContain('id')
    }
  })

  it('preferências (podem ter alergia) e colunas internas nunca saem', () => {
    const todas = RECURSOS.flatMap((r) => r.colunas.map((c) => `${r.tabela}.${c.de}`))
    for (const proibida of ['clients.preferences', 'clients.phone_hash', 'clients.name_busca', 'appointments.risk_features', 'payments.psp_payload', 'payments.pix_qr']) expect(todas).not.toContain(proibida)
  })
})
