'use client'

import { createContext, useContext } from 'react'

/**
 * O fuso do NEGÓCIO disponível para qualquer tela do painel (APR-019).
 *
 * As telas internas formatavam hora sem fuso, contando que "o fuso do navegador da profissional já
 * é o do salão". Só que o HTML sai do SERVIDOR, e na Vercel o servidor é UTC: medido com o build
 * servido em `TZ=UTC`, a Agenda mostrava 12:11 para um horário das 09:11 e a hora errada ficava
 * visível por 819 a 1.093 ms até a hidratação trocar. Com o fuso vindo daqui, servidor e navegador
 * desenham a mesma hora.
 *
 * Resolvido uma vez no layout do painel (`ctx.tenant.timezone`), como o `VocabularioProvider`. O
 * padrão é o fuso da casa, não um erro: tela fora do provedor (teste, rota nova) mostra a hora de
 * Brasília em vez de estourar — e é o fuso de quase todo negócio da base.
 */
const Contexto = createContext<string>('America/Sao_Paulo')

export function FusoProvider({ fuso, children }: { fuso: string; children: React.ReactNode }) {
  return <Contexto.Provider value={fuso}>{children}</Contexto.Provider>
}

export function useFuso(): string {
  return useContext(Contexto)
}
