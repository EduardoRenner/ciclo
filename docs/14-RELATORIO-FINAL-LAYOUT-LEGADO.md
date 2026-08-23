# 14 · Relatório final — o layout roxo que voltava

> Execução do plano de `docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md`, feita em 2026-08-22 depois de o
> Eduardo confirmar a decisão pendente (T3: **o dono escolhe a cor do site**). Este documento é o
> relatório de FASE 12 pedido; o diagnóstico e a arquitetura-alvo estão no 13, que este não repete.

---

## 1 · Causa raiz

O roxo não estava em nenhum código no ar — o CSS realmente servido em produção não tinha um
único hex roxo (medido). Ele voltava porque **o service worker guardava uma cópia do app da era
roxa e nunca a invalidava**:

- O nome do cache (`ciclo-v2`) era uma constante digitada à mão, fixada às **05:38 de 19/08**.
- O roxo só saiu do produto às **20:55 do mesmo dia** — 15 horas depois.
- `activate` só apaga cache com nome **diferente** do atual; como o nome nunca mudava sozinho a
  cada deploy, quem visitou o app naquela janela ficou com o shell roxo (HTML, ícones, manifest)
  congelado **para sempre**, e o `fetch` do worker respondia cache primeiro, rede depois.

Um segundo bug explicava por que era intermitente ("às vezes"): o registro do service worker
pendurava o listener de `load` dentro de um `useEffect`, que roda depois da hidratação — que
normalmente já é depois do `load` ter passado. Medido em produção antes da correção:
`swRegistrado: false` mesmo com o documento completo. Ou seja, às vezes o SW nem existia (rede
entregava o app novo), às vezes existia de dias atrás (servia o roxo).

Uma segunda fonte de roxo, independente da primeira e que **não** explicava o relato original
(a conta do Eduardo é vertical `barber`, que resolve para âmbar): `vertical_packs.accent_color`
fixava a cor do site público por profissão, e duas das seis entradas eram roxo puro
(`lashes #a855f7`, `brows #8b5cf6`) — herdadas do design system antigo, nunca atualizadas quando
o redesign de identidade trocou o acento do resto do produto para osso.

---

## 2 · Bugs encontrados

**Frontend**
- Registro do service worker efetivamente não acontecia (timing do `useEffect`/`load`).
- `#a855f7` (purple-500) pré-selecionado por padrão no cadastro de profissional.
- `docs/03-DESIGN-SYSTEM.md` ainda documentava o acento antigo e a paleta roxa por nicho como se
  fossem vigentes — não é bug de produto, mas era a fonte que alimentava R1/R2.

**Backend**
- `public-booking.ts` lia `vertical_packs.accent_color` como fonte de cor do site público —
  cor fixada por profissão, sem o dono poder mudar, e duas entradas roxas.
- Nenhuma validação de formato na escrita da cor (não existia campo de cor até esta rodada).

**Banco/dados**
- `vertical_packs.accent_color` continha valores de fábrica nunca revisados desde o redesign de
  identidade (2026-08-19), incluindo os dois roxos.

**Cache**
- Nome de cache fixo, nunca versionado por deploy — a causa raiz.
- O service worker ignorava `Cache-Control: no-store` do servidor e cacheava a resposta assim
  mesmo.

**Segurança**
- Cache do service worker indexado só por URL, cacheando `/admin/*` (faturamento, agenda, ficha
  de cliente) — em aparelho compartilhado, a segunda pessoa a abrir `/admin/hoje` podia herdar a
  tela renderizada da primeira, inclusive depois do logout.

**UX**
- A tela de sucesso do site — nenhuma, este bug não tinha superfície de UX própria além da cor
  errada em si.

**Performance**
- Nenhum achado de performance nesta auditoria — fora de escopo do bug relatado, e nada na
  investigação apontou para isso.

**Testes**
- Não existia nenhum teste sobre o service worker (era um arquivo JS solto, sem cobertura).
- Não existia teste garantindo que a cor do site não vaza entre tenants.

---

## 3 · Alterações realizadas

