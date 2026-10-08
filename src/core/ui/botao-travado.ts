/**
 * docs/102 M1.4: como um botão travado se comporta.
 *
 * Até aqui o `Button` usava `disabled` nativo com `pointer-events: none`. O motivo (`motivoDesabilitado`)
 * ia para o `title` e para um texto só de leitor de tela: o `title` nunca aparecia (sem eventos de ponteiro
 * não há passar o mouse) e no celular não existe `title`. Quem enxerga via um botão apagado e nenhuma pista.
 *
 * A regra:
 *  - carregando: `disabled` nativo. O spinner já conta a história e o toque não deve fazer nada;
 *  - travado COM motivo: `aria-disabled`. O botão continua recebendo o toque (e o foco), nunca executa a
 *    ação nem envia formulário, e o toque mostra o motivo em texto visível;
 *  - travado SEM motivo: `disabled` nativo (a guarda `botao-travado-diz-por-que` já exige o motivo onde
 *    ele faz falta; aqui é só o comportamento seguro quando ele não veio).
 */
export type EstadoDoBotao = { disabledNativo: boolean; ariaDisabled: boolean; explicaNoToque: boolean }

export function estadoDoBotao(e: { disabled?: boolean; carregando?: boolean; motivo?: string }): EstadoDoBotao {
  if (e.carregando) return { disabledNativo: true, ariaDisabled: false, explicaNoToque: false }
  if (e.disabled && e.motivo && e.motivo.trim()) return { disabledNativo: false, ariaDisabled: true, explicaNoToque: true }
  if (e.disabled) return { disabledNativo: true, ariaDisabled: false, explicaNoToque: false }
  return { disabledNativo: false, ariaDisabled: false, explicaNoToque: false }
}

/**
 * Onde a bolha do motivo aparece: abaixo do botão, ou acima quando não cabe embaixo. A posição é fixa na
 * tela e a largura vai de margem a margem, então nunca cria rolagem lateral.
 */
export function posicaoDaBolha(botao: { top: number; bottom: number }, alturaDaTela: number): { top: number } | { bottom: number } {
  const ESPACO = 8
  const ALTURA_ESTIMADA = 64
  return botao.bottom + ESPACO + ALTURA_ESTIMADA <= alturaDaTela ? { top: botao.bottom + ESPACO } : { bottom: alturaDaTela - botao.top + ESPACO }
}
