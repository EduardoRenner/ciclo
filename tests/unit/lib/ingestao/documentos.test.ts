import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { gradesDeDocx, gradesDeHtml } from '@/core/ingestao/documento'
import { lerParaGrades } from '@/lib/ingestao/ler'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-016: documentos e compactados, montados aqui com o fflate. Dados inventados. */
const HOJE = '2026-10-13'
const nomes = async (bytes: Uint8Array, arquivo: string) => {
  const r = await processarArquivo({ bytes, nome: arquivo, contexto: { hoje: HOJE } })
  if (!r.ok) throw new Error(r.mensagem)
  return r.resultado.registros.map((x) => [x.nome, x.telefone])
}

const DOCX = zipSync({
  '[Content_Types].xml': strToU8('<Types/>'),
  'word/document.xml': strToU8(
    '<w:document><w:body><w:p><w:r><w:t>Lista de clientes</w:t></w:r></w:p><w:tbl>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Nome</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Celular</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t xml:space="preserve">Maria </w:t></w:r><w:r><w:t>Souza</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>(11) 99999-0001</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Jo&#227;o Lima &amp; Filho</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>(11) 98888-0002</w:t></w:r></w:p></w:tc></w:tr>' +
      '</w:tbl></w:body></w:document>',
  ),
})

const CONTENT_ODT =
  '<office:document-content><office:body><office:text><table:table table:name="Tabela1">' +
  '<table:table-row><table:table-cell><text:p>Nome</text:p></table:table-cell><table:table-cell><text:p>Telefone</text:p></table:table-cell></table:table-row>' +
  '<table:table-row><table:table-cell><text:p>Ana<text:s/>Paula</text:p></table:table-cell><table:table-cell><text:p>21987776666</text:p></table:table-cell></table:table-row>' +
  '<table:table-row><table:table-cell table:number-columns-repeated="2"><text:p>Rita Alves</text:p></table:table-cell></table:table-row>' +
  '</table:table></office:text></office:body></office:document-content>'
const ODT = zipSync({ mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }], 'content.xml': strToU8(CONTENT_ODT) })

const CONTENT_ODS =
  '<office:document-content><office:body><office:spreadsheet>' +
  '<table:table table:name="Resumo"><table:table-row><table:table-cell><text:p>Total</text:p></table:table-cell><table:table-cell><text:p>2</text:p></table:table-cell></table:table-row></table:table>' +
  '<table:table table:name="Clientes">' +
  '<table:table-row><table:table-cell><text:p>Nome</text:p></table:table-cell><table:table-cell><text:p>Telefone</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1022"/></table:table-row>' +
  '<table:table-row><table:table-cell><text:p>Carla Nunes</text:p></table:table-cell><table:table-cell><text:p>(41) 99999-0003</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1022"/></table:table-row>' +
  '<table:table-row><table:table-cell><text:p>Duda Prado</text:p></table:table-cell><table:table-cell><text:p>(41) 99999-0004</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1022"/></table:table-row>' +
  '<table:table-row table:number-rows-repeated="1048573"><table:table-cell table:number-columns-repeated="1024"/></table:table-row>' +
  '</table:table></office:spreadsheet></office:body></office:document-content>'
const ODS = zipSync({ mimetype: [strToU8('application/vnd.oasis.opendocument.spreadsheet'), { level: 0 }], 'content.xml': strToU8(CONTENT_ODS) })

describe('documentos viram grade (CNV-016)', () => {
  it('tabela HTML colada: colspan, entidades e script ignorado', () => {
    const html = '<p>oi</p><script>alert(1)</script><table><tr><th>Nome</th><th colspan="2">Contato</th></tr><tr><td>Maria&nbsp;Souza<script>roubar()</script></td><td>(11) 99999-0001</td><td>m@x.com</td></tr></table>'
    expect(gradesDeHtml(html)).toEqual([
      [
        ['Nome', 'Contato', ''],
        ['Maria Souza', '(11) 99999-0001', 'm@x.com'],
      ],
    ])
  })

  it('.docx: a tabela do Word entra pela esteira, com texto em vários pedaços e entidades', async () => {
    expect(await nomes(DOCX, 'clientes.docx')).toEqual([
      ['Maria Souza', '+5511999990001'],
      ['João Lima & Filho', '+5511988880002'],
    ])
  })

  it('.docx: célula mesclada (gridSpan) não desloca as colunas de baixo', () => {
    const xml =
      '<w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Cliente</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Fone</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Maria</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Souza</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>11999990001</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
    expect(gradesDeDocx(xml)).toEqual([
      [
        ['Cliente', '', 'Fone'],
        ['Maria', 'Souza', '11999990001'],
      ],
    ])
  })

  it('.odt: espaço especial e coluna repetida', async () => {
    const lido = await lerParaGrades(ODT, 'lista.odt')
    expect(lido.ok && lido.abas[0]!.grade).toEqual([
      ['Nome', 'Telefone'],
      ['Ana Paula', '21987776666'],
      ['Rita Alves', 'Rita Alves'],
    ])
  })

  it('.ods: abas com nome; o preenchimento do editor até a coluna 1024 e o milhão de linhas vazias não explodem', async () => {
    const lido = await lerParaGrades(ODS, 'planilha.ods')
    expect(lido.ok && lido.abas.map((a) => a.nome)).toEqual(['Resumo', 'Clientes'])
    expect(lido.ok && lido.abas[1]!.grade).toEqual([
      ['Nome', 'Telefone'],
      ['Carla Nunes', '(41) 99999-0003'],
      ['Duda Prado', '(41) 99999-0004'],
    ])
    // A esteira escolhe a aba com mais linhas: a de clientes.
    expect(await nomes(ODS, 'planilha.ods')).toEqual([
      ['Carla Nunes', '+5541999990003'],
      ['Duda Prado', '+5541999990004'],
    ])
  })
})

describe('arquivo compactado (CNV-016)', () => {
  it('a lista dentro do zip entra; mídia e lixo do macOS ficam de fora', async () => {
    const zip = zipSync({
      'export/clientes.csv': strToU8('Nome;Telefone\nMaria Souza;11999990001'),
      'export/foto.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
      '__MACOSX/export/._clientes.csv': strToU8('lixo'),
    })
    expect(await nomes(zip, 'export.zip')).toEqual([['Maria Souza', '+5511999990001']])
  })

  it('zip-bomba (entrada que descompacta além do teto) é recusado antes de abrir', async () => {
    const bomba = zipSync({ 'clientes.csv': new Uint8Array(31 * 1024 * 1024) })
    expect(bomba.length).toBeLessThan(100 * 1024)
    expect(await lerParaGrades(bomba, 'b.zip')).toEqual({ ok: false, mensagem: expect.stringMatching(/grande demais/) })
  })

  it('zip dentro de zip não é aberto, nem disfarçado com nome de CSV', async () => {
    const dentro = zipSync({ 'lista.csv': strToU8('Nome'+String.fromCharCode(10)+'Maria') })
    const fora = zipSync({ 'disfarcado.csv': dentro, 'leia.txt': strToU8('oi') })
    const lido = await lerParaGrades(fora, 'fora.zip')
    expect(lido.ok && lido.abas.map((a) => a.nome)).toEqual(['leia.txt'])
  })
})
