'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { rotuloDoPapel } from '@/core/auth/rotulo-do-papel'
import { drenarFilaPendente } from '@/lib/offline/api-client'
import { apagarBancoOffline, listarMutacoes } from '@/lib/offline/db'

type Vinculo = { tenantId: string; role: string }
type Situacao = { vinculos: Vinculo[]; bloqueios: string[] }

/**
 * Mesmo padrão de `clientes/[id]/direitos.tsx` (a tela equivalente do LADO da cliente do salão):
 * `MFA_REQUIRED` vira aviso pra ligar a verificação em duas etapas, não erro genérico; confirmação
 * em duas telas, nunca um toque só apaga a conta.
 */
export default function FormularioExcluirConta() {
  const mostrarToast = useToast()
  const [situacao, setSituacao] = useState<Situacao | 'carregando' | 'falhou'>('carregando')
  const [confirmando, setConfirmando] = useState(false)
  const [precisaMfa, setPrecisaMfa] = useState(false)
  const [pendente, iniciar] = useTransition()

  useEffect(() => {
    let vivo = true
    fetch('/api/v1/account')
      .then((r) => r.json())
      .then((json: { data?: Situacao }) => {
        if (vivo) setSituacao(json.data ?? 'falhou')
      })
      .catch(() => {
        if (vivo) setSituacao('falhou')
      })
    return () => {
      vivo = false
    }
  }, [])

  function excluir() {
    setPrecisaMfa(false)
    iniciar(async () => {
      try {
        // Mesma disciplina de `sair.tsx`: entrega o que estiver pendente antes de a conta sumir —
        // depois disso não há mais como reenviar em nome de ninguém.
        const pendentes = await listarMutacoes().catch(() => [])
        if (pendentes.length > 0 && navigator.onLine) {
          await drenarFilaPendente().catch(() => undefined)
        }

        const r = await fetch('/api/v1/account', { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } })
        const json = (await r.json()) as { data?: unknown; error?: { code?: string; message?: string } }
        if (!r.ok) {
          setConfirmando(false)
          if (json.error?.code === 'MFA_REQUIRED') {
            setPrecisaMfa(true)
            return
          }
          mostrarToast({ tom: 'erro', titulo: 'Não consegui excluir sua conta', descricao: json.error?.message })
          return
        }

        /*
         * `apagarBancoOffline` é a limpeza que existe pra não deixar nome/telefone/agendamento de
         * quem está saindo no IndexedDB de um tablet de balcão compartilhado (achado S9). Quase
         * nunca falha de verdade (`indexedDB.deleteDatabase` só rejeita em erro genuíno; bloqueio
         * por outra aba já resolve como sucesso dentro do próprio `apagarBancoOffline`) — mas se
         * falhar, a conta já foi apagada no servidor e não há mais tela pra avisar a pessoa. O
         * `console.warn` é o que sobra pra não ser 100% silencioso — mesmo padrão de
         * `upstash_indisponivel`/`hcaptcha_indisponivel` nesta base.
         */
        await apagarBancoOffline().catch((erro: unknown) =>
          console.warn(JSON.stringify({ level: 'warn', event: 'apagar_banco_offline_falhou', origem: 'excluir-conta' }), erro),
        )
        // `location.href`, não `router.push`: a sessão já não existe mais no servidor, e o Next
        // não pode devolver nenhuma tela autenticada depois disso — mesmo raciocínio de `sair.tsx`.
        window.location.href = '/entrar'
      } catch {
        setConfirmando(false)
        mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira a conexão e tente de novo.' })
      }
    })
  }

  if (situacao === 'carregando') {
    return <Card className="text-secundario text-txt-2">Conferindo sua conta…</Card>
  }

  if (situacao === 'falhou') {
    return (
      <Card className="text-secundario text-bad">Não consegui verificar sua conta agora. Confira a conexão e tente de novo.</Card>
    )
  }

  const { vinculos, bloqueios } = situacao
  const negocios = vinculos.length

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="text-secundario text-txt-2">
          Isto apaga seu login do CICLO para sempre. Não dá para voltar atrás. O histórico de{' '}
          {negocios === 0 ? 'qualquer negócio' : negocios === 1 ? 'o negócio abaixo' : 'os negócios abaixo'} (agenda, clientes,
          caixa) continua intacto, exatamente como quando alguém sai da equipe: só o SEU acesso some.
        </p>

        {vinculos.length > 0 ? (
          <ul className="flex flex-col gap-1 text-secundario text-txt-2">
            {vinculos.map((v) => (
              <li key={v.tenantId}>{rotuloDoPapel(v.role)}</li>
            ))}
          </ul>
        ) : null}

        {precisaMfa ? (
          <p role="alert" className="text-secundario text-warn">
            Antes disso, ligue a verificação em duas etapas na sua conta:{' '}
            <Link href="/admin/config/seguranca" className="font-semibold text-acc-2">
              Configurações · Segurança
            </Link>
            .
          </p>
        ) : null}

        {bloqueios.length > 0 ? (
          bloqueios.map((motivo, i) => (
            <p key={i} role="alert" className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
              <span>{motivo}</span>
            </p>
          ))
        ) : (
          <Button variante="danger" onClick={() => setConfirmando(true)}>
            <Trash2 aria-hidden className="size-4" />
            Excluir minha conta
          </Button>
        )}
      </Card>

      <Sheet aberto={confirmando} aoFechar={setConfirmando} titulo="Excluir sua conta?" descricao="Não dá para voltar atrás.">
        <div className="flex flex-col gap-3">
          <p className="text-corpo text-txt-2">
            Seu nome, e-mail e login somem. {negocios === 1 ? 'O negócio continua' : 'Os negócios continuam'} funcionando com o
            histórico intacto, só você deixa de conseguir entrar.
          </p>
          <Button variante="danger" largura="cheia" carregando={pendente} onClick={excluir}>
            Excluir mesmo assim
          </Button>
          <Button variante="ghost" largura="cheia" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
