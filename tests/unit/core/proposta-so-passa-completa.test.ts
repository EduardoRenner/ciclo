import { describe, expect, it } from 'vitest'

import { extrairProposta } from '@/core/assistente/proposta'

/**
 * A porta que decide se um retorno de ferramenta vira CARTÃO COM BOTÃO no chat. Ela é estreita de
 * propósito: o objeto que passa aqui carrega o corpo que a rota de execução vai receber quando o
 * dono tocar em confirmar. Malformado virando cartão é um botão que promete e falha no clique —
 * ou executa outra coisa.
 */
const completa = {
  status: 'proposta',
  acao: 'criar_agendamento',
  dados: { clientId: 'c1', serviceId: 's1' },
  resumo: { cliente: 'Maria Silva' },
}

describe('extrairProposta', () => {
  it('proposta completa passa', () => {
    const p = extrairProposta(completa)
    expect(p).toBeDefined()
    expect(p?.acao).toBe('criar_agendamento')
  })

  it('resultado que NÃO é proposta não vira botão', () => {
    // Os outros três status que a ferramenta devolve, e que precisam continuar sendo só texto.
    expect(extrairProposta({ status: 'qual_delas', oQue: 'cliente', opcoes: ['a', 'b'] })).toBeUndefined()
    expect(extrairProposta({ status: 'nao_achei', oQue: 'cliente' })).toBeUndefined()
    // E o retorno de qualquer ferramenta de LEITURA, que nunca deve virar ação.
    expect(extrairProposta({ revenueTodayCents: 15000, alerts: [] })).toBeUndefined()
  })

  it('status errado NÃO passa, mesmo com todo o resto perfeito', () => {
    // O caso que isola o STATUS. Sem ele esta guarda era CEGA: os outros negativos falhavam por
    // não ter `acao`, então a checagem de status podia ser removida e o teste seguia verde —
    // medido, removendo a linha do produto. Aqui o objeto é uma proposta completa em tudo, menos
    // no status; se a porta parar de olhar o status, esta asserção é a única que reprova.
    expect(extrairProposta({ ...completa, status: 'qual_delas' })).toBeUndefined()
    expect(extrairProposta({ ...completa, status: 'nao_achei' })).toBeUndefined()
    expect(extrairProposta({ ...completa, status: undefined })).toBeUndefined()
  })

  it('proposta faltando peça não passa — botão sem destino ou sem conteúdo', () => {
    for (const quebrada of [
      { ...completa, acao: undefined },
      { ...completa, acao: '' },
      { ...completa, dados: undefined },
      { ...completa, resumo: undefined },
      { ...completa, dados: 'nao é objeto' },
      { ...completa, resumo: [1, 2, 3] },
    ]) {
      expect(extrairProposta(quebrada), `passou: ${JSON.stringify(quebrada)}`).toBeUndefined()
    }
  })

  it('lixo não derruba nem passa', () => {
    for (const lixo of [null, undefined, 'texto', 42, [], [completa]]) {
      expect(extrairProposta(lixo), `passou: ${JSON.stringify(lixo)}`).toBeUndefined()
    }
  })
})
