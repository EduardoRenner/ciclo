import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { executarLaco, promptDeSistema } from '@/server/services/assistente'

import type { ContextoFerramenta, Ferramenta } from '@/server/assistente/ferramentas'
import type { AiProvider, MensagemDoAssistente, RespostaDoModelo } from '@/server/providers/ai/types'

/**
 * Medido em produção em 2026-08-30, num tenant sem o módulo `stock`:
 *
 *   pergunta: "quais produtos estão acabando no meu estoque?"
 *   resposta: "Não há alertas de estoque no momento. Todos os itens estão com níveis adequados."
 *   ferramentasUsadas: ["resumo_de_hoje"]   ← nada a ver com estoque
 *
 * O modelo não vê a ferramenta de estoque (filtrada por plano, corretamente), não percebe a
 * AUSÊNCIA dela, pega uma ferramenta qualquer e inventa a tranquilização. O dono é informado de
 * que o estoque está bem quando o sistema não pode saber.
 *
 * O prompt já dizia "se nenhuma ferramenta traz o dado, diga que não consegue". Instrução passiva
 * não resolve — o modelo vê a lista do que TEM e assume que cobre a pergunta. É preciso nomear o
 * que falta.
 */
const CTX: ContextoFerramenta = { db: {} as never, tenantId: 't1', timezone: 'America/Sao_Paulo' }

describe('promptDeSistema com bloqueios', () => {
  it('nomeia o assunto bloqueado e o plano que o libera', () => {
    const p = promptDeSistema('2026-08-30', [{ modulo: 'stock', rotulo: 'Estoque', precisaDoPlano: 'avancado' }])
    expect(p).toContain('Estoque')
    expect(p).toContain('avancado')
  })

  it('proíbe explicitamente o "está tudo certo" — a confabulação medida', () => {
    const p = promptDeSistema('2026-08-30', [{ modulo: 'stock', rotulo: 'Estoque', precisaDoPlano: 'avancado' }])
    // Sem esta frase o modelo preenche o vazio com a resposta mais simpática, que é a mais
    // perigosa. É o coração do conserto, não um detalhe de redação.
    expect(p.toLowerCase()).toContain('nunca responda que está tudo certo')
  })

  it('distingue bloqueio de plano de desligado pelo dono', () => {
    const p = promptDeSistema('2026-08-30', [{ modulo: 'stock', rotulo: 'Estoque' }])
    expect(p).toContain('desligado nas configurações')
    expect(p).not.toContain('está no plano')
  })

  it('sem bloqueio nenhum, o prompt não ganha ruído', () => {
    const p = promptDeSistema('2026-08-30', [])
    expect(p).not.toContain('NÃO tem acesso')
    // Prova que o cenário foi montado: o prompt existe e é o de sempre.
    expect(p).toContain('CICLO')
  })
})

describe('o aviso chega ao modelo de verdade', () => {
  it('o laço entrega os bloqueios na mensagem de sistema', async () => {
    let vistas: MensagemDoAssistente[] = []
    const provider: AiProvider = {
      perguntar: vi.fn(async ({ mensagens }) => {
        vistas = mensagens
        return { tipo: 'texto', texto: 'Não consigo ver seu estoque neste plano.' } as RespostaDoModelo
      }),
    }
    const ferramenta: Ferramenta = {
      nome: 'resumo_de_hoje', descricao: 'x', schema: z.object({}),
      permissao: 'client:read', modulo: 'clients', executar: vi.fn(async () => ({})),
    }

    await executarLaco({
      provider, ferramentas: [ferramenta], ctxFerramenta: CTX,
      pergunta: 'quais produtos estão acabando?',
      bloqueios: [{ modulo: 'stock', rotulo: 'Estoque', precisaDoPlano: 'avancado' }],
    })

    const sistema = vistas.filter((m) => m.papel === 'sistema').map((m) => (m as { texto: string }).texto).join(' ')
    expect(sistema, 'não houve mensagem de sistema — o cenário não foi montado').toContain('CICLO')
    expect(sistema, 'o modelo não foi avisado do que não consegue ver').toContain('Estoque')
  })
})
