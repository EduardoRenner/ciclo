'use client'

import { createContext, useContext } from 'react'

import { PADRAO, type Vocabulario } from '@/core/text/vocabulario'

/**
 * As palavras da profissão disponíveis para qualquer tela do painel.
 *
 * Existe pelo mesmo motivo que o `ToastProvider` do `layout.tsx`, e o docstring de lá já diz com
 * estas palavras: *"precisa envolver `{children}` aqui, não em cada tela"*. Medindo o painel em
 * 2026-09-04, **20 rótulos** em 14 telas usam uma das palavras do vocabulário, e seis das sete
 * telas de maior volume são componentes de cliente. Enfiar uma prop em cada uma, e depois na página
 * de servidor que a renderiza, seria mais encanamento do que produto.
 *
 * O valor é resolvido **uma vez, no servidor** (`contextoAtual` já traz `tenant.vocabulario`), e a
 * precedência entre `professions.vocab` e `tenants.vocab_override` continua sendo decidida lá — a
 * tela só consome. Ver `docs/DECISOES.md`, 2026-09-04.
 */
const Contexto = createContext<Vocabulario>(PADRAO)

export function VocabularioProvider({ valor, children }: { valor: Vocabulario; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/**
 * O padrão da casa é o valor inicial do contexto, não um erro: uma tela renderizada fora do
 * provedor (um teste, uma rota nova que ainda não passou pelo layout) mostra "Cliente" e "Serviço"
 * em vez de estourar. Rótulo genérico é sempre melhor que tela quebrada.
 */
export function useVocabulario(): Vocabulario {
  return useContext(Contexto)
}
