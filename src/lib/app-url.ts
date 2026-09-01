/**
 * A URL do produto em UM lugar só — o mesmo motivo de `NOME_DO_PLANO` e `ROTAS_AGENDADAS`.
 *
 * O domínio já esteve escrito em seis lugares: `metadataBase`, `robots.ts`, `sitemap.ts`,
 * `llms.txt`, e dois campos de tela (`onboarding` e `config/negocio`) que mostravam `ciclo.app/`
 * — um domínio que nunca foi registrado. Quem digitasse de memória publicava um link morto.
 *
 * Em produção `NEXT_PUBLIC_APP_URL` está setado. O fallback existe só pra `next build` e o dev
 * não quebrarem — e aponta pro domínio real pra que um env var que falhe em silêncio caia num
 * link que funciona, não num que não existe.
 */
export const APP_URL: string = process.env.NEXT_PUBLIC_APP_URL ?? 'https://seuciclo.com.br'

/** `seuciclo.com.br` — sem protocolo. Pra mostrar como prefixo de campo ("seuciclo.com.br/joao"). */
export const APP_HOST: string = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
