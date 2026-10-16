/**
 * docs/98-aprimoramento/11 LOJA-30: no app nativo a página desenha por baixo da barra de status (edge-to-edge,
 * ver `configurar-status-bar-nativo.tsx`), e quem escolhe a cor dos ícones (hora, bateria, sinal) somos nós.
 * Estavam fixos em branco: no tema claro do painel, branco sobre `#faf8f5`, praticamente invisíveis.
 *
 * Decide pela cor medida debaixo da barra, não pelo nome do tema: o painel segue o cookie, o "Automático" segue o
 * aparelho, e a suposição de que a frente de casa era escura caiu ao medir (`/entrar` pinta `#faf8f5`, 15/10/2026).
 * Uma pergunta só: qual dos dois ícones contrasta mais com o que está ali.
 */

/** Luminância relativa da WCAG 2.x, de 0 (preto) a 1 (branco). */
function luminancia(r: number, g: number, b: number): number {
  const canal = (c: number) => {
    const s = Math.min(255, Math.max(0, c)) / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** `claros` sobre fundo escuro, `escuros` sobre fundo claro: o que tiver mais contraste com o fundo. */
export function iconesDaBarraParaFundo(r: number, g: number, b: number): 'claros' | 'escuros' {
  const l = luminancia(r, g, b)
  const contrasteComBranco = 1.05 / (l + 0.05)
  const contrasteComPreto = (l + 0.05) / 0.05
  return contrasteComBranco >= contrasteComPreto ? 'claros' : 'escuros'
}
