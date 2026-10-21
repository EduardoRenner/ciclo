'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { rotuloDoPapel } from '@/core/auth/rotulo-do-papel'
import { ASSUNTO_TRANSFERIR_TITULARIDADE, canalDeContato } from '@/lib/contato'
import { drenarFilaPendente } from '@/lib/offline/api-client'
import { apagarBancoOffline, listarMutacoes } from '@/lib/offline/db'
import { avisoAntesDeSair, type AvisoDeSaida, type LeituraDaFila } from '@/core/offline/aviso-de-saida'
import { fetchComTentativa } from '@/lib/tentativa'

type Vinculo = { tenantId: string; role: string }
/** LOJA-27: o que confirma a exclusão para ESTA conta (`core/auth/confirmar-exclusao.ts`), decidido no servidor. */
type Confirmacao = 'pronta' | 'senha' | 'entrar_de_novo' | 'segundo_fator'
type Situacao = { vinculos: Vinculo[]; bloqueios: string[]; confirmacao?: Confirmacao }

/**
 * Mesmo padrão de `clientes/[id]/direitos.tsx` (a tela equivalente do LADO da cliente do salão):
 * `MFA_REQUIRED` vira aviso pra ligar a verificação em duas etapas, não erro genérico; confirmação
 * em duas telas, nunca um toque só apaga a conta.
 */
export default function FormularioExcluirConta() {
  const mostrarToast = useToast()
  const [situacao, setSituacao] = useState<Situacao | 'carregando' | 'falhou'>('carregando')
  const [confirmando, setConfirmando] = useState(false)
  // APR-222 (G-10): a mesma régua de "Sair" — contar o que está na fila e dizer, em vez de apagar em silêncio.
  const [avisoDaFila, setAvisoDaFila] = useState<AvisoDeSaida | null>(null)
  const [precisaMfa, setPrecisaMfa] = useState(false)
  const [senha, setSenha] = useState('')
  const [erroDaSenha, setErroDaSenha] = useState<string | null>(null)
  const [precisaEntrarDeNovo, setPrecisaEntrarDeNovo] = useState(false)
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
    setErroDaSenha(null)
    const pedeSenha = situacao !== 'carregando' && situacao !== 'falhou' && situacao.confirmacao === 'senha'
    if (pedeSenha && !senha) {
      setErroDaSenha('Digite sua senha para confirmar.')
      return
    }
    iniciar(async () => {
      try {
        // Mesma disciplina de `sair.tsx`: entrega o que estiver pendente antes de a conta sumir —
        // depois disso não há mais como reenviar em nome de ninguém.
        const pendentes = await listarMutacoes().catch(() => [])
        if (pendentes.length > 0 && navigator.onLine) {
          await drenarFilaPendente().catch(() => undefined)
        }

        const r = await fetchComTentativa('/api/v1/account', {
          method: 'DELETE',
          ...(pedeSenha ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: senha }) } : {}),
        })
        const json = (await r.json()) as { data?: unknown; error?: { code?: string; message?: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok) {
          // Senha errada fica na folha, com o erro no campo: fechar obrigaria a pessoa a começar de novo.
          const doCampo = json.error?.details?.fields?.password
          if (doCampo) {
            setErroDaSenha(doCampo)
            return
          }
          setConfirmando(false)
          if (json.error?.code === 'MFA_REQUIRED') {
            setPrecisaMfa(true)
            return
          }
          if (json.error?.code === 'REAUTH_REQUIRED') {
            setPrecisaEntrarDeNovo(true)
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
  const canalDeTransferencia = canalDeContato(ASSUNTO_TRANSFERIR_TITULARIDADE)
  const negocios = vinculos.length

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="text-secundario text-txt-2">
          Isto apaga seu login do CICLO para sempre. Não dá para voltar atrás. O histórico{' '}
          {negocios === 0 ? 'de qualquer negócio' : negocios === 1 ? 'do negócio abaixo' : 'dos negócios abaixo'} (agenda, clientes,
          caixa) continua intacto, exatamente como quando alguém sai da equipe: só o SEU acesso some.
        </p>

        {vinculos.length > 0 ? (
          <ul className="flex flex-col gap-1 text-secundario text-txt-2">
            {vinculos.map((v) => (
              <li key={v.tenantId}>{rotuloDoPapel(v.role)}</li>
            ))}
          </ul>
        ) : null}

        {precisaMfa || situacao.confirmacao === 'segundo_fator' ? (
          <p role="alert" className="text-secundario text-warn">
            Sua conta tem verificação em duas etapas: saia e entre de novo com o código para poder excluir.
          </p>
        ) : null}
        {precisaEntrarDeNovo || situacao.confirmacao === 'entrar_de_novo' ? (
          <p role="alert" className="text-secundario text-warn">
            Por segurança, saia e entre de novo para excluir sua conta. Depois volte a{' '}
            <Link href="/admin/config/excluir-conta" className="font-semibold text-acc-2">
              esta tela
            </Link>
            .
          </p>
        ) : null}

        {bloqueios.length > 0 ? (
          <>
            {bloqueios.map((motivo, i) => (
              <p key={i} role="alert" className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                <span>{motivo}</span>
              </p>
            ))}
            {/*
              O "fale com a gente" do bloqueio só existe quando há canal (`bloqueioDeTitularSemSucessor`),
              e aí o caminho vem junto. Sem canal, nem a frase nem o botão aparecem.
            */}
            {canalDeTransferencia ? (
              <a href={canalDeTransferencia.href} target="_blank" rel="noreferrer" className="flex min-h-12 items-center font-semibold text-acc-2">
                {canalDeTransferencia.rotulo}
              </a>
            ) : null}
          </>
        ) : (
          <Button
            variante="danger"
            onClick={() => {
              setConfirmando(true)
              listarMutacoes().then(
                (m) => setAvisoDaFila(avisoAntesDeSair({ ok: true, quantidade: m.length } as LeituraDaFila)),
                () => setAvisoDaFila(avisoAntesDeSair({ ok: false } as LeituraDaFila)),
              )
            }}
          >
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
          {avisoDaFila && avisoDaFila.tipo !== 'pode_sair' ? (
            <p role="alert" className="rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt">
              {avisoDaFila.tipo === 'vai_descartar' ? (
                <>
                  <span className="font-semibold">
                    {avisoDaFila.quantidade === 1 ? '1 alteração guardada neste aparelho ainda não subiu' : `${avisoDaFila.quantidade} alterações guardadas neste aparelho ainda não subiram`}
                  </span>{' '}
                  e {avisoDaFila.quantidade === 1 ? 'se perde' : 'se perdem'} com a conta. Para não perder, conecte à internet antes.
                </>
              ) : (
                <>
                  <span className="font-semibold">Não consegui verificar se há alterações não enviadas.</span> Se houver algo que não subiu, excluir agora descarta.
                </>
              )}
            </p>
          ) : null}
          {situacao.confirmacao === 'senha' ? (
            <Input
              rotulo="Sua senha"
              name="password"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              erro={erroDaSenha ?? undefined}
            />
          ) : null}
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
