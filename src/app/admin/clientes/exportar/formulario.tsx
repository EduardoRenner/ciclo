'use client'

import { Download } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

/**
 * Mesmo padrão de `clientes/[id]/direitos.tsx` e `config/excluir-conta/formulario.tsx`:
 * `MFA_REQUIRED` vira aviso com link para ligar a verificação em duas etapas, não erro genérico.
 *
 * Diferente dos dois: a resposta de sucesso aqui não é JSON, é o próprio arquivo CSV (a rota
 * devolve `Response` crua — `server/http/handler.ts` deixa passar sem o envelope, é o caminho
 * pensado para arquivo). Só o caminho de ERRO continua no envelope JSON de sempre.
 */
export default function FormularioExportarClientes({ podeExportar }: { podeExportar: boolean }) {
  const mostrarToast = useToast()
  const [precisaMfa, setPrecisaMfa] = useState(false)
  const [pendente, iniciar] = useTransition()

  function baixar() {
    setPrecisaMfa(false)
    iniciar(async () => {
      try {
        const r = await fetch('/api/v1/clients/export')

        if (!r.ok) {
          const json = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
          if (json.error?.code === 'MFA_REQUIRED') {
            setPrecisaMfa(true)
            return
          }
          mostrarToast({ tom: 'erro', titulo: 'Não consegui gerar a planilha', descricao: json.error?.message })
          return
        }

        // Arquivo montado no próprio navegador, igual a `direitos.tsx`: o endereço não pode virar
        // link solto (dado pessoal de toda a carteira não pode parar no histórico do navegador).
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        // Sem data no nome, de propósito — ver o comentário equivalente na rota.
        a.download = 'clientes.csv'
        a.click()
        URL.revokeObjectURL(url)
        mostrarToast({ tom: 'ok', titulo: 'Planilha gerada', descricao: 'Todos os seus clientes, prontos para abrir no Excel ou reimportar em outro lugar.' })
      } catch {
        // Sem isto, o React 19 relança a Action rejeitada para o error boundary da raiz e a tela
        // inteira some numa piscada de rede (docs/21 §5.4, regra do CLAUDE.md).
        mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira a conexão e tente de novo.' })
      }
    })
  }

  if (!podeExportar) {
    return (
      <Card className="text-secundario text-txt-2">
        Só quem é dono do negócio pode baixar a base inteira de clientes.
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-secundario text-txt-2">
        Baixe nome, telefone, e-mail e a data da última visita de cada cliente numa planilha CSV: a mesma que você
        pode subir de volta no importador, aqui ou em qualquer outro lugar. Isso exige confirmação em duas etapas e
        tem um limite de uma vez por mês.
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
        <Download aria-hidden className="size-4" />
        Baixar clientes em planilha
      </Button>
    </Card>
  )
}
