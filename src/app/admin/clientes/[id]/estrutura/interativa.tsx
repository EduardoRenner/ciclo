'use client'

import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'

import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import {
  compararEfetivas,
  formatarPercentual,
  montarEstrutura,
  simular,
  type Empresa,
  type EmpresaNaTela,
  type Pessoa,
} from '@/core/advocacia/estrutura-da-familia'
import { camadaDe, type ArestaDeParticipacao } from '@/core/advocacia/participacao'

const TIPO: Record<string, string> = {
  holding_patrimonial: 'Holding patrimonial',
  holding_participacoes: 'Holding de participações',
  holding_mista: 'Holding mista',
  operacional: 'Operacional',
  outra: 'Empresa',
}

type Props = { pessoas: Pessoa[]; empresas: Empresa[]; arestas: ArestaDeParticipacao[] }

/**
 * A parte interativa da Estrutura: lista ou grafo, participação efetiva com a conta, e o simulador.
 * Tudo calculado no navegador a partir das mesmas funções puras do servidor (`core/advocacia`),
 * porque o simulador precisa responder a cada toque sem ida à rede, e nada aqui grava.
 */
export default function EstruturaInterativa({ pessoas, empresas, arestas }: Props) {
  const [vista, setVista] = useState<'lista' | 'grafo'>('lista')
  const atual = useMemo(() => montarEstrutura(pessoas, empresas, arestas), [pessoas, empresas, arestas])
  const somasErradas = atual.empresas.filter((e) => e.problema !== null)
  const ciclo = atual.problemas.some((p) => p.kind === 'ciclo')

  return (
    <div className="flex flex-col gap-6 pb-10">
      {somasErradas.length > 0 || ciclo ? (
        <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-md)] border border-bad/40 bg-bad/10 p-3 text-secundario text-txt">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-bad" />
          <ul className="flex flex-col gap-1">
            {somasErradas.map((e) => (
              <li key={e.id}>
                <span className="font-semibold">{e.nome}</span>:{' '}
                {e.problema === 'acima-de-100'
                  ? `a soma das participações desta empresa passa de 100% (${formatarPercentual(e.total)}).`
                  : `a soma das participações desta empresa não chega a 100% (${formatarPercentual(e.total)}).`}
              </li>
            ))}
            {ciclo ? <li>Há uma empresa que é dona de si mesma por algum caminho. A participação efetiva não pode ser calculada.</li> : null}
          </ul>
        </div>
      ) : null}

      <div role="tablist" aria-label="Como ver a estrutura" className="flex gap-2">
        {(
          [
            ['lista', 'Lista'],
            ['grafo', 'Grafo'],
          ] as const
        ).map(([v, rotulo]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => setVista(v)}
            className={`inline-flex h-12 items-center rounded-[var(--radius-pill)] px-4 text-secundario font-semibold ${
              vista === v ? 'bg-acc text-on-acc' : 'border border-line-2 bg-surface-2 text-txt-2'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {vista === 'lista' ? <Lista empresas={atual.empresas} /> : <Grafo pessoas={pessoas} empresas={atual.empresas} arestas={arestas} />}

      {atual.efetivas.length > 0 ? (
        <section aria-labelledby="sec-efetiva">
          <h2 id="sec-efetiva" className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
            Participação efetiva
          </h2>
          <ul className="flex flex-col gap-2">
            {atual.efetivas.map((p) => (
              <li key={p.pessoaId}>
                <Card className="p-3">
                  <p className="text-corpo font-semibold">{p.nome}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {p.porEmpresa.map((e) => (
                      <li key={e.empresaId}>
                        <details>
                          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-secundario">
                            <span className="text-txt-2">{e.empresa}</span>
                            <span className="font-semibold tabular-nums text-txt">{formatarPercentual(e.total)}</span>
                          </summary>
                          <p className="pb-1 text-label text-txt-3">
                            {e.conta} = {formatarPercentual(e.total)}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!ciclo ? <Simulador pessoas={pessoas} empresas={empresas} arestas={arestas} /> : null}
    </div>
  )
}

function Lista({ empresas }: { empresas: EmpresaNaTela[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Empresas e quem é dono de cada uma">
      {empresas.map((e) => (
        <li key={e.id}>
          <Card className={`p-3 ${e.problema ? 'border-bad/50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-corpo font-semibold">{e.nome}</p>
                <p className="text-label text-txt-3">{TIPO[e.tipo] ?? 'Empresa'}</p>
              </div>
              {e.problema ? (
                <Badge estado="bad" className="shrink-0 whitespace-nowrap">
                  Soma {formatarPercentual(e.total)}
                </Badge>
              ) : null}
            </div>
            {e.donos.length === 0 ? (
              <p className="mt-2 text-secundario text-txt-2">Nenhuma participação lançada.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 border-l-2 border-line-2 pl-3">
                {e.donos.map((d) => (
                  <li key={d.chave} className="flex items-baseline justify-between gap-3 text-secundario">
                    <span className="text-txt">
                      {d.nome}
                      {d.usufruto ? <span className="text-txt-3"> · usufruto de {d.usufruto}</span> : null}
                    </span>
                    <span className="font-semibold tabular-nums">{formatarPercentual(d.percent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** Grafo em camadas (pessoas | holdings | operacionais), SVG próprio: nenhuma biblioteca de layout. */
function Grafo({ pessoas, empresas, arestas }: { pessoas: Pessoa[]; empresas: EmpresaNaTela[]; arestas: ArestaDeParticipacao[] }) {
  const camadas = camadaDe(arestas, empresas.map((e) => e.id))
  const donosUsados = new Set(arestas.filter((a) => a.owner.kind === 'person').map((a) => a.owner.id))
  const colunas = new Map<number, { chave: string; nome: string; erro: boolean }[]>()
  colunas.set(0, pessoas.filter((p) => donosUsados.has(p.id)).map((p) => ({ chave: `person:${p.id}`, nome: p.nome, erro: false })))
  for (const e of empresas) {
    const c = camadas.get(e.id) ?? 1
    colunas.set(c, [...(colunas.get(c) ?? []), { chave: `entity:${e.id}`, nome: e.nome, erro: e.problema !== null }])
  }
  const L = 184
  const A = 56
  const VAO = 96
  // Uma faixa própria por aresta que pula camada: na mesma faixa, os rótulos se sobrepunham.
  const colunaDe = (k: string) => (k.startsWith('person:') ? 0 : (camadas.get(k.slice(7)) ?? 1))
  const longas = arestas.map((a, i) => ({ a, i })).filter(({ a }) => colunaDe(`entity:${a.entityId}`) - colunaDe(`${a.owner.kind}:${a.owner.id}`) > 1)
  const faixa = new Map(longas.map(({ i }, k) => [i, k]))
  const MARGEM_TOPO = 24 + 26 * longas.length
  const pos = new Map<string, { x: number; y: number }>()
  const nCol = Math.max(...colunas.keys()) + 1
  const maxLinhas = Math.max(...[...colunas.values()].map((c) => c.length))
  for (const [c, nos] of colunas) nos.forEach((n, i) => pos.set(n.chave, { x: 16 + c * (L + VAO), y: MARGEM_TOPO + i * (A + 24) + ((maxLinhas - nos.length) * (A + 24)) / 2 }))
  const largura = 32 + nCol * L + (nCol - 1) * VAO
  const altura = MARGEM_TOPO + 16 + maxLinhas * (A + 24)
  // Cada aresta sai e chega num ponto PRÓPRIO do nó, na ordem vertical do outro lado: com todas no
  // centro, os rótulos de 60% e 40% se encostavam na chegada da holding.
  const yDo = (k: string) => pos.get(k)?.y ?? 0
  const espalhar = (chaveDoNo: (a: ArestaDeParticipacao) => string, chaveDoOutro: (a: ArestaDeParticipacao) => string) => {
    const grupos = new Map<string, number[]>()
    arestas.forEach((a, i) => grupos.set(chaveDoNo(a), [...(grupos.get(chaveDoNo(a)) ?? []), i]))
    const m = new Map<number, { k: number; n: number }>()
    for (const idx of grupos.values()) {
      idx.sort((x, y) => yDo(chaveDoOutro(arestas[x]!)) - yDo(chaveDoOutro(arestas[y]!)))
      idx.forEach((i, k) => m.set(i, { k, n: idx.length }))
    }
    return m
  }
  const donoDe = (a: ArestaDeParticipacao) => `${a.owner.kind}:${a.owner.id}`
  const alvoDe = (a: ArestaDeParticipacao) => `entity:${a.entityId}`
  const saida = espalhar(donoDe, alvoDe)
  const chegada = espalhar(alvoDe, donoDe)
  const descricao = empresas.map((e) => `${e.nome}: ${e.donos.map((d) => `${d.nome} ${formatarPercentual(d.percent)}`).join(', ')}`).join('. ')

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line-2 bg-surface p-2">
      <svg role="img" aria-label={`Estrutura da família. ${descricao}`} viewBox={`0 0 ${largura} ${altura}`} className="h-auto w-full min-w-[520px]">
        {arestas.map((a, i) => {
          const de = pos.get(`${a.owner.kind}:${a.owner.id}`)
          const para = pos.get(`entity:${a.entityId}`)
          if (!de || !para) return null
          const x1 = de.x + L
          const y1 = de.y + (A * (saida.get(i)!.k + 1)) / (saida.get(i)!.n + 1)
          const x2 = para.x
          const y2 = para.y + (A * (chegada.get(i)!.k + 1)) / (chegada.get(i)!.n + 1)
          // Aresta que pula uma camada (pessoa direto na operacional) passaria por baixo da holding e
          // esconderia o percentual: ela contorna POR CIMA dos nós do meio. Visto no grafo da família Lago.
          const lane = faixa.get(i)
          const cy = lane === undefined ? null : 14 + lane * 26
          const c1 = { x: x1 + 50, y: cy ?? y1 }
          const c2 = { x: x2 - 50, y: cy ?? y2 }
          // rótulo a 75% do caminho (perto do destino), onde as arestas que chegam já se separaram
          const t = 0.75
          const bx = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * c1.x + 3 * (1 - t) * t ** 2 * c2.x + t ** 3 * x2
          const by = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t ** 2 * c2.y + t ** 3 * y2
          const rotulo = formatarPercentual(a.percent)
          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y1} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--line-2)"
                strokeWidth={2}
                strokeDasharray={a.usufructPersonId ? '6 4' : undefined}
              />
              <rect x={bx - (rotulo.length * 4 + 8)} y={by - 11} width={rotulo.length * 8 + 16} height={22} rx={11} fill="var(--surface)" stroke="var(--line-2)" />
              <text x={bx} y={by + 4.5} textAnchor="middle" fontSize="13" fill="var(--txt)" fontWeight={600}>
                {rotulo}
              </text>
            </g>
          )
        })}
        {[...colunas.values()].flat().map((n) => {
          const p = pos.get(n.chave)!
          return (
            <g key={n.chave}>
              <rect x={p.x} y={p.y} width={L} height={A} rx={12} fill="var(--surface-2)" stroke={n.erro ? 'var(--bad)' : 'var(--line-2)'} strokeWidth={n.erro ? 2.5 : 1.5} />
              <text x={p.x + 12} y={p.y + A / 2 + 5} fontSize="14" fill="var(--txt)">
                {n.nome.length > 22 ? `${n.nome.slice(0, 21)}…` : n.nome}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Simulador({ pessoas, empresas, arestas }: Props) {
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '')
  const donos = arestas.filter((a) => a.entityId === empresaId && a.owner.kind === 'person')
  const [de, setDe] = useState('')
  const [para, setPara] = useState('')
  const [quanto, setQuanto] = useState('10')
  const nome = (chave: string) => pessoas.find((p) => `person:${p.id}` === chave)?.nome ?? ''

  const resultado = useMemo(() => {
    const n = Number(quanto.replace(',', '.'))
    if (!empresaId || !de || !para || !Number.isFinite(n)) return null
    const r = simular(arestas, { empresaId, de, para, percent: n })
    if (!r.ok) return { erro: r.motivo, linhas: null }
    return { erro: null, linhas: compararEfetivas(montarEstrutura(pessoas, empresas, arestas).efetivas, montarEstrutura(pessoas, empresas, r.arestas).efetivas) }
  }, [arestas, de, empresaId, empresas, para, pessoas, quanto])

  return (
    <section aria-labelledby="sec-simulador">
      <h2 id="sec-simulador" className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
        E se
      </h2>
      <Card className="flex flex-col gap-3 p-4">
        <Select
          rotulo="Empresa"
          value={empresaId}
          onChange={(e) => {
            setEmpresaId(e.target.value)
            setDe('')
          }}
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select rotulo="Tirar de" value={de} onChange={(e) => setDe(e.target.value)}>
            <option value="">Escolha</option>
            {[...new Set(donos.map((d) => `person:${d.owner.id}`))].map((k) => (
              <option key={k} value={k}>
                {nome(k)}
              </option>
            ))}
          </Select>
          <Select rotulo="Passar para" value={para} onChange={(e) => setPara(e.target.value)}>
            <option value="">Escolha</option>
            {pessoas.map((p) => (
              <option key={p.id} value={`person:${p.id}`}>
                {p.nome}
              </option>
            ))}
          </Select>
          <Input rotulo="Quantos %" inputMode="decimal" value={quanto} onChange={(e) => setQuanto(e.target.value)} />
        </div>

        <div aria-live="polite">
          {resultado?.erro ? <p className="text-secundario text-bad">{resultado.erro}</p> : null}
          {resultado?.linhas ? (
            resultado.linhas.length === 0 ? (
              <p className="text-secundario text-txt-2">Nada muda na participação efetiva.</p>
            ) : (
              <table className="w-full text-secundario">
                <caption className="sr-only">Participação efetiva antes e depois</caption>
                <thead>
                  <tr className="text-left text-label text-txt-3">
                    <th className="py-1 font-semibold">Pessoa</th>
                    <th className="py-1 font-semibold">Empresa</th>
                    <th className="py-1 text-right font-semibold">Antes</th>
                    <th className="py-1 text-right font-semibold">Depois</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.linhas.map((l) => (
                    <tr key={`${l.nome}${l.empresa}`} className="border-t border-line">
                      <td className="py-1.5">{l.nome}</td>
                      <td className="py-1.5 text-txt-2">{l.empresa}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatarPercentual(l.antes)}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{formatarPercentual(l.depois)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
        </div>
        <p className="text-label text-txt-3">Simulação sem efeito jurídico ou tributário. Revisão da advocacia necessária.</p>
      </Card>
    </section>
  )
}
