import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'

export const POST = rota(async () => {
  const db = await criarClienteDoUsuario()

  // `scope: 'global'` invalida também os refresh tokens dos outros aparelhos. É o
  // que a pessoa espera quando sai da conta por ter perdido o celular; sair só
  // deste navegador não protege ninguém.
  await db.auth.signOut({ scope: 'global' })

  return { status: 'saiu' }
})
