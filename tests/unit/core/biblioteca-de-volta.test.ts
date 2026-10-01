import { describe, expect, it } from 'vitest'

import { CHAVES_DE_VARIANTE, metadeDe, textoDaVariante, varianteDe } from '@/core/mensageria/biblioteca-de-volta'
import { textoDeVolta } from '@/lib/mensagens'

const PERFIS = ['fiel', 'regular', 'novo', 'atrasado', 'faltante', 'sumido'] as const

describe('biblioteca de textos da chamada de volta (docs/95 E4)', () => {
  it('sem perfil (nota ainda não calculada) é sempre o texto de sempre', () => {
    expect(varianteDe('qualquer-id', null)).toBe('padrao')
    expect(varianteDe('qualquer-id', undefined)).toBe('padrao')
  })

  it('a mesma pessoa cai sempre na mesma versão; metade das pessoas recebe a de sempre', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `cliente-${i}-${i * 7919}`)
    for (const id of ids) expect(varianteDe(id, 'sumido')).toBe(varianteDe(id, 'sumido'))
    const padrao = ids.filter((id) => varianteDe(id, 'sumido') === 'padrao').length
    // Sorteio fixo, não aleatório: o que importa é não cair tudo de um lado só.
    expect(padrao).toBeGreaterThan(140)
    expect(padrao).toBeLessThan(260)
  })

  it('todo perfil tem uma versão própria, diferente da de sempre', () => {
    const idDaOutraMetade = Array.from({ length: 50 }, (_, i) => `x${i}`).find((id) => metadeDe(id) === 1)!
    for (const p of PERFIS) expect(varianteDe(idDaOutraMetade, p)).not.toBe('padrao')
  })

  it('todo texto usa o nome e o serviço, sem travessão e sem supor gênero', () => {
    for (const chave of CHAVES_DE_VARIANTE) {
      const texto = textoDaVariante(chave, 'Joana', 'corte')
      expect(texto, chave).toContain('Joana')
      expect(texto, chave).toContain('corte')
      expect(texto, chave).not.toMatch(/—|–/)
      expect(texto, chave).not.toMatch(/\bobrigad[oa]\b|bem-?vind[oa]\b|\bseu (corte|barba)\b/i)
      // Nome em branco não vira "Oi, !".
      expect(textoDaVariante(chave, '', 'corte'), chave).not.toContain('Oi, !')
    }
  })

  it('o texto de sempre continua exatamente igual ao que estava no ar', () => {
    expect(textoDeVolta({ nome: 'Joana Teste', servico: 'Corte' })).toBe(
      'Oi, Joana! Faz um tempinho desde seu último horário de corte. Quer marcar essa semana?',
    )
    expect(textoDeVolta({ nome: 'Joana', servico: 'Corte', variante: 'saudade' })).toContain('a gente sente falta')
  })
})
