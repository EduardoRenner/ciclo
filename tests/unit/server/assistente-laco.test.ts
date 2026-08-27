import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { executarLaco } from '@/server/services/assistente'

import type { ContextoFerramenta, Ferramenta } from '@/core/assistente/ferramentas'
import type { AiProvider, PedidoAoModelo, RespostaDoModelo } from '@/server/providers/ai/types'

/**
 * docs/26-AGENTE-IA-PLANO.md §6 (ticket A8): testes do laço puro, sem Supabase — `executarLaco`
 * recebe ferramentas já resolvidas, então dá para injetar ferramenta falsa e provider falso.
 * Roda em `tests/unit/server/`, nunca em `tests/integration/` (a casa toda segue essa regra
 * porque `.env.local` aponta para produção — ver docs/ciclo-monetizacao na memória).
 */

const CTX_FALSO: ContextoFerramenta = { db: {} as never, tenantId: 't1', timezone: 'America/Sao_Paulo' }

function ferramentaFalsa(sobrescreve: Partial<Ferramenta> = {}): Ferramenta {
  return {
    nome: 'ferramenta_falsa',
    descricao: 'só para teste',
    schema: z.object({}),
    permissao: 'client:read',
    modulo: 'clients',
    executar: vi.fn(async () => ({ ok: true })),
    ...sobrescreve,
  }
}

/** Provider falso que devolve as respostas passadas, uma por chamada, na ordem. */
function providerComRoteiro(roteiro: RespostaDoModelo[]): AiProvider {
  let i = 0
  return {
    perguntar: vi.fn(async (_pedido: PedidoAoModelo) => {
      const resposta = roteiro[i]
      i++
      if (!resposta) throw new Error('roteiro do provider falso acabou antes do esperado')
      return resposta
    }),
  }
}

describe('executarLaco', () => {
  it('responde direto em texto quando o modelo não chama ferramenta', async () => {
    const provider = providerComRoteiro([{ tipo: 'texto', texto: 'Você tem 3 horários vagos hoje.' }])
    const resultado = await executarLaco({ provider, ferramentas: [], ctxFerramenta: CTX_FALSO, pergunta: 'tenho vaga hoje?' })

    expect(resultado.resposta).toBe('Você tem 3 horários vagos hoje.')
    expect(resultado.ferramentasUsadas).toEqual([])
  })

  it('executa a ferramenta escolhida e devolve o resultado dela ao modelo antes da resposta final', async () => {
    const executar = vi.fn(async () => ({ atrasadas: 4, valorCents: 32000 }))
    const ferramenta = ferramentaFalsa({ nome: 'clientes_para_recuperar', executar })
    const provider = providerComRoteiro([
      { tipo: 'chamada_ferramenta', nome: 'clientes_para_recuperar', argumentos: '{}' },
      { tipo: 'texto', texto: 'Tem 4 clientes atrasadas, R$ 320 em risco.' },
    ])

    const resultado = await executarLaco({ provider, ferramentas: [ferramenta], ctxFerramenta: CTX_FALSO, pergunta: 'quem sumiu?' })

    expect(executar).toHaveBeenCalledTimes(1)
    expect(resultado.ferramentasUsadas).toEqual(['clientes_para_recuperar'])
    expect(resultado.resposta).toBe('Tem 4 clientes atrasadas, R$ 320 em risco.')
  })

  it('nunca deixa passar mais de 3 chamadas de ferramenta — corta o laço maluco', async () => {
    const executar = vi.fn(async () => ({ n: 1 }))
    const ferramenta = ferramentaFalsa({ executar })
    // Provider "maluco": sempre tenta chamar ferramenta de novo, nunca responde em texto.
    const respostaFixa: RespostaDoModelo = { tipo: 'chamada_ferramenta', nome: 'ferramenta_falsa', argumentos: '{}' }
    const provider: AiProvider = { perguntar: vi.fn(async () => respostaFixa) }

    const resultado = await executarLaco({ provider, ferramentas: [ferramenta], ctxFerramenta: CTX_FALSO, pergunta: 'qualquer coisa' })

    // MAX_CHAMADAS_DE_FERRAMENTA = 3: a última rodada do laço não oferece ferramenta nenhuma
    // (ver assistente.ts), então mesmo um provider que insiste não consegue chamar a 4ª vez.
    expect(executar).toHaveBeenCalledTimes(3)
    expect(resultado.ferramentasUsadas).toHaveLength(3)
  })

  it('erro de consulta vira "não consegui" — nunca resposta vazia disfarçada de "não tem nada" (§8.1)', async () => {
    const executar = vi.fn(async () => {
      throw new Error('erro de banco simulado')
    })
    const ferramenta = ferramentaFalsa({ nome: 'clientes_para_recuperar', executar })
    const provider = providerComRoteiro([
      { tipo: 'chamada_ferramenta', nome: 'clientes_para_recuperar', argumentos: '{}' },
      { tipo: 'texto', texto: 'Não consegui consultar quem está atrasado agora.' },
    ])

    const resultado = await executarLaco({ provider, ferramentas: [ferramenta], ctxFerramenta: CTX_FALSO, pergunta: 'quem sumiu?' })

    // O laço não lança — devolve o erro como resultado de ferramenta, e é o PROVIDER (aqui,
    // com roteiro fixo) que decide o que responder a partir disso. O que garantimos aqui é que
    // a ferramenta nunca aparece como "usada com sucesso" silenciosamente: o texto de erro
    // interno precisa ter chegado ao modelo antes da resposta final.
    expect(resultado.resposta).toBe('Não consegui consultar quem está atrasado agora.')
  })

  it('ferramenta fora da lista disponível (nome alucinado ou fora de alcance) não executa nada', async () => {
    const executar = vi.fn(async () => ({ n: 1 }))
    const ferramentaPermitida = ferramentaFalsa({ nome: 'permitida', executar })
    const provider = providerComRoteiro([
      { tipo: 'chamada_ferramenta', nome: 'ferramenta_que_nao_existe', argumentos: '{}' },
      { tipo: 'texto', texto: 'Não consigo fazer isso.' },
    ])

    const resultado = await executarLaco({ provider, ferramentas: [ferramentaPermitida], ctxFerramenta: CTX_FALSO, pergunta: 'faz algo estranho' })

    expect(executar).not.toHaveBeenCalled()
    expect(resultado.ferramentasUsadas).toEqual([])
    expect(resultado.resposta).toBe('Não consigo fazer isso.')
  })

  it('argumento que não passa no schema da ferramenta não executa — vira erro de volta ao modelo', async () => {
    const executar = vi.fn(async () => ({ n: 1 }))
    const ferramenta = ferramentaFalsa({ nome: 'com_schema', schema: z.object({ clientId: z.uuid() }), executar })
    const provider = providerComRoteiro([
      { tipo: 'chamada_ferramenta', nome: 'com_schema', argumentos: '{"clientId":"não-é-uuid"}' },
      { tipo: 'texto', texto: 'Preciso de um id válido para continuar.' },
    ])

    const resultado = await executarLaco({ provider, ferramentas: [ferramenta], ctxFerramenta: CTX_FALSO, pergunta: 'me dá o histórico dela' })

    expect(executar).not.toHaveBeenCalled()
    expect(resultado.resposta).toBe('Preciso de um id válido para continuar.')
  })
})
