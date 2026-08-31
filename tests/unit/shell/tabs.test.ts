import { describe, expect, it } from 'vitest'

import { ABAS, HREF_DO_CENTRO, abaAtiva, hrefDaAbaAtiva } from '@/components/shell/tabs'

describe('ABAS', () => {
  it('tem os 4 destinos que sustentam o essencial do MVP', () => {
    expect(ABAS.map((a) => a.href)).toEqual(['/admin/hoje', '/admin/agenda', '/admin/clientes', '/admin/agenda/novo'])
  })

  it('o Motor de Ciclo é o botão CENTRAL, não uma aba de canto', () => {
    // 31/08: o centro é o único ponto que o polegar alcança sem reposicionar a mão, e estava com a
    // ação mais comum (marcar) em vez da mais valiosa. Se alguém devolver o Motor para a lista de
    // abas, ele volta para o canto — que é de onde as coisas somem da rotina.
    expect(HREF_DO_CENTRO).toBe('/admin/recuperar')
    expect(ABAS.map((a) => a.href), 'o Motor voltou a ser aba de canto').not.toContain(HREF_DO_CENTRO)
  })

  it('marcar horário continua alcançável — nada foi removido, só trocou de lugar', () => {
    expect(ABAS.map((a) => a.href)).toContain('/admin/agenda/novo')
  })

  it('nenhum rótulo ou href duplicado', () => {
    expect(new Set(ABAS.map((a) => a.href)).size).toBe(ABAS.length)
    expect(new Set(ABAS.map((a) => a.rotulo)).size).toBe(ABAS.length)
  })
})

describe('abaAtiva', () => {
  it('acende na rota exata', () => {
    expect(abaAtiva('/admin/clientes', '/admin/clientes')).toBe(true)
    expect(abaAtiva('/admin/agenda', '/admin/clientes')).toBe(false)
  })

  it('acende também numa sub-rota', () => {
    expect(abaAtiva('/admin/clientes/123', '/admin/clientes')).toBe(true)
    expect(abaAtiva('/admin/clientes/123/historico', '/admin/clientes')).toBe(true)
  })

  it('não confunde prefixo textual com sub-rota — /admin/clientes não acende /admin/clientes-vip', () => {
    expect(abaAtiva('/admin/clientes-vip', '/admin/clientes')).toBe(false)
  })

  it('/admin/hoje não acende em toda rota só por casar com prefixo vazio', () => {
    // Caso que motivou o cuidado extra: sem o tratamento, toda rota do app
    // faria a primeira aba parecer sempre ativa.
    expect(abaAtiva('/admin/agenda', '/admin/hoje')).toBe(false)
    expect(abaAtiva('/admin/clientes/123', '/admin/hoje')).toBe(false)
  })
})

describe('hrefDaAbaAtiva — só UMA aba acende', () => {
  it('em /admin/agenda/novo acende Marcar, não Agenda', () => {
    /*
     * O defeito que esta regra existe para impedir: `/admin/agenda/novo` casa com a aba Agenda por
     * PREFIXO e com a própria Marcar por igualdade. Sem desempate, as duas acendem e a barra diz à
     * pessoa que ela está em dois lugares ao mesmo tempo.
     */
    expect(hrefDaAbaAtiva('/admin/agenda/novo')).toBe('/admin/agenda/novo')
  })

  it('em /admin/agenda acende Agenda', () => {
    expect(hrefDaAbaAtiva('/admin/agenda')).toBe('/admin/agenda')
  })

  it('numa sub-rota da agenda que não é /novo, acende Agenda', () => {
    expect(hrefDaAbaAtiva('/admin/agenda/2026-08-31')).toBe('/admin/agenda')
  })

  it('fora das abas, nenhuma acende', () => {
    expect(hrefDaAbaAtiva('/admin/caixa')).toBeNull()
    // O botão central não é aba: estar nele não pode acender nenhuma das quatro.
    expect(hrefDaAbaAtiva('/admin/recuperar')).toBeNull()
  })
})
