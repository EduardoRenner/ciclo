'use client'

import { CloudOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { assinarEventosDeFila } from '@/lib/offline/api-client'
import { listarMutacoes } from '@/lib/offline/db'

/**
 * T4 (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.4 item 2): a fila offline (`src/lib/offline`) já
 * segura o golpe quando a rede cai — o que faltava era a pessoa VER isso acontecendo. Sem
 * indicador, sem conexão e uma mutação enfileirada parecem ação normal, e só a falta de resposta
 * ("cadê a atualização?") denuncia algo errado. A pesquisa cita justamente este tipo de sinal
 * como o que diferencia um app "de verdade" de um WebView pelado, mas o comportamento serve os
 * dois lados igual — web e nativo — porque a fila em si nunca teve gate de plataforma.
 *
 * Só aparece quando há algo a dizer: sem conexão, ou com mutação pendente pra enviar. Nos outros
 * momentos retorna `null`, mesmo padrão de `ResolucaoDeFila`.
 */
export default function IndicadorDeConexao() {
  const [online, setOnline] = useState(true)
  const [pendentes, setPendentes] = useState(0)

  useEffect(() => {
    setOnline(navigator.onLine)
    listarMutacoes()
      .then((fila) => setPendentes(fila.length))
      .catch(() => {})

    function atualizarContagem() {
      listarMutacoes()
        .then((fila) => setPendentes(fila.length))
        .catch(() => {})
    }

    const aoFicarOnline = () => setOnline(true)
    const aoFicarOffline = () => setOnline(false)
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)

    const cancelar = assinarEventosDeFila(atualizarContagem)

    return () => {
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
      cancelar()
    }
  }, [])

  if (online && pendentes === 0) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-warn/12 px-[var(--gutter)] py-1.5 text-label font-semibold text-warn"
    >
      <CloudOff aria-hidden className="size-3.5 shrink-0" />
      {online
        ? `${pendentes} ${pendentes === 1 ? 'alteração pendente' : 'alterações pendentes'} — enviando quando possível`
        : pendentes > 0
          ? `Sem conexão · ${pendentes} ${pendentes === 1 ? 'alteração guardada' : 'alterações guardadas'}`
          : 'Sem conexão — mudanças serão guardadas'}
    </div>
  )
}
