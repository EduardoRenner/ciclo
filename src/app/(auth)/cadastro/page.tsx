import { redirect } from 'next/navigation'

import { NOME_DO_PLANO } from '@/core/billing/planos'
import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { provedoresSociaisAtivos } from '@/server/auth/provedores-sociais'
import { sessaoAtual } from '@/server/auth/session'

import LoginSocial from '../login-social'
import FormularioCadastro from './formulario'

export const metadata = { title: "Criar conta" }

export default async function PaginaCadastro() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  const provedores = await provedoresSociaisAtivos()

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        {/*
          Era "Criar conta no CICLO", com o logotipo do `Selo` logo acima dizendo CICLO — a marca
          duas vezes em 60 px, o mesmo defeito que a landing tinha na dobra.
        */}
        <h1 className="text-titulo font-bold">Criar sua conta</h1>
        {/*
          "Leva menos de um minuto" fala do custo. Esta linha fala do risco, que é a objeção real
          de quem está com o dedo em cima de um formulário de quatro campos: a landing prometeu
          grátis e sem cartão, e a tela que converte era a única do funil sem nenhum argumento.

          Os dois fatos são os do cartão do Grátis em `planos-cartoes.ts` ("Para sempre, sem
          cartão"), e o nome do degrau vem do core — a página não reescreve promessa nem preço.
        */}
        <p className="mt-1 text-secundario text-txt-2">
          Leva menos de um minuto. Você começa no {NOME_DO_PLANO.gratis} e não pedimos cartão.
        </p>
      </div>
      <LoginSocial provedores={provedores} />
      <FormularioCadastro />
    </TelaPublica>
  )
}
