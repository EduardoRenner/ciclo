import { beforeAll, describe, expect, it } from 'vitest'

import { faixaDaConta } from '@/core/billing/faixa-da-conta'
import { situacaoDaConta, type Cortesia } from '@/core/billing/prelancamento'

/**
 * Mesma ideia do `prelancamento.test.ts`: a máquina vai para Kiritimati (UTC+14). Se a faixa lesse o
 * dia pelo relógio da máquina, "faltam 14 dias" sairia errado em UM dia, e só para quem usa o
 * painel de madrugada em Brasília.
 */
beforeAll(() => {
  process.env.TZ = 'Pacific/Kiritimati'
})

/** A cortesia longa: vale até a meia-noite de Brasília de 11/01/2027 (exclusiva), então o último dia é 10/01. */
const LONGA: Cortesia = {
  plano: 'equipe',
  ate: '2027-01-11T03:00:00.000Z',
  origem: 'pre_lancamento',
  concedida_em: '2026-11-09T15:00:00.000Z',
  fundador: true,
}

/** O teste de 21 dias de quem se cadastrou em 02/02/2027: o último dia é 22/02. */
const TESTE: Cortesia = {
  plano: 'equipe',
  ate: '2027-02-23T03:00:00.000Z',
  origem: 'teste',
  concedida_em: '2027-02-02T15:00:00.000Z',
  fundador: false,
}

const faixaEm = (cortesia: Cortesia, agoraIso: string, pago: 'gratis' | 'essencial' | 'equipe' = 'gratis') => {
  const agora = new Date(agoraIso)
  return faixaDaConta(situacaoDaConta(pago, cortesia, agora), agora)
}

describe('controle do arnês', () => {
  it('a máquina está em Kiritimati, e o dia dela não é o de Brasília', () => {
    const instante = new Date('2026-12-27T01:30:00Z') // 22h30 de 26/12 em Brasília
    expect(instante.getDate(), 'TZ não pegou').toBe(27)
  })
})

describe('faixa da conta — cortesia longa', () => {
  it('no começo: diz a DATA de fim por extenso, sem contador e sem urgência', () => {
    const f = faixaEm(LONGA, '2026-11-10T15:00:00Z')!
    expect(f.tom).toBe('acento')
    expect(f.texto).toBe('Pré-lançamento: tudo liberado até 10 de janeiro de 2027. Nada é cobrado sem você escolher um plano.')
    expect(f.acao).toBe('Escolher plano')
    expect(f.texto).not.toMatch(/\d+ dias?\b/)
  })

  it('a contagem começa nos últimos 14 dias, nem um dia antes', () => {
    // 26/12 em Brasília: 15 dias para o último dia (10/01). Ainda calma.
    expect(faixaEm(LONGA, '2026-12-26T15:00:00Z')!.tom).toBe('acento')
    // 27/12: 14 dias. A faixa passa a contar.
    const f = faixaEm(LONGA, '2026-12-27T15:00:00Z')!
    expect(f.tom).toBe('warn')
    expect(f.texto).toBe('Faltam 14 dias para o fim da sua cortesia (último dia: 10 de janeiro). Escolha um plano para continuar criando.')
  })

  it('o dia é o de Brasília: 22h30 de 26/12 ainda é 26/12, mesmo com a máquina em outro dia', () => {
    // 2026-12-27T01:30Z = 22h30 de 26/12 em Brasília → ainda faltam 15 dias.
    expect(faixaEm(LONGA, '2026-12-27T01:30:00Z')!.tom).toBe('acento')
  })

  it('amanhã e hoje têm frase própria, sem "faltam 1 dias"', () => {
    expect(faixaEm(LONGA, '2027-01-09T15:00:00Z')!.texto).toMatch(/^Amanhã é o último dia/)
    expect(faixaEm(LONGA, '2027-01-10T15:00:00Z')!.texto).toMatch(/^Hoje é o último dia/)
    for (const iso of ['2027-01-09T15:00:00Z', '2027-01-10T15:00:00Z']) expect(faixaEm(LONGA, iso)!.texto).not.toMatch(/Faltam/)
  })
})

