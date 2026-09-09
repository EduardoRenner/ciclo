'use client'

import { useEffect, useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

/** `applicationServerKey` do `PushManager.subscribe` exige `Uint8Array`, não a string base64url que o VAPID usa. */
function base64UrlParaUint8Array(base64Url: string): Uint8Array {
  const preenchimento = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + preenchimento).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = window.atob(base64)
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

/** iOS só entrega push a partir do 16.4, e só se o PWA estiver instalado na tela de início (I118 do FAQ). */
function detectarIosNaoInstalado(): boolean {
  const ehIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const instalado = 'standalone' in navigator && (navigator as unknown as { standalone?: boolean }).standalone === true
  return ehIos && !instalado
}

type Estado = 'carregando' | 'suportado' | 'inscrito' | 'ios_nao_instalado' | 'sem_suporte' | 'negado'

export default function AtivarPush() {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)

  useEffect(() => {
    async function verificar() {
      if (detectarIosNaoInstalado()) return setEstado('ios_nao_instalado')
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setEstado('sem_suporte')
      if (Notification.permission === 'denied') return setEstado('negado')

      const registro = await navigator.serviceWorker.ready
      const inscricaoAtual = await registro.pushManager.getSubscription()
      setEstado(inscricaoAtual ? 'inscrito' : 'suportado')
    }
    void verificar()
  }, [])

  async function ativar() {
    setPendente(true)
    setErro(null)
    try {
      const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!chavePublica) throw new Error('Notificação push ainda não está configurada neste ambiente.')

      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setEstado('negado')
        return
      }

      const registro = await navigator.serviceWorker.ready
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaUint8Array(chavePublica) as BufferSource,
      })

      const resposta = await fetch('/api/v1/push/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(inscricao.toJSON()),
      })
      if (!resposta.ok) throw new Error('Não conseguimos salvar a inscrição no servidor.')

      setEstado('inscrito')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ativar as notificações.')
    } finally {
      setPendente(false)
    }
  }

  async function desativar() {
    setPendente(true)
    setErro(null)
    try {
      const registro = await navigator.serviceWorker.ready
      const inscricao = await registro.pushManager.getSubscription()
      if (inscricao) {
        await fetch('/api/v1/push/subscriptions', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ endpoint: inscricao.endpoint }),
        })
        await inscricao.unsubscribe()
      }
      setEstado('suportado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível desativar as notificações.')
    } finally {
      setPendente(false)
    }
  }

  /*
    Era `return null`. A seção sumia da tela enquanto a detecção rodava (service worker pronto +
    `getSubscription()`, que dependem do navegador e não são instantâneos) e depois aparecia do
    nada, empurrando o resto da página para baixo. Pior: se a detecção travasse, a pessoa ficava
    olhando para um buraco sem saber que faltava algo ali.

    O esqueleto imita a FORMA REAL do cartão que vem depois — duas linhas de texto e um botão —
    para a página não pular quando o conteúdo chega. `aria-busy` é quem conta o carregamento; o
    `Skeleton` é `aria-hidden` de propósito, leitor de tela não narra caixa cinza.
  */
  if (estado === 'carregando') {
    return (
      <Card aria-busy="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/2" />
        <Skeleton className="mt-3 h-11 w-48 rounded-[var(--radius-md)]" />
      </Card>
    )
  }

  if (estado === 'ios_nao_instalado') {
    return (
      <Card>
        <p className="text-corpo font-semibold">Adicione o CICLO à tela de início para receber notificações</p>
        <ol className="mt-2 space-y-1 text-secundario text-txt-2 list-decimal pl-5">
          <li>Toque no ícone de compartilhar do Safari (o quadrado com a seta para cima)</li>
          <li>Escolha &quot;Adicionar à Tela de Início&quot;</li>
          <li>Abra o CICLO pelo ícone que aparecer lá, não mais pelo Safari</li>
        </ol>
      </Card>
    )
  }

  if (estado === 'sem_suporte') {
    return <p className="text-secundario text-txt-2">Seu navegador não aceita notificações push.</p>
  }

  if (estado === 'negado') {
    return <p className="text-secundario text-txt-2">Notificação bloqueada nas permissões do navegador. Libere no navegador para ativar.</p>
  }

  return (
    <Card>
      <p className="text-corpo font-semibold">Lembretes e alertas no aparelho</p>
      <p className="mt-1 text-secundario text-txt-2">Receba avisos mesmo com o app fechado.</p>
      {erro ? <p className="mt-2 text-secundario text-bad">{erro}</p> : null}
      {estado === 'inscrito' ? (
        <Button variante="secondary" className="mt-3" onClick={desativar} carregando={pendente}>
          Desativar notificações
        </Button>
      ) : (
        <Button className="mt-3" onClick={ativar} carregando={pendente}>
          Ativar notificações
        </Button>
      )}
    </Card>
  )
}
