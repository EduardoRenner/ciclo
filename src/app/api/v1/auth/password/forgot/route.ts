import { EsquemaEsqueciSenha } from '@/server/auth/schemas'
import { criarClienteDoUsuario, exigirEnv } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const POST = rota(async (req) => {
  const { email } = await lerCorpo(req, EsquemaEsqueciSenha)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${exigirEnv('NEXT_PUBLIC_APP_URL')}/nova-senha`,
  })

  if (error?.status === 429) throw AppError.limiteDeTaxa(60)

  // Fora o excesso de tentativas, a resposta é sempre a mesma: dizer "esse
  // e-mail não existe" transforma a tela de recuperar senha numa lista de
  // clientes do CICLO.
  return { status: 'se_existir_enviamos' }
})
