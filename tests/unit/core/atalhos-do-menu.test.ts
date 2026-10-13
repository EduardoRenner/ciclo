import { describe, expect, it } from 'vitest'

import { ATALHOS_DO_MENU, atalhosVisiveis } from '@/core/navegacao/atalhos-do-menu'
import { avaliarPermissao, type Papel } from '@/server/auth/rbac'

import type { ModuloKey } from '@/core/billing/planos'

/** APR-103: o menu do topo pela regra do hub (módulo) e do RBAC (papel). */
const menu = (papel: Papel, desligados: ModuloKey[] = []) =>
  atalhosVisiveis({ moduloVisivel: (m) => !desligados.includes(m), alcanca: (p) => avaliarPermissao(papel, p) !== null }).map((a) => a.href)

describe('menu do topo obedece módulo e papel (APR-103)', () => {
  it('com tudo ligado, o dono vê a lista inteira', () => {
    expect(menu('owner')).toEqual(ATALHOS_DO_MENU.map((a) => a.href))
  })

  it('Estoque desligado pelo dono: nenhum link para /admin/estoque', () => {
    expect(menu('owner', ['stock'])).not.toContain('/admin/estoque')
    expect(menu('owner', ['stock'])).toContain('/admin/config')
  })

  it('a Recepção não vê Caixa nem Estoque (a tela a recusaria); vê Configurações', () => {
    const r = menu('reception')
    expect(r).not.toContain('/admin/caixa')
    expect(r).not.toContain('/admin/estoque')
    expect(r).toContain('/admin/config')
  })

  it('o Financeiro vê o Caixa; o Profissional não', () => {
    expect(menu('finance')).toContain('/admin/caixa')
    expect(menu('professional')).not.toContain('/admin/caixa')
  })

  it('controle: uma lista fixa (sem regra) reprovaria os casos acima', () => {
    const fixa = ATALHOS_DO_MENU.map((a) => a.href)
    expect(fixa).toContain('/admin/estoque')
    expect(fixa).toContain('/admin/caixa')
  })
})
