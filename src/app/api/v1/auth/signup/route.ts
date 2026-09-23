import { cookies } from 'next/headers'

import { COOKIE_ORIGEM, lerOrigem, serializarOrigem } from '@/core/aquisicao/origem'
import { exigirSenhaForte } from '@/server/auth/password'
import { EsquemaCadastro } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'

export const POST = rota(async (req) => {
  /*
   * Mesma razão do `password/forgot` (auditoria de 31/08/2026): o limite de e-mail do Supabase
   * é do PROJETO, então cadastro em massa daqui queima a cota que o resto da plataforma precisa
   * para confirmar conta. 5 em 10 minutos por IP é folgado para gente cadastrando de verdade
   * (inclusive errando e tentando de novo) e apertado para script.
   */
  await limitarRotaPublica(req, 'cadastro', { limite: 5, janelaSegundos: 600 })

  const { email, password, fullName, phone } = await lerCorpo(req, EsquemaCadastro)

  await exigirSenhaForte(password)

  // docs/82 §6: a origem vai junto com a conta. O link de confirmação costuma abrir em OUTRO
  // navegador (o do app de e-mail), sem o cookie — sem isto a atribuição se perdia justo no caminho
  // mais comum do celular. Relida por `lerOrigem`: só entra o que já passou pelo filtro.
  const origem = lerOrigem((await cookies()).get(COOKIE_ORIGEM)?.value)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      // A trigger `on_auth_user_created` (migration 0006) lê estes campos para
      // montar a linha de `profiles`.
      data: { full_name: fullName, phone, ...(origem ? { origem: serializarOrigem(origem) } : {}) },
      // Sem isso, o link do e-mail de confirmação usa o Site URL configurado
      // no painel do Supabase — que aponta pra localhost até alguém trocar lá.
      // `NEXT_PUBLIC_APP_URL` já é a variável certa (é o que o resto do app usa
      // pra montar link absoluto, ver `EsquemaEsqueciSenha`/mensageria).
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
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
