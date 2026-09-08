'use client'

import { useState } from 'react'

import Card from '@/components/ui/card'
import { textoDoEnvioAutomatico } from '@/core/messaging/promessa'

/**
 * F0 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): interruptor manual por tenant. O teto diário
 * (`mensageria.ts`) limita volume; isto aqui é "não mandar nada automático", ligado por escolha
 * do dono — cobre `reminders`/`campaigns`, os dois disparos sem ninguém clicando em nada.
 */
export default function PausarEnvios({ inicial }: { inicial: boolean }) {
  const [pausado, setPausado] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(novoValor: boolean) {
    setSalvando(true)
    setErro(null)

    // Otimista, mesmo padrão do interruptor de módulos: numa rede de salão, esperar o servidor
    // pro switch mexer faz a pessoa tocar de novo achando que não pegou.
    const anterior = pausado
    setPausado(novoValor)

    try {
      const r = await fetch('/api/v1/tenant', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ messaging: { paused: novoValor } }),
      })
      if (!r.ok) {
        setPausado(anterior)
        const json = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
        setErro(json?.error?.message ?? 'Não deu para salvar agora. Tente de novo.')
        return
      }
    } catch {
      setPausado(anterior)
      setErro('Sem conexão agora. O que você mudou não foi salvo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {/*
          O título dizia "Lembretes e campanhas AUTOMÁTICOS" e contradizia, no adjetivo, a frase
          honesta que ele mesmo introduz — `textoDoEnvioAutomatico` explica logo abaixo que "o
          disparo é seu: a mensagem vai quando você toca em Avisar". Achado da auditoria de
          2026-09-08.

          É a recorrência que o docstring de `core/messaging/promessa.ts` já previa: a promessa
          saiu da prosa e sobreviveu no RÓTULO, um componente acima. Enquanto `reminders` não
          estiver no `schedule` do `cron.yml`, nada aqui pode afirmar automação — e quando
          estiver, quem volta a afirmar é a função, não este texto fixo.
        */}
        <p className="text-corpo font-semibold text-txt">Lembretes e campanhas</p>
        {/*
          A frase NÃO mora aqui: prosa na tela foi exatamente como nasceu a mentira que esta
          linha corrige (ver `core/messaging/promessa.ts`). Quem decide o que o produto pode
          afirmar sobre envio automático é `ROTAS_AGENDADAS`, um lugar só, com guarda própria.
        */}
        <p className="mt-0.5 text-secundario text-txt-2">{textoDoEnvioAutomatico(pausado)}</p>
        {erro ? (
          <p role="alert" className="mt-1 text-secundario text-bad">
            {erro}
          </p>
        ) : null}
      </div>

      <label className="-my-2 -mr-1.5 grid size-12 shrink-0 cursor-pointer place-items-center">
        {/* Mesmo motivo do título: quem usa leitor de tela ouvia a promessa que a tela desmente. */}
        <span className="sr-only">{pausado ? 'Retomar envios' : 'Pausar envios'}</span>
        <input
          type="checkbox"
          checked={!pausado}
          disabled={salvando}
          onChange={(e) => alternar(!e.target.checked)}
          className="size-5 rounded border-line-2 bg-surface-2 accent-[var(--acc-2)] disabled:opacity-40"
        />
      </label>
    </Card>
  )
}
