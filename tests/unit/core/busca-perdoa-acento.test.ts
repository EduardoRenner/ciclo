import { describe, expect, it } from 'vitest'

import { semAcento } from '@/core/text/normalizar'

/**
 * Medido em produção (30/08/2026) ANTES de existir: buscar "Otávio" achava, buscar **"Otavio"
 * não achava nada** — e o mesmo para "Joao", "Vinicius", "Sergio". Quatro de oito buscas
 * falhavam, justamente as quatro que a pessoa digita de verdade: ninguém põe acento com pressa,
 * no celular, com a cliente na frente. `ilike` do Postgres é case-insensitive mas não é
 * accent-insensitive.
 *
 * Esta guarda exercita a MESMA função que a busca usa (`semAcento`), não uma cópia da lógica
 * dentro do teste — foi assim que uma guarda cega passou verde nesta base hoje mais cedo.
 *
 * O par desta função vive no banco (`imutavel_sem_acento`, migration 0047, materializado em
 * `clients.name_busca`). Os dois lados TÊM que normalizar igual; se divergirem, a busca volta a
 * não achar — por isso os casos abaixo são os nomes REAIS que falhavam em produção.
 */
describe('semAcento — busca que perdoa como a pessoa digita', () => {
  it('os quatro nomes que falhavam em produção passam a bater', () => {
    // Esquerda: como está gravado. Direita: como a pessoa digita com pressa.
    expect(semAcento('Otávio Pinheiro')).toContain(semAcento('Otavio'))
    expect(semAcento('João Pedro Alves')).toContain(semAcento('Joao'))
    expect(semAcento('Vinícius Prado')).toContain(semAcento('Vinicius'))
    expect(semAcento('Sérgio Antunes')).toContain(semAcento('Sergio'))
  })

  it('cedilha também — é o outro caso que importa em português', () => {
    // `ç` decompõe em `c` + cedilha combinante (U+0327), que está no bloco removido.
    expect(semAcento('Conceição')).toBe('conceicao')
    expect(semAcento('Assunção')).toBe('assuncao')
  })

  it('continua achando quem digita COM acento — a correção não troca um problema por outro', () => {
    expect(semAcento('Otávio Pinheiro')).toContain(semAcento('Otávio'))
    expect(semAcento('João Pedro Alves')).toContain(semAcento('João'))
  })

  it('caixa não importa, nos dois sentidos', () => {
    expect(semAcento('OTÁVIO')).toBe('otavio')
    expect(semAcento('otávio')).toBe('otavio')
  })

  it('apara as pontas — a cópia consolidada do onboarding fazia isso, e a busca depende', () => {
    // `onboarding/formulario.tsx` tinha uma segunda cópia desta regra, com `.trim()`. Ao unir as
    // duas, o `.trim()` veio junto: sem ele, " Otavio " deixaria de casar e a busca de profissão
    // do onboarding regrediria em silêncio.
    expect(semAcento('  Otávio  ')).toBe('otavio')
    expect(semAcento('  João  ')).toBe('joao')
  })

  it('não destrói o que não é acento — nome sem diacrítico atravessa inteiro', () => {
    // Guarda contra o próprio detector: um regex guloso demais (ex.: remover [^a-z]) passaria
    // nos casos acima e comeria espaço, hífen e apóstrofo — quebrando "Ana Clara" e "D'Ávila".
    expect(semAcento('Ana Clara')).toBe('ana clara')
    expect(semAcento("D'Ávila")).toBe("d'avila")
    expect(semAcento('Jean-Pierre')).toBe('jean-pierre')
  })
})
