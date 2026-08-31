import type { ModuloKey } from '@/core/billing/planos'

/**
 * O que o assistente NÃO consegue ver neste tenant, dito ao modelo em palavras.
 *
 * Medido em produção em 2026-08-30, e o resultado foi pior do que a hipótese. Perguntando "quais
 * produtos estão acabando no meu estoque?" num tenant sem o módulo `stock`, a ferramenta de
 * estoque está escondida (filtrada por plano, corretamente) — e o modelo, sem saber que ela
 * existe, chamou uma ferramenta NÃO RELACIONADA (`resumo_de_hoje`) e respondeu:
 *
 *   "Não há alertas de estoque no momento. Todos os itens estão com níveis adequados."
 *
 * Ele inventou uma tranquilização sobre um dado que nunca viu. O dono é informado de que o estoque
 * está bem quando o sistema literalmente não pode saber — e descobre a falta com a cliente na
 * cadeira. É a mesma armadilha que o `catch` do laço já registra em código ("resposta vazia parece
 * 'você não tem nada atrasado', que é mentira"), agora uma camada acima, no modelo.
 *
 * O prompt JÁ mandava "se nenhuma ferramenta traz o dado, diga que não consegue responder". Não
 * bastou, e o motivo importa: a instrução é passiva. O modelo não percebe a AUSÊNCIA de uma
 * ferramenta — ele vê a lista do que tem e assume que ela cobre a pergunta. Dizer o nome do que
 * falta transforma um vazio invisível numa informação concreta.
 *
 * E dizer o motivo é a regra 5.2 do plano de monetização: bloqueio mostra o motivo e o caminho.
 * Sumir em silêncio esconde o que o dono poderia comprar.
 */
export type Bloqueio = { modulo: ModuloKey; rotulo: string; precisaDoPlano?: string }

export function frasesDeBloqueio(bloqueios: Bloqueio[]): string {
  if (bloqueios.length === 0) return ''

  const itens = bloqueios
    .map((b) => (b.precisaDoPlano ? `${b.rotulo} (está no plano ${b.precisaDoPlano})` : `${b.rotulo} (desligado nas configurações)`))
    .join('; ')

  return [
    `Você NÃO tem acesso a estes assuntos neste salão: ${itens}.`,
    // A frase que impede a confabulação. Sem ela o modelo preenche o vazio com a resposta mais
    // simpática, que é justamente a mais perigosa: "está tudo certo".
    'Se perguntarem sobre qualquer um deles, diga que não consegue ver isso e explique o motivo acima.',
    'NUNCA responda que está tudo certo, que não há nada, ou que está tudo em ordem sobre um desses assuntos — você não tem como saber, e dizer que está tudo bem é pior do que não responder.',
  ].join('\n')
}
