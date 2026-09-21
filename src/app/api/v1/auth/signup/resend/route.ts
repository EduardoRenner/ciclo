import { createHash } from 'node:crypto'

import { EsquemaEsqueciSenha } from '@/server/auth/schemas'
import { criarClienteDoUsuario, exigirEnv } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { limitador } from '@/server/services/rate-limit'

/**
 * Reenvia o e-mail de confirmação de cadastro. Mesma disciplina de `password/forgot` (auditoria
 * de segurança de 31/08/2026): o limite de e-mail do Supabase é do PROJETO inteiro, não por IP
 * nem por destinatário — sem os dois baldes daqui, um script batendo nesta rota com um e-mail só
 * queimaria a cota de confirmação de TODO o CICLO, derrubando o cadastro de todo mundo.
 *
 * `EsquemaEsqueciSenha` reaproveitada de propósito: é `{ email: z.email(...) }`, exatamente o
 * corpo que esta rota também precisa — criar um schema igual do zero seria a mesma fórmula
 * duplicada duas vezes.
 */
const LIMITE_POR_EMAIL = { limite: 3, janelaSegundos: 3600 }

export const POST = rota(async (req) => {
  await limitarRotaPublica(req, 'confirmacao-reenviar', { limite: 5, janelaSegundos: 600 })

  const { email } = await lerCorpo(req, EsquemaEsqueciSenha)

  const chaveEmail = createHash('sha256').update(email.toLowerCase()).digest('hex')
  const porEmail = await limitador(`confirmacao-reenviar:email:${chaveEmail}`, LIMITE_POR_EMAIL)
  // Mesma resposta do caminho feliz quando estoura: a pessoa acabou de se cadastrar com este
  // e-mail, então não há o que esconder sobre ele existir — só não vale reenviar sem parar.
  if (!porEmail.permitido) return { status: 'reenviado' }

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${exigirEnv('NEXT_PUBLIC_APP_URL')}/auth/callback` },
  })

  if (error?.status === 429) throw AppError.limiteDeTaxa(60)

  // Fora o excesso de tentativas, a resposta é sempre a mesma — se o e-mail já foi confirmado ou
  // nunca existiu, o Supabase recusa em silêncio, e reenviar erro aqui só confundiria quem só
  // quer tentar de novo.
  return { status: 'reenviado' }
})
