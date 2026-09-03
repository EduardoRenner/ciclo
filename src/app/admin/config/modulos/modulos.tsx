'use client'

import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import Card from '@/components/ui/card'

import { NOME_DO_PLANO } from '@/core/billing/planos'

import type { ModuloNaTela } from '@/server/services/modulos'

export default function Modulos({ iniciais }: { iniciais: ModuloNaTela[] }) {
  const [modulos, setModulos] = useState(iniciais)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(m: ModuloNaTela, ligado: boolean) {
    setSalvando(m.key)
    setErro(null)

    // Otimista: o interruptor responde na hora. Numa rede de salão, esperar o servidor para o
    // switch mexer faz a pessoa tocar de novo achando que não pegou.
    const anterior = modulos
    setModulos((atual) => atual.map((x) => (x.key === m.key ? { ...x, ligado } : x)))

    try {
      const r = await fetch('/api/v1/tenant/modules', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ modulo: m.key, ligado }),
      })
      const json = (await r.json()) as { data?: { modules: ModuloNaTela[] }; error?: { message?: string } }
      if (!r.ok || !json.data) {
        setModulos(anterior)
        setErro(json.error?.message ?? 'Não deu para salvar agora. Tente de novo.')
        return
      }
      setModulos(json.data.modules)
    } catch {
      setModulos(anterior)
      setErro('Sem conexão agora. O que você mudou não foi salvo.')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro ? (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-bad/10 p-3 text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {modulos.map((m) => {
        const bloqueado = m.veredito.estado === 'bloqueado_pelo_plano'
        const precisaDo = m.veredito.estado === 'bloqueado_pelo_plano' ? m.veredito.precisaDo : null

        return (
          <Card key={m.key} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-corpo font-semibold text-txt">{m.label}</p>
              {/*
                A regra 5.2 em uma linha: bloqueio nunca some da tela sem explicação, e sempre diz
                o caminho. "Sempre ligado" também explica, para o interruptor desabilitado não
                parecer defeito.
              */}
              {bloqueado && precisaDo ? (
                <p className="mt-0.5 text-secundario text-txt-3">
                  Faz parte do{' '}
                  <Link href="/precos" className="font-semibold text-acc-2 underline underline-offset-2">
                    {NOME_DO_PLANO[precisaDo]}
                  </Link>
                </p>
              ) : m.sempreLigado ? (
                <p className="mt-0.5 text-secundario text-txt-3">Sempre ligado: é a base do produto</p>
              ) : null}
            </div>

            {bloqueado ? (
              <Lock aria-hidden className="size-5 shrink-0 text-txt-3" />
            ) : (
              /* O quadradinho tem 20px; quem precisa de 48 é o dedo — o rótulo em volta é a área
                 de toque, como na lista de "Recuperar receita". */
              <label className="-my-2 -mr-1.5 grid size-12 shrink-0 cursor-pointer place-items-center">
                {/*
                  Módulo "sempre ligado" (agenda e Motor de Ciclo) chega aqui travado. Sem a
                  segunda frase, o leitor de tela dizia só "Desligar Agenda, marcada, indisponível"
                  — e quem tenta desligar não descobre que não dá, descobre que não funcionou.
                  Mesma correção dos botões de `motivoDesabilitado` (auditoria de 2026-08-28).
                */}
                <span className="sr-only">
                  {m.sempreLigado
                    ? `${m.label} faz parte do produto e não pode ser desligado.`
                    : `${m.ligado ? 'Desligar' : 'Ligar'} ${m.label}`}
                </span>
                <input
                  type="checkbox"
                  checked={m.ligado}
                  disabled={m.sempreLigado || salvando === m.key}
                  title={m.sempreLigado ? `${m.label} faz parte do produto e não pode ser desligado.` : undefined}
                  onChange={(e) => alternar(m, e.target.checked)}
                  className="size-5 rounded border-line-2 bg-surface-2 accent-[var(--acc-2)] disabled:opacity-40"
                />
              </label>
            )}
          </Card>
        )
      })}
    </div>
  )
}
