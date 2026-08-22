'use client'

import { Download, ShieldCheck, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

/**
 * `GET /clients/:id/data-export` e `POST /clients/:id/erase` existem desde o
 * TICKET-054 (LGPD art. 18: acesso, portabilidade e eliminação) e **nunca
 * tiveram porta na interface** — quem responde ao pedido de uma cliente é o
 * salão, não o programador, e não havia como. Os dois exigem verificação em
 * duas etapas no servidor; a tela precisa dizer isso quando o pedido voltar
 * `MFA_REQUIRED`, senão o erro lê como defeito.
 */
export default function DireitosDaCliente({
  clientId,
  nome,
  podeApagar,
}: {
  clientId: string
  nome: string
  podeApagar: boolean
}) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [confirmando, setConfirmando] = useState(false)
  const [precisaMfa, setPrecisaMfa] = useState(false)
  const [pendente, iniciar] = useTransition()

  function tratarFalha(json: { error?: { code?: string; message?: string } }, padrao: string): void {
    if (json.error?.code === 'MFA_REQUIRED') {
      setPrecisaMfa(true)
      return
    }
    mostrarToast({ tom: 'erro', titulo: padrao, descricao: json.error?.message })
  }

  function baixar() {
    setPrecisaMfa(false)
    iniciar(async () => {
      const r = await fetch(`/api/v1/clients/${clientId}/data-export`)
      const json = (await r.json()) as { data?: unknown; error?: { code?: string; message?: string } }
      if (!r.ok || !json.data) {
        tratarFalha(json, 'Não consegui gerar a cópia')
        return
      }

      // Arquivo montado no próprio navegador: o endereço do export não pode
      // virar link solto (é dado pessoal numa URL que iria parar no histórico).
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dados-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      mostrarToast({ tom: 'ok', titulo: 'Cópia gerada', descricao: 'O arquivo tem tudo que o sistema guarda sobre ela.' })
    })
  }

  function apagar() {
    setPrecisaMfa(false)
    iniciar(async () => {
      const r = await fetch(`/api/v1/clients/${clientId}/erase`, {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      })
      const json = (await r.json()) as { data?: unknown; error?: { code?: string; message?: string } }
      if (!r.ok) {
        setConfirmando(false)
        tratarFalha(json, 'Não consegui apagar')
        return
      }
      setConfirmando(false)
      mostrarToast({ tom: 'ok', titulo: 'Dados apagados', descricao: 'O histórico que a lei exige guardar ficou sem identificação.' })
      router.push('/admin/clientes')
      router.refresh()
    })
  }

  return (
    <section className="mt-7">
      <SectionHeader icone={<ShieldCheck aria-hidden className="size-3.5" />}>Direitos da cliente</SectionHeader>
      <Card className="flex flex-col gap-3">
        <p className="text-secundario text-txt-2">
          Ela pode pedir uma cópia de tudo que você guarda sobre ela, ou pedir para sumir da sua base. As duas coisas
          exigem confirmação em duas etapas.
        </p>

        {precisaMfa ? (
          <p role="alert" className="text-secundario text-warn">
            Antes disso, ligue a verificação em duas etapas na sua conta —{' '}
            <Link href="/admin/config/seguranca" className="font-semibold text-acc-2">
              Configurações · Segurança
            </Link>
            .
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button tamanho="sm" variante="secondary" carregando={pendente} onClick={baixar}>
            <Download aria-hidden className="size-4" />
            Baixar os dados
          </Button>
          {podeApagar ? (
            <Button tamanho="sm" variante="ghost" onClick={() => setConfirmando(true)}>
              <Trash2 aria-hidden className="size-4" />
              Apagar os dados
            </Button>
          ) : null}
        </div>
      </Card>

      <Sheet
        aberto={confirmando}
        aoFechar={setConfirmando}
        titulo={`Apagar os dados de ${nome}?`}
        descricao="Não dá para voltar atrás."
      >
        <div className="flex flex-col gap-3">
          <p className="text-corpo text-txt-2">
            O nome, o telefone e as anotações somem. Os atendimentos e os valores continuam no histórico do negócio sem
            identificação — é o que a lei manda guardar, e é o que mantém seu caixa fechando.
          </p>
          <Button variante="danger" largura="cheia" carregando={pendente} onClick={apagar}>
            Apagar mesmo assim
          </Button>
          <Button variante="ghost" largura="cheia" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
