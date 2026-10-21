/**
 * CNV-018 · Preparar um print ou foto para o OCR (`docs/103-conversor/00c-…` §2): o Tesseract espera
 * texto ESCURO em fundo CLARO. Print de app em modo escuro, sem inverter, volta vazio — medido: o mesmo
 * print deu o texto inteiro claro e nada escuro. Funções puras sobre os pixels (quem lê a imagem e
 * desenha no canvas mora fora do core).
 */

/** RGBA → cinza (luminância), um byte por pixel. */
export function paraCinza(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length / 4)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) out[j] = Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!)
  return out
}

/** Fundo escuro? A MEDIANA da luminância decide (o fundo ocupa a maior parte da imagem; o texto, pouco). */
export function ehModoEscuro(cinza: Uint8Array): boolean {
  if (cinza.length === 0) return false
  const histograma = new Uint32Array(256)
  for (const v of cinza) histograma[v]!++
  let acumulado = 0
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v]!
    if (acumulado >= cinza.length / 2) return v < 110
  }
  return false
}

/** Cinza → RGBA pronto para o OCR: invertido se o fundo é escuro. */
export function prepararParaOcr(rgba: Uint8ClampedArray | Uint8Array): { pixels: Uint8ClampedArray; invertida: boolean } {
  const cinza = paraCinza(rgba)
  const invertida = ehModoEscuro(cinza)
  const pixels = new Uint8ClampedArray(rgba.length)
  for (let j = 0, i = 0; j < cinza.length; j++, i += 4) {
    const v = invertida ? 255 - cinza[j]! : cinza[j]!
    pixels[i] = v
    pixels[i + 1] = v
    pixels[i + 2] = v
    pixels[i + 3] = 255
  }
  return { pixels, invertida }
}

/** Escala para o OCR: o Tesseract lê melhor perto de 300 DPI — print de celular pede 2 a 3 vezes. */
export function escalaParaOcr(largura: number): number {
  if (largura <= 0) return 1
  return Math.min(3, Math.max(1, 1600 / largura))
}
