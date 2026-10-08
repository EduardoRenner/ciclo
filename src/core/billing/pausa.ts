/**
 * C5 (docs/86 e 87): a conta PAUSADA lê e exporta tudo, mas não cria nada novo (Termos §5). Este
 * arquivo é o único que responde "esta escrita é recusada na pausa?", e responde para CADA rota de
 * escrita da API, uma por uma.
 *
 * **Por que uma tabela e não um `if` em cada rota.** Das 93 rotas que escrevem, 16 passavam por uma
 * trava de plano; as outras 77 deixavam a conta pausada criar à vontade. Um `if` por rota é o que
 * esquece a rota 94. Aqui a regra é de PORTA: `contextoAtual` (por onde toda rota autenticada passa)
 * consulta esta tabela, e rota que não está nela é **recusada** (negar por padrão). Há guarda que
 * enumera os arquivos `route.ts` e reprova a rota nova que ninguém classificou.
 *
 * Valores:
 * - `bloqueia`: cria algo novo para o negócio, ou gasta o que o negócio paga (mensagem, crédito).
 * - `permite`: mexe no que já existe (editar, cancelar, concluir, apagar), é configuração do próprio
 *   negócio, ou é obrigação da conta (assinar, cancelar assinatura, exportar, apagar, LGPD).
 * - `fora`: NÃO passa por `contextoAtual` (login, webhook, página pública); a trava não alcança por
 *   construção. As públicas que criam algo no negócio (agendar, pedir orçamento) têm a checagem
 *   própria, em `server/services/pausa-publica.ts`.
 *
 * Quem classificar `permite` uma rota que cria algo novo abre um buraco que ninguém vê: o teste de
 * dado real (`pausa-por-rota`) só enumera, não julga. A pergunta a fazer é "o negócio ganha uma
 * linha nova que não tinha?". Se sim, `bloqueia`.
 */
export type RegraNaPausa = 'bloqueia' | 'permite' | 'fora'