| Arquivo | Alteração | Motivo | Impacto |
|---|---|---|---|
| `public/sw.js` | Reescrito: nome do cache vem de `?v=<build>` na própria URL do worker; `NUNCA_CACHEAR` passa a cobrir toda rota autenticada (`/admin`, `/onboarding`, `/entrar`, `/cadastro`, `/verificar`, `/nova-senha`, `/recuperar-senha`), não só `/api`; obedece `Cache-Control: no-store`; estático com hash usa cache-first, HTML público usa network-first com fallback offline | Causa raiz (nome fixo) + o vazamento de tela autenticada (§4.3 do doc 13) | Todo deploy futuro invalida sozinho o cache do anterior; nenhum dado pessoal fica indexável só por URL |
| `src/components/shell/registrar-service-worker.tsx` | Registra na hora se `document.readyState === 'complete'`, só pendura `load` senão; passa `?v=<NEXT_PUBLIC_BUILD_ID>` | O listener de `load` estava pendurado depois do evento já ter passado — o SW quase nunca registrava | A correção do cache (acima) passa a chegar de fato nos aparelhos |
| `next.config.ts` | `env.NEXT_PUBLIC_BUILD_ID` = `VERCEL_GIT_COMMIT_SHA` (ou `'dev'` local) | Dá ao cliente um identificador de build para nomear o cache | Habilita a correção do SW |
| `src/server/services/site.ts` | `EsquemaSite` ganha `accent` (regex `#rrggbb`, nullish) | Fonte única de verdade da cor do site (§5.1 do doc 13) | `PATCH /api/v1/tenant` passa a aceitar/validar cor |
| `src/server/services/public-booking.ts` | Removida a consulta a `vertical_packs.accent_color`; `acc` passa a vir de `site.accent ?? osso` | Tirar a cor de fábrica por profissão, incluindo as duas roxas | Site público de todo tenant, novo ou existente, para de herdar cor de nicho |
| `src/app/admin/config/negocio/formulario.tsx` | Novo campo "Cor do seu site" (`input type=color` + botão "Usar a cor padrão") | Interface para o dono exercer a escolha decidida em T3 | Primeira tela do produto onde o dono controla a própria marca |
| `src/app/admin/config/profissionais/formulario.tsx` | Paleta sem roxo; cadastro nasce sem cor (`null`), não mais pré-selecionado em `CORES[0]`; botão "Remover cor" | R2 — matava o roxo de fábrica no cadastro | Nenhum profissional novo nasce com cor sem o usuário escolher |
| `src/middleware.ts` | `Cache-Control: private, no-store, max-age=0, must-revalidate` explícito em toda resposta de rota protegida (inclusive redirects) | Defesa em profundidade (T6) | Nenhuma tela sob `/admin/*` pode ficar cacheável, nem por engano futuro |
| `docs/03-DESIGN-SYSTEM.md` | Seção "acento por vertical" marcada como superada, com data e link para a fonte vigente | Era a documentação que legitimava o roxo por nicho | Ninguém reintroduz o padrão antigo lendo a doc errada |
| `src/server/db/types.gen.ts` | `vertical_packs.accent_color` passa a `string \| null` (Row/Update) e opcional (Insert) | Reflete a migration 0033 | Typecheck acompanha o schema real |
| `docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md`, `docs/DECISOES.md` | Diagnóstico, plano e decisões da execução | Rastreabilidade | — |

---

## 4 · Migrações

**`supabase/migrations/0033_cor_do_site_por_tenant.sql`** — aplicada no projeto de verdade
(`sukloaoodpxjukngyojo`) e confirmada por leitura direta após aplicar:

```sql
alter table vertical_packs alter column accent_color drop not null;
update vertical_packs set accent_color = null;
```

- **Dados afetados:** as 6 linhas de `vertical_packs` (uma por vertical semeada). Nenhum dado de
  tenant, cliente ou agendamento tocado.
- **Idempotente:** rodar de novo dá o mesmo resultado.
- **Rollback:** os 6 valores originais estão escritos em comentário no topo do próprio arquivo de
  migration — copiar, colar, e recolocar `not null`.
- **A coluna não foi removida.** `vertical_packs` continua sendo lido para semear serviço e
  produto no onboarding; remover a coluna é passo mais caro e foi deixado para depois que o
  Eduardo confirmar, num aparelho de verdade, que o cache antigo desapareceu (ver §6).

---

## 5 · Testes

