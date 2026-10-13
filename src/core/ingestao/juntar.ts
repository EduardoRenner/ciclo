/**
 * E7 da esteira (`docs/97` §5): a mesma pessoa em várias linhas vira UMA ficha — e duas pessoas nunca
 * viram uma.
 *
 * Pontuação por campo no espírito de Fellegi-Sunter (`docs/103-conversor/00-pesquisa.md` P8), com a
 * regra de produto acima dela:
 *   · junta SOZINHO só com telefone ou e-mail igual E nome compatível;
 *   · mesmo telefone com nomes muito diferentes = telefone compartilhado (mãe e filha, a recepção que
 *     marca para todos): NÃO junta, marca;
 *   · nome parecido sem contato em comum: no máximo vira PERGUNTA; nunca junta só por nome (duas
 *     "Maria Silva" são duas pessoas até alguém dizer o contrário — defeito D11 sumia o homônimo).
 */
import { jaroWinkler, normalizarTexto } from '@/core/ingestao/similaridade'

export type RegistroParaJuntar = {
  linha: number
  nome: string
  /** E.164 já normalizados (E6). */
  telefones: string[]
  email: string | null
  nascimento: string | null
}

export type Decisao = 'junta' | 'pergunta' | 'compartilhado'

export type Ligacao = { a: number; b: number; decisao: Decisao; motivo: string }

export type Juntado = {
  /** Grupos que viram UMA ficha (índices em `registros`). Quem está sozinho também é um grupo. */
  grupos: number[][]
  /** Pares para a pessoa decidir ("estas duas são a mesma?"). */
  perguntas: Ligacao[]
  /** Pares com o mesmo telefone e nomes diferentes: não juntam, e a prévia avisa. */
  compartilhados: Ligacao[]
}

const PARTICULAS = /\b(da|de|do|das|dos|e)\b/g

/** Chave fonética simples para português: o bastante para BLOQUEAR (achar candidatos), nunca para decidir. */
export function chaveFonetica(nome: string): string {
  let s = normalizarTexto(nome).replace(PARTICULAS, ' ').replace(/\s+/g, ' ').trim()
  s = s
    .replace(/th/g, 't')
    .replace(/ph/g, 'f')
    .replace(/lh/g, 'li')
    .replace(/nh/g, 'ni')
    .replace(/(ch|sh)/g, 'x')
    .replace(/qu/g, 'k')
    .replace(/gu([ei])/g, 'g$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/g([ei])/g, 'j$1')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/h/g, '')
    .replace(/([a-z])\1+/g, '$1')
  return s
}

/** Nomes compatíveis: um contém o outro ("Ana" × "Ana Paula Reis") ou são quase iguais ("Ana" × "Anna"). */
function compatibilidadeDeNome(a: string, b: string): number {
  const x = normalizarTexto(a).replace(PARTICULAS, ' ').replace(/\s+/g, ' ').trim()
  const y = normalizarTexto(b).replace(PARTICULAS, ' ').replace(/\s+/g, ' ').trim()
  if (x === '' || y === '') return 0.5
  if (x === y) return 1
  const px = x.split(' ')
  const py = y.split(' ')
  const curto = px.length <= py.length ? px : py
  const longo = px.length <= py.length ? py : px
  if (curto.every((p) => longo.includes(p))) return 0.95
  const primeiro = jaroWinkler(px[0]!, py[0]!)
  const inteiro = jaroWinkler(x, y)
  return Math.max(inteiro, primeiro >= 0.9 && (px.length === 1 || py.length === 1) ? 0.9 : 0)
}

export function juntarRegistros(registros: readonly RegistroParaJuntar[]): Juntado {
  const ligacoes: Ligacao[] = []
  const vistos = new Set<string>()
  const ligar = (a: number, b: number, decisao: Decisao, motivo: string) => {
    const chave = a < b ? `${a}-${b}` : `${b}-${a}`
    if (vistos.has(chave)) return
    vistos.add(chave)
    ligacoes.push({ a: Math.min(a, b), b: Math.max(a, b), decisao, motivo })
  }

  // Bloqueio: só compara quem divide telefone, e-mail ou (fonética do nome + nascimento).
  const blocos = new Map<string, number[]>()
  const no = (chave: string, i: number) => blocos.set(chave, [...(blocos.get(chave) ?? []), i])
  registros.forEach((r, i) => {
    for (const t of r.telefones) no(`t:${t}`, i)
    if (r.email) no(`e:${r.email.toLowerCase()}`, i)
    if (r.nascimento && r.nome.trim()) no(`n:${chaveFonetica(r.nome)}|${r.nascimento}`, i)
  })

  for (const [chave, membros] of blocos) {
    for (let p = 0; p < membros.length; p++) {
      for (let q = p + 1; q < membros.length; q++) {
        const a = membros[p]!
        const b = membros[q]!
        const ra = registros[a]!
        const rb = registros[b]!
        const nome = compatibilidadeDeNome(ra.nome, rb.nome)
        if (chave.startsWith('t:')) {
          if (nome >= 0.9) ligar(a, b, 'junta', 'mesmo telefone e o mesmo nome')
          else if (nome >= 0.75) ligar(a, b, 'pergunta', 'mesmo telefone, nomes parecidos')
          else ligar(a, b, 'compartilhado', 'mesmo telefone, pessoas diferentes')
        } else if (chave.startsWith('e:')) {
          if (nome >= 0.85) ligar(a, b, 'junta', 'mesmo e-mail e o mesmo nome')
          else ligar(a, b, 'pergunta', 'mesmo e-mail, nomes diferentes')
        } else {
          // A chave já garante o mesmo som do nome e o mesmo nascimento. Sem contato em comum: pergunta.
          ligar(a, b, 'pergunta', 'mesmo nome e mesmo nascimento')
        }
      }
    }
  }

  // Grupos por união só das ligações "junta".
  const pai = registros.map((_, i) => i)
  const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i]!)))
  for (const l of ligacoes) if (l.decisao === 'junta') pai[raiz(l.a)] = raiz(l.b)
  const porRaiz = new Map<number, number[]>()
  registros.forEach((_, i) => porRaiz.set(raiz(i), [...(porRaiz.get(raiz(i)) ?? []), i]))

  // Uma pergunta entre dois que já ficaram no mesmo grupo não é pergunta.
  const perguntas = ligacoes.filter((l) => l.decisao === 'pergunta' && raiz(l.a) !== raiz(l.b))
  const compartilhados = ligacoes.filter((l) => l.decisao === 'compartilhado' && raiz(l.a) !== raiz(l.b))
  return { grupos: [...porRaiz.values()], perguntas, compartilhados }
}
