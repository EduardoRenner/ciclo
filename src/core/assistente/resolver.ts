import { semAcento } from '@/core/text/normalizar'

/**
 * Como o assistente transforma "marca a Maria pra terça" em IDs — e, principalmente, o que ele
 * faz quando NÃO tem certeza.
 *
 * O `docs/33 §8.1` (pré-mortem) diz que a seleção do alvo é onde o dano mora: o modelo escolheu a
 * cliente errada e a mensagem saiu. A resposta ali era "no nível autônomo o alvo vem de consulta
 * determinística, não do modelo". Aqui, no nível com confirmação, a resposta é a irmã disso:
 * **empatou, pergunta — nunca desempata sozinho.** Duas "Maria" na base não viram um chute com
 * 50% de chance de constranger a cliente errada.
 *
 * Vive em `core/` (função pura, sem I/O, regra 5 do `CLAUDE.md`) porque é a regra que a guarda
 * precisa exercitar de verdade. Se ela morasse dentro da ferramenta, o teste teria que espelhar a
 * lógica — e foi assim que duas guardas cegas nasceram nesta base.
 */
export type Candidato = { id: string; nome: string }

export type Resolucao =
  | { tipo: 'achou'; item: Candidato }
  | { tipo: 'nenhum' }
  | { tipo: 'ambiguo'; opcoes: Candidato[] }

/** Quantos nomes cabem numa pergunta de desambiguação sem virar parede de texto. */
const MAX_OPCOES = 5

/**
 * Casa `termo` contra uma lista de candidatos, em três passadas cada vez mais frouxas — e para na
 * primeira que der resultado ÚNICO. A ordem importa: sem ela, "Ana" casaria "Ana" e "Mariana" ao
 * mesmo tempo e viraria ambiguidade onde havia resposta exata.
 */
export function resolverPorNome(termo: string, candidatos: Candidato[]): Resolucao {
  const alvo = semAcento(termo)
  if (alvo === '') return { tipo: 'nenhum' }

  const exatos = candidatos.filter((c) => semAcento(c.nome) === alvo)
  const comecam = candidatos.filter((c) => semAcento(c.nome).startsWith(alvo))
  const contem = candidatos.filter((c) => semAcento(c.nome).includes(alvo))

  for (const grupo of [exatos, comecam, contem]) {
    if (grupo.length === 1) return { tipo: 'achou', item: grupo[0]! }
    // Empate NUNCA vira escolha: devolve as opções para o assistente perguntar.
    if (grupo.length > 1) return { tipo: 'ambiguo', opcoes: grupo.slice(0, MAX_OPCOES) }
  }
  return { tipo: 'nenhum' }
}

/**
 * Quando o salão tem um profissional só, perguntar "com quem?" é ruído: não existe alternativa.
 * Com mais de um, o assistente pergunta — a menos que o dono tenha dito o nome.
 */
export function resolverProfissional(termo: string | undefined, candidatos: Candidato[]): Resolucao {
  if (termo === undefined || termo.trim() === '') {
    if (candidatos.length === 1) return { tipo: 'achou', item: candidatos[0]! }
    return { tipo: 'ambiguo', opcoes: candidatos.slice(0, MAX_OPCOES) }
  }
  return resolverPorNome(termo, candidatos)
}
