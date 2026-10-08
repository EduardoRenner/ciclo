import { describe, expect, it } from 'vitest'

import { ABAS, HREF_DO_CENTRO, hrefDaAbaAtiva } from '@/components/shell/tabs'
import { PACOTES, normalizarPacote, pacoteDe } from '@/core/pacotes'

/**
 * docs/101 T0.1. O que estes testes fixam, e por quê por LITERAL e não por referência:
 *
 * O pacote `base` é o produto de beleza como ele é hoje. Se a barra dele mudar, muda para todo
 * tenant existente ao mesmo tempo. Comparar `PACOTES.base.abas` com `ABAS` seria tautologia
 * (um reexporta o outro); comparar com a lista escrita aqui, à mão, é o que faz uma mudança
 * acidental reprovar em vez de passar junto.
 */
const BARRA_DE_HOJE = [
  { href: '/admin/hoje', rotulo: 'Hoje', icone: 'Home' },
  { href: '/admin/agenda', rotulo: 'Agenda', icone: 'CalendarDays' },
  { href: '/admin/clientes', rotulo: 'Clientes', icone: 'Users' },
  { href: '/admin/agenda/novo', rotulo: 'Marcar', icone: 'Plus' },
] as const

describe('o pacote base é o CICLO de hoje, sem mudar uma letra', () => {
  it('as quatro abas, na ordem, por literal', () => {
    expect(PACOTES.base.abas).toEqual(BARRA_DE_HOJE)
  })

  it('o centro continua sendo o Motor de Ciclo (31/08)', () => {
    expect(PACOTES.base.centro).toEqual({ href: '/admin/recuperar', rotulo: 'Recuperar receita', icone: 'Anel' })
  })

  it('tabs.ts entrega exatamente o pacote base a quem já consumia ABAS e HREF_DO_CENTRO', () => {
    // A costura entre as duas pontas: o `TabBar` lê `ABAS`; se `tabs.ts` passasse a reexportar
    // outro pacote, todo tenant mudaria de barra e os testes do pacote continuariam verdes.
    expect(ABAS).toEqual(BARRA_DE_HOJE)
    expect(HREF_DO_CENTRO).toBe('/admin/recuperar')
  })

  it('não tem vocabulário extra: as seis chaves de PADRAO bastam para beleza', () => {
    expect(PACOTES.base.vocabularioExtra).toEqual({})
  })
})

describe('o pacote advocacia', () => {
  it('tem quatro abas e o centro em Pendências, sem aba repetindo o centro', () => {
    const { abas, centro } = PACOTES.advocacia
    expect(abas.map((a) => a.rotulo)).toEqual(['Hoje', 'Casos', 'Agenda', 'Clientes'])
    expect(centro.href).toBe('/admin/pendencias')
    expect(abas.some((a) => a.href === centro.href)).toBe(false)
  })

  it('hrefDaAbaAtiva funciona com as abas do pacote, não só com as da base', () => {
    expect(hrefDaAbaAtiva('/admin/casos/123', PACOTES.advocacia.abas)).toBe('/admin/casos')
    // `/admin/casos` não existe na base: lá a mesma rota não acende aba nenhuma.
    expect(hrefDaAbaAtiva('/admin/casos/123', PACOTES.base.abas)).toBeNull()
  })

  it('os rótulos de papel não presumem gênero', () => {
    const v = PACOTES.advocacia.vocabularioExtra
    expect(v.direcao).toBe('direção')
    expect(v.advocacia).toBe('advocacia')
    expect(v.estagio).toBe('estágio')
    for (const palavra of Object.values(v)) {
      expect(palavra, `"${palavra}" tem forma marcada de gênero`).not.toMatch(/(sócio|sócia|advogad[oa]|estagiári[oa]|secretári[oa])/i)
    }
  })
})

describe('todo pacote', () => {
  it.each(Object.values(PACOTES))('$slug: rótulos curtos, sem travessão, hrefs sob /admin', (p) => {
    for (const aba of [...p.abas, p.centro]) {
      expect(aba.href.startsWith('/admin/')).toBe(true)
      expect(aba.rotulo).not.toMatch(/[—–]/)
      // A barra divide 5 slots em 390px: rótulo longo quebra em duas linhas ou some. "Recuperar receita"
      // é a exceção já medida (vira rótulo só na coluna lateral, `tab-bar.tsx`).
      if (aba.href !== p.centro.href) expect(aba.rotulo.length).toBeLessThanOrEqual(10)
    }
    expect(p.slug).toBe(Object.keys(PACOTES).find((k) => PACOTES[k as keyof typeof PACOTES] === p))
  })
})

describe('normalizarPacote: o que vem do banco vira slug conhecido', () => {
  it('reconhece os dois slugs', () => {
    expect(normalizarPacote('base')).toBe('base')
    expect(normalizarPacote('advocacia')).toBe('advocacia')
    expect(pacoteDe('advocacia')).toBe(PACOTES.advocacia)
  })

  it('ausente, nulo, desconhecido ou de outro tipo cai em base, que é o produto de hoje', () => {
    for (const v of [undefined, null, '', 'mecanica', 42, {}, 'BASE']) expect(normalizarPacote(v)).toBe('base')
  })
})
