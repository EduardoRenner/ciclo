/**
 * CNV-017 · Gerador de PDF mínimo e válido para os testes: texto em posições escolhidas, uma lista por
 * página, fonte Helvetica com WinAnsi (os acentos do português cabem num byte). Nenhum PDF real.
 */
export type TextoNaPagina = { x: number; y: number; texto: string }

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

export function pdfComTexto(paginas: TextoNaPagina[][]): Uint8Array {
  const objetos: string[] = []
  const novo = (corpo: string) => {
    objetos.push(corpo)
    return objetos.length
  }
  const catalogo = novo('') // preenchido depois
  const arvore = novo('')
  const fonte = novo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const filhas: number[] = []
  for (const textos of paginas) {
    const conteudo = textos.map((t) => `BT /F1 10 Tf ${t.x} ${t.y} Td (${escapar(t.texto)}) Tj ET`).join('\n')
    const fluxo = novo(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`)
    filhas.push(novo(`<< /Type /Page /Parent ${arvore} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fonte} 0 R >> >> /Contents ${fluxo} 0 R >>`))
  }
  objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${arvore} 0 R >>`
  objetos[arvore - 1] = `<< /Type /Pages /Kids [${filhas.map((f) => `${f} 0 R`).join(' ')}] /Count ${filhas.length} >>`

  let texto = '%PDF-1.4\n'
  const deslocamentos: number[] = []
  objetos.forEach((corpo, i) => {
    deslocamentos.push(texto.length)
    texto += `${i + 1} 0 obj\n${corpo}\nendobj\n`
  })
  const xref = texto.length
  texto += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${deslocamentos.map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join('')}`
  texto += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  // Latin-1: um byte por caractere (os deslocamentos acima contam caracteres = bytes).
  return Uint8Array.from(Array.from(texto, (c) => c.charCodeAt(0) & 0xff))
}
