import { exigirSessao } from '@/server/auth/session'
import { EsquemaVerificarMfa } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitador } from '@/server/services/rate-limit'

/**
 * Mesma rota serve os dois momentos em que alguém digita o código de 6 dígitos: terminar de
 * cadastrar o fator (depois do QR code) e o desafio de cada login novo — `challengeAndVerify`
 * do Supabase faz as duas coisas (challenge + verify) numa chamada só, e o resultado é o
 * mesmo nos dois casos: a sessão sobe de `aal1` para `aal2`.
 */

/**
 * Auditoria de segurança de 31/08/2026 — **o achado mais grave da rodada**.
 *
 * Esta rota não tinha limite nenhum, e é a que menos podia ficar sem: o código é de **6 dígitos**,
 * ou seja 1.000.000 de combinações, e quem chega aqui **já passou pela senha** (`exigirSessao`
 * aceita `aal1`, que é exatamente o nível que `signInWithPassword` devolve antes do segundo
 * fator). Então o cenário não é hipotético: atacante com a senha vazada abre a sessão `aal1` e
 * martela o segundo fator até acertar. Sem teto, o 2FA vira decoração — a defesa que existe
 * justamente para o caso de a senha ter vazado.
 *
 * O balde é por **usuário**, não por IP: o IP é a parte que o atacante troca de graça (proxy,
 * celular, botnet), a conta alvo é a que ele não troca. `exigirSessao()` já identifica o dono,
 * então a chave é confiável — não vem do corpo da requisição.
 *
 * 8 em 10 minutos: quem está digitando de verdade erra o código uma ou duas vezes (relógio
 * dessincronizado, código que virou entre ler e digitar), nunca oito. Para o atacante, o teto
 * transforma 1.000.000 de tentativas em ~48/hora — passa de horas para séculos.
 */
const LIMITE_CODIGO = { limite: 8, janelaSegundos: 600 }

export const POST = rota(async (req) => {
  const sessao = await exigirSessao()

  const { permitido } = await limitador(`mfa-verify:user:${sessao.userId}`, LIMITE_CODIGO)
  if (!permitido) throw AppError.limiteDeTaxa(LIMITE_CODIGO.janelaSegundos)

  const { factorId, code } = await lerCorpo(req, EsquemaVerificarMfa)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw AppError.validacao({ code: 'Código incorreto ou expirado. Confira no app e tente de novo.' })

  return { ok: true }
})
