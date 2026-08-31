import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * As metricas da ficha da cliente vinham de `clients.visits_count` e `clients.ltv_cents` —
 * colunas desnormalizadas cujo UNICO escritor e o cron `segments`, uma vez por dia e, medido em
 * 31/08, com 5 a 6 horas de atraso do GitHub Actions. Concluir um atendimento as 14h e abrir a
 * ficha mostrava o numero de ontem.
 *
 * E o rotulo dizia "Ja gastou" sobre um valor que e PRECO DE TABELA: nao enxerga desconto dado na
 * comanda nem item extra. Errar isso e errar sobre uma pessoa especifica, com nome na tela.
 */
const CRM = readFileSync('src/server/services/crm.ts', 'utf8')
const FICHA = readFileSync('src/app/admin/clientes/[id]/ficha.tsx', 'utf8')

describe('as metricas da ficha sao do agora, nao do cron de ontem', () => {
  it('visitas e valor NAO saem mais da coluna desnormalizada', () => {
    // O que muda quando o defeito volta: voltar a ler `cliente.visits_count` / `cliente.ltv_cents`
    // dentro do calculo das metricas.
    const bloco = CRM.slice(CRM.indexOf('metricas: {'), CRM.indexOf('metricas: {') + 400)
    expect(bloco, 'a ficha voltou a ler o contador que o cron escreve').not.toContain('cliente.ltv_cents')
    expect(bloco, 'a ficha voltou a ler o contador que o cron escreve').not.toContain('cliente.visits_count')
  })

  it('existe a consulta ao vivo dos concluidos', () => {
    expect(CRM, 'sumiu a consulta que torna a metrica exata').toContain("const concluidos = concluidosBruto.data")
    expect(CRM).toContain('const visitas = concluidos.length')
  })

  it('o ticket medio usa o mesmo valor ao vivo — senao media e total discordam na mesma tela', () => {
    expect(CRM).toContain('Math.round(ltvCents / visitas)')
  })

  it('o rotulo nao promete que a cliente GASTOU aquilo', () => {
    expect(FICHA, 'voltou a prometer gasto sobre preco de tabela').not.toContain('rotulo="Ja gastou"')
    expect(FICHA).not.toMatch(/rotulo="Já gastou"/)
    expect(FICHA, 'o rotulo honesto sumiu').toContain('rotulo="Valor atendido"')
  })
})
