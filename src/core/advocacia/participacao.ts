// Origem: LUBI src/lib/domain/ownership.ts @ db8aeac (docs/101 §8, cópia versionada com teste próprio).
/**
 * Participação societária: percentual efetivo (direto + indireto via holdings) e validações.
 * Base da Estrutura da família (docs/101 §7, anexo 04 §4.5). Pura, sem I/O (regra 5 do `CLAUDE.md`).
 *
 * O que muda em relação ao LUBI: só o estilo da casa (sem ponto e vírgula, aspas simples). A regra,
 * a tolerância e o arredondamento são os mesmos, e os casos de referência do teste vieram junto,
 * calculados à mão antes da função (protocolo 09 §9 do LUBI).
 */

export type DonoRef = { kind: 'person' | 'entity'; id: string }

export interface ArestaDeParticipacao {
  owner: DonoRef
  /** Empresa possuída. */
  entityId: string
  /** 0 < percent ≤ 100. */
  percent: number
  /** Pessoa usufrutuária das quotas, se houver. Não altera o percentual de propriedade. */
  usufructPersonId?: string
}

const chave = (o: DonoRef) => `${o.kind}:${o.id}`

/** Soma dos percentuais vigentes por empresa. */
export function totaisPorEmpresa(arestas: readonly ArestaDeParticipacao[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of arestas) m.set(e.entityId, (m.get(e.entityId) ?? 0) + e.percent)
  return m
}

export type ProblemaNaEstrutura =
  | { kind: 'acima-de-100'; entityId: string; total: number }
  | { kind: 'abaixo-de-100'; entityId: string; total: number }
  | { kind: 'ciclo'; path: string[] }
  | { kind: 'percentual-invalido'; entityId: string; percent: number }

/** Folga para soma com casas (33,3333 + 33,3333 + 33,3334). Igual à do LUBI. */
const TOLERANCIA = 0.0001

/**
 * Problemas da estrutura: percentual fora de (0, 100], soma por empresa diferente de 100 e ciclo
 * (empresa dona de si mesma por qualquer caminho). Nunca corrige: a tela mostra e a pessoa decide.
 */
export function validarEstrutura(arestas: readonly ArestaDeParticipacao[]): ProblemaNaEstrutura[] {
  const saida: ProblemaNaEstrutura[] = []
  for (const e of arestas) {
    if (!(e.percent > 0 && e.percent <= 100)) saida.push({ kind: 'percentual-invalido', entityId: e.entityId, percent: e.percent })
  }
  for (const [entityId, total] of totaisPorEmpresa(arestas)) {
    if (total > 100 + TOLERANCIA) saida.push({ kind: 'acima-de-100', entityId, total })
    else if (total < 100 - TOLERANCIA) saida.push({ kind: 'abaixo-de-100', entityId, total })
  }
  // Ciclo: grafo empresa-dona → empresa-possuída.
  const vizinhos = new Map<string, string[]>()
  for (const e of arestas) {
    if (e.owner.kind !== 'entity') continue
    vizinhos.set(e.owner.id, [...(vizinhos.get(e.owner.id) ?? []), e.entityId])
  }
  const estado = new Map<string, 1 | 2>()
  const pilha: string[] = []
  const visitar = (n: string): boolean => {
    estado.set(n, 1)
    pilha.push(n)
    for (const prox of vizinhos.get(n) ?? []) {
      if (estado.get(prox) === 1) {
        saida.push({ kind: 'ciclo', path: [...pilha.slice(pilha.indexOf(prox)), prox] })
        return true
      }
      if (!estado.has(prox) && visitar(prox)) return true
    }
    pilha.pop()
    estado.set(n, 2)
    return false
  }
  for (const n of vizinhos.keys()) if (!estado.has(n)) visitar(n)
  return saida
}

/**
 * Percentual efetivo de cada dono (pessoa ou empresa) em cada empresa, somando todos os caminhos:
 * direto + via holdings. Devolve "kind:id" → (entityId → percentual 0–100, arredondado a 6 casas).
 * Recusa estrutura com ciclo: com ciclo o percentual efetivo não está definido.
 */
export function participacaoEfetiva(arestas: readonly ArestaDeParticipacao[]): Map<string, Map<string, number>> {
  if (validarEstrutura(arestas).some((i) => i.kind === 'ciclo')) throw new Error('Estrutura com ciclo')
  const porDono = new Map<string, ArestaDeParticipacao[]>()
  for (const e of arestas) porDono.set(chave(e.owner), [...(porDono.get(chave(e.owner)) ?? []), e])

  const memo = new Map<string, Map<string, number>>()
  const alcance = (dono: string): Map<string, number> => {
    const guardado = memo.get(dono)
    if (guardado) return guardado
    const acc = new Map<string, number>()
    for (const e of porDono.get(dono) ?? []) {
      const fracao = e.percent / 100
      acc.set(e.entityId, (acc.get(e.entityId) ?? 0) + fracao)
      for (const [empresa, f] of alcance(`entity:${e.entityId}`)) acc.set(empresa, (acc.get(empresa) ?? 0) + fracao * f)
    }
    memo.set(dono, acc)
    return acc
  }

  const saida = new Map<string, Map<string, number>>()
  for (const dono of porDono.keys()) {
    const m = new Map<string, number>()
    for (const [empresa, f] of alcance(dono)) m.set(empresa, Math.round(f * 1e8) / 1e6)
    saida.set(dono, m)
  }
  return saida
}

/** Camada de cada empresa para desenhar o grafo: pessoas 0; empresa = 1 + maior camada dos donos. */
export function camadaDe(arestas: readonly ArestaDeParticipacao[], empresas: readonly string[]): Map<string, number> {
  const donos = new Map<string, DonoRef[]>()
  for (const e of arestas) donos.set(e.entityId, [...(donos.get(e.entityId) ?? []), e.owner])
  const memo = new Map<string, number>()
  const nivel = (id: string, vistos = new Set<string>()): number => {
    const guardado = memo.get(id)
    if (guardado !== undefined) return guardado
    if (vistos.has(id)) return 1
    vistos.add(id)
    const os = donos.get(id) ?? []
    const l = os.length === 0 ? 1 : 1 + Math.max(...os.map((o) => (o.kind === 'person' ? 0 : nivel(o.id, vistos))))
    memo.set(id, l)
    return l
  }
  const saida = new Map<string, number>()
  for (const id of empresas) saida.set(id, nivel(id))
  return saida
}
