const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/** WCAG 2.1: sRGB → luminância relativa, canal por canal. */
function luminanciaRelativa(hex: string): number {
  const m = HEX.exec(hex)
  if (!m) return 1 // hex inválido: trata como claro, cai no texto escuro (mesmo padrão do osso default)

  const canal = (h: string) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }

  const [r, g, b] = [canal(m[1]!), canal(m[2]!), canal(m[3]!)]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Ponto onde o contraste contra preto (#0d0c0c) e contra branco (#fffcf7) empatam —
 * derivado da fórmula de contraste do WCAG: `(L+0.05)/0.05 = 1.05/(L+0.05)`. Abaixo
 * disso, texto claro contrasta mais; acima, texto escuro.
 */
const LIMIAR_LUMINANCIA = 0.179

/**
 * `--on-acc` do tenant: o layout público só sobrescreve `--acc`/`--acc-2`/`--acc-soft`,
 * nunca o texto que fica em cima. Sem isto, um dono que escolhe um acento escuro (a cor
 * é livre, `EsquemaSite.accent` só valida formato hex) recebe botão primário com texto
 * `#0d0c0c` sobre fundo `#0d0c0c` — ilegível. As mesmas duas cores do osso default
 * (`#0d0c0c`/`#fffcf7`) cobrem os dois lados.
 */
export function corDeContraste(accentHex: string): '#0d0c0c' | '#fffcf7' {
  return luminanciaRelativa(accentHex) > LIMIAR_LUMINANCIA ? '#0d0c0c' : '#fffcf7'
}

/**
 * Presets curados para quem "não sabe escolher cor, sabe escolher essa aqui" — cada um
 * testado para dar contraste ≥ 4,5:1 com `corDeContraste` no botão primário. O seletor
 * de cor livre continua existindo ao lado, para quem quer outra coisa.
 */
export const PALETA_PRESET: ReadonlyArray<{ nome: string; hex: string }> = [
  { nome: 'Osso', hex: '#f0ebe3' },
  { nome: 'Menta', hex: '#5eead4' },
  { nome: 'Coral', hex: '#fb923c' },
  { nome: 'Lavanda', hex: '#c4b5fd' },
  { nome: 'Dourado', hex: '#eab308' },
  { nome: 'Rosa', hex: '#f9a8d4' },
]
