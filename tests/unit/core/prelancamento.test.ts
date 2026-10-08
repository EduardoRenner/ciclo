import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  PRELANCAMENTO,
  cortesiaDoCadastro,
  ofertaDoCadastro,
  descreverDia,
  descreverDiaCurto,
  diaDeBrasilia,
  diasParaOFim,
  fimDaGraca,
  fimDaPausa,
  lerCortesia,
  planoVigente,
  situacaoDaConta,
  ultimoDiaDaCortesia,
  type Cortesia,
} from '@/core/billing/prelancamento'

// Estas regras são as do programa de cortesia e dos degraus: valem com `ACESSO_ABERTO` desligado.
vi.mock('@/core/billing/acesso-aberto', () => ({ ACESSO_ABERTO: false }))

/**
 * A máquina vai para Kiritimati (UTC+14), o fuso onde o dia UTC vira 14 horas ANTES do de Brasília.
 * Se alguma parte do código lesse o dia pelo relógio da máquina (`getDate`, `toISOString().slice`),
 * estes casos reprovariam: o mesmo instante é dia 12 em Brasília e dia 13 na máquina.
 *
 * O primeiro teste é o controle: prova que a máquina de fato mudou de fuso. Sem ele, um `TZ` que
 * o Vitest ignorasse deixaria o resto passar verde numa máquina que nunca saiu de UTC.
 */
beforeAll(() => {
  process.env.TZ = 'Pacific/Kiritimati'
})

const D0_MEIA_NOITE = '2027-01-11T03:00:00.000Z' // 00:00 em Brasília (UTC-3, sem horário de verão desde 2019)

describe('controle do arnês', () => {
  it('a máquina está mesmo em Kiritimati, e o dia dela NÃO é o de Brasília', () => {
    const instante = new Date('2026-12-13T01:30:00Z') // 22h30 de 12/12 em Brasília
    expect(instante.getDate(), 'TZ não pegou: a máquina ainda não está em Kiritimati').toBe(13)
    expect(diaDeBrasilia(instante)).toBe('2026-12-12')
  })
})

describe('as datas do docs/87', () => {
  it('o último dia da cortesia longa é D0 menos 30 dias', () => {
    const d0 = new Date(`${PRELANCAMENTO.lancamento}T12:00:00Z`).getTime()
    const ultimo = new Date(`${PRELANCAMENTO.ultimoDiaDaCortesiaLonga}T12:00:00Z`).getTime()
    expect((d0 - ultimo) / 86_400_000).toBe(30)
  })

  it('a janela do fundador termina no último dia da cortesia longa', () => {
    expect(PRELANCAMENTO.fundadorAte).toBe(PRELANCAMENTO.ultimoDiaDaCortesiaLonga)
  })
})

describe('cortesiaDoCadastro — o corte é por dia de Brasília', () => {
  it('cadastro na janela pública: cortesia até a meia-noite de D0, com a marca de fundador', () => {
    const c = cortesiaDoCadastro(new Date('2026-11-20T15:00:00Z'))
    expect(c.ate).toBe(D0_MEIA_NOITE)
    expect(c.origem).toBe('pre_lancamento')
    expect(c.fundador).toBe(true)
    expect(c.concedida_em).toBe('2026-11-20T15:00:00.000Z')
  })

  it('22h30 de 12/12 em Brasília (já 13/12 em UTC e em Kiritimati) AINDA leva a cortesia longa', () => {
    const c = cortesiaDoCadastro(new Date('2026-12-13T01:30:00Z'))
    expect(c.origem).toBe('pre_lancamento')
    expect(c.ate).toBe(D0_MEIA_NOITE)
    expect(c.fundador).toBe(true)
  })

  it('o último milissegundo de 12/12 é cortesia longa; a meia-noite de 13/12 é teste de 21 dias', () => {
    expect(cortesiaDoCadastro(new Date('2026-12-13T02:59:59.999Z')).origem).toBe('pre_lancamento')
    const t = cortesiaDoCadastro(new Date('2026-12-13T03:00:00.000Z'))
    expect(t.origem).toBe('teste')
    expect(t.fundador).toBe(false)
  })

  it('o teste dura 21 dias inteiros depois do dia do cadastro e termina à meia-noite de Brasília', () => {
    const t = cortesiaDoCadastro(new Date('2026-12-20T18:00:00Z')) // 15h em Brasília
    expect(ultimoDiaDaCortesia(t)).toBe('2027-01-10')
    expect(t.ate).toBe('2027-01-11T03:00:00.000Z')
    // e nunca entrega menos de 21 dias: cadastro no último minuto do dia também ganha os 21 inteiros
    const tarde = cortesiaDoCadastro(new Date('2026-12-21T02:59:00Z')) // 23h59 de 20/12 em Brasília
    expect(ultimoDiaDaCortesia(tarde)).toBe('2027-01-10')
  })

  it('conta criada DEPOIS de D0 não ganha a cortesia longa: só os 21 dias', () => {
    const c = cortesiaDoCadastro(new Date('2027-01-20T14:00:00Z'))
    expect(c.origem).toBe('teste')
    expect(c.fundador).toBe(false)
    expect(ultimoDiaDaCortesia(c)).toBe('2027-02-10')
    expect(c.ate).toBe('2027-02-11T03:00:00.000Z')
  })

  it('fundador é só quem entrou entre 09/11 e 12/12 (D5); o alpha, não', () => {
    expect(cortesiaDoCadastro(new Date('2026-10-26T12:00:00Z')).fundador).toBe(false)
    expect(cortesiaDoCadastro(new Date('2026-11-09T02:59:59.999Z')).fundador).toBe(false) // 23h59 de 08/11
    expect(cortesiaDoCadastro(new Date('2026-11-09T03:00:00.000Z')).fundador).toBe(true) // 00h de 09/11
  })

  it('o alpha, antes da janela, também vai até D0', () => {
    expect(cortesiaDoCadastro(new Date('2026-10-26T12:00:00Z')).ate).toBe(D0_MEIA_NOITE)
  })
})

