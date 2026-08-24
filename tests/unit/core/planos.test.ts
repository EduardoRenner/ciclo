import { describe, expect, it } from 'vitest'

import {
  PLANOS,
  menorPlanoCom,
  podeCriar,
  podeUsarCapacidade,
  podeUsarModulo,
  verificarLimite,
  type ContextoDoTenant,
} from '@/core/billing/planos'

const BARBEARIA_GRATIS: ContextoDoTenant = {
  plano: 'gratis',
  eixos: { onde: 'no_local', cobranca: 'fixo', ritmo: 'avulso' },
}

const ELETRICISTA_GRATIS: ContextoDoTenant = {
  plano: 'gratis',
  eixos: { onde: 'vai_ate', cobranca: 'orcamento', inicio: 'orcamento', ritmo: 'sob_demanda' },
}

describe('herança entre degraus', () => {
  it('degrau de cima acumula tudo do de baixo', () => {
    for (const m of PLANOS.gratis.modulos) expect(PLANOS.avancado.modulos).toContain(m)
    for (const m of PLANOS.essencial.modulos) expect(PLANOS.equipe.modulos).toContain(m)
  })

  it('o Motor de Ciclo está no grátis — §D.2, o grátis mostra o dinheiro parado', () => {
    expect(PLANOS.gratis.modulos).toContain('cycle_engine')
  })

  it('mas o envio em lote não — é a alavanca que faz subir de degrau', () => {
    expect(PLANOS.gratis.capacidades).not.toContain('envio_em_lote')
    expect(PLANOS.essencial.capacidades).toContain('envio_em_lote')
  })
})

