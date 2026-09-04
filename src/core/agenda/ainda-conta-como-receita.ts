/**
 * Se um agendamento ainda vale como receita esperada do dia.
 *
 * O `forecastCents` de `listarAgendaDoDia` sempre somou os estados
 * `pending | confirmed | arrived | done`, e o docstring dele diz, com estas palavras: *"soma do
 * `price_cents` dos agendamentos que ainda valem (não cancelados, **vencidos** ou faltosos)"*.
 *
 * "Vencido" é o estado `expired`, que existe no enum desde a migration 0001 — e **nunca foi
 * alcançado por nada**. Medido na produção em 2026-09-03: zero linhas `expired` na história
 * inteira do banco, e `hold_expires_at` (a coluna que decidiria o vencimento) nunca escrita.
 * Ou seja, o filtro excluía um estado que não existe na prática, e o número prometia uma coisa
 * enquanto somava outra.
 *
 * **O que isso custava.** Todo agendamento nasce `pending` (`docs/09-PLATAFORMA.md` §4) e só sai
 * dali quando alguém do salão confirma. Quem marcou às 9h e não foi confirmado continuava
 * `pending` para sempre — então, às 18h, o "previsto" do dia ainda contava um atendimento que já
 * não podia acontecer: a hora passou, ninguém confirmou, ninguém atendeu. Eram 19 linhas assim em
 * produção no momento da medição. O salão fecha o dia comparando o que entrou com um previsto
 * inflado, e a diferença parece perda de venda quando é erro de conta.
 *
 * **Por que isto é leitura e não transição de estado.** Marcar o agendamento como `expired` seria
 * o conserto "de verdade" — e é exatamente o que a armadilha do CLAUDE.md sobre no-show proíbe
 * fazer sozinho: *"o sistema sugere; quem marca é o profissional"*. Um salão que atendeu a pessoa
 * e esqueceu de confirmar no app ainda precisa poder marcar `done` depois. Então o estado fica
 * como está, e quem muda é o NÚMERO — que passa a dizer o que o docstring já prometia.
 *
 * `confirmed` e `arrived` continuam contando mesmo com a hora passada: ali o salão AFIRMOU que o
 * atendimento existe. O que não se sustenta é dinheiro previsto a partir de um pedido que nunca
 * foi aceito por ninguém.
 */
export type AgendamentoParaReceita = {
  status: string
  /** Fim do horário, em ISO 8601. */
  endsAt: string
}

const ESTADOS_QUE_CONTAM = new Set(['pending', 'confirmed', 'arrived', 'done'])

export function aindaContaComoReceita(agendamento: AgendamentoParaReceita, agora: Date): boolean {
  if (!ESTADOS_QUE_CONTAM.has(agendamento.status)) return false
  // Só `pending` decai com o tempo. Os outros três já passaram por uma decisão humana.
  if (agendamento.status !== 'pending') return true
  return new Date(agendamento.endsAt).getTime() > agora.getTime()
}
