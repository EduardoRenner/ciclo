import { describe, expect, it } from 'vitest'

import { paiDaRota } from '@/components/shell/navegacao'

/**
 * O app é um PWA `standalone`: instalado, não existe botão de voltar do
 * navegador. Uma rota que caia no `null` sem ser raiz de aba é um beco sem
 * saída de verdade — por isso isto tem teste.
 */
describe('paiDaRota', () => {
  it('raiz de aba não tem voltar — a tab bar já é a navegação', () => {
    expect(paiDaRota('/admin/hoje')).toBeNull()
    expect(paiDaRota('/admin/agenda')).toBeNull()
    expect(paiDaRota('/admin/clientes')).toBeNull()
    expect(paiDaRota('/admin/recuperar')).toBeNull()
  })

  it('sub-rota de aba volta para a própria aba', () => {
    expect(paiDaRota('/admin/clientes/123')).toEqual({ href: '/admin/clientes', rotulo: 'Clientes' })
    expect(paiDaRota('/admin/agenda/novo')).toEqual({ href: '/admin/agenda', rotulo: 'Agenda' })
  })

  it('as nove telas de configuração voltam para a lista de configurações', () => {
    for (const tela of ['servicos', 'horarios', 'mensagens', 'negocio', 'notificacoes', 'planos', 'profissionais', 'cofre']) {
      expect(paiDaRota(`/admin/config/${tela}`)).toEqual({ href: '/admin/config', rotulo: 'Configurações' })
    }
    expect(paiDaRota('/admin/config/profissionais/abc')).toEqual({ href: '/admin/config', rotulo: 'Configurações' })
  })

  it('a própria lista de configurações volta para Hoje — não é aba, não pode ficar sem saída', () => {
    expect(paiDaRota('/admin/config')).toEqual({ href: '/admin/hoje', rotulo: 'Hoje' })
  })

  it('campanha nova volta para a lista de campanhas, e a lista volta para configurações', () => {
    expect(paiDaRota('/admin/campanhas/nova')).toEqual({ href: '/admin/campanhas', rotulo: 'Campanhas' })
    expect(paiDaRota('/admin/campanhas')).toEqual({ href: '/admin/config', rotulo: 'Configurações' })
  })

  it('orçamento novo volta para a lista de orçamentos, e a lista volta para configurações', () => {
    expect(paiDaRota('/admin/orcamentos/novo')).toEqual({ href: '/admin/orcamentos', rotulo: 'Orçamentos' })
    expect(paiDaRota('/admin/orcamentos')).toEqual({ href: '/admin/config', rotulo: 'Configurações' })
  })

  it('a lista de séries de recorrência volta para configurações', () => {
    expect(paiDaRota('/admin/series')).toEqual({ href: '/admin/config', rotulo: 'Configurações' })
  })

  it('comanda volta para a agenda, que é de onde ela abre', () => {
    expect(paiDaRota('/admin/comanda/abc')).toEqual({ href: '/admin/agenda', rotulo: 'Agenda' })
    expect(paiDaRota('/admin/comanda/agendamento/abc')).toEqual({ href: '/admin/agenda', rotulo: 'Agenda' })
  })

  it('nenhuma rota de /admin fica sem saída', () => {
    const rotas = [
      '/admin/hoje',
      '/admin/agenda',
      '/admin/agenda/novo',
      '/admin/clientes',
      '/admin/clientes/nova',
      '/admin/clientes/importar',
      '/admin/clientes/abc',
      '/admin/recuperar',
      '/admin/campanhas',
      '/admin/campanhas/nova',
      '/admin/orcamentos',
      '/admin/orcamentos/novo',
      '/admin/series',
      '/admin/comanda/abc',
      '/admin/config',
      '/admin/config/servicos',
    ]
    const raizes = ['/admin/hoje', '/admin/agenda', '/admin/clientes', '/admin/recuperar']
    const semSaida = rotas.filter((r) => paiDaRota(r) === null && !raizes.includes(r))
    expect(semSaida).toEqual([])
  })
})
