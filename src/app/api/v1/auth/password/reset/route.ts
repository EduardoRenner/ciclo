import { exigirSenhaForte } from '@/server/auth/password'
import { EsquemaNovaSenha } from '@/server/auth/schemas'
import { exigirSessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const POST = rota(async (req) => {
  // O link do e-mail já abriu uma sessão de recuperação; sem ela, não há o que
  // trocar. É o mesmo guard das outras rotas autenticadas.
  await exigirSessao()

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