describe('lerCortesia — jsonb livre, nunca lança, lixo vira "sem cortesia"', () => {
  const boa = {
    plano: 'avancado',
    ate: D0_MEIA_NOITE,
    origem: 'pre_lancamento',
    concedida_em: '2026-11-20T15:00:00.000Z',
    fundador: true,
  }

  it('lê o valor íntegro', () => {
    expect(lerCortesia({ cortesia: boa })).toEqual(boa)
  })

  it('fundador ausente vale falso', () => {
    expect(lerCortesia({ cortesia: { ...boa, fundador: undefined } })?.fundador).toBe(false)
  })

  it.each([
    ['settings nulo', null],
    ['settings indefinido', undefined],
    ['settings número', 42],
    ['settings texto', 'cortesia'],
    ['sem a chave', {}],
    ['cortesia nula', { cortesia: null }],
    ['cortesia texto', { cortesia: 'ate 2027' }],
    ['cortesia lista', { cortesia: [boa] }],
    ['degrau que não existe', { cortesia: { ...boa, plano: 'ouro' } }],
    ['degrau de outro tipo', { cortesia: { ...boa, plano: 3 } }],
    ['data que não é data', { cortesia: { ...boa, ate: 'quando der' } }],
    ['data ausente', { cortesia: { ...boa, ate: undefined } }],
    ['data número', { cortesia: { ...boa, ate: 1799000000000 } }],
    ['origem desconhecida', { cortesia: { ...boa, origem: 'presente' } }],
    ['concedida_em quebrada', { cortesia: { ...boa, concedida_em: '31/02/2027' } }],
    ['fundador em texto', { cortesia: { ...boa, fundador: 'sim' } }],
  ])('%s → null, sem lançar', (_nome, settings) => {
    expect(() => lerCortesia(settings)).not.toThrow()
    expect(lerCortesia(settings)).toBeNull()
  })
})

