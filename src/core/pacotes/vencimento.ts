/** "alerta em D-15 do vencimento" — a janela vem do critério de aceite do TICKET-046. */
export const DIAS_ALERTA_VENCIMENTO = 15

/**
 * O pacote está na janela de alerta de vencimento?
 *
 * Regra pura, e mora aqui pelo mesmo motivo de `core/cycle/valor-em-risco.ts`: é aritmética de
 * regra de negócio sem I/O, e estando dentro de `server/services/pacotes.ts` só dava para
 * exercitá-la subindo banco.
 *
 * **O piso inferior é o conserto, e o defeito era invisível.** A condição era
 * `dias <= DIAS_ALERTA_VENCIMENTO`, sem `>= 0`: um pacote vencido há cem dias devolve `dias =
 * -100`, que também é `<= 15`. Ou seja, "vencendo em breve" ficava verdadeiro **para sempre**
 * depois do vencimento, desde que sobrasse sessão — e sobra é justamente o caso interessante,
 * porque pacote esgotado a própria regra já exclui.
 *
 * O comentário original dizia "alerta em D-15 do vencimento": uma janela ANTES da data, não uma
 * condição que abre na data e nunca mais fecha. O código dizia outra coisa.
 *
 * **Latente, e vale dizer com precisão:** hoje nenhuma tela lê `expiringSoon` — a ficha do cliente
 * recebe `expiresOn` cru e formata por conta — e `pacotesAVencerEmBreve` não tem consumidor
 * nenhum. O valor errado viaja só no formato da resposta de `GET /api/v1/packages`. Isto é
 * conserto de uma armadilha armada, não de um incêndio: quem for construir o alerta de pacotes
 * encontraria a lista contaminada de pacotes mortos, misturados com os que vencem semana que vem.
 *
 * Pacote JÁ VENCIDO com sessão sobrando é uma pergunta de produto legítima e diferente — e é
 * deliberadamente deixada de fora: inventar um `expired` que ninguém pediu é o que produz campo
 * sem leitor, que é como este defeito nasceu.
 */
export function venceEmBreve(diasAteVencer: number | null, sessoesRestantes: number): boolean {
  if (diasAteVencer === null) return false
  if (sessoesRestantes <= 0) return false
  return diasAteVencer >= 0 && diasAteVencer <= DIAS_ALERTA_VENCIMENTO
}
