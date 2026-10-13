import { describe, expect, it } from 'vitest'

import { pdfComTexto, type TextoNaPagina } from '../../../fixtures/ingestao/pdf'

import { gradeDePalavras } from '@/core/ingestao/pdf-tabela'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-017: PDF com texto → tabela, pelo pdf.js e pelo modo "stream". PDFs gerados aqui. */
const HOJE = '2026-10-13'

/** Relatório de outro sistema: título, cabeçalho, linhas, rodapé; colunas alinhadas, sem grade desenhada. */
function relatorio(): TextoNaPagina[][] {
  const linha = (y: number, nome: string, tel: string, data: string) => [
    { x: 50, y, texto: nome },
    { x: 260, y, texto: tel },
    { x: 420, y, texto: data },
  ]
  return [
    [
      { x: 50, y: 800, texto: 'Relatório de Clientes' },
      ...linha(760, 'Nome', 'Telefone', 'Última visita'),
      ...linha(740, 'Maria Souza', '(11) 99999-0001', '15/08/2026'),
      ...linha(725, 'João Lima', '(11) 98888-0002', '02/09/2026'),
      // Uma célula vazia no meio (sem telefone): não pode puxar a data para a coluna do telefone.
      { x: 50, y: 710, texto: 'Conceição Ávila' },
      { x: 420, y: 710, texto: '20/09/2026' },
    ],
    [...linha(760, 'Nome', 'Telefone', 'Última visita'), ...linha(740, 'Ana Paula', '(21) 97777-0004', '25/09/2026'), { x: 50, y: 60, texto: 'Página 2 de 2 - gerado pelo Sistema X' }],
  ]
}

describe('palavras com posição → grade (CNV-017)', () => {
  it('colunas pelas linhas típicas; célula vazia não desloca; palavras próximas viram uma célula', () => {
    const p = (x: number, y: number, texto: string, largura = texto.length * 5) => ({ texto, x, y, largura, altura: 10, pagina: 1 })
    expect(
      gradeDePalavras([p(50, 700, 'Maria'), p(78, 700, 'Souza'), p(260, 700, '11999990001'), p(420, 700, '15/08'), p(50, 680, 'João Lima'), p(420, 680, '02/09'), p(50, 660, 'Ana'), p(260, 660, '21977770004'), p(420, 660, '25/09')]),
    ).toEqual([
      ['Maria Souza', '11999990001', '15/08'],
      ['João Lima', '', '02/09'],
      ['Ana', '21977770004', '25/09'],
    ])
  })
})

describe('PDF de verdade, pelo pdf.js (CNV-017)', () => {
  it('relatório de duas páginas: título, cabeçalho repetido e rodapé ficam de fora; as pessoas entram', async () => {
    const r = await processarArquivo({ bytes: pdfComTexto(relatorio()), nome: 'relatorio.pdf', contexto: { hoje: HOJE } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.formato).toBe('pdf')
    expect(r.resultado.registros.map((x) => [x.nome, x.telefone, x.ultimaVisita])).toEqual([
      ['Maria Souza', '+5511999990001', '2026-08-15'],
      ['João Lima', '+5511988880002', '2026-09-02'],
      ['Conceição Ávila', null, '2026-09-20'],
      ['Ana Paula', '+5521977770004', '2026-09-25'],
    ])
    const c = r.resultado.contagem
    expect(c.ouro + c.comAviso + c.quarentena + c.ignoradas).toBe(c.lidas)
  }, 30_000)

  it('PDF sem texto (escaneado) diz que é imagem, não devolve vazio calado', async () => {
    const r = await processarArquivo({ bytes: pdfComTexto([[]]), nome: 'escaneado.pdf', contexto: { hoje: HOJE } })
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/imagem escaneada/) })
  }, 30_000)

  it('PDF quebrado vira mensagem', async () => {
    const r = await processarArquivo({ bytes: new TextEncoder().encode('%PDF-1.4\nlixo sem nada'), nome: 'quebrado.pdf', contexto: { hoje: HOJE } })
    expect(r.ok).toBe(false)
  }, 30_000)
})
