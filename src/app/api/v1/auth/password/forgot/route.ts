import { EsquemaEsqueciSenha } from '@/server/auth/schemas'
import { criarClienteDoUsuario, exigirEnv } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const POST = rota(async (req) => {
  const { email } = await lerCorpo(req, EsquemaEsqueciSenha)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.resetPasswordForEmail(email, {
    // Passa por `/auth/callback` de propósito: é lá que o `code` do PKCE vira
    // sessão (Server Component não pode gravar cookie). `/nova-senha` só existe
    // depois disso e exige a sessão que o callback acabou de criar.
    redirectTo: `${exigirEnv('NEXT_PUBLIC_APP_URL')}/auth/callback?next=/nova-senha`,
  })

  if (error?.status === 429) throw AppError.limiteDeTaxa(60)

  // Fora o excesso de tentativas, a resposta é sempre a mesma: dizer "esse
  // e-mail não existe" transforma a tela de recuperar senha numa lista de
  // clientes do CICLO.
  return { status: 'se_existir_enviamos' }
})
