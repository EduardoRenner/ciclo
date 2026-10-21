import { exigirSenhaForte } from '@/server/auth/password'
import { EsquemaNovaSenha } from '@/server/auth/schemas'
import { cookies } from 'next/headers'

import {
  CAMINHO_DO_COOKIE_DE_RECUPERACAO,
  COOKIE_DE_RECUPERACAO,
  marcaDeRecuperacaoConfere,
} from '@/server/auth/marca-de-recuperacao'
import { exigirSessao, veioDoLinkDeRecuperacao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { traduzirErroDeSenha } from '@/core/auth/erro-de-senha'
import { rota } from '@/server/http/handler'

export const POST = rota(async (req) => {
  // O link do e-mail já abriu uma sessão de recuperação; sem ela, não há o que
  // trocar. É o mesmo guard das outras rotas autenticadas.
  const sessao = await exigirSessao()

  // ...mas "tem sessão" não basta aqui. Sem esta trava, um cookie roubado de uma
  // sessão comum (login social) trocava a senha e, com o `signOut` de baixo,
  // expulsava o dono de vez — takeover permanente sem nunca provar quem é.
  // A sessão que o link de recuperação abre tem `amr` só com `otp` (+ `totp` se
  // a pessoa tem 2FA); a de um login normal traz `oauth` ou `password`.
  // Desde o login por número o `amr` sozinho não basta: o código do WhatsApp também grava `otp`. A
  // marca do cookie só nasce em `auth/confirmar` com `type=recovery` (`marca-de-recuperacao.ts`).
  const jar = await cookies()
  const marca = jar.get(COOKIE_DE_RECUPERACAO)?.value
  if (!veioDoLinkDeRecuperacao(sessao.metodos) || !marcaDeRecuperacaoConfere(marca, sessao.userId)) {
    throw new AppError('FORBIDDEN', {
      message: 'Para trocar a senha, abra o link "Esqueci minha senha" que enviamos por e-mail. É assim que confirmamos que é você.',
    })
  }

  const { password } = await lerCorpo(req, EsquemaNovaSenha)
  await exigirSenhaForte(password)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.updateUser({ password })
  if (error) {
    // APR-217: senha curta/igual não é erro nosso — vira 422 com a instrução.
    const traduzido = traduzirErroDeSenha(error.message)
    if (traduzido) throw AppError.validacao({ password: traduzido })
    throw new AppError('INTERNAL', { cause: error })
  }

  // Trocar a senha derruba as outras sessões: quem trocou a senha porque
  // desconfiou de invasão precisa que o invasor caia junto.
  await db.auth.signOut({ scope: 'others' })

  // A marca vale para uma troca só. Com o `path` do cookie: sem ele o `delete` mira `/` e não alcança
  // o cookie de verdade (medido: a segunda troca com o mesmo link passava).
  jar.delete({ name: COOKIE_DE_RECUPERACAO, path: CAMINHO_DO_COOKIE_DE_RECUPERACAO })

  return { status: 'senha_trocada' }
})
