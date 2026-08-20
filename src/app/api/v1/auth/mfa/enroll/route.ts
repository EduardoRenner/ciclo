import { exigirSessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

/**
 * docs/09-PLATAFORMA.md §19 (achado em V2/verificação estrutural): `exigirAal2()` trava
 * exportar dado, apagar cliente (LGPD) e o cofre de saúde — mas não existia NENHUM jeito de
 * cadastrar o segundo fator, então essas três rotas eram permanentemente inacessíveis. Esta
 * rota é o primeiro passo: pede o QR code pro Supabase Auth (TOTP nativo, sem tabela nova).
 */
export const POST = rota(async () => {
  await exigirSessao()
  const db = await criarClienteDoUsuario()

  const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw new AppError('INTERNAL', { cause: error })

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
})
