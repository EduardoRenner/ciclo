/**
 * CNV-014b · Lista livre (uma pessoa por linha, sem colunas) → tabela com Nome, Telefone e E-mail.
 *
 * É o formato de quem não tem sistema (`docs/97` Onda 1b): a lista colada das notas ou do WhatsApp
 * ("Maria 11 99999-0001", "1. João – joao@x.com"), a lista de um PDF de uma coluna, e o texto lido de
 * um print. A E3 sozinha via "linhas de uma célula" e tratava tudo como título.
 *
 * Só entra quando a grade É uma lista (quase todas as linhas têm uma célula só). As linhas antes do
 * primeiro contato ficam acima do cabeçalho (título, "Minhas clientes:"), e a E3 as ignora com motivo.
 */

const preenchidas = (l: readonly string[]) => l.filter((c) => c.trim() !== '')

const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi
/** Sequência que parece telefone: dígitos com espaço, ponto, hífen, parênteses e o + na frente. */
const TELEFONE = /\+?\(?\d[\d\s().-]{6,}\d/g

export type LinhaLivre = { nome: string; telefones: string[]; email: string | null }

export function separarLinhaLivre(linha: string): LinhaLivre {
  let resto = ` ${linha} `
  const email = linha.match(EMAIL)?.[0] ?? null
  if (email) resto = resto.replace(email, ' ')
  const telefones: string[] = []
  for (const m of resto.match(TELEFONE) ?? []) {
    const digitos = m.replace(/\D/g, '')
    if (digitos.length < 8 || digitos.length > 13) continue
    telefones.push(m.trim())
    resto = resto.replace(m, ' ')
  }
  const nome = resto
    .replace(/^\s*(\d{1,3}[.)-]|[-•*–—>·])\s+/, '') // marcador de lista
    .replace(/\b(tel|cel|fone|whats|whatsapp|zap|wpp|e-?mail)\b\.?:?/gi, ' ')
    // Separador que ficou sozinho entre espaços depois de tirar telefone e e-mail ("João Lima / ").
    .replace(/\s[/|;,:–—-]+(?=\s)/g, ' ')
    .replace(/[/|;,:–—-]+\s*$/g, '')
    .replace(/^\s*[/|;,:–—-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { nome, telefones, email }
}

/** A grade é uma lista livre? Então vira tabela de três colunas; senão `null` (segue como está). */
export function gradeDeListaLivre(grade: readonly string[][]): string[][] | null {
  const naoVazias = grade.filter((l) => preenchidas(l).length > 0)
  if (naoVazias.length < 2) return null
  // Lista de verdade não começa com cabeçalho de várias colunas: "Nome;Telefone" seguido de nomes
  // soltos é uma tabela esparsa (a E3 cuida), não uma lista.
  if (preenchidas(naoVazias[0]!).length > 1) return null
  const deUmaCelula = naoVazias.filter((l) => preenchidas(l).length === 1).length
  if (deUmaCelula / naoVazias.length < 0.8) return null
  const partes = grade.map((l) => separarLinhaLivre(preenchidas(l).join(' ')))
  // Sem nenhum contato: lista só de nomes — o cabeçalho vai no topo.
  const primeiroContato = partes.findIndex((p) => p.telefones.length > 0 || p.email)
  const corte = primeiroContato < 0 ? 0 : primeiroContato
  return [
    ...grade.slice(0, corte).map((l) => [...l]),
    ['Nome', 'Telefone', 'E-mail'],
    ...partes.slice(corte).map((p, i) => (preenchidas(grade[corte + i]!).length === 0 ? [] : [p.nome, p.telefones.join(' / '), p.email ?? ''])),
  ]
}
