import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { quemRecuperar } from '@/core/ciclo/quem-recuperar'

/**
 * A regra que decide quem aparece em "Recuperar receita" — a tela do diferencial do produto.
 *
 * Ela existe porque a tela mostrava as linhas cruas de `client_cycles`, que são por
 * (cliente, serviço). Medido nas seis contas de demonstração em 02/09: `demo-studio-bella`
 * listava 149 linhas, com o cartão rotulado "Clientes", num salão que tem 55 clientes — e apenas
 * CINCO tinham de fato parado de vir.
 */
const linha = (clientId: string, valueCents: number, serviceId = 's') => ({ clientId, valueCents, serviceId })

describe('quem entra na lista de recuperar', () => {
  it('uma linha por cliente, não uma por serviço', () => {
    const r = quemRecuperar([linha('ana', 4500, 'corte'), linha('ana', 18000, 'platinado')], new Set())
    expect(r).toHaveLength(1)
    expect(r[0]!.clientId).toBe('ana')
  })

  it('fica o serviço de MAIOR valor, venha na ordem que vier', () => {
    /*
     * Os dois sentidos de propósito. A `v_recover_revenue` até vem ordenada por valor, mas
     * depender disso é a aposta de "paginar sem `.order()` explícito" que já mordeu esta base:
     * a troca seria silenciosa — a lista continua do mesmo tamanho, só com o serviço errado.
     */
    const maiorPrimeiro = quemRecuperar([linha('ana', 18000, 'platinado'), linha('ana', 4500, 'corte')], new Set())
    const menorPrimeiro = quemRecuperar([linha('ana', 4500, 'corte'), linha('ana', 18000, 'platinado')], new Set())
    expect(maiorPrimeiro[0]!.serviceId).toBe('platinado')
    expect(menorPrimeiro[0]!.serviceId, 'a ordem de chegada mudou o resultado').toBe('platinado')
  })

  it('quem tem algum ciclo em dia NÃO está atrasada para voltar', () => {
    // O ruído medido: 72% a 92% das linhas eram de gente que nunca deixou de vir. Cliente que
    // corta o cabelo todo mês não precisa de campanha de recuperação porque não faz progressiva
    // desde março — isso é venda no salão, que é outra coisa.
    const r = quemRecuperar([linha('ana', 18000, 'platinado'), linha('bia', 4500, 'corte')], new Set(['ana']))
    expect(r.map((x) => x.clientId)).toEqual(['bia'])
  })

  it('quem não tem nenhum ciclo em dia continua aparecendo', () => {
    // O outro lado. Sem ele, um filtro que excluísse todo mundo passaria despercebido.
    const r = quemRecuperar([linha('ana', 4500), linha('bia', 9000)], new Set())
    expect(r.map((x) => x.clientId).sort()).toEqual(['ana', 'bia'])
  })

  it('devolve em ordem de valor, não na ordem em que chegou', () => {
    const r = quemRecuperar([linha('ana', 4500), linha('bia', 22000), linha('cris', 9000)], new Set())
    expect(r.map((x) => x.clientId)).toEqual(['bia', 'cris', 'ana'])
  })

  it('lista vazia não quebra e não inventa ninguém', () => {
    expect(quemRecuperar([], new Set())).toEqual([])
    expect(quemRecuperar([linha('ana', 4500)], new Set(['ana']))).toEqual([])
  })
})

describe('o envio em lote de recuperação', () => {
  /*
   * `enviarParaRecuperar` não é função pura (fala com banco e provedor), e o teste que a exercita
   * é de integração — precisa de Supabase local. Esta guarda de varredura cobre a única coisa que
   * pode voltar em silêncio e chega no telefone de gente real.
   *
   * O defeito: a trava de 7 dias lê `last_campaign_at` da linha de `client_cycles`, que é POR
   * SERVIÇO. Duas linhas da mesma cliente têm as duas `last_campaign_at` nulas, as duas passam, e
   * a pessoa recebe dois WhatsApp no mesmo segundo. Com o botão de marcar todas, uma cliente
   * atrasada em três serviços recebia TRÊS mensagens ao mesmo tempo.
   */
  const fonte = () =>
    semComentarios(readFileSync(join('src', 'server', 'services', 'recuperar-receita.ts'), 'utf8'))

  it('nunca manda duas mensagens para a mesma pessoa no mesmo lote', () => {
    const src = fonte()
    const laco = src.slice(src.indexOf('for (const item of entrada.items)'))

    expect(laco.length, 'o laço de envio sumiu — atualize esta guarda').toBeGreaterThan(0)
    expect(
      laco,
      'o laço precisa pular cliente já atendido no lote: a trava de 7 dias é por SERVIÇO e não segura isto',
    ).toMatch(/jaEnviado\.has\(item\.clientId\)/)
    expect(laco, 'e precisa registrar quem já recebeu').toMatch(/jaEnviado\.add\(item\.clientId\)/)
  })

  it('a lista já chega reduzida a uma linha por cliente', () => {
    // A guarda de cima é a segunda camada. A primeira é a lista não trazer duplicata — proteção
    // que depende só do chamador mandar a lista certa não é proteção, e vice-versa.
    expect(fonte(), 'listarParaRecuperar não usa mais a regra de `core/`').toMatch(/quemRecuperar\(/)
  })
})
