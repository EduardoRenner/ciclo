'use client'

import Link from 'next/link'

import { ChevronRight, Search, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import Avatar from '@/components/ui/avatar'
import { useVocabulario } from '@/components/shell/vocabulario'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import FilterRow from '@/components/ui/filter-row'
import Skeleton from '@/components/ui/skeleton'
import { dinheiro, formatarTelefone } from '@/lib/formato'

type ClienteLinha = {
  id: string
  name: string
  phone_e164: string | null
  tags: string[]
  visits_count: number
  ltv_cents: number
}

type Segmento = 'aniversariante' | 'primeira_visita_sem_retorno' | 'ticket_alto'

const SEGMENTOS: { valor: Segmento; rotulo: string }[] = [
  { valor: 'aniversariante', rotulo: '🎂 Aniversariante' },
  { valor: 'primeira_visita_sem_retorno', rotulo: 'Primeira visita sem volta' },
  { valor: 'ticket_alto', rotulo: 'Ticket alto' },
]

export default function ListaClientes({ iniciais }: { iniciais: ClienteLinha[] }) {
  const vocabulario = useVocabulario()
  const [termo, setTermo] = useState('')
  const [segmento, setSegmento] = useState<Segmento | null>(null)
  const [clientes, setClientes] = useState(iniciais)
  const [carregando, setCarregando] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [falhou, setFalhou] = useState(false)

  const buscar = useCallback((valor: string) => {
    setCarregando(true)
    setFalhou(false)
    fetch(`/api/v1/clients?q=${encodeURIComponent(valor)}`)
      .then((r) => r.json() as Promise<{ data?: { clients: ClienteLinha[] } }>)
      .then((json) => setClientes(json.data?.clients ?? []))
      /*
        Sem este `catch`, a busca que falhasse deixava a lista ANTERIOR na tela, sem nenhum sinal:
        a pessoa digitava um nome, via os resultados de antes e concluía que aquele era o
        resultado. Lista errada com cara de certa é pior que lista vazia.
      */
      .catch(() => setFalhou(true))
      .finally(() => setCarregando(false))
  }, [])

  const alternarSegmento = useCallback((valor: Segmento) => {
    setTermo('')
    setSegmento((atual) => (atual === valor ? null : valor))
  }, [])

  useEffect(() => {
    if (segmento) {
      setCarregando(true)
      fetch(`/api/v1/clients?segment=${segmento}`)
        .then((r) => r.json() as Promise<{ data?: { clients: ClienteLinha[] } }>)
        .then((json) => setClientes(json.data?.clients ?? []))
        .catch(() => setFalhou(true))
        .finally(() => setCarregando(false))
      return
    }

    // Debounce: sem ele, cada letra digitada dispara uma busca — no 4G do
    // subsolo (§10) isso significa uma fila de respostas fora de ordem.
    clearTimeout(debounce.current)
    if (termo.trim() === '') {
      setClientes(iniciais)
      return
    }
    debounce.current = setTimeout(() => buscar(termo), 300)
    return () => clearTimeout(debounce.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `iniciais` só serve de valor inicial; recolocá-la aqui reexecutaria a busca a cada render do servidor.
  }, [termo, segmento, buscar])

  return (
    <div>
      <label className="sr-only" htmlFor="busca-clientes">
        Buscar cliente por nome ou telefone
      </label>
      <div className="relative mb-3">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-txt-3" />
        <input
          id="busca-clientes"
          type="search"
          inputMode="search"
          placeholder="Nome ou telefone"
          value={termo}
          onChange={(e) => {
            setSegmento(null)
            setTermo(e.target.value)
          }}
          className="h-12 w-full rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 pl-10 pr-4 text-corpo text-txt transition-colors placeholder:text-txt-3 focus:border-acc"
        />
      </div>

      {/* Eram pílulas próprias, com outro raio e outra altura que as da agenda —
          o mesmo gesto parecendo dois controles diferentes. */}
      <FilterRow rotulo="Filtrar por grupo" className="mb-4">
        {SEGMENTOS.map((s) => (
          <Chip key={s.valor} ligado={segmento === s.valor} onClick={() => alternarSegmento(s.valor)}>
            {s.rotulo}
          </Chip>
        ))}
      </FilterRow>

      {/*
        Busca que troca o conteúdo sem trocar de rota — o caso mais clássico de mudança sem aviso.
        A pessoa digita, a lista inteira troca, e quem usa leitor de tela não sabe se achou trinta
        ou nenhum. A região vive SEMPRE no DOM: leitor de tela precisa observar o nó antes de o
        texto mudar (docs/21 §5.3).

        O texto sai do MESMO `clientes` que desenha a lista, então o que se lê é o que se vê.
      */}
      <p aria-live="polite" className="sr-only">
        {carregando
          ? 'Buscando.'
          : falhou
            ? 'Não consegui buscar. A lista abaixo é a anterior.'
            : `${clientes.length} ${clientes.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}.`}
      </p>

      {falhou ? (
        <p role="alert" className="mb-3 text-secundario text-bad">
          Não consegui buscar agora. Confira a conexão e tente de novo. A lista abaixo é a de antes.
        </p>
      ) : null}

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </Card>
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <>
          <Card className="p-0">
            <EmptyState
              icone={<Users aria-hidden className="size-6" />}
              titulo={segmento ? 'Ninguém nesse grupo agora' : termo ? 'Nenhum resultado' : 'Sem clientes ainda'}
              descricao={
                segmento
                  ? 'Esse filtro atualiza todo dia, volte mais tarde.'
                  : termo
                    ? 'Confira a grafia do nome ou o telefone digitado.'
                    : 'Cadastre a primeira cliente para começar a marcar horários.'
              }
              acao={<Link href="/admin/clientes/nova">Cadastrar {vocabulario.cliente}</Link>}
            />
          </Card>
          {/*
            F2 (docs/25-ESTRATEGIA-E-EXECUCAO.md): a importação em lote existe e funciona, mas o
            único caminho de descoberta era um card entre três na Central de Ações — some assim
            que o primeiro cliente é cadastrado. Aqui é onde quem tem uma lista pronta realmente
            procura "adicionar clientes". Só na busca vazia de verdade — filtro/busca sem
            resultado não tem nada a ver com importar uma planilha nova.
          */}
          {!segmento && !termo ? (
            <p className="mt-3 text-center text-secundario text-txt-2">
              Já tem uma lista pronta?{' '}
              <Link href="/admin/clientes/importar" className="font-semibold text-acc-2 underline underline-offset-2">
                Importe uma planilha
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.id}>
              {/* A linha inteira abre a ficha: era o buraco central do CRM — todo o histórico existia
                  no banco e não havia caminho nenhum na interface para chegar nele. */}
              <Link href={`/admin/clientes/${c.id}`} className="block">
                <Card pressionavel>
                  <div className="flex items-center gap-3">
                    {/* Âncora visual: 200 nomes em texto igual não dão onde o olho pousar. */}
                    <Avatar nome={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-corpo font-semibold">{c.name}</p>
                      {c.phone_e164 ? (
                        <p className="tabular mt-0.5 text-secundario text-txt-2">{formatarTelefone(c.phone_e164)}</p>
                      ) : null}
                    </div>
                    {c.visits_count > 0 ? (
                      <div className="shrink-0 text-right">
                        <p className="tabular text-corpo font-semibold">{dinheiro.format(c.ltv_cents / 100)}</p>
                        <p className="text-label text-txt-3">
                          {c.visits_count} {c.visits_count === 1 ? 'visita' : 'visitas'}
                        </p>
                      </div>
                    ) : null}
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
                  </div>
                  {c.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-[var(--radius-pill)] bg-surface-3 px-2 py-0.5 text-label font-semibold text-txt-3"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
