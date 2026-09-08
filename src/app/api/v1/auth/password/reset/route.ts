import { exigirSenhaForte } from '@/server/auth/password'
import { EsquemaNovaSenha } from '@/server/auth/schemas'
import { exigirSessao, veioDoLinkDeRecuperacao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
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
  if (!veioDoLinkDeRecuperacao(sessao.metodos)) {
    throw new AppError('FORBIDDEN', {
      message: 'Para trocar a senha, abra o link "Esqueci minha senha" que enviamos por e-mail. É assim que confirmamos que é você.',
    })
  }

  const { password } = await lerCorpo(req, EsquemaNovaSenha)
  await exigirSenhaForte(password)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.updateUser({ password })
  if (error) throw new AppError('INTERNAL', { cause: error })

  // Trocar a senha derruba as outras sessões: quem trocou a senha porque
  // desconfiou de invasão precisa que o invasor caia junto.
  await db.auth.signOut({ scope: 'others' })

  return { status: 'senha_trocada' }
})
