'use client'

import { Archive } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

/**
 * CNV-009b: a conta inteira num `.zip` (clientes, agenda, comandas, pacotes, créditos, estoque…), no
 * formato aberto e no do Excel. Mesmo padrão do cartão de cima (`formulario.tsx`): a verificação em
 * duas etapas vira aviso com o link, e o arquivo é montado no navegador (o endereço não pode virar
 * link solto com o dado de toda a carteira).
 */
export default function ExportarConta({ podeExportar }: { podeExportar: boolean }) {
  const mostrarToast = useToast()
  const [precisaMfa, setPrecisaMfa] = useState(false)
  const [pendente, iniciar] = useTransition()

  if (!podeExportar) return null

  function baixar() {
    setPrecisaMfa(false)
    iniciar(async () => {
      try {
        const r = await fetch('/api/v1/account/export')
        if (!r.ok) {
          const json = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
          if (json.error?.code === 'MFA_REQUIRED') {
            setPrecisaMfa(true)
            return
          }
          mostrarToast({ tom: 'erro', titulo: 'Não consegui gerar o arquivo', descricao: json.error?.message })
          return
        }
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ciclo-dados-do-negocio.zip'
        a.click()
        URL.revokeObjectURL(url)
        mostrarToast({ tom: 'ok', titulo: 'Arquivo pronto', descricao: 'Abra a pasta "excel" para ver no Excel. O LEIA-ME explica cada arquivo.' })
      } catch {
        // Sem isto, o React 19 relança a Action rejeitada para o error boundary e a tela some.
        mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira a conexão e tente de novo.' })
      }
    })
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-corpo font-semibold">Tudo do seu negócio</p>
      <p className="text-secundario text-txt-2">
        Clientes, agenda, comandas, pacotes, créditos, fidelidade, produtos e estoque, num arquivo só. Abre no Excel e
        entra em outro sistema. Seus dados são seus.
      </p>
      {precisaMfa ? (
        <p role="alert" className="text-secundario text-warn">
          Antes disso, ligue a verificação em duas etapas na sua conta:{' '}
          <Link href="/admin/config/seguranca" className="font-semibold text-acc-2">
            Configurações · Segurança
          </Link>
          .
        </p>
      ) : null}
      <Button variante="secondary" carregando={pendente} onClick={baixar}>
        <Archive aria-hidden className="size-4" />
        Baixar tudo (.zip)
      </Button>
    </Card>
  )
}
