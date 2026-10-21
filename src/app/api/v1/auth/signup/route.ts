import { cookies } from 'next/headers'

import { COOKIE_ORIGEM, lerOrigem, serializarOrigem } from '@/core/aquisicao/origem'
import { desfechoDoCadastro } from '@/server/auth/desfecho-do-cadastro'
import { exigirSenhaForte, SENHA_MINIMA } from '@/server/auth/password'
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

  const { password, fullName, phone } = await lerCorpo(req, EsquemaCadastro)

  await exigirSenhaForte(password)

  // docs/82 §6: a origem vai junto com a conta. Relida por `lerOrigem`: só entra o que já passou pelo filtro.
  const origem = lerOrigem((await cookies()).get(COOKIE_ORIGEM)?.value)

  /*
    docs/114 L-03 (decisão do Vitor, 21/10): número + senha, sem e-mail. Com `[auth.sms]
    enable_confirmations = false` o número entra sem código (o código depende da Meta) e o `signUp`
    devolve a sessão na hora. Risco aceito e anotado: sem verificar, dá para cadastrar o número de
    outra pessoa; a verificação volta quando o envio pelo WhatsApp estiver no ar.
  */
  const db = await criarClienteDoUsuario()
  const { data, error } = await db.auth.signUp({
    phone,
    password,
    options: {
      // A trigger `on_auth_user_created` (migrations 0006 e 0142) lê estes campos para montar `profiles`.
      data: { full_name: fullName, phone, ...(origem ? { origem: serializarOrigem(origem) } : {}) },
    },
  })

  /*
    Número já cadastrado: diz que já tem conta e manda entrar. Isto conta a quem digita que o número
    tem conta no CICLO; com o número como login não há como esconder sem deixar a dona de uma conta
    antiga presa num "conta criada" que não abre. O limite por IP acima segura a varredura.
  */
  if (error?.code === 'phone_exists' || error?.code === 'user_already_exists') {
    throw AppError.validacao({ phone: 'Esse número já tem conta no CICLO. Entre com ele e a sua senha.' })
  }

  // APR-025: cada recusa com a sua resposta — ver `desfechoDoCadastro`.
  const desfecho = desfechoDoCadastro(error)
  if (desfecho === 'limite') throw AppError.limiteDeTaxa(60)
  if (desfecho === 'senha_fraca') {
    throw AppError.validacao({ password: `Essa senha é curta ou fraca demais. Use pelo menos ${SENHA_MINIMA} caracteres, sem palavra óbvia.` })
  }
  if (desfecho !== 'aceito') {
    console.warn(JSON.stringify({ level: 'warn', event: 'signup_recusado', status: error?.status ?? null, code: error?.code ?? null }))
    throw new AppError('INTERNAL', { cause: error })
  }

  if (data?.session) return { status: 'conta_criada' }

  /*
    Sem sessão e sem erro é o Auth esperando um código que não vai sair: a confirmação de telefone
    está ligada no painel (passo do docs/118). Dizer "conta criada" deixaria a pessoa presa no
    login; o alarme é o que faz alguém consertar o interruptor.
  */
  console.error(JSON.stringify({ level: 'error', event: 'signup_numero_sem_sessao' }))
  throw new AppError('INTERNAL')
})
