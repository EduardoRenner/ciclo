import { createHash } from 'node:crypto'

import { EsquemaPedirCodigo } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitarRotaPublica } from '@/server/http/limite-publico'
import { limitador } from '@/server/services/rate-limit'

/**
 * Login por número, passo 1 (docs/110 L1): manda o código de 6 dígitos pelo WhatsApp.
 *
 * **A resposta é a mesma exista conta ou não.** O código sai sempre, e a conta só nasce de verdade
 * quando alguém digita o código certo. Responder diferente para número com conta entregaria a lista
 * de quem usa o CICLO, mesmo motivo da mensagem única do login por e-mail.
 *
 * Cada código é uma mensagem paga da Meta, então são três baldes: por IP (script varrendo números),
 * por número (alguém bombardeando o WhatsApp de uma pessoa) e o `max_frequency` do próprio Auth.
 */
const LIMITE_POR_NUMERO = { limite: 5, janelaSegundos: 3600 }

export const POST = rota(async (req) => {
  await limitarRotaPublica(req, 'codigo-de-acesso', { limite: 10, janelaSegundos: 600 })

  const { telefone, nome } = await lerCorpo(req, EsquemaPedirCodigo)

  const chave = createHash('sha256').update(telefone).digest('hex')
  const porNumero = await limitador(`codigo:numero:${chave}`, LIMITE_POR_NUMERO)
  if (!porNumero.permitido) throw AppError.limiteDeTaxa(LIMITE_POR_NUMERO.janelaSegundos)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.signInWithOtp({
    phone: telefone,
    options: { shouldCreateUser: true, data: { full_name: nome, phone: telefone } },
  })

  if (error) {
    if (error.status === 429) throw AppError.limiteDeTaxa(60)
    console.warn(JSON.stringify({ level: 'warn', event: 'codigo_de_acesso_recusado', codigo: error.code, status: error.status }))
    throw new AppError('CODE_UNAVAILABLE')
  }

  return { enviado: true }
})
