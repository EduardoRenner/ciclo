'use client'

import Link from 'next/link'

import { Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Skeleton from '@/components/ui/skeleton'

type ClienteLinha = {
  id: string
  name: string
  phone_e164: string | null
  tags: string[]
}

/** `(11) 98765-4321`, o formato que a profissional reconhece de cabeça. */
function formatarTelefone(e164: string | null): string | null {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164 ?? '')
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

export default function ListaClientes({ iniciais }: { iniciais: ClienteLinha[] }) {
  const [termo, setTermo] = useState('')
  const [clientes, setClientes] = useState(iniciais)
  const [carregando, setCarregando] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const buscar = useCallback((valor: string) => {
    setCarregando(true)
    fetch(`/api/v1/clients?q=${encodeURIComponent(valor)}`)
      .then((r) => r.json() as Promise<{ data?: { clients: ClienteLinha[] } }>)
      .then((json) => setClientes(json.data?.clients ?? []))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
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
  }, [termo, buscar])

  return (
    <div>
      <label className="sr-only" htmlFor="busca-clientes">
        Buscar cliente por nome ou telefone
      </label>
      <input
        id="busca-clientes"
        type="search"
        inputMode="search"
        placeholder="Nome ou telefone"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        className="mb-4 h-12 w-full rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 text-corpo text-txt"
      />

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
        <Card className="p-0">
          <EmptyState
            icone={<Users aria-hidden className="size-6" />}
            titulo={termo ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente ainda'}
            descricao={
              termo
                ? 'Confira a grafia do nome ou o telefone digitado.'
                : 'Cadastre a primeira cliente para começar a marcar horários.'
            }
            acao={<Link href="/clientes/nova">Cadastrar cliente</Link>}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Card>
                <p className="text-corpo font-semibold">{c.name}</p>
                {c.phone_e164 ? (
                  <p className="tabular mt-0.5 text-secundario text-txt-2">{formatarTelefone(c.phone_e164)}</p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
