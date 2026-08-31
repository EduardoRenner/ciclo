import { limitador } from '@/server/services/rate-limit'

import { AppError } from './errors'
import { ipDe } from './ip'

/**
 * Limite por IP das rotas que **qualquer um alcança sem sessão**.
 *
 * ## Por que isto existe (auditoria de segurança de 31/08/2026)
 *
 * A auditoria anterior (achado S4) colocou limite próprio em `book` e `availability` e parou aí.
 * Medido agora: das **11** rotas sob `api/v1/public/`, **9 não tinham limite nenhum** — só o teto
 * global de 120/min do `rota()`, que é `somenteMemoria: true` de propósito e portanto **não conta
 * entre instâncias**. Num deploy serverless isso quer dizer que o teto global vale por lambda
 * viva, não por IP: quem abre conexões o suficiente para espalhar entre instâncias passa por ele.
 *
 * O que estava exposto sem limite compartilhado, e por que cada um importa:
 *
 * - `GET /{slug}` — perfil público inteiro (serviços, profissionais, horário, avaliações,
 *   portfólio) em várias consultas por chamada. É a rota mais barata de abusar e a mais cara de
 *   servir; e os slugs são enumeráveis pelo `sitemap.xml`.
 * - os **quatro** links assinados que MUDAM estado — confirmar/cancelar agendamento, aprovar/
 *   recusar orçamento, reivindicar vaga da lista de espera. O HMAC impede forjar (assinatura
 *   completa de sha256, comparada em tempo constante), mas um token que vazou — link reencaminhado
 *   num grupo de WhatsApp é o caso comum — podia ser martelado sem teto.
 * - `POST /reviews/{token}` — escreve linha no banco.
 * - `GET /reconhecer` — quatro idas ao banco por chamada.
 *
 * ## O limite NÃO substitui a autenticação de cada rota
 *
 * Token assinado continua sendo o que autoriza; isto só impede volume. As duas coisas são
 * necessárias e nenhuma cobre a outra.
 *
 * ## Escopo separado por rota, de propósito
 *
 * A chave leva o `escopo` para o balde de uma rota não gastar o da outra: quem está confirmando
 * o próprio agendamento não pode ser bloqueado porque outra pessoa atrás do mesmo NAT estava
 * abrindo páginas de salão.
 */
export async function limitarRotaPublica(
  req: Request,
  escopo: string,
  opcoes?: { limite?: number; janelaSegundos?: number },
): Promise<void> {
  const limite = opcoes?.limite ?? LIMITE_LEITURA.limite
  const janelaSegundos = opcoes?.janelaSegundos ?? LIMITE_LEITURA.janelaSegundos

  const { permitido } = await limitador(`pub:${escopo}:${ipDe(req)}`, { limite, janelaSegundos })
  if (!permitido) throw AppError.limiteDeTaxa(janelaSegundos)
}

/**
 * Leitura pública: a pessoa abre a página, talvez recarregue, talvez espie outro dia. 60/min é
 * folgado para isso e apertado para script que varre.
 */
export const LIMITE_LEITURA = { limite: 60, janelaSegundos: 60 }

/**
 * Ação por link assinado (confirmar, cancelar, aprovar, recusar, reivindicar, avaliar). Quem
 * recebeu o link clica **uma vez**; 10/min já cobre errar o toque e recarregar com folga.
 */
export const LIMITE_ACAO = { limite: 10, janelaSegundos: 60 }