describe('faixa da conta — o teste de 21 dias', () => {
  it('abre dizendo "Teste grátis", não "Pré-lançamento", e não chama de cortesia', () => {
    const f = faixaEm(TESTE, '2027-02-03T15:00:00Z')!
    expect(f.texto).toBe('Teste grátis: tudo liberado até 22 de fevereiro de 2027. Nada é cobrado sem você escolher um plano.')
    expect(faixaEm(TESTE, '2027-02-20T15:00:00Z')!.texto).toMatch(/para o fim do seu teste/)
    expect(faixaEm(TESTE, '2027-02-22T15:00:00Z')!.texto).toBe('Hoje é o último dia do seu teste. Escolha um plano para continuar criando.')
    expect(faixaEm(LONGA, '2027-01-10T15:00:00Z')!.texto).toBe('Hoje é o último dia da sua cortesia. Escolha um plano para continuar criando.')
  })
})

describe('faixa da conta — graça e pausa', () => {
  it('a meia-noite do fim: a cortesia acabou, tudo funciona, e a faixa diz até quando', () => {
    // `ate` é exclusivo: 2027-01-11T03:00Z já é graça. A graça vai até 17/01 (18/01 pausa).
    const f = faixaEm(LONGA, '2027-01-11T03:00:00Z')!
    expect(f.tom).toBe('danger')
    expect(f.texto).toBe('Sua cortesia acabou. Tudo continua funcionando até 17 de janeiro; depois a conta fica pausada.')
    // Um milissegundo antes ainda é cortesia.
    expect(faixaEm(LONGA, '2027-01-11T02:59:59.999Z')!.tom).toBe('warn')
  })

  it('a conta pausada diz que VER e EXPORTAR continuam, e que assinar reativa na hora', () => {
    // 18/01 00:00 em Brasília = 03:00Z.
    const f = faixaEm(LONGA, '2027-01-18T03:00:00Z')!
    expect(f.tom).toBe('danger')
    expect(f.texto).toBe('Conta pausada: você vê e exporta tudo, mas não cria nada novo. Escolher um plano reativa na hora.')
    // Um milissegundo antes ainda é graça.
    expect(faixaEm(LONGA, '2027-01-18T02:59:59.999Z')!.texto).toMatch(/^Sua cortesia acabou/)
  })
})

describe('faixa da conta — quando NÃO aparece', () => {
  it('quem paga o degrau da cortesia ou mais não vê faixa nenhuma, nem depois do fim', () => {
    expect(faixaEm(LONGA, '2026-11-10T15:00:00Z', 'equipe')).toBeNull()
    expect(faixaEm(LONGA, '2027-02-01T15:00:00Z', 'equipe')).toBeNull()
  })

  it('conta que nunca teve cortesia (anterior ao programa) não ganha faixa', () => {
    const agora = new Date('2026-11-10T15:00:00Z')
    expect(faixaDaConta(situacaoDaConta('gratis', null, agora), agora)).toBeNull()
    expect(faixaDaConta(situacaoDaConta('essencial', null, agora), agora)).toBeNull()
  })

  it('quem pagava um degrau MENOR e agora está na cortesia vê a faixa (a cortesia é o que libera mais)', () => {
    expect(faixaEm(LONGA, '2026-11-10T15:00:00Z', 'essencial')!.tom).toBe('acento')
  })

  it('depois da graça, quem passou a pagar (ex.: Solo) sai da pausa e a faixa some', () => {
    expect(faixaEm(LONGA, '2027-02-01T15:00:00Z', 'essencial')).toBeNull()
  })
})

describe('faixa da conta — texto', () => {
  it('nenhuma frase tem travessão nem palavra de urgência falsa', () => {
    const cenarios = [
      '2026-11-10T15:00:00Z',
      '2026-12-27T15:00:00Z',
      '2027-01-09T15:00:00Z',
      '2027-01-10T15:00:00Z',
      '2027-01-12T15:00:00Z',
      '2027-01-18T03:00:00Z',
    ]
    for (const iso of cenarios) {
      const t = faixaEm(LONGA, iso)!.texto
      expect(t, iso).not.toMatch(/[—–]/)
      expect(t, iso).not.toMatch(/só hoje|últimas vagas|corra|imperdível/i)
    }
  })
})
