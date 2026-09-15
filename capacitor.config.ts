import type { CapacitorConfig } from '@capacitor/cli'

/**
 * T1 (docs/64-APP-STORE-CAPACITOR-PLANO.md): scaffold do app nativo sobre o mesmo Next.js que já
 * está em produção — zero reescrita de tela, zero segunda base de código. Este arquivo só existe
 * pro build NATIVO (`npx cap sync`/`npx cap open ios|android`); o `next build` da Vercel nunca lê
 * este arquivo, e este arquivo nunca entra no bundle que o navegador recebe.
 *
 * ## `appId`, e por que ele é um placeholder por decisão, não por esquecimento
 *
 * Bundle ID é PERMANENTE depois da primeira submissão numa loja — trocar depois não é "editar",
 * é publicar um app novo do zero, perdendo reviews e histórico. `br.com.seuciclo.app` segue o
 * domínio canônico do produto (`src/lib/app-url.ts`, `APP_URL`), mas é o Eduardo quem confirma
 * antes de rodar `npx cap add ios`/`npx cap add android` pela primeira vez — depois disso, é tarde.
 *
 * ## `server.url` apontando pra produção, não empacotando os assets localmente
 *
 * Decisão revisada em §0.4/§0.9 do plano: para um Next.js com Server Components/Server Actions e
 * sessão por cookie, empacotar tudo localmente (sem servidor) não é viável sem reescrever a
 * autenticação — e a pesquisa mostrou que o que realmente decide a revisão da Apple/Google não é
 * de onde vem o HTML, é se existe casca nativa por cima (T2/T3/T4). Aponta pro MESMO domínio que o
 * site usa, `APP_URL` de `src/lib/app-url.ts` — nunca `localhost`, nunca hardcoded diferente do que
 * o resto do produto já usa como fonte única.
 *
 * `NEXT_PUBLIC_APP_URL` como variável de ambiente do BUILD nativo (não do `next build`) permite
 * apontar pra um ambiente de teste antes de apontar pra produção de verdade, sem editar este
 * arquivo — mesma disciplina que `criar-tenant-real.mjs` já usa pra nunca gravar no banco errado
 * por engano.
 */
const config: CapacitorConfig = {
  appId: 'br.com.seuciclo.app',
  appName: 'CICLO',
  webDir: 'public',
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://seuciclo.com.br',
    // `androidScheme`/`iosScheme` ficam no padrão (`https`) de propósito: a sessão do Supabase
    // depende de cookie `Secure`, e um esquema não-https quebraria o login silenciosamente.
    cleartext: false,
  },
  /*
   * T1.5 (docs/64 §0.2): o servidor precisa saber, sem confiar no cliente, se um pedido veio do
   * app nativo — é o sinal que decide se a tela/rota de cobrança aparece ou fica neutralizada
   * (guideline 3.1.1, nenhuma exceção cobre o CICLO). `appendUserAgent` soma este texto ao final
   * do User-Agent que o WebView manda em TODA requisição — nenhum navegador comum escreve
   * "CicloApp" sozinho. `src/core/plataforma/nativo.ts` (`ehRequisicaoDoAppNativo`) é quem lê.
   */
  appendUserAgent: 'CicloApp',
}

export default config
