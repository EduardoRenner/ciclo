import { describe, expect, it } from 'vitest'

import { origemDaUrl } from '@/core/aquisicao/origem'
import { BIOS_DO_INSTAGRAM, linkDaBio, linksDaBio, NOME_DO_PERFIL } from '@/core/aquisicao/links-da-bio'
import { APP_URL } from '@/lib/app-url'

/**
 * A bio do Instagram e a página `/links` (`docs/82` rodada 35). O funil é: bio, link único, calculadora
 * (o gancho), cadastro. Se a origem some no meio do caminho, o canal Instagram nunca aparece no placar,
 * e o plano de 30 dias não tem como dizer se ele traz conta que usa.
 *
 * Vocabulário: as regras do brief de marca (`public/marca/BRIEF-carrossel-diferencial.md`) e do roteiro
 * (`docs/marketing/roteiro-lancamento-instagram.md`): sem travessão, sem "para sempre", sem palavra de
 * vitrine de software, sem nome de concorrente.
 */
const PROIBIDAS = [
  'poderos',
  'solução',
  'plataforma',
  'otimiz',
  'impuls',
  'revolucion',
  'transform',
  'inteligente',
  'simplesmente',
  'incrível',
  'completo',
  'robust',
  'intuitiv',
  'em breve',
  'aprende',
  'para sempre',
  'pra sempre',
  'trinks',
  'fresha',
]

function texto(...partes: string[]): string {
  return partes.join(' ').toLocaleLowerCase('pt-BR')
}

describe('linksDaBio — a página que a bio do Instagram aponta', () => {
  const links = linksDaBio({ slugDeDemonstracao: 'demo-barbearia' })

  it('a calculadora vem primeiro (é o gancho) e o cadastro logo depois', () => {
    expect(links[0]?.chave).toBe('calculadora')
    expect(links[0]?.destaque, 'o gancho precisa ser o cartão de destaque').toBe(true)
    expect(links[1]?.chave).toBe('cadastro')
  })

  it('a ordem é calculadora, cadastro, como funciona, exemplo (o exemplo fica por último)', () => {
    expect(links.map((l) => l.chave)).toEqual(['calculadora', 'cadastro', 'como-funciona', 'exemplo'])
    // Sem demonstração no ar a ordem continua, só sem o exemplo.
    expect(linksDaBio({ slugDeDemonstracao: null }).map((l) => l.chave)).toEqual(['calculadora', 'cadastro', 'como-funciona'])
  })

  it('não tem planos nem preço: a página leva a conta, não a comparação', () => {
    for (const l of links) {
      expect(l.chave, 'o cartão de preços voltou').not.toBe('precos')
      expect(l.href, `${l.chave} aponta para a página de preços`).not.toContain('/precos')
      expect(texto(l.titulo, l.descricao), `${l.chave} fala de plano ou preço`).not.toMatch(/plano|pre[cç]o|quanto custa/)
    }
  })

  it('só o destaque tem etiqueta, e ela diz por onde começar', () => {
    expect(links[0]?.selo).toBe('Comece por aqui')
    expect(links.filter((l) => l.selo), 'etiqueta em mais de um cartão dilui o "comece por aqui"').toHaveLength(1)
  })

  it('o cadastro é o botão principal, o único marcado como tal', () => {
    expect(links.filter((l) => l.principal).map((l) => l.chave)).toEqual(['cadastro'])
  })

  it('todo link interno carrega a origem instagram, senão o canal some do placar', () => {
    expect(links.length, 'cenário não montado: nenhum link').toBeGreaterThan(3)
    for (const l of links) {
      const url = new URL(l.href, 'https://seuciclo.com.br')
      const origem = origemDaUrl(url.searchParams, '2026-09-25')
      expect(origem?.canal, `${l.chave} perdeu a origem`).toBe('instagram')
    }
  })

  it('sem página de demonstração no ar, o cartão de exemplo some em vez de virar 404', () => {
    const sem = linksDaBio({ slugDeDemonstracao: null }).map((l) => l.chave)
    expect(sem).not.toContain('exemplo')
    expect(links.map((l) => l.chave)).toContain('exemplo')
  })

  it('o exemplo abre já na visão de quem atende (?ver=dono)', () => {
    const exemplo = links.find((l) => l.chave === 'exemplo')
    expect(exemplo?.href).toContain('/demo-barbearia/agendar')
    expect(exemplo?.href).toContain('ver=dono')
  })

  it('é curta: no máximo 5 cartões, título e descrição que cabem no celular', () => {
    expect(links.length).toBeLessThanOrEqual(5)
    for (const l of links) {
      expect(l.titulo.length, `título longo em ${l.chave}`).toBeLessThanOrEqual(40)
      expect(l.descricao.length, `descrição longa em ${l.chave}`).toBeLessThanOrEqual(110)
    }
  })

  it('copy sem travessão nem vocabulário proibido', () => {
    const tudo = texto(...links.flatMap((l) => [l.titulo, l.descricao, l.selo ?? '']))
    expect(tudo).not.toContain('—')
    for (const p of PROIBIDAS) expect(tudo, `"${p}" entrou na página de links`).not.toContain(p)
  })

  it('não promete o que o produto não faz: fala em texto pronto para chamar, não em envio sozinho', () => {
    const tudo = texto(...links.flatMap((l) => [l.titulo, l.descricao]))
    expect(tudo).not.toMatch(/sozinh|automátic|manda por você/)
  })
})

describe('bio do Instagram', () => {
  it('há três variantes para escolher', () => {
    expect(BIOS_DO_INSTAGRAM).toHaveLength(3)
  })

  it.each(BIOS_DO_INSTAGRAM.map((b, i) => [i + 1, b] as const))('variante %i cabe nos 150 caracteres e fala do que o produto faz', (_i, bio) => {
    expect(bio.length, 'a bio do Instagram aceita 150 caracteres').toBeLessThanOrEqual(150)
    expect(bio.toLocaleLowerCase('pt-BR')).toMatch(/reten[cç][aã]o|voltar|sumiu/)
    expect(bio).not.toContain('—')
    for (const p of PROIBIDAS) expect(bio.toLocaleLowerCase('pt-BR'), `"${p}" na bio`).not.toContain(p)
  })

  it('toda variante termina apontando para o link', () => {
    for (const bio of BIOS_DO_INSTAGRAM) expect(bio).toMatch(/\u{1F447}$/u)
  })

  it('o nome do perfil cabe nos 30 caracteres do Instagram', () => {
    expect(NOME_DO_PERFIL.length).toBeLessThanOrEqual(30)
    expect(NOME_DO_PERFIL).toContain('CICLO')
  })

  it('o link da bio é um só, na raiz do domínio do produto, com a origem instagram', () => {
    const url = new URL(linkDaBio(APP_URL))
    expect(url.origin).toBe(new URL(APP_URL).origin)
    expect(url.pathname).toBe('/links')
    expect(origemDaUrl(url.searchParams, '2026-09-25')?.canal).toBe('instagram')
  })
})
