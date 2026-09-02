import { createHash } from 'node:crypto'

import { motivoDaRecusa } from '@/core/auth/motivo-da-recusa'
import { EsquemaLogin } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { limitador } from '@/server/services/rate-limit'

/**
 * Auditoria de segurança de 31/08/2026. A decisão registrada em `ip.ts` era "quem limita tentativa
 * de senha é o próprio Supabase Auth, do lado dele" — e limita mesmo, **só que por projeto**,
 * como o achado do `password/forgot` desta mesma rodada mostrou. Não é por IP nem por conta.
 *
 * Dois baldes, porque são dois ataques diferentes e nenhum cobre o outro:
 * - por **conta** (e-mail em hash): credential stuffing mirando uma pessoa. Sobrevive a trocar de
 *   IP, que é o que o atacante faz de graça;
 * - por **IP**: spray de uma senha comum contra muitas contas — cada conta leva poucas tentativas,
 *   então o balde por conta nunca dispara, mas o volume vindo do mesmo lugar é gritante.
 *
 * Só a resposta 429 muda; a mensagem de credencial errada continua idêntica para "e-mail não
 * existe" e "senha errada", pelo motivo já escrito abaixo.
 */
const LIMITE_POR_CONTA = { limite: 10, janelaSegundos: 900 }

export const POST = rota(async (req) => {
  await limitarRotaPublica(req, 'login', { limite: 30, janelaSegundos: 300 })

  const { email, password } = await lerCorpo(req, EsquemaLogin)

  const chaveConta = createHash('sha256').update(email.toLowerCase()).digest('hex')
  const porConta = await limitador(`login:conta:${chaveConta}`, LIMITE_POR_CONTA)
  if (!porConta.permitido) throw AppError.limiteDeTaxa(LIMITE_POR_CONTA.janelaSegundos)

  const db = await criarClienteDoUsuario()
  const { data, error } = await db.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    if (error?.status === 429) throw AppError.limiteDeTaxa(60)

    /*
     * Nem toda recusa do Auth é senha errada. Dizer que é tranca a pessoa num laço — ela retipa,
     * troca a senha, retipa de novo — e o motivo real nunca aparece. A regra de QUAL recusa é
     * sobre credencial mora em `core/auth/motivo-da-recusa.ts`, com o porquê de cada código.
     */
    if (motivoDaRecusa(error?.code) === 'outro') {
      // O motivo real fica no log do servidor: é o que torna a falha diagnosticável sem contar
      // nada a quem está do outro lado.
      console.warn(JSON.stringify({ level: 'warn', event: 'login_recusado_sem_ser_credencial', codigo: error?.code }))
      throw new AppError('UNAUTHENTICATED', {
        message: 'Não consegui verificar seu acesso agora. Não é problema com a sua senha — tente de novo em instantes.',
      })
    }

    // Uma única mensagem para "e-mail não existe" e "senha errada": separar as
    // duas entrega a lista de quem tem conta.
    throw new AppError('UNAUTHENTICATED', { message: 'E-mail ou senha não conferem.' })
  }

  // Senha certa não é a sessão inteira quando a conta tem segundo fator: `signInWithPassword`
  // sempre devolve uma sessão `aal1`, mesmo com TOTP cadastrado — quem decide exigir o
  // desafio é a aplicação, olhando `nextLevel`. Sem essa checagem, a tela de código nunca
  // apareceria e o "segundo fator" seria só decoração.
  const { data: nivel } = await db.auth.mfa.getAuthenticatorAssuranceLevel()
  if (nivel && nivel.currentLevel === 'aal1' && nivel.nextLevel === 'aal2') {
    const { data: fatores } = await db.auth.mfa.listFactors()
    const fator = fatores?.totp.find((f) => f.status === 'verified')
    if (fator) return { mfaRequired: true, factorId: fator.id }
  }

  // A RLS de `memberships` já limita ao próprio usuário; o filtro por `user_id` é
  // a segunda camada que a FAQ C30 pede.
  const { data: vinculos } = await db
    .from('memberships')
    .select('role, tenants ( id, name, slug, vertical )')
    .eq('user_id', data.user.id)
    .eq('active', true)

  return {
    session: {
      expiresAt: data.session.expires_at ?? null,
    },
    user: { id: data.user.id, email: data.user.email ?? '' },
    tenants: (vinculos ?? [])
      .filter((v) => v.tenants !== null)
      .map((v) => ({ ...v.tenants, role: v.role })),
  }
})
