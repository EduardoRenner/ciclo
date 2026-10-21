import { cookies } from 'next/headers'

import { COOKIE_TENANT } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'

export const POST = rota(async () => {
  const db = await criarClienteDoUsuario()

  // `scope: 'global'` invalida também os refresh tokens dos outros aparelhos. É o
  // que a pessoa espera quando sai da conta por ter perdido o celular; sair só
  // deste navegador não protege ninguém.
  await db.auth.signOut({ scope: 'global' })
  // O estabelecimento lembrado é do aparelho, não da pessoa: quem entrar depois não o herda (docs/112, 21/10).
  ;(await cookies()).delete(COOKIE_TENANT)

  return { status: 'saiu' }
})
