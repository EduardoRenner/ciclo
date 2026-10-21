import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { farejarFormato } from '@/core/ingestao/formato'
import { lerParaGrades } from '@/lib/ingestao/ler'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-013: `.xlsx` montado à mão, como o Excel grava (ECMA-376). Dados inventados. */
function xlsx({ data1904 = false } = {}) {
  const workbook = `<workbook xmlns:r="r"><workbookPr${data1904 ? ' date1904="1"' : ''}/><sheets><sheet name="Resumo" sheetId="2" r:id="rId2"/><sheet name="Clientes &amp; Cia" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const rels = '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId3" Type="styles" Target="styles.xml"/></Relationships>'
  const shared =
    '<sst><si><t>Nome</t></si><si><t>Telefone</t></si><si><t>Última visita</t></si><si><t>Ativo</t></si><si><r><t>Maria </t></r><r><rPr><b/></rPr><t>Souza</t></r></si><si><t>João Lima</t></si><si><t>Total</t></si></sst>'
  const styles =
    '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy;@"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>'
  const sheet1 =
    '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="E1" t="s"><v>3</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2"><v>11999990001</v></c><c r="C2" s="1"><v>46259</v></c><c r="E2" t="b"><v>1</v></c></row>' +
    '<row r="4"><c r="A4" t="inlineStr"><is><t>Conceição Ávila</t></is></c><c r="B4" t="str"><f>"(41) "&amp;"99999-0003"</f><v>(41) 99999-0003</v></c><c r="C4" s="2"><v>46230</v></c><c r="D4" t="e"><v>#N/A</v></c></row>' +
    '<row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3" t="s"><v>1</v></c></row>' +
    '</sheetData></worksheet>'
  const sheet2 = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>6</v></c><c r="B1"><v>0.30000000000000004</v></c></row></sheetData></worksheet>'
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
    'xl/sharedStrings.xml': strToU8(shared),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
  })
}

describe('planilha do Excel (.xlsx) sem biblioteca (CNV-013)', () => {
  it('é reconhecida pelos bytes', () => {
    expect(farejarFormato(xlsx(), 'qualquer.bin')).toEqual({ aceito: true, formato: 'xlsx' })
  })

  it('abas na ordem do workbook, células puladas no lugar, texto rico, fórmula pelo valor, booleano, erro vazio, datas pelo estilo', async () => {
    const lido = await lerParaGrades(xlsx(), 'base.xlsx')
    expect(lido.ok).toBe(true)
    if (!lido.ok) return
    expect(lido.abas.map((a) => a.nome)).toEqual(['Resumo', 'Clientes & Cia'])
    expect(lido.abas[0]!.grade).toEqual([['Total', '0.3']])
    expect(lido.abas[1]!.grade).toEqual([
      ['Nome', 'Telefone', 'Última visita', '', 'Ativo'],
      ['Maria Souza', '11999990001', '2026-08-25', '', 'sim'],
      ['João Lima', 'Telefone'],
      ['Conceição Ávila', '(41) 99999-0003', '2026-07-27', ''],
    ])
  })

  it('calendário 1904 (Mac antigo) dá a mesma data com outro número', async () => {
    const lido = await lerParaGrades(xlsx({ data1904: true }), 'base.xlsx')
    // 46259 no sistema 1904 = 4 anos e 1 dia depois.
    expect(lido.ok && lido.abas[1]!.grade[1]![2]).toBe('2030-08-26')
  })

  it('ponta a ponta: a aba com mais linhas vai pela esteira até as fichas', async () => {
    const r = await processarArquivo({ bytes: xlsx(), nome: 'base.xlsx', contexto: { hoje: '2026-10-13' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.abas).toEqual(['Resumo', 'Clientes & Cia'])
    expect(r.aba).toBe(1)
    expect(r.resultado.registros.map((x) => [x.nome, x.telefone, x.ultimaVisita])).toEqual([
      ['Maria Souza', '+5511999990001', '2026-08-25'],
      ['João Lima', null, null],
      ['Conceição Ávila', '+5541999990003', '2026-07-27'],
    ])
  })
})
