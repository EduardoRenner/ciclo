import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'

import { clientesParaCsv, type LinhaClienteParaExportar } from '@/server/services/clientes'

/**
 * P3 de `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §7.4: "Baixar todos os meus clientes em
 * planilha". Colunas mínimas do ticket: nome, telefone, e-mail, última visita — nos mesmos nomes
 * que fazem sentido escolher de volta na tela de mapeamento do importador.
 */
describe('clientesParaCsv', () => {
  it('gera cabeçalho em português com as quatro colunas mínimas', () => {
    const csv = clientesParaCsv([])
    expect(csv.split('\r\n')[0]).toBe('nome,telefone,email,ultima_visita')
  })

  it('caminho feliz: uma linha com todos os campos preenchidos', () => {
    const linhas: LinhaClienteParaExportar[] = [
      { name: 'Ana Paula', phone: '+5511987654321', email: 'ana@example.com', lastVisit: '2026-08-15' },
    ]
    const csv = clientesParaCsv(linhas)
    const [cabecalho, linha] = csv.split('\r\n')
    expect(cabecalho).toBe('nome,telefone,email,ultima_visita')
    expect(linha).toBe('Ana Paula,+5511987654321,ana@example.com,2026-08-15')
  })

  it('campos ausentes viram célula vazia, não a palavra "null"', () => {
    const csv = clientesParaCsv([{ name: 'Sem Contato', phone: null, email: null, lastVisit: null }])
    expect(csv.split('\r\n')[1]).toBe('Sem Contato,,,')
  })

  it('protege o nome contra injeção de fórmula, mas NUNCA o telefone', () => {
    // Todo `phone_e164` começa com "+" — se o guard alcançasse essa coluna, o arquivo inteiro
    // sairia com telefone prefixado por aspas simples, quebrando 100% das linhas na reimportação.
    const csv = clientesParaCsv([
      { name: '=HYPERLINK("http://mal","clique")', phone: '+5511987654321', email: null, lastVisit: null },
    ])

    const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
    expect(data[0]?.telefone).toBe('+5511987654321')
    expect(data[0]?.nome).toBe('\'=HYPERLINK("http://mal","clique")')
  })
})
