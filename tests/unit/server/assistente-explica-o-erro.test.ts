import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { executarLaco } from '@/server/services/assistente'

import type { ContextoFerramenta, Ferramenta } from '@/server/assistente/ferramentas'
import type { AiProvider, MensagemDoAssistente, RespostaDoModelo } from '@/server/providers/ai/types'

/**
 * Quando os argumentos do modelo não passam no Zod, o que volta para ele precisa dizer QUAL campo
 * e POR QUÊ. Com a frase fixa antiga ("Argumentos inválidos para esta ferramenta.") a correção
 * mais provável era repetir o mesmo erro: as três voltas queimavam às cegas e o dono recebia
 * "não consegui terminar de responder" por causa de um traço no lugar errado.
 *
 * Ficou mais importante em 2026-08-30: a limpeza de schema para o Gemini tira `pattern`, então o
 * formato só existe na descrição e o Zod virou a única checagem de verdade.
 */
const CTX: ContextoFerramenta = { db: {} as never, tenantId: 't1', timezone: 'America/Sao_Paulo' }

function ferramentaComData(): Ferramenta {
  return {
    nome: 'ocupacao_do_dia',
    descricao: 'só para teste',
    schema: z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD') }),
    permissao: 'client:read',
    modulo: 'clients',
    executar: vi.fn(async () => ({ ok: true })),
  }
}

/** Captura o que o laço devolve ao modelo, que é o objeto do teste. */
function providerQueGrava(roteiro: RespostaDoModelo[]) {
  const vistas: MensagemDoAssistente[][] = []
  let i = 0
  const provider: AiProvider = {
    perguntar: vi.fn(async ({ mensagens }) => {
      vistas.push(structuredClone(mensagens))
      const r = roteiro[i]
      i++
      if (!r) throw new Error('roteiro acabou')
      return r
    }),
  }
  return { provider, vistas }
}

describe('erro de argumento volta explicado', () => {
  it('nomeia o campo e a regra, para o modelo poder consertar', async () => {
    const { provider, vistas } = providerQueGrava([
      // O modelo escreve a data no formato brasileiro — exatamente o erro que o `pattern`
      // removido do schema deixou de avisar antes da chamada.
      { tipo: 'chamada_ferramenta', nome: 'ocupacao_do_dia', argumentos: JSON.stringify({ dia: '28/08/2026' }) },
      { tipo: 'chamada_ferramenta', nome: 'ocupacao_do_dia', argumentos: JSON.stringify({ dia: '2026-08-28' }) },
      { tipo: 'texto', texto: 'Você teve 1 agendamento.' },
    ])

    const r = await executarLaco({ provider, ferramentas: [ferramentaComData()], ctxFerramenta: CTX, pergunta: 'ocupação do dia 28' })

    // Prova que o cenário foi montado: houve uma segunda volta, logo a primeira foi recusada.
    expect(vistas.length, 'o laço não chegou a repetir a chamada').toBeGreaterThan(1)

    const devolvido = vistas
      .flat()
      .filter((m): m is Extract<MensagemDoAssistente, { papel: 'ferramenta' }> => m.papel === 'ferramenta')
      .map((m) => m.conteudo)
      .join(' | ')

    expect(devolvido, 'o modelo não foi informado de QUAL campo errou').toContain('dia')
    expect(devolvido, 'o modelo não foi informado da REGRA').toContain('AAAA-MM-DD')
    // Depois de saber o campo e a regra, a segunda tentativa passa e a ferramenta roda.
    expect(r.ferramentasUsadas).toContain('ocupacao_do_dia')
  })

  /*
   * O que a mutação ensinou sobre ESTA guarda: vazar pelas `issues` do Zod é impossível — elas não
   * carregam o valor recebido. Duas tentativas de mutação passaram verdes por isso, e uma guarda
   * que nada consegue reprovar é decoração. O que ela protege de verdade é a assinatura: alguém
   * "melhorando" a função para receber os argumentos crus "e dar mais contexto ao modelo" põe o
   * telefone da cliente no histórico da conversa e no log do provedor. Essa mutação reprova.
   */
  it('não devolve o valor recebido — pode ser dado de cliente que o dono ditou', async () => {
    const ferramenta: Ferramenta = {
      nome: 'buscar', descricao: 'x', schema: z.object({ telefone: z.string().min(20, 'curto') }),
      permissao: 'client:read', modulo: 'clients', executar: vi.fn(async () => ({})),
    }
    const { provider, vistas } = providerQueGrava([
      { tipo: 'chamada_ferramenta', nome: 'buscar', argumentos: JSON.stringify({ telefone: '51988887777' }) },
      { tipo: 'texto', texto: 'ok' },
    ])

    await executarLaco({ provider, ferramentas: [ferramenta], ctxFerramenta: CTX, pergunta: 'x' })

    const devolvido = vistas.flat().filter((m) => m.papel === 'ferramenta').map((m) => (m as { conteudo: string }).conteudo).join(' ')
    expect(devolvido, 'o cenário não foi montado — nenhuma recusa aconteceu').toContain('curto')
    expect(devolvido, 'o telefone do cliente vazou para o histórico do modelo').not.toContain('51988887777')
  })
})
