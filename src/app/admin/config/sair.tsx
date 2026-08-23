'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { drenarFilaPendente } from '@/lib/offline/api-client'
import { apagarBancoOffline, listarMutacoes } from '@/lib/offline/db'

/**
 * Auditoria de segurança, achado S9: **não existia como sair da conta.** A rota
 * `POST /api/v1/auth/logout` estava escrita e correta desde o TICKET-009 — inclusive com
 * `scope: 'global'`, que derruba os refresh tokens dos outros aparelhos — e nada na interface
 * a chamava. Varredura em `src/app`, `src/components` e `src/lib`: zero ocorrências.
 *
 * Por que isso importa aqui mais que na média: o tablet do balcão é o caso de uso central deste
 * produto. Sem botão, a recepcionista da tarde continuava na sessão da manhã, e quem fosse
 * desligado seguia com acesso naquele aparelho até o refresh token vencer sozinho. (Desativar a
 * membership revoga na hora, porque `has_tenant()` confere `m.active` — mas isso é o caminho de
 * exceção, não o de trocar de pessoa no meio do expediente.)
 *
 * Fica em Configurações, não na Topbar: a Topbar aparece em toda tela, e um alvo de 48px que
 * encerra a sessão a um toque de distância o dia inteiro é acidente esperando acontecer.
 */
export default function SairDaConta() {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function sair() {
    setSaindo(true)
    setErro(null)

    try {
      // Tenta entregar o que estiver pendente antes de descartar. Se a rede estiver fora, o que
      // sobrar é apagado mesmo assim — é dado de uma pessoa que está indo embora, e mandá-lo
      // depois, em nome de quem entrar a seguir, seria pior.
      const pendentes = await listarMutacoes().catch(() => [])
      if (pendentes.length > 0 && navigator.onLine) {
        await drenarFilaPendente().catch(() => undefined)
      }

      const resposta = await fetch('/api/v1/auth/logout', { method: 'POST' })
      if (!resposta.ok) throw new Error('logout falhou')

      await apagarBancoOffline().catch(() => undefined)

      // `replace`, não `push`: o botão "voltar" não pode devolver a tela autenticada de quem
      // acabou de sair. E `refresh()` para o middleware reavaliar a sessão já encerrada.
      router.replace('/entrar')
      router.refresh()
    } catch {
      setSaindo(false)
      setErro('Não consegui sair agora. Confira a conexão e tente de novo.')
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-corpo font-semibold">Sair da conta</p>
        <p className="text-secundario text-txt-2">
          Encerra a sessão neste e nos outros aparelhos, e limpa o que estiver guardado aqui.
        </p>
      </div>

      <Button variante="secondary" onClick={sair} disabled={saindo}>
        <LogOut aria-hidden className="size-4" />
        {saindo ? 'Saindo…' : 'Sair da conta'}
      </Button>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
    </Card>
  )
}