describe('precedência: eixo vem antes de plano (§D.5)', () => {
  it('módulo fora do eixo some, e NÃO vira oferta de upgrade', () => {
    // Barbearia atende no local: rota não faz sentido nem no degrau mais caro.
    const v = podeUsarModulo({ ...BARBEARIA_GRATIS, plano: 'avancado' }, 'routing')
    expect(v.estado).toBe('fora_do_eixo')
  })

  it('o mesmo módulo, num negócio que se desloca, vira bloqueio com caminho', () => {
    const v = podeUsarModulo(ELETRICISTA_GRATIS, 'routing')
    expect(v).toEqual({ estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' })
  })

  it('eixo ainda não respondido não esconde nada — onboarding incompleto não é veredito', () => {
    const v = podeUsarModulo({ plano: 'avancado', eixos: {} }, 'routing')
    expect(v.estado).toBe('liberado')
  })

  it('linha perdida no banco NÃO consegue desligar a agenda nem o Motor de Ciclo', () => {
    // `definirModulo` recusa desligá-los, mas `tenant_modules.modulo` não tem restrição que
    // impeça a linha chegar por seed ou correção manual. Sem esta defesa, um registro de
    // configuração faria o produto sumir da interface.
    for (const modulo of ['agenda', 'cycle_engine'] as const) {
      const v = podeUsarModulo({ ...BARBEARIA_GRATIS, desligadosPeloDono: [modulo] }, modulo)
      expect(v.estado, `${modulo} não pode ser desligado por linha perdida`).toBe('liberado')
    }
  })

  it('dono desligou vem depois de plano liberar, e é reversível', () => {
    const v = podeUsarModulo({ ...BARBEARIA_GRATIS, desligadosPeloDono: ['public_page'] }, 'public_page')
    expect(v.estado).toBe('desligado_pelo_dono')
  })
})

describe('bloqueio aponta o degrau mais barato que resolve', () => {
  it('campanha custa o Essencial, não o Avançado', () => {
    expect(podeUsarModulo(BARBEARIA_GRATIS, 'campaigns')).toEqual({
      estado: 'bloqueado_pelo_plano',
      precisaDo: 'essencial',
    })
  })

  it('anamnese custa o Avançado — dado de saúde tem custo de conformidade real', () => {
    expect(menorPlanoCom('health_records')).toBe('avancado')
  })

  it('o selo aparece no grátis e sai no primeiro degrau pago (§D.3/G.1)', () => {
    // A página pública decide por `podeUsarCapacidade(..., 'remover_selo') !== 'liberado'`.
    const mostraSelo = (plano: ContextoDoTenant['plano']) =>
      podeUsarCapacidade({ plano, eixos: {} }, 'remover_selo').estado !== 'liberado'
    expect(mostraSelo('gratis')).toBe(true)
    expect(mostraSelo('essencial')).toBe(false)
    expect(mostraSelo('equipe')).toBe(false)
    expect(mostraSelo('avancado')).toBe(false)
  })

  it('remover o selo é a capacidade do primeiro degrau pago', () => {
    expect(podeUsarCapacidade(BARBEARIA_GRATIS, 'remover_selo')).toEqual({
      estado: 'bloqueado_pelo_plano',
      precisaDo: 'essencial',
    })
    expect(podeUsarCapacidade({ ...BARBEARIA_GRATIS, plano: 'essencial' }, 'remover_selo').estado).toBe('liberado')
  })
})

describe('limite duro × limite suave (§L.1)', () => {
  it('profissional é limite duro: o segundo é recusado no grátis', () => {
    const r = verificarLimite(BARBEARIA_GRATIS, 'profissionais', 1)
    expect(r.dentro).toBe(false)
    expect(r.severidade).toBe('duro')
    expect(r.precisaDo).toBe('equipe')
    expect(podeCriar(BARBEARIA_GRATIS, 'profissionais', 1)).toBe(false)
  })

  it('cliente é limite suave: avisa, mas NUNCA trava cadastro no meio do atendimento', () => {
    const r = verificarLimite(BARBEARIA_GRATIS, 'clientes', 50)
    expect(r.dentro).toBe(false)
    expect(r.severidade).toBe('suave')
    expect(podeCriar(BARBEARIA_GRATIS, 'clientes', 50)).toBe(true)
  })

  it('avisa a partir de 80% do teto, antes de doer', () => {
    expect(verificarLimite(BARBEARIA_GRATIS, 'clientes', 39).perto).toBe(false)
    expect(verificarLimite(BARBEARIA_GRATIS, 'clientes', 40).perto).toBe(true)
  })

  it('importação em lote é avaliada pelo total, não de um em um', () => {
    // 46 clientes + CSV de 10 estoura o teto de 50 do grátis.
    const r = verificarLimite(BARBEARIA_GRATIS, 'clientes', 46, 10)
    expect(r.dentro).toBe(false)
    expect(r.restante).toBe(4)
  })

  it('aAdicionar 0 responde "como estou hoje", não "posso criar mais um"', () => {
    // É a pergunta que a tela de clientes faz para desenhar o aviso de teto.
    const exatamenteNoTeto = verificarLimite(BARBEARIA_GRATIS, 'clientes', 50, 0)
    expect(exatamenteNoTeto.dentro).toBe(true) // 50 de 50 ainda é dentro
    expect(exatamenteNoTeto.restante).toBe(0)
    expect(exatamenteNoTeto.perto).toBe(true)

    // Com aAdicionar 1 a mesma situação já responde "não cabe mais".
    expect(verificarLimite(BARBEARIA_GRATIS, 'clientes', 50, 1).dentro).toBe(false)
  })

  it('acima do teto continua reportando o teto, para a tela poder dizer quanto é', () => {
    const estourado = verificarLimite(BARBEARIA_GRATIS, 'clientes', 58, 0)
    expect(estourado.dentro).toBe(false)
    expect(estourado.limite).toBe(50)
    expect(estourado.restante).toBe(0)
    // E mesmo estourado o limite suave não impede nada.
    expect(podeCriar(BARBEARIA_GRATIS, 'clientes', 58)).toBe(true)
  })

  it('degrau sem teto responde limite nulo, não zero', () => {
    const r = verificarLimite({ ...BARBEARIA_GRATIS, plano: 'avancado' }, 'profissionais', 900)
    expect(r).toMatchObject({ dentro: true, limite: null, restante: null, precisaDo: null })
  })

  it('quem já está acima do teto do degrau novo não perde nada — só não cria mais (regra 5.1)', () => {
    // dom-rocha tem 3 profissionais; rebaixado para grátis, continua com os 3 à vista.
    const rebaixado: ContextoDoTenant = { ...BARBEARIA_GRATIS, plano: 'gratis' }
    const r = verificarLimite(rebaixado, 'profissionais', 3, 0)
    expect(r.dentro).toBe(false) // está acima do teto...
    expect(podeCriar(rebaixado, 'profissionais', 3)).toBe(false) // ...e não pode criar o 4º
    // ...mas nada nesta camada apaga ou esconde os 3 que existem: não há função para isso.
  })
})
