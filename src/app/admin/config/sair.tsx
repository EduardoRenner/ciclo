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
  const [aDescartar, setADescartar] = useState<number | null>(null)

  /**
   * `confirmado` só chega como `true` pelo segundo botão, o que a pessoa toca DEPOIS de ler
   * quantas alterações vão embora.
   */
  async function sair(confirmado = false) {
    setSaindo(true)
    setErro(null)

    try {
      // Tenta entregar o que estiver pendente antes de descartar. O que sobrar é apagado mesmo
      // assim — é dado de uma pessoa que está indo embora, e mandá-lo depois, em nome de quem
      // entrar a seguir, seria pior. Essa parte da decisão continua valendo.
      const pendentes = await listarMutacoes().catch(() => [])
      if (pendentes.length > 0 && navigator.onLine) {
        await drenarFilaPendente().catch(() => undefined)
      }

      /*
        O que faltava não era a decisão de descartar, era CONTAR e AVISAR. Antes disto, uma
        recepcionista que marcasse doze atendimentos sem rede e saísse perdia os doze sem uma
        palavra — a tela só dizia "limpa o que estiver guardado aqui". Descartar trabalho de
        alguém em silêncio é o tipo de coisa que a pessoa só descobre no dia seguinte, quando o
        cliente aparece para um horário que não existe.

        A contagem vem de reler a fila DEPOIS da drenagem: é exatamente o que não subiu, seja
        porque estava offline, seja porque o envio falhou no meio.
      */
      const restantes = await listarMutacoes().catch(() => [])
      if (restantes.length > 0 && !confirmado) {
        setADescartar(restantes.length)
        setSaindo(false)
        return
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
          Encerra a sessão neste e nos outros aparelhos, e limpa o que estiver guardado aqui. O que
          ainda não tiver subido é enviado antes, se houver internet.
        </p>
      </div>

      {aDescartar === null ? (
        <Button variante="secondary" onClick={() => sair()} disabled={saindo}>
          <LogOut aria-hidden className="size-4" />
          {saindo ? 'Saindo…' : 'Sair da conta'}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <p role="alert" className="rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt">
            <span className="font-semibold">
              {aDescartar === 1
                ? '1 alteração ainda não subiu.'
                : `${aDescartar} alterações ainda não subiram.`}
            </span>{' '}
            Elas ficaram guardadas neste aparelho e não podem ser enviadas em nome de quem entrar
            depois de você. Se sair agora, {aDescartar === 1 ? 'ela será descartada' : 'elas serão descartadas'}.
            Para não perder, conecte à internet e tente de novo.
          </p>
          <Button variante="secondary" onClick={() => sair(true)} disabled={saindo}>
            <LogOut aria-hidden className="size-4" />
            {saindo ? 'Saindo…' : `Sair e descartar ${aDescartar === 1 ? 'a alteração' : `as ${aDescartar} alterações`}`}
          </Button>
          <Button variante="secondary" onClick={() => setADescartar(null)} disabled={saindo}>
            Continuar na conta
          </Button>
        </div>
      )}

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
    </Card>
  )
}
