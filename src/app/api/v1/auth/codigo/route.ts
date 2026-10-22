import { createHash } from 'node:crypto'

import { modoDoCodigo } from '@/server/auth/login-por-numero'
import { EsquemaPedirCodigo } from '@/server/auth/schemas'
import { numeroTemCadastro } from '@/server/db/with-tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { pedirCodigoDeAcesso } from '@/server/services/codigo-de-acesso'
import { limitador } from '@/server/services/rate-limit'
import { hashTelefone } from '@/server/services/telefone'

/**
 * Login por número, passo 1 (docs/119): manda o código de 6 dígitos pelo WhatsApp (Twilio Verify),
 * **só para número já cadastrado**. A regra de resposta neutra mora em `pedirCodigoDeAcesso`.
 *
 * Três baldes: por IP (script varrendo números), por número (alguém bombardeando o WhatsApp de uma
 * pessoa) e o `max_frequency` do próprio Auth. Os dois primeiros contam antes de olhar o cadastro.
 */
const LIMITE_POR_NUMERO = { limite: 5, janelaSegundos: 3600 }

function hashOuNulo(e164: string): string | null {
  try {
    return hashTelefone(e164)
  } catch {
    return null
  }
}

export const POST = rota(async (req) => {
  await limitarRotaPublica(req, 'codigo-de-acesso', { limite: 10, janelaSegundos: 600 })

  const { telefone } = await lerCorpo(req, EsquemaPedirCodigo)
  const modo = modoDoCodigo()
  const chave = createHash('sha256').update(telefone).digest('hex')

  return pedirCodigoDeAcesso({
    modo,
    janelaDoLimiteSegundos: LIMITE_POR_NUMERO.janelaSegundos,
    limitarPorNumero: async () => (await limitador(`codigo:numero:${chave}`, LIMITE_POR_NUMERO)).permitido,
    temCadastro: () => numeroTemCadastro(telefone, hashOuNulo(telefone)),
    enviar: async (canal) => {
      const db = await criarClienteDoUsuario()
      // `shouldCreateUser: true` só porque a cliente cadastrada num negócio ainda não tem conta no
      // Auth: quem chega aqui já passou por `temCadastro`. Número desconhecido nunca chega.
      const { error } = await db.auth.signInWithOtp({
        phone: telefone,
        options: { shouldCreateUser: true, channel: canal, data: { phone: telefone } },
      })
      return error ? { ok: false, motivo: `${error.status ?? ''} ${error.code ?? ''}`.trim() } : { ok: true }
    },
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    agora: () => Date.now(),
    registrar: (evento, extra) => console.warn(JSON.stringify({ level: 'warn', event: evento, ...extra })),
  })
})
