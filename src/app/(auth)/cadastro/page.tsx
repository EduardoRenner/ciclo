import { redirect } from 'next/navigation'

import { ofertaDoCadastro } from '@/core/billing/prelancamento'
import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { provedoresSociaisAtivos } from '@/server/auth/provedores-sociais'
import { sessaoAtual } from '@/server/auth/session'

import LoginSocial from '../login-social'
import FormularioCadastro from './formulario'

export const metadata = { title: "Criar conta" }

export default async function PaginaCadastro({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  /*
    `docs/82` §8: quem chega pela calculadora acabou de ver um número dele ("R$ 284 por mês") e o
    botão prometeu "ver quem sumiu, pelo nome". Um "Criar sua conta" genérico quebra a conversa no
    meio; o título continua a frase do botão. Só o texto muda — o formulário é o mesmo.
  */
  const daCalculadora = (await searchParams).origem === 'calculadora'

  const provedores = await provedoresSociaisAtivos()
  // A MESMA função que concede a cortesia quando a conta é criada (docs/87 §3.2): o que a tela diz e o que a pessoa ganha não divergem.
  const oferta = ofertaDoCadastro(new Date())

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        {/*
          Era "Criar conta no CICLO", com o logotipo do `Selo` logo acima dizendo CICLO — a marca
          duas vezes em 60 px, o mesmo defeito que a landing tinha na dobra.
        */}
        <h1 className="text-titulo font-bold">{daCalculadora ? 'Vamos achar quem sumiu, pelo nome' : 'Criar sua conta'}</h1>
        {/*
          "Leva menos de um minuto" fala do custo. Esta linha fala do risco, que é a objeção real
          de quem está com o dedo em cima de um formulário de quatro campos: a landing prometeu
          grátis e sem cartão, e a tela que converte era a única do funil sem nenhum argumento.

          O Grátis deixou de ser vendido (docs/87 D1, D2). O fato que sobra é o do dia: quantos dias de
          uso completo, sem cartão, e até quando. Vem de `ofertaDoCadastro`, nunca datilografado.
        */}
        <p className="mt-1 text-secundario text-txt-2">
          {daCalculadora
            ? 'Crie a conta, escreva quem você lembra e o CICLO mostra quem passou da hora de voltar. '
            : 'Leva menos de um minuto. '}
          Você começa com {oferta.chamada[0]?.toLowerCase()}
          {oferta.chamada.slice(1)}: o último dia é {oferta.fim}.
        </p>
      </div>
      <LoginSocial provedores={provedores} />
      <FormularioCadastro />
    </TelaPublica>
  )
}