export const ROTAS_DE_ESCRITA: Readonly<Record<string, RegraNaPausa>> = {
  'DELETE v1/account': 'fora',
  'POST v1/appointments/[id]/arrive': 'permite',
  'POST v1/appointments/[id]/complete': 'permite',
  'POST v1/appointments/[id]/confirm': 'permite',
  'POST v1/appointments/[id]/no-show': 'permite',
  'PATCH v1/appointments/[id]': 'permite',
  'DELETE v1/appointments/[id]': 'permite',
  'POST v1/appointments': 'bloqueia',
  'POST v1/appointments/series/[id]/cancel': 'permite',
  'POST v1/appointments/series': 'bloqueia',
  'POST v1/assistant/rapido': 'permite',
  'POST v1/assistant': 'permite',
  'POST v1/auth/login': 'fora',
  'POST v1/auth/logout': 'fora',
  'POST v1/auth/mfa/enroll': 'fora',
  'DELETE v1/auth/mfa/factors/[id]': 'fora',
  'POST v1/auth/mfa/verify': 'fora',
  'POST v1/auth/password/forgot': 'fora',
  'POST v1/auth/password/reset': 'fora',
  'POST v1/auth/signup/resend': 'fora',
  'POST v1/auth/signup': 'fora',
  'POST v1/billing/assinar': 'permite',
  'POST v1/billing/cancelar': 'permite',
  'POST v1/campaigns': 'bloqueia',
  'DELETE v1/clients/[id]/consents/[kind]': 'permite',
  'POST v1/clients/[id]/consents': 'permite',
  'POST v1/clients/[id]/erase': 'permite',
  'POST v1/clients/[id]/loyalty': 'bloqueia',
  'POST v1/clients/[id]/media': 'bloqueia',
  'POST v1/clients/[id]/notes': 'bloqueia',
  'PATCH v1/clients/[id]': 'permite',
  'DELETE v1/clients/[id]': 'permite',
  'POST v1/clients/[id]/subscription': 'bloqueia',
  'DELETE v1/clients/[id]/subscription': 'permite',
  'PUT v1/clients/[id]/vault': 'bloqueia',
  'POST v1/clients/import/preview': 'bloqueia',
  'POST v1/clients/import': 'bloqueia',
  'POST v1/clients/ja-atendo': 'bloqueia',
  'POST v1/clients': 'bloqueia',
  'POST v1/cycle/recover/manual': 'bloqueia',
  'POST v1/cycle/recover/send': 'bloqueia',
  'POST v1/cycles/recompute': 'permite',
  'POST v1/experiments/[id]/cancel': 'permite',
  'POST v1/experiments': 'bloqueia',
  'POST v1/inventory/entries': 'bloqueia',
  'POST v1/media/[id]/publish': 'bloqueia',
  'DELETE v1/media/[id]/publish': 'permite',
  'DELETE v1/media/[id]': 'permite',
  'POST v1/memberships/accept': 'fora',
  'POST v1/memberships/invite': 'bloqueia',
  // docs/101 (pacote Advocacia): criar caso é linha nova; agir numa pendência mexe no que existe.
  'POST v1/legal/cases': 'bloqueia',
  'PATCH v1/legal/checklist/[id]': 'permite',
  // triagem é obrigação (prazo que nasce dela não pode esperar a conta voltar a pagar)
  'POST v1/legal/intimations/[id]/decide': 'permite',
  'PATCH v1/message-templates/[id]': 'permite',
  'DELETE v1/message-templates/[id]': 'permite',
  'POST v1/message-templates': 'bloqueia',
  'POST v1/onboarding/perfil': 'permite',
  'POST v1/onboarding': 'fora',
  'POST v1/packages/[id]/use': 'permite',
  'POST v1/packages': 'bloqueia',
  'PATCH v1/products/[id]': 'permite',
  'POST v1/products': 'bloqueia',
  'PUT v1/professionals/[id]/business-hours': 'permite',
  'PATCH v1/professionals/[id]': 'permite',
  'DELETE v1/professionals/[id]': 'permite',
  'POST v1/professionals': 'bloqueia',
  'POST v1/public/[slug]/book': 'fora',
  'POST v1/public/[slug]/quote-request': 'fora',
  'POST v1/public/appointments/cancel/[token]': 'fora',
  'POST v1/public/appointments/confirm/[token]': 'fora',
  'POST v1/public/quotes/[token]/approve': 'fora',
  'POST v1/public/quotes/[token]/reject': 'fora',
  'POST v1/public/reviews/[token]': 'fora',
  'POST v1/public/waitlist/claim/[token]': 'fora',
  'POST v1/push/subscriptions': 'permite',
  'DELETE v1/push/subscriptions': 'permite',
  'POST v1/quotes/[id]/convert': 'bloqueia',
  'POST v1/quotes': 'bloqueia',
  'PUT v1/services/[id]/consumption': 'permite',
  'PATCH v1/services/[id]': 'permite',
  'DELETE v1/services/[id]': 'permite',
  'POST v1/services/reorder': 'permite',
  'POST v1/services': 'bloqueia',
  'POST v1/subscription-plans': 'bloqueia',
  // docs/101 T4.6: regras de contagem e OAB da equipe são configuração do próprio escritório
  'PATCH v1/tenant/advocacia': 'permite',
  'PATCH v1/tenant/automacoes': 'permite',
  'PATCH v1/tenant/fixed-cost': 'permite',
  'PATCH v1/tenant/loyalty-config': 'permite',
  'PATCH v1/tenant/modules': 'permite',
  'PATCH v1/tenant/payment-fees': 'permite',
  'PATCH v1/tenant': 'permite',
  'POST v1/tenant/vitrine/entidade': 'bloqueia',
  'DELETE v1/tenant/vitrine/entidade': 'permite',
  'POST v1/tenant/vitrine': 'bloqueia',
  'DELETE v1/tenant/vitrine': 'permite',
  'POST v1/tickets/[id]/cancel': 'permite',
  'POST v1/tickets/[id]/close': 'permite',
  'DELETE v1/tickets/[id]/items/[itemId]': 'permite',
  'POST v1/tickets/[id]/items': 'bloqueia',
  'PATCH v1/tickets/[id]': 'permite',
  'DELETE v1/time-off/[id]': 'permite',
  'POST v1/time-off': 'bloqueia',
  'POST v1/waitlist': 'bloqueia',
  'POST v1/wallet/credit': 'bloqueia',
  'POST v1/wallet/debit': 'permite',
  'POST v1/webhooks/mercado-pago': 'fora',
  'POST webhooks/whatsapp': 'fora',
}

const METODOS_DE_ESCRITA: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

type Padrao = { chave: string; regra: RegraNaPausa; metodo: string; re: RegExp; dinamicos: number }

/** `v1/clients/[id]/notes` vira um regex ancorado; `[x]` casa um segmento qualquer. */
const PADROES: readonly Padrao[] = Object.entries(ROTAS_DE_ESCRITA)
  .map(([chave, regra]): Padrao => {
    const [metodo, caminho] = chave.split(' ') as [string, string]
    const segmentos = caminho.split('/')
    // Os segmentos fixos das rotas só têm letras e hífen: não há o que escapar.
    const re = new RegExp('^' + segmentos.map((s) => (s.startsWith('[') ? '[^/]+' : s)).join('/') + '$')
    return { chave, regra, metodo, re, dinamicos: segmentos.filter((s) => s.startsWith('[')).length }
  })
  // Segmento fixo antes do dinâmico: `clients/import` ganha de `clients/[id]`.
  .sort((a, b) => a.dinamicos - b.dinamicos)

/**
 * A regra desta escrita. `GET`/`HEAD` nunca são recusados. Escrita que a tabela não conhece vira
 * `bloqueia`: errar para o lado de recusar é recuperável (a pessoa assina e volta na hora); errar
 * para o outro lado deixa a conta pausada criar sem ninguém notar.
 */
export function regraDaEscritaNaPausa(metodo: string, pathname: string): RegraNaPausa | 'leitura' {
  const m = metodo.toUpperCase()
  if (!METODOS_DE_ESCRITA.has(m)) return 'leitura'
  const caminho = pathname.replace(/^\/api\//, '').replace(/\/+$/, '')
  const achou = PADROES.find((p) => p.metodo === m && p.re.test(caminho))
  return achou?.regra ?? 'bloqueia'
}