describe('situação da conta — expiração preguiçosa', () => {
  const c: Cortesia = {
    plano: 'avancado',
    ate: D0_MEIA_NOITE,
    origem: 'pre_lancamento',
    concedida_em: '2026-11-20T15:00:00.000Z',
    fundador: true,
  }
  const antes = (ms: number, base: Date) => new Date(base.getTime() - ms)
  const ate = new Date(c.ate)

  it('cortesia válida: comporta-se como o degrau da cortesia, e pode escrever', () => {
    const s = situacaoDaConta('gratis', c, new Date('2026-12-01T12:00:00Z'))
    expect(s).toMatchObject({ estado: 'cortesia', plano: 'avancado', planoDeLeitura: 'avancado', podeEscrever: true })
  })

  it('no milissegundo antes de D0 ainda é cortesia; NA meia-noite de D0 já é graça', () => {
    expect(situacaoDaConta('gratis', c, antes(1, ate)).estado).toBe('cortesia')
    expect(situacaoDaConta('gratis', c, ate).estado).toBe('graca')
  })

  it('graça: tudo funciona (degrau e escrita) por 7 dias', () => {
    const s = situacaoDaConta('gratis', c, new Date('2027-01-14T12:00:00Z'))
    expect(s).toMatchObject({ estado: 'graca', plano: 'avancado', podeEscrever: true })
    expect(fimDaGraca(c).toISOString()).toBe('2027-01-18T03:00:00.000Z')
  })

  it('a graça acaba na meia-noite de 18/01: o milissegundo antes ainda é graça, o exato é pausa', () => {
    const fim = fimDaGraca(c)
    expect(situacaoDaConta('gratis', c, antes(1, fim)).estado).toBe('graca')
    expect(situacaoDaConta('gratis', c, fim).estado).toBe('pausada')
  })

  it('pausada: não escreve, mas continua ENXERGANDO o que o degrau da cortesia liberava (regra 5.1)', () => {
    const s = situacaoDaConta('gratis', c, new Date('2027-02-15T12:00:00Z'))
    expect(s.estado).toBe('pausada')
    expect(s.podeEscrever).toBe(false)
    expect(s.plano).toBe('gratis')
    expect(s.planoDeLeitura).toBe('avancado')
  })

  it('a pausa dura 90 dias depois da graça', () => {
    expect(fimDaPausa(c).toISOString()).toBe('2027-04-18T03:00:00.000Z') // 18/01 + 90 dias
  })

  it('assinar reativa na hora: pago > gratis muda o estado sem esperar nada', () => {
    const depois = new Date('2027-02-15T12:00:00Z')
    expect(situacaoDaConta('gratis', c, depois).estado).toBe('pausada')
    const s = situacaoDaConta('essencial', c, depois)
    expect(s).toMatchObject({ estado: 'pago', plano: 'essencial', podeEscrever: true })
  })

  it('cortesia nunca rebaixa quem paga mais', () => {
    const cortesiaDoEquipe: Cortesia = { ...c, plano: 'equipe' }
    expect(planoVigente('avancado', cortesiaDoEquipe, new Date('2026-12-01T12:00:00Z'))).toBe('avancado')
    const s = situacaoDaConta('avancado', cortesiaDoEquipe, new Date('2026-12-01T12:00:00Z'))
    expect(s.estado).toBe('pago')
    expect(s.plano).toBe('avancado')
  })

  it('quem paga menos ganha o degrau da cortesia enquanto ela vale', () => {
    const cortesiaDoEquipe: Cortesia = { ...c, plano: 'equipe' }
    expect(planoVigente('essencial', cortesiaDoEquipe, new Date('2026-12-01T12:00:00Z'))).toBe('equipe')
    expect(situacaoDaConta('essencial', cortesiaDoEquipe, new Date('2026-12-01T12:00:00Z')).estado).toBe('cortesia')
  })

  it('cortesia vencida e sem graça: sobra o que a pessoa paga, e paga é estado pago', () => {
    const depois = new Date('2027-03-01T12:00:00Z')
    expect(planoVigente('essencial', c, depois)).toBe('essencial')
    expect(situacaoDaConta('essencial', c, depois)).toMatchObject({ estado: 'pago', podeEscrever: true })
  })

  it('quem assinou e cancelou depois da cortesia cai na pausa (o cancelamento devolve `gratis`)', () => {
    expect(situacaoDaConta('gratis', c, new Date('2027-03-01T12:00:00Z')).estado).toBe('pausada')
  })

  it('sem cortesia nenhuma: conta anterior ao programa, comporta-se como antes', () => {
    expect(situacaoDaConta('gratis', null, new Date('2027-03-01T12:00:00Z'))).toMatchObject({
      estado: 'sem_cortesia',
      plano: 'gratis',
      podeEscrever: true,
    })
    expect(situacaoDaConta('equipe', null, new Date('2027-03-01T12:00:00Z')).estado).toBe('pago')
  })

  it('o teste de 21 dias segue a mesma máquina de estados', () => {
    const t = cortesiaDoCadastro(new Date('2027-01-20T14:00:00Z'))
    expect(situacaoDaConta('gratis', t, new Date('2027-02-05T12:00:00Z')).estado).toBe('cortesia')
    expect(situacaoDaConta('gratis', t, new Date('2027-02-12T12:00:00Z')).estado).toBe('graca')
    expect(situacaoDaConta('gratis', t, new Date('2027-02-19T12:00:00Z')).estado).toBe('pausada')
  })
})

