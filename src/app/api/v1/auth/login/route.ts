import { EsquemaLogin } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const POST = rota(async (req) => {
  const { email, password } = await lerCorpo(req, EsquemaLogin)

  const db = await criarClienteDoUsuario()
  const { data, error } = await db.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    if (error?.status === 429) throw AppError.limiteDeTaxa(60)
    // Uma única mensagem para "e-mail não existe" e "senha errada": separar as
    // duas entrega a lista de quem tem conta.
    throw new AppError('UNAUTHENTICATED', { message: 'E-mail ou senha não conferem.' })
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
