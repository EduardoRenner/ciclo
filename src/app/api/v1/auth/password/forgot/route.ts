import { createHash } from 'node:crypto'

import { EsquemaEsqueciSenha } from '@/server/auth/schemas'
import { criarClienteDoUsuario, exigirEnv } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { limitador } from '@/server/services/rate-limit'

/**
 * Auditoria de segurança de 31/08/2026. O Supabase Auth tem limite próprio de e-mail, e a rota
 * já traduzia o 429 dele — mas esse limite é **do projeto inteiro**, não por IP nem por
 * destinatário. Ou seja: um script batendo aqui com o e-mail de uma pessoa só queimava a cota de
 * e-mail do CICLO inteiro, e a partir daí **ninguém** conseguia confirmar cadastro nem recuperar
 * senha. Um atacante derrubava o onboarding de todos os salões sem precisar de conta.
 *
 * Dois baldes, porque são dois abusos diferentes:
 * - por IP, contra o script que varre muitos e-mails;
 * - por DESTINATÁRIO, contra o assédio de encher a caixa de uma pessoa específica (e esse
 *   sobrevive a trocar de IP, que é justamente o que um atacante faz).
 *
 * O e-mail entra na chave como hash, nunca em claro: chave de limitador vira log e memória
 * compartilhada (mesma regra que `book` já aplica ao telefone).
 */
const LIMITE_POR_EMAIL = { limite: 3, janelaSegundos: 3600 }

export const POST = rota(async (req) => {
  await limitarRotaPublica(req, 'senha-esqueci', { limite: 5, janelaSegundos: 600 })

  const { email } = await lerCorpo(req, EsquemaEsqueciSenha)

  const chaveEmail = createHash('sha256').update(email.toLowerCase()).digest('hex')
  const porEmail = await limitador(`senha-esqueci:email:${chaveEmail}`, LIMITE_POR_EMAIL)
  // Responde a MESMA coisa do caminho feliz quando estoura: dizer "esse e-mail pediu demais"
  // devolveria a confirmação de existência que o resto da rota existe pra esconder.
  if (!porEmail.permitido) return { status: 'se_existir_enviamos' }

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
