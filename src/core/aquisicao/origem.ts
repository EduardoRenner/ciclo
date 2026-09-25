/**
 * De onde veio cada conta nova — a atribuição de aquisição do `docs/82-MOTOR-DE-DISTRIBUICAO.md` §6.
 *
 * Antes disto o CICLO não sabia de onde vinha ninguém. Os dois laços de distribuição que o produto
 * já tinha — o selo "Feito com CICLO" na página de cada negócio e o convite de colega em
 * "Meu plano" — apontavam para a raiz pelada: um cadastro que chegasse por eles era indistinguível
 * de um que chegasse do nada. Sem isso, o plano de 30 dias não tem como responder a única pergunta
 * que ele existe para responder: **qual canal traz conta que usa**.
 *
 * O desenho é o mínimo que responde essa pergunta sem rastrear ninguém:
 *
 * - Dois campos, os dois vindos do LINK que a pessoa clicou, nunca do comportamento dela: `canal`
 *   (por onde chegou — `selo`, `convite`, `visita`, `instagram`…) e `ref` (quem indicou — o slug do
 *   negócio que mandou o convite, ou o código de um parceiro).
 * - **Primeiro toque vence.** Quem chegou pelo convite de um colega e depois voltou pelo Google foi
 *   trazido pelo colega; é a indicação que o programa de parceiros vai querer pagar.
 * - Nenhum dado pessoal. Nem IP, nem identificador de navegador — um cookie de primeira parte com
 *   o que estava escrito no link, e só enquanto a pessoa não cria a conta.
 *
 * Tudo aqui é função pura: o middleware grava, o onboarding lê, e os dois passam por `sanear`,
 * porque cookie e query string são entrada de quem quiser escrever nelas.
 */

/** Nome do cookie. Exportado para o middleware e a rota de onboarding não divergirem na grafia. */
export const COOKIE_ORIGEM = 'ciclo_origem'

/**
 * 60 dias: dono de salão decide devagar — vê a página de um colega numa semana, cria conta na
 * outra. Mais que isso e a atribuição vira arqueologia.
 */
export const VALIDADE_ORIGEM_SEGUNDOS = 60 * 24 * 60 * 60

/** Os canais que o `docs/82` §9 mede. Qualquer outro valor bem-formado cai em `outro`. */
export const CANAIS = [
  'selo',
  'convite',
  'visita',
  'instagram',
  'whatsapp',
  'google',
  'parceiro',
  'calculadora',
  'conteudo',
  'evento',
] as const

export type Canal = (typeof CANAIS)[number] | 'outro'

export type Origem = {
  canal: Canal
  /** Slug do negócio que indicou, ou código de parceiro. `null` quando o link não trazia. */
  ref: string | null
  /** `AAAA-MM-DD` do primeiro toque. */
  em: string
}

const FORMATO_SLUG = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$|^[a-z0-9]$/
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normaliza um valor vindo de fora. Minúsculo, sem espaço, no formato de slug do próprio CICLO
 * (`tenants_slug_format`) — o que não couber some, em vez de virar uma chave estranha no funil.
 */
function sanear(valor: string | null | undefined): string | null {
  if (!valor) return null
  const limpo = valor.trim().toLowerCase()
  return FORMATO_SLUG.test(limpo) ? limpo : null
}

function paraCanal(valor: string | null): Canal | null {
  if (!valor) return null
  return (CANAIS as readonly string[]).includes(valor) ? (valor as Canal) : 'outro'
}

/**
 * Lê a origem da query string de uma visita. `origem` é o parâmetro do CICLO; `utm_source` é
 * aceito porque é o que qualquer ferramenta de terceiro (Linktree, agendador de post) já escreve.
 * Um `ref` sem canal é uma indicação — o jeito mais curto de um parceiro montar o link à mão.
 *
 * Devolve `null` quando o link não diz nada: visita sem origem não grava cookie, e o primeiro
 * toque de verdade continua livre para quem vier depois.
 */
export function origemDaUrl(params: URLSearchParams, hoje: string): Origem | null {
  const ref = sanear(params.get('ref'))
  const bruto = params.get('origem') ?? params.get('utm_source')
  const canal = paraCanal(sanear(bruto))
  if (!canal && !ref) return null
  // Canal escrito mas mal formado ("Instagram Stories") é `outro`, não indicação: só um link SEM
  // canal nenhum, com `ref`, é o atalho de convite.
  const padrao: Canal = bruto?.trim() ? 'outro' : 'convite'
  return { canal: canal ?? padrao, ref, em: FORMATO_DATA.test(hoje) ? hoje : '1970-01-01' }
}

/** Valor do cookie. `URLSearchParams` escapa o que precisar — mas `sanear` já não deixou passar nada. */
export function serializarOrigem(origem: Origem): string {
  const p = new URLSearchParams({ canal: origem.canal, em: origem.em })
  if (origem.ref) p.set('ref', origem.ref)
  return p.toString()
}

/**
 * Lê o cookie de volta. Cookie é entrada do navegador: passa pelo mesmo filtro da URL e, se
 * qualquer parte não fechar, a origem inteira é descartada — melhor "sem origem" no funil do que
 * uma linha com canal inventado por alguém que editou o cookie.
 */
export function lerOrigem(valor: string | null | undefined): Origem | null {
  if (!valor) return null
  let p: URLSearchParams
  try {
    p = new URLSearchParams(valor)
  } catch {
    return null
  }
  const canal = paraCanal(sanear(p.get('canal')))
  const em = p.get('em') ?? ''
  if (!canal || !FORMATO_DATA.test(em)) return null
  const refBruto = p.get('ref')
  const ref = sanear(refBruto)
  if (refBruto !== null && !ref) return null
  return { canal, ref, em }
}

/**
 * Monta um link do CICLO que carrega a origem. É o que o selo, o convite e — no plano — cada
 * parceiro usam; ninguém concatena `?ref=` à mão, então a grafia do parâmetro mora num lugar só.
 */
export function linkComOrigem(base: string, canal: Canal, ref?: string | null): string {
  // Caminho relativo (`/`) é o selo, servido no mesmo domínio: devolve relativo também.
  const relativo = base.startsWith('/')
  const url = new URL(base, 'https://relativo.invalid')
  url.searchParams.set('origem', canal)
  const refLimpo = sanear(ref)
  if (refLimpo) url.searchParams.set('ref', refLimpo)
  return relativo ? `${url.pathname}${url.search}` : url.toString()
}

/**
 * Entre duas origens lidas de lugares diferentes, a do primeiro toque.
 *
 * Existe por causa do e-mail de confirmação: no celular, o link dele costuma abrir no navegador do
 * app de e-mail, que não tem o cookie de quem se cadastrou. Por isso o cadastro também grava a
 * origem na conta (`user_metadata`), e o onboarding compara as duas — a mais antiga ganha; empate
 * fica com a da conta, que é a registrada no momento da decisão.
 */
export function primeiroToque(daConta: Origem | null, doNavegador: Origem | null): Origem | null {
  if (!daConta) return doNavegador
  if (!doNavegador) return daConta
  return doNavegador.em < daConta.em ? doNavegador : daConta
}