describe('apresentação', () => {
  const c: Cortesia = {
    plano: 'avancado',
    ate: D0_MEIA_NOITE,
    origem: 'pre_lancamento',
    concedida_em: '2026-11-20T15:00:00.000Z',
    fundador: true,
  }

  it('o último dia é o dia ANTES da meia-noite de D0', () => {
    expect(ultimoDiaDaCortesia(c)).toBe('2027-01-10')
  })

  it('a contagem é por dia de Brasília: 22h do dia 10 ainda é "hoje", e já é dia 11 em UTC', () => {
    expect(diasParaOFim(c, new Date('2027-01-11T01:00:00Z'))).toBe(0) // 22h de 10/01 em Brasília
    expect(diasParaOFim(c, new Date('2027-01-11T03:00:00Z'))).toBe(-1)
    expect(diasParaOFim(c, new Date('2026-12-27T15:00:00Z'))).toBe(14)
  })

  it('escreve a data por extenso, igual em qualquer máquina', () => {
    expect(descreverDia('2027-01-11')).toBe('11 de janeiro de 2027')
    expect(descreverDiaCurto('2026-12-12')).toBe('12 de dezembro')
  })
})

describe('ofertaDoCadastro: o que a página pública diz antes de a conta existir', () => {
  const um = (iso: string) => ofertaDoCadastro(new Date(iso))

  it('antes da janela: diz "pelo menos 60" e a data de fim, e o número NÃO passa do que a pessoa recebe', () => {
    const o = um('2026-10-03T15:00:00Z')
    expect(o.longa).toBe(true)
    expect(o.chamada).toBe('Pelo menos 60 dias de tudo liberado, sem cartão')
    expect(o.fim).toBe('10 de janeiro de 2027')
    const c = cortesiaDoCadastro(new Date('2026-10-03T15:00:00Z'))
    const dias = diasParaOFim(c, new Date('2026-10-03T15:00:00Z')) + 1
    expect(dias, 'a chamada prometeu mais dias do que a cortesia entrega').toBeGreaterThanOrEqual(60)
  })

  it('na abertura pública (09/11) ainda são mais de 60 dias, e a chamada continua verdadeira', () => {
    const o = um('2026-11-09T15:00:00Z')
    expect(o.chamada).toBe('Pelo menos 60 dias de tudo liberado, sem cartão')
  })

  it('o número SOME no dia em que deixa de ser verdade, e vira a data', () => {
    // Em 12/11 restam 60 dias inclusivos até 10/01? Conferido pela mesma conta, não por aritmética à mão.
    const quando = (iso: string) => {
      const c = cortesiaDoCadastro(new Date(iso))
      return diasParaOFim(c, new Date(iso)) + 1
    }
    expect(quando('2026-11-12T15:00:00Z')).toBe(60)
    expect(um('2026-11-12T15:00:00Z').chamada).toBe('Pelo menos 60 dias de tudo liberado, sem cartão')
    expect(quando('2026-11-13T15:00:00Z')).toBe(59)
    expect(um('2026-11-13T15:00:00Z').chamada).toBe('Tudo liberado até 10 de janeiro, sem cartão')
  })

  it('o último dia da cortesia longa (12/12) ainda é cortesia longa, com 30 dias de verdade', () => {
    const o = um('2026-12-12T15:00:00Z')
    expect(o.longa).toBe(true)
    expect(o.chamada).toBe('Tudo liberado até 10 de janeiro, sem cartão')
    expect(o.ateQuandoALongaVale).toBe('12 de dezembro')
  })

  it('13/12 em diante é o teste de 21 dias, e a frase diz 21', () => {
    const o = um('2026-12-13T15:00:00Z')
    expect(o.longa).toBe(false)
    expect(o.chamada).toBe('21 dias de tudo liberado, sem cartão')
    expect(o.fim).toBe('3 de janeiro de 2027')
  })

  it('depois do lançamento: o teste de 21 dias, para sempre', () => {
    expect(um('2027-03-01T15:00:00Z')).toMatchObject({ longa: false, chamada: '21 dias de tudo liberado, sem cartão' })
  })

  it('o dia é o de Brasília: 22h30 de 12/12 em Brasília ainda é cortesia longa, mesmo com a máquina em outro dia', () => {
    // 2026-12-13T01:30Z = 22h30 de 12/12 em Brasília; em Kiritimati já é 13/12.
    expect(um('2026-12-13T01:30:00Z').longa).toBe(true)
    // E 21h01 de 12/12 + 3h = 00h01 de 13/12 em Brasília: acabou.
    expect(um('2026-12-13T03:01:00Z').longa).toBe(false)
  })

  it('nenhuma frase tem travessão nem escassez', () => {
    for (const iso of ['2026-10-03T15:00:00Z', '2026-11-20T15:00:00Z', '2026-12-13T15:00:00Z', '2027-03-01T15:00:00Z']) {
      const o = um(iso)
      expect(o.chamada).not.toMatch(/[—–]/)
      expect(o.chamada).not.toMatch(/só hoje|últimas vagas|corra/i)
    }
  })
})
