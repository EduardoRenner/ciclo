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

/** O fundo da página pública (`html,body` do layout do `[slug]` e `--bg` do tema claro). */
export const FUNDO_CLARO = '#faf8f5'

/** Osso: o acento de fábrica. Feito para o fundo escuro, some sobre o fundo claro. */
export const ACENTO_OSSO = '#f0ebe3'

/** WCAG 2.1: razão de contraste entre duas cores hex (1 a 21). Hex inválido conta como branco. */
export function contrasteWcag(a: string, b: string): number {
  const [maior, menor] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x) as [number, number]
  return (maior + 0.05) / (menor + 0.05)
}

function misturarComPreto(hex: string, fator: number): string {
  const m = HEX.exec(hex)
  if (!m) return hex
  const canal = (h: string) =>
    Math.round(parseInt(h, 16) * (1 - fator))
      .toString(16)
      .padStart(2, '0')
  return `#${canal(m[1]!)}${canal(m[2]!)}${canal(m[3]!)}`
}

/**
 * Escurece `hex` só o quanto falta para chegar a `minimo`:1 contra o fundo claro. Cor que já
 * passa volta igual, para a marca do dono não mudar sem necessidade. Menta, rosa, lavanda e
 * dourado (os presets) eram pensados para o fundo escuro: sobre o creme dão 1,2 a 2:1, e é nesse
 * tom que a página pública pinta a aba ativa, o link e a data escolhida.
 */
export function corLegivelNoClaro(hex: string, minimo: number): string {
  if (!HEX.test(hex)) return hex
  for (let passo = 0; passo <= 100; passo += 2) {
    const candidata = misturarComPreto(hex, passo / 100)
    if (contrasteWcag(candidata, FUNDO_CLARO) >= minimo) return candidata
  }
  return '#000000'
}

/**
 * O acento da página pública, que agora é clara. `null` para o osso de fábrica (ou hex inválido):
 * o layout então NÃO sobrescreve nada e valem os tokens do tema claro (`--acc` #0b7d6f), que já
 * foram medidos. Antes o osso era gravado por cima dentro de um wrapper claro: aba ativa, botão
 * e dia escolhido saíam bege sobre creme, 1,1:1, em todo negócio que nunca escolheu cor.
 *
 * Com cor escolhida, `acc` (preenchimento de botão e dia) precisa de 3:1 contra o fundo e `acc2`
 * (texto e borda) de 4,5:1.
 */
export function acentoNoTemaClaro(hex: string): { acc: string; acc2: string; onAcc: '#0d0c0c' | '#fffcf7' } | null {
  if (!HEX.test(hex) || hex.toLowerCase() === ACENTO_OSSO) return null
  const acc = corLegivelNoClaro(hex, 3)
  return { acc, acc2: corLegivelNoClaro(hex, 4.5), onAcc: corDeContraste(acc) }
}
