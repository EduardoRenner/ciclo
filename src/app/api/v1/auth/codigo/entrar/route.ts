import { createHash } from 'node:crypto'

import { EsquemaEntrarComCodigo } from '@/server/auth/schemas'
import { apagarContaVaziaDoLoginPorNumero } from '@/server/db/with-tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { limitador } from '@/server/services/rate-limit'

/**
 * Login por número, passo 2 (docs/110 L1): confere o código e abre a sessão.
 *
 * A sessão só nasce de `verifyOtp`. Nenhum caminho desta rota entra sem o código certo, e a guarda
 * `login-por-numero-pede-codigo` reprova se aparecer outro jeito de criar sessão aqui.
 *
 * O aparelho fica lembrado pelo próprio refresh token do Auth, guardado em cookie pelo cliente do
 * servidor: a pessoa só digita código de novo se sair da conta ou trocar de aparelho.
 */
const TENTATIVAS_POR_NUMERO = { limite: 8, janelaSegundos: 900 }

export const POST = rota(async (req) => {
  await limitarRotaPublica(req, 'codigo-entrar', { limite: 20, janelaSegundos: 300 })

  const { telefone, codigo } = await lerCorpo(req, EsquemaEntrarComCodigo)

  // Seis dígitos são um milhão de combinações: sem este balde, dá para chutar o código.
  const chave = createHash('sha256').update(telefone).digest('hex')
  const porNumero = await limitador(`codigo:entrar:${chave}`, TENTATIVAS_POR_NUMERO)
  if (!porNumero.permitido) throw AppError.limiteDeTaxa(TENTATIVAS_POR_NUMERO.janelaSegundos)

  const db = await criarClienteDoUsuario()
  const { data, error } = await db.auth.verifyOtp({ phone: telefone, token: codigo, type: 'sms' })

  if (error || !data.session || !data.user) {
    if (error?.status === 429) throw AppError.limiteDeTaxa(60)
    throw new AppError('UNAUTHENTICATED', { message: 'Código errado ou vencido. Confira ou peça outro.' })
  }

  const { data: vinculos } = await db
    .from('memberships')
    .select('role, tenants ( id, name, slug, vertical )')
    .eq('user_id', data.user.id)
    .eq('active', true)
  const negocios = (vinculos ?? []).filter((v) => v.tenants !== null)

  if (negocios.length === 0) {
    const { data: emOutraConta } = await db.rpc('telefone_em_outra_conta')
    if (emOutraConta) {
      await db.auth.signOut()
      const apagou = await apagarContaVaziaDoLoginPorNumero(data.user.id)
      if (!apagou) console.warn(JSON.stringify({ level: 'warn', event: 'conta_vazia_do_login_por_numero_ficou' }))
      throw new AppError('PHONE_IN_EMAIL_ACCOUNT')
    }
  }

  // Mesma regra do login por e-mail: quem cadastrou segundo fator passa pelo desafio.
  const { data: nivel } = await db.auth.mfa.getAuthenticatorAssuranceLevel()
  if (nivel && nivel.currentLevel === 'aal1' && nivel.nextLevel === 'aal2') {
    const { data: fatores } = await db.auth.mfa.listFactors()
    const fator = fatores?.totp.find((f) => f.status === 'verified')
    if (fator) return { mfaRequired: true, factorId: fator.id }
  }

  return {
    user: { id: data.user.id },
    tenants: negocios.map((v) => ({ ...v.tenants, role: v.role })),
  }
})