| Teste | Onde | Resultado |
|---|---|---|
| A · nome do cache inclui a versão da URL do worker | `tests/unit/shell/service-worker.test.ts` | ✅ |
| B · `activate` apaga cache de deploy anterior (fecha a causa raiz) | idem | ✅ |
| Sem `?v=` cai em `'dev'`, nunca indefinido | idem | ✅ |
| `/admin/*`, `/onboarding`, `/entrar`, `/api`, `/auth`, `/nova-senha` nunca interceptados | idem | ✅ |
| Mutação (POST/PATCH/DELETE) nunca interceptada, mesmo em rota pública | idem | ✅ |
| Resposta com `no-store` nunca é gravada no cache | idem | ✅ |
| Resposta cacheável é gravada | idem | ✅ |
| `/_next/static/*`: cache-first (não bate na rede na 2ª vez) | idem | ✅ |
| HTML público: network-first (sempre tenta a rede primeiro) | idem | ✅ |
| HTML público sem rede: cai no cache (offline) | idem | ✅ |
| `lerSite`: sem `site` nenhum, `accent` cai em osso | `tests/unit/server/site.test.ts` | ✅ |
| `lerSite`: hex válido (minúsculo e maiúsculo) passa | idem | ✅ |
| `lerSite`: hex malformado nunca vira cor de nicho — cai no vazio | idem | ✅ |
| `lerSite`: `site` corrompido não lança | idem | ✅ |
| `EsquemaSite`: aceita ausente/null/hex válido, recusa malformado em pt-BR | idem | ✅ |
| Tenant de vertical historicamente roxa (`lashes`/`brows`) nasce osso, contra o banco real | `tests/integration/cor-do-site.test.ts` | ✅ |
| Dono escolhe a cor e ela não vaza para outro tenant (isolamento) | idem | ✅ |
| Cor inválida gravada direto no banco (contornando a API) nunca vira `style` inline | idem | ✅ |

**Suíte inteira:** `pnpm verify` — 472 testes unitários + 254 de integração + 133 de RLS, todos
verdes; `tsc`/`eslint` limpos; build sem nenhuma página de `admin/`, `(auth)/` ou `(public)/`
saindo estática (só as 4 de sempre: `/dev/ui`, `/icon.svg`, `/robots.txt`, `/sitemap.xml`).

**Verificação ao vivo, no navegador**, além dos testes automatizados:
- Registro do service worker confirmado (`swRegistrado: true`, `scriptURL: /sw.js?v=dev`) — antes
  da correção, media `false`.
- Autenticado e navegando para `/admin/hoje`, o cache do SW **não** ganhou entrada nenhuma —
  só `/manifest.json` e uma fonte estática seguiam lá.
- Campo de cor em `/admin/config/negocio`: escolhida `#2563eb`, salva, e a página pública do
  salão (`/dom-rocha`) refletiu exatamente essa cor (`--acc: #2563eb`, `--acc-2` derivado
  corretamente). Revertido para o padrão em seguida, para não deixar a demonstração azul.
- Formulário de profissional: paleta sem roxo, nenhuma cor pré-selecionada, botão "Remover cor"
  corretamente ausente quando não há cor escolhida.
- Cabeçalho `Cache-Control` confirmado no redirect de sessão ausente (`private, no-store,
  max-age=0, must-revalidate`).

---

## 6 · Riscos restantes

1. **Não posso provar que o Eduardo especificamente tinha `ciclo-v2` no cache dele** — só o
   mecanismo e a janela de tempo. Confirmação de 10 segundos, se ele quiser: DevTools →
   Application → Cache Storage, procurar por `ciclo-v2`.
2. **Nenhum deploy foi feito nesta sessão.** Tudo está commitado e verificado localmente; a
   correção só vale para quem abrir o app depois do próximo `vercel --prod`. Até lá, quem já tem
   `ciclo-v2` continua vendo o roxo.
3. **`vertical_packs.accent_color` continua existindo como coluna**, agora sempre `null` — por
   decisão consciente (§4), não descuido. Remover é o próximo passo depois de confirmar em campo.
4. **`professionals.color` continua sendo gravado e nunca lido** (R3) — decisão de escopo (§2 de
   `docs/DECISOES.md`), não esquecimento: ligá-lo à agenda é feature nova, fora do que foi pedido.
5. **Perda consciente de "abrir offline" nas telas de `/admin/*`.** Antes, o app shell autenticado
   ficava em cache e abria sem rede; agora não abre, porque manter em cache é o próprio risco de
   segurança do §4.3. A fila de mutação offline (`src/lib/offline/api-client.ts`) não depende
   disso e continua funcionando.
6. **Sem acesso ao navegador real do Eduardo**, não dá para confirmar ao vivo que o cache antigo
   dele especificamente foi limpo depois do deploy — só que o mecanismo que devia limpá-lo agora
   existe e foi testado contra o próprio `sw.js` de produção, não uma reimplementação paralela.

---

## 7 · Recomendações futuras

- Depois do próximo deploy, e só depois que o Eduardo confirmar (ou o tempo passar sem novos
  relatos) que o roxo não volta: remover a coluna `vertical_packs.accent_color` de vez.
- Decidir o destino de `professionals.color` — usar na agenda (ex.: uma faixa colorida por
  profissional na visão do dia) ou remover o campo. Hoje ele não faz nada.
- Se o Eduardo quiser o app instalado abrindo offline de novo, isso exige desenhar uma tela de
  app-shell **sem dado pessoal** (skeleton genérico) para pré-cachear, em vez de cachear a
  renderização real de `/admin/hoje`.
