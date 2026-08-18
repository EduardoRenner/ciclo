import { exigirSenhaForte } from '@/server/auth/password'
import { EsquemaCadastro } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const POST = rota(async (req) => {
  const { email, password, fullName, phone } = await lerCorpo(req, EsquemaCadastro)

  await exigirSenhaForte(password)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.signUp({
    email,
    password,
    // A trigger `on_auth_user_created` (migration 0006) lê estes campos para
    // montar a linha de `profiles`.
    options: { data: { full_name: fullName, phone } },
  })

  if (error) {
    const status = error.status ?? 500

    // Só o excesso de tentativas volta como erro: a pessoa precisa saber que é
    // para esperar, e isso não diz se o e-mail existe.
    if (status === 429) throw AppError.limiteDeTaxa(60)

    // Falha de infraestrutura não pode virar "enviamos o e-mail" — a pessoa
    // ficaria esperando uma mensagem que nunca sai.
    if (status >= 500) throw new AppError('INTERNAL', { cause: error })

    console.warn(JSON.stringify({ level: 'warn', event: 'signup_recusado', status }))
  }

  // Daqui para baixo a resposta é idêntica para e-mail novo e e-mail já
  // cadastrado. A diferença transformaria o cadastro num verificador de quem tem
  // conta no CICLO; quem já tem recebe um e-mail dizendo isso, quem não tem
  // recebe o link de confirmação.
  return { status: 'confirmacao_enviada' }
})
