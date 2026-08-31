import { createHash } from 'node:crypto'

import { verificarCaptcha } from '@/server/services/captcha'
import { criarAgendamentoPublico, EsquemaBookingPublico } from '@/server/services/public-booking'
import { limitador } from '@/server/services/rate-limit'
import { normalizarTelefoneBR } from '@/server/services/telefone'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { ipDe } from '@/server/http/ip'

type Ctx = { params: Promise<{ slug: string }> }

/** Honeypot: resposta com a mesma forma de sucesso, para não ensinar o script a se adaptar. */
const RESPOSTA_HONEYPOT = { appointmentId: null, reconhecimentoToken: null }

export const POST = rota(async (req, ctx) => {
  const { slug } = await (ctx as Ctx).params
  const entrada = await lerCorpo(req, EsquemaBookingPublico)

  // Honeypot (G100/TICKET-027): campo que só script preenche. A resposta é a
  // mesma de sucesso — dizer "bloqueado" ensinaria o próprio script a se
  // adaptar. Nada é criado.
  if (entrada.website) return RESPOSTA_HONEYPOT

  const ip = ipDe(req)

  // TICKET-027, literal: 5/min por IP, 3 agendamentos por telefone por dia, 20 por IP por dia.
  const porIpMinuto = await limitador(`book:ip:${ip}:min`, { limite: 5, janelaSegundos: 60 })
  if (!porIpMinuto.permitido) throw AppError.limiteDeTaxa(60)

  const porIpDia = await limitador(`book:ip:${ip}:dia`, { limite: 20, janelaSegundos: 86_400 })
  if (!porIpDia.permitido) throw AppError.limiteDeTaxa(3600)

  const telefoneNormalizado = normalizarTelefoneBR(entrada.phone)
  if (telefoneNormalizado) {
    // Hash do telefone na chave do limitador, nunca o número em claro — a
    // regra 9/10 do CLAUDE.md vale também para dado que só passa pela
    // memória do limitador, não só pelo banco.
    const chaveTelefone = createHash('sha256').update(telefoneNormalizado).digest('hex')
    const porTelefoneDia = await limitador(`book:tel:${chaveTelefone}:dia`, { limite: 3, janelaSegundos: 86_400 })
    if (!porTelefoneDia.permitido) throw AppError.limiteDeTaxa(3600)
  }

  const captchaOk = await verificarCaptcha(entrada.captchaToken ?? undefined)
  if (!captchaOk) throw AppError.validacao({ captchaToken: 'Não conseguimos confirmar que você não é um robô. Tente de novo.' })

  // TICKET-027: "resposta idêntica para telefone já existe e telefone novo".
  // `appointmentId` não vaza essa diferença — é sempre um agendamento novo,
  // reaproveitar o *cliente* pelo telefone (dentro de `resolverCliente`) não
  // muda a forma da resposta.
  return criarAgendamentoPublico(slug, entrada)
})
