import { SLUGS_DE_VITRINE } from '@/core/tenants/demonstracao'
import { withNovoTenant } from '@/server/db/with-tenant'

/**
 * Qual página de demonstração está de fato NO AR agora — resolvido no servidor, nunca escrito à mão.
 *
 * **O defeito que isto conserta, medido em produção em 2026-09-03:** a landing linkava
 * `/dom-rocha` em `href` literal, e essa rota respondia **404** no ar. O projeto migrou a
 * demonstração para os seis tenants `demo-*` (`scripts/seed-demo-6-negocios.mjs`), que respondem
 * 200, e o link da home ficou apontando para o tenant antigo.
 *
 * (O domínio do produto não é citado aqui de propósito: `dominio-em-um-lugar-so` guarda que ele
 * exista num arquivo só, e a guarda não distingue comentário de código — o que está certo, porque
 * é mais barato não escrever o domínio do que ensinar a guarda a ler prosa.)
 *
 * O custo disso é desproporcional ao tamanho do erro: "Ver uma página de exemplo" é a prova de
 * produto da landing — o argumento mais forte que o CICLO tem para quem nunca ouviu falar dele — e
 * levava a "Página não encontrada". Quem clicou concluiu que o produto está quebrado, que é
 * exatamente a leitura oposta da que o botão existe para produzir.
 *
 * **Por que resolver no servidor e não trocar o literal por outro literal.** Trocar `dom-rocha` por
 * `demo-navalha-de-ouro` conserta hoje e reproduz a fragilidade: no dia em que ESSE for renomeado
 * ou removido, a landing volta a apontar para um 404, em silêncio, sem nada reprovando. Nenhuma
 * varredura de código pega isso, porque o defeito não está no código — está na distância entre o
 * código e o banco. Só uma pergunta em tempo de execução responde.
 *
 * Quando nenhuma existe, devolve `null` e a landing **esconde o botão**. Um argumento a menos é
 * pior que um argumento; um link para 404 é pior que os dois.
 *
 * `withNovoTenant` (service role) porque isto roda para visitante anônimo, antes de existir
 * qualquer contexto de tenant — mesma razão de `perfilPublico`. A consulta lê só `slug`, de uma
 * lista fechada, e não expõe nada que a página pública já não mostre.
 */
export async function slugDeDemonstracaoNoAr(): Promise<string | null> {
  /*
    `SLUGS_DE_VITRINE`, e NÃO a lista de exclusão do sitemap. São perguntas diferentes: aquela
    responde "o que esconder", esta responde "o que mostrar". Usei a errada na primeira versão e o
    botão passou a apontar para `/teste-essencial`, uma conta de teste de degrau de plano.
  */
  const candidatos = [...SLUGS_DE_VITRINE]
  if (candidatos.length === 0) return null

  return withNovoTenant(async (svc) => {
    const { data, error } = await svc
      .from('tenants')
      .select('slug')
      .in('slug', candidatos)
      .is('deleted_at', null)

    // Falha de banco não pode derrubar a home: sem resposta, o botão some, e o resto da página
    // (que é o argumento inteiro) continua de pé. É a mesma régua do `catch` de `quemIndicou`.
    if (error) return null

    /*
      A ORDEM da lista é a preferência de produto, e o banco não a conhece — devolveria em qualquer
      ordem. Por isso a escolha é feita aqui, percorrendo `candidatos`, e não com `limit(1)` na
      consulta: com `limit(1)` a vitrine seria sorteada pelo planejador do Postgres.
    */
    const existentes = new Set((data ?? []).map((t) => t.slug))
    return candidatos.find((slug) => existentes.has(slug)) ?? null
  }).catch(() => null)
}
