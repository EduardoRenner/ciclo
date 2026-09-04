/**
 * Quais tenants NÃO representam um negócio real.
 *
 * Existe porque o produto estava entregando um deles ao buscador como se fosse estabelecimento:
 * o `sitemap.ts` lista todo tenant com `deleted_at is null`, o `robots.ts` libera `/`, a página
 * pública não tinha marca nenhuma de exemplo — e o agendamento público está ligado nela. Ou seja,
 * dava para alguém achar a "Barbearia Dom Rocha" no Google e **marcar horário num lugar que não
 * existe**. O `scripts/seed-demo-barbearia.mjs` a descreve, na primeira linha, como "um tenant
 * fictício". Ver `docs/20-COPY-PLANO.md` §A.4.1.
 *
 * Por que uma lista em código, e não uma coluna `is_demo` no banco — que seria o desenho durável:
 * migration neste projeto **não** é aplicada por deploy automático (a CI só aplica em banco
 * efêmero; produção é manual, ver `docs/DECISOES.md` sobre a 0040). Código que consultasse uma
 * coluna inexistente ficaria quebrado no intervalo entre o deploy e a migration — e o sintoma
 * seria um sitemap vazio, que é pior que o problema original. Uma lista pura funciona no instante
 * em que sobe. A coluna continua sendo o alvo, e está registrada como tal.
 *
 * Em `core/` porque é regra de negócio sem I/O (regra 5 do CLAUDE.md) e porque tem CINCO leitores
 * que precisam concordar: o sitemap, o `robots` da página, o aviso visível, e (F0,
 * `docs/25-ESTRATEGIA-E-EXECUCAO.md`) as rotas de `reminders` e `campaigns` — que não podem
 * mandar WhatsApp/e-mail de verdade para um tenant que não tem cliente de verdade do outro lado
 * do telefone. Se eles divergirem, volta a existir um caminho que indexa — ou mensageia — o que
 * o outro esconde.
 *
 * 03/09: somou-se um sexto leitor, `enviarComFallback` (`server/services/mensageria.ts`) — o
 * ponto único por onde todo envio passa. `notificarProximoDaLista` e `/cycle/recover/send` não
 * têm laço de tenant onde pular a demo, então a trava tinha de descer para o transporte.
 */

/**
 * Semeados por script, com clientes e histórico inventados:
 *   - `dom-rocha`    → `scripts/seed-demo-barbearia.mjs` ("um tenant fictício")
 *   - `ruivo-barber` → tenant de teste (`docs/17-MONETIZACAO-PROMPT.md` §3)
 *
 * ⚠️ Isto NÃO cobre os tenants órfãos que `pnpm test:rls` e `pnpm test:integration` criam na base
 * de produção toda vez que rodam, porque o `.env.local` aponta para lá — eles nascem com slug
 * aleatório e não há como listá-los. A correção daquilo é apontar o ambiente de teste para outro
 * projeto Supabase, que já está registrada como P-B.1 no `docs/18-MONETIZACAO-PLANO.md` §P.1.1.
 * Enquanto isso não acontecer, esta lista resolve os dois casos conhecidos e permanentes.
 */
/*
 * 31/08: os três tenants de PLANO estavam no sitemap em produção — conferido baixando
 * `/sitemap.xml` do ar, não lendo código. `teste-essencial`, `teste-equipe` e `teste-avancado`
 * existem para exercitar cada degrau de plano e não são negócio nenhum; entregá-los ao buscador
 * é o mesmo defeito que criou este arquivo, com outro nome.
 *
 * Eles são exatamente o caso que a lista cobre: slug conhecido e permanente. Os órfãos de slug
 * aleatório continuam fora do alcance dela, pelo motivo já escrito acima.
 */
/*
 * 02/09: os seis de `scripts/seed-demo-6-negocios.mjs` (3 barbearias + 3 salões, um por degrau de
 * plano). Nascem já com o prefixo `demo-` justamente para que a origem seja legível no slug — mas
 * o prefixo é convenção, não regra: quem decide é esta lista, e é ela que o sitemap, o robots, o
 * aviso da página e as rotas de lembrete/campanha leem.
 */
const SLUGS_DE_DEMONSTRACAO: readonly string[] = [
  'dom-rocha',
  'ruivo-barber',
  'teste-essencial',
  'teste-equipe',
  'teste-avancado',
  'lang-barber',
  'lang-unhas',
  'demo-navalha-de-ouro',
  'demo-corte-fino',
  'demo-dom-estilo',
  'demo-studio-bella',
  'demo-salao-encanto',
  'demo-espaco-vitoria',
]

/** O tenant deste slug é uma demonstração, e não um negócio de verdade. */
export function ehDemonstracao(slug: string): boolean {
  return SLUGS_DE_DEMONSTRACAO.includes(slug.trim().toLowerCase())
}

/** Para o teste-guarda conferir que os três leitores enxergam a mesma lista. */
export const SLUGS_DE_DEMONSTRACAO_PARA_TESTE = SLUGS_DE_DEMONSTRACAO

/**
 * Quais demonstrações servem de VITRINE — e por que esta lista não é a de cima.
 *
 * A lista acima responde *"o que esconder do buscador e da mensageria"*. Esta responde *"o que
 * mostrar para quem nunca ouviu falar do produto"*, e são perguntas diferentes com respostas
 * diferentes. Confundi as duas em 2026-09-03: fiz a landing escolher o primeiro item da lista de
 * exclusão e o botão "Ver uma página de exemplo" passou a apontar para `/teste-essencial` — uma
 * conta de teste de DEGRAU DE PLANO, sem conteúdo de vitrine, com nome que denuncia que é interna.
 * Lista de exclusão usada como lista de exibição entrega o pior candidato, não o melhor.
 *
 * Só entram aqui os seis de `scripts/seed-demo-6-negocios.mjs`: são os que nascem com serviço,
 * profissional, histórico, logo, capa e avatar — ou seja, os únicos que mostram o produto cheio.
 * Ficam de fora `teste-*` (degrau de plano), e os legados `dom-rocha`/`ruivo-barber`/`lang-*`, que
 * não existem mais em produção (conferido por requisição: respondem 404).
 *
 * **A ORDEM é a preferência**, e é decisão de produto: barbearia primeiro, porque é onde o esforço
 * de venda está (`docs/18` §B.2), e dentro dela a de conteúdo mais cheio primeiro — uma vitrine com
 * três profissionais demonstra mais que uma com um. Quem resolve pega o primeiro que existir de
 * fato no banco (`server/services/demonstracao.ts`), então a ordem é o que decide na prática.
 */
export const SLUGS_DE_VITRINE: readonly string[] = [
  'demo-dom-estilo',
  'demo-corte-fino',
  'demo-navalha-de-ouro',
  'demo-studio-bella',
  'demo-salao-encanto',
  'demo-espaco-vitoria',
  /*
    Último recurso, e não engano: `dom-rocha` não existe mais em PRODUÇÃO (404, conferido por
    requisição), mas existe no banco de desenvolvimento — que é outro projeto Supabase, medido em
    2026-09-03. Sem ele nesta lista, quem roda o projeto localmente vê a home sem o botão de
    exemplo e conclui que quebrou.

    Fica por último de propósito: a ordem garante que produção nunca o escolha enquanto houver um
    `demo-*`. E ele é vitrine legítima — o `seed-demo-barbearia.mjs` o semeia com seis meses de
    histórico, que é justamente o que uma vitrine precisa ter.
  */
  'dom-rocha',
]
