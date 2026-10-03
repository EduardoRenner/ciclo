import { describe, expect, it } from 'vitest'

import { textoDeMudarDePlano } from '@/lib/contato'

/**
 * Auditoria de 27/09, B5: a tela "Meu plano" dizia "a cobrança automática ainda não está no ar" AO
 * LADO de um botão Assinar que cobra de verdade pelo Mercado Pago. Duas frases verdadeiras no
 * código e uma falsa na tela, e nenhum teste olhava a distância entre elas.
 */
describe('textoDeMudarDePlano com a cobrança automática ligada', () => {
  const casos: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ]

  it('nunca diz que a cobrança automática não está no ar, com ou sem canal, no Grátis ou não', () => {
    for (const [noGratis, temCanal] of casos) {
      const texto = textoDeMudarDePlano(noGratis, temCanal, true)
      expect(texto, `noGratis=${noGratis} temCanal=${temCanal}`).not.toMatch(/ainda n[ãa]o est[áa] no ar/i)
      expect(texto.trim().length, 'ficou sem explicação').toBeGreaterThan(40)
    }
  })

  it('responde a pergunta que a pessoa veio fazer: só cobra depois do toque em assinar', () => {
    expect(textoDeMudarDePlano(false, true, true)).toMatch(/Nada é cobrado sem você assinar/)
    expect(textoDeMudarDePlano(true, false, true)).toMatch(/não vira cobrança sem você pedir/)
  })

  it('SEM a cobrança ligada, a frase antiga continua a mesma (a guarda do canal depende dela)', () => {
    for (const [noGratis, temCanal] of casos) {
      expect(textoDeMudarDePlano(noGratis, temCanal)).toMatch(/cobran[çc]a autom[áa]tica ainda n[ãa]o est[áa] no ar/i)
      expect(textoDeMudarDePlano(noGratis, temCanal, false)).toBe(textoDeMudarDePlano(noGratis, temCanal))
    }
  })

  it('os dois mundos dizem coisas diferentes (o parâmetro não virou decoração)', () => {
    for (const [noGratis, temCanal] of casos) {
      expect(textoDeMudarDePlano(noGratis, temCanal, true)).not.toBe(textoDeMudarDePlano(noGratis, temCanal, false))
    }
  })

  it('sem travessão', () => {
    for (const [noGratis, temCanal] of casos) expect(textoDeMudarDePlano(noGratis, temCanal, true)).not.toMatch(/[—–]/)
  })
})
