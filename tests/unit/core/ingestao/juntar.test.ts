import { describe, expect, it } from 'vitest'

import { chaveFonetica, juntarRegistros, type RegistroParaJuntar } from '@/core/ingestao/juntar'

/** CNV-006: E7. Dados inventados. */
let n = 0
const r = (nome: string, telefones: string[] = [], email: string | null = null, nascimento: string | null = null): RegistroParaJuntar => ({ linha: n++, nome, telefones, email, nascimento })
const grupos = (rs: RegistroParaJuntar[]) => juntarRegistros(rs).grupos.map((g) => g.map((i) => rs[i]!.nome)).filter((g) => g.length > 1)

describe('juntar a mesma pessoa, nunca duas (CNV-006)', () => {
  it('mesmo telefone e o mesmo nome (ou um contido no outro) junta', () => {
    expect(grupos([r('Ana Paula Reis', ['+5511999990001']), r('Ana', ['+5511999990001']), r('Anna Paula Reis', ['+5511999990001'])])).toEqual([['Ana Paula Reis', 'Ana', 'Anna Paula Reis']])
  })

  it('mesmo telefone, pessoas diferentes = telefone compartilhado, NÃO junta', () => {
    const rs = [r('Maria Lima', ['+5511999990001']), r('João Lima', ['+5511999990001'])]
    const j = juntarRegistros(rs)
    expect(grupos(rs)).toEqual([])
    expect(j.compartilhados).toHaveLength(1)
    expect(j.compartilhados[0]!.motivo).toMatch(/pessoas diferentes/)
  })

  it('D11: duas "Maria Silva" sem contato em comum continuam duas', () => {
    expect(grupos([r('Maria Silva'), r('Maria Silva')])).toEqual([])
    expect(grupos([r('Maria Silva', ['+5511999990001']), r('Maria Silva', ['+5511988880002'])])).toEqual([])
  })

  it('mesmo e-mail (caixa diferente) e mesmo nome junta; nomes diferentes vira pergunta', () => {
    expect(grupos([r('Carla Nunes', [], 'carla@exemplo.com'), r('Carla Nunes', [], 'CARLA@exemplo.com')])).toEqual([['Carla Nunes', 'Carla Nunes']])
    const j = juntarRegistros([r('Carla Nunes', [], 'casal@exemplo.com'), r('Pedro Nunes', [], 'casal@exemplo.com')])
    expect(j.grupos.every((g) => g.length === 1)).toBe(true)
    expect(j.perguntas).toHaveLength(1)
  })

  it('mesmo nome pelo som e mesmo nascimento, sem contato em comum: pergunta, nunca junta', () => {
    const j = juntarRegistros([r('Thaís Souza', [], null, '1990-08-15'), r('Tais Sousa', [], null, '1990-08-15')])
    expect(j.grupos.every((g) => g.length === 1)).toBe(true)
    expect(j.perguntas).toHaveLength(1)
  })

  it('junção transitiva: telefone liga A–B, e-mail liga B–C', () => {
    expect(grupos([r('Rita Alves', ['+5511999990001']), r('Rita Alves', ['+5511999990001'], 'rita@exemplo.com'), r('Rita Alves', [], 'rita@exemplo.com')])).toEqual([['Rita Alves', 'Rita Alves', 'Rita Alves']])
  })

  it('chave fonética aproxima grafias comuns', () => {
    expect(chaveFonetica('Thaís de Souza')).toBe(chaveFonetica('Tais Sousa'))
    expect(chaveFonetica('Philippe')).toBe(chaveFonetica('Filipe'))
    expect(chaveFonetica('Kátia')).toBe(chaveFonetica('Catia'))
  })
})
