import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * As metricas da ficha da cliente vinham de `clients.visits_count` e `clients.ltv_cents` —
 * colunas desnormalizadas cujo UNICO escritor e o cron `segments`, uma vez por dia e, medido em
 * 31/08, com 5 a 6 horas de atraso do GitHub Actions. Concluir um atendimento as 14h e abrir a
 * ficha mostrava o numero de ontem.
 *
 * E o rotulo dizia "Ja gastou" sobre um valor que e PRECO DE TABELA: nao enxerga desconto dado na
 * comanda nem item extra. Errar isso e errar sobre uma pessoa especifica, com nome na tela.
 */
const CRM = semComentarios(readFileSync('src/server/services/crm.ts', 'utf8'))
const FICHA = readFileSync('src/app/admin/clientes/[id]/ficha.tsx', 'utf8')

describe('as metricas da ficha sao do agora, nao do cron de ontem', () => {
  it('visitas e valor NAO saem mais da coluna desnormalizada', () => {
    /*
     * Sem janela de N caracteres. A primeira versao recortava 400 chars a partir do primeiro
     * `metricas: {` — que e a DECLARACAO DE TIPO, la em cima, e nao o retorno. A mutacao passou
     * verde: guarda cega classica, e a armadilha da janela por contagem que o CLAUDE.md registra.
     * Agora casa com a LEITURA em si, em qualquer lugar do arquivo.
     */
    expect(CRM, 'a ficha voltou a ler o LTV que o cron escreve').not.toContain('cliente.ltv_cents')
    expect(CRM, 'a ficha voltou a ler o contador de visitas que o cron escreve').not.toContain('cliente.visits_count')
  })

  it('existe a consulta ao vivo dos concluidos', () => {
    expect(CRM, 'sumiu a leitura das linhas de verdade').toContain('concluidosBruto.data')
    expect(CRM, 'as visitas voltaram a nao ser contadas das linhas').toContain('const visitas = concluidos.length')
  })

  it('o ticket medio usa o mesmo valor ao vivo — senao media e total discordam na mesma tela', () => {
    expect(CRM).toContain('Math.round(ltvCents / visitas)')
  })

  it('FALTAS nao sai de no_show_count — coluna que so a semente da demo escreve', () => {
    /*
     * O achado mais grave desta familia, e de outra natureza que a defasagem: o UNICO escritor de
     * `clients.no_show_count` no repositorio inteiro e `scripts/seed-demo-barbearia.mjs`. Em uso
     * real a coluna fica em ZERO para sempre, e a ficha mostrava "Faltas: 0" para quem faltou
     * cinco vezes — que e o numero com que se decide cobrar sinal.
     */
    expect(CRM, 'a ficha voltou a ler a coluna que ninguem escreve').not.toContain('cliente.no_show_count')
    expect(CRM, 'sumiu a contagem de faltas ao vivo').toContain("a.status === 'no_show'")
  })

  it('ULTIMA VISITA tambem nao sai da coluna do cron', () => {
    expect(CRM, 'a ficha voltou a ler last_visit_at').not.toContain('cliente.last_visit_at')
  })

  it('a consulta traz os dois estados — sem no_show ela nao teria como contar falta', () => {
    expect(CRM).toContain("in('status', ['done', 'no_show'])")
  })

  it('o rotulo nao promete que a cliente GASTOU aquilo', () => {
    expect(FICHA, 'voltou a prometer gasto sobre preco de tabela').not.toContain('rotulo="Ja gastou"')
    expect(FICHA).not.toMatch(/rotulo="Já gastou"/)
    expect(FICHA, 'o rotulo honesto sumiu').toContain('rotulo="Valor atendido"')
  })
})
