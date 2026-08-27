'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Solta o botão antes de a tela recarregar.
 *
 * O padrão anterior era `onAtualizado: () => { fechar(); router.refresh() }`, chamado de dentro
 * do `useTransition` do sheet de detalhe. `router.refresh()` entra no escopo da transição, então
 * o `pendente` do botão — o spinner — só terminava depois de o servidor re-renderizar a página
 * inteira: mutação **mais** re-render, em série, tudo no dedo de quem clicou
 * (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §1 e §3 P0-c).
 *
 * Aqui o `refresh` sai da transição: o componente só marca "precisa atualizar", e o efeito roda
 * depois do commit do estado, já fora do escopo. O toast e o fechamento do sheet aparecem assim
 * que a mutação responde; a lista se atualiza logo atrás, sem prender o botão.
 *
 * Não é otimista e não finge nada: o dado exibido continua vindo do servidor.
 */
export function useAtualizarDepois(): () => void {
  const router = useRouter()
  const [pedidos, setPedidos] = useState(0)

  useEffect(() => {
    if (pedidos === 0) return
    router.refresh()
  }, [pedidos, router])

  return () => setPedidos((n) => n + 1)
}
