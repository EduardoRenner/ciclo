# Agente B · Desempenho (Fase 0 · subfases 0.4 e 0.5)

> Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md` (A3, A5 "Velocidade", A6, A7, A8, Fase 0, Fase 4).
> Base: `docs/28`, `docs/42`, `docs/70`, `docs/98-aprimoramento/medidas/AMBIENTE.md`.
> Data: 13/10/2026. Tudo **medido no ambiente local**. Produção **não** foi tocada.

## 0. Ambiente e método (registrado antes de qualquer consulta)

| Item | Valor |
| --- | --- |
| Banco | Postgres do Supabase **local**, contêiner `supabase_db_ciclo`, porta 54322; API em `127.0.0.1:54321` (Kong do projeto `ciclo`, conferido com `docker ps`) |
| É produção? | **Não.** `.env.local` aponta para `127.0.0.1` (conferido sem imprimir valores) |
| App | build de produção já no ar em `http://localhost:3200` (`next start`, Next 15.5.27). Não reiniciei |
| Tenant usado | `demo-salao-encanto` (plano avançado, 28 clientes, ~140 agendamentos), dono `dono-demo-salao-encanto@ciclo.app`. **Escolhido para não misturar o log com o agente A**, que usa `demo-dom-estilo` |
| Sessão | login pela tela real `/entrar` (`medidas/B-login.mjs`), `storageState` em `C:\temp\ciclo-medicao\estado-B-dono.json` (fora do repo) |
| Máquina | Windows 11, 12 núcleos lógicos, Node 24.18.0. **Carga de CPU medida em 94%** durante as medições (96 processos do Chrome de outros agentes; `Get-CimInstance Win32_Processor`) |
| Idas ao banco | log do Postgres com `log_min_duration_statement = 0` **ligado só durante cada medição** (`alter system` como `supabase_admin` + `pg_reload_conf()`; desligado com `alter system reset` no `finally` de cada script). Marcas `select 'MARCA-…'` antes e depois de cada requisição |
| Atribuição | PostgREST: 1 transação (BEGIN → `set_config(request.jwt.claims…)` → consulta → COMMIT) = 1 ida; dono pelo `sub` dos claims, ou pelo tenant/ids nos parâmetros quando é `service_role`. GoTrue: 1 `getUser()` = 5 SELECTs internos; conto 1 ida por SELECT em `users` com o nosso `user_id`. Requisições de outros agentes aparecem como "outro"/"indefinido" e ficam fora da conta |
| Série × paralelo | (1) **medido**: "ondas" = grupos de idas que se sobrepõem no relógio do banco; (2) **lido no código** (arquivo:linha). O banco local responde em < 1 ms, então duas idas em série curtas podem cair na mesma onda: a onda medida é o **piso** da profundidade; o código dá o **teto** |
| Tempo no navegador | Playwright 1.48 + Chrome, `medidas/B-tempos.mjs`: perfis **celular** (390×844, toque, CPU 4×, rede 1,6 Mb/s / 150 ms via CDP) e **computador** (1280×800, sem limite). 5 repetições por rota: 1 fria (cache HTTP vazio) + 4 quentes. "Conteúdo útil" = predicado por tela (tabela 2) sondado a cada 25 ms pelo CDP (a CSP do app proíbe `eval`, então `waitForFunction` não serve) |
| Interação | `medidas/B-interacoes.mjs`: Event Timing (INP aproximado = maior duração de evento da interação), `MutationObserver` (1ª mudança no DOM após o toque) e predicado de estado final |

**Limite principal desta medição (vale para todo número de tempo):** servidor e banco são locais e a máquina estava saturada por outros agentes. Os tempos absolutos estão **inflados e com variância alta** (ex.: TTFB de Hoje no computador 272–2425 ms entre repetições). Por isso, como pede o `AMBIENTE.md`, a **medida principal de servidor é a contagem de idas e a profundidade em série**; os tempos servem para comparar telas entre si e para o lado do cliente (feedback, tarefas longas, CLS, JS).

**Custo medido de uma ida, local** (`medidas/B-gotrue.mjs`, 20 chamadas em série):

| Chamada | mediana | pior |
| --- | ---: | ---: |
| `auth.getUser()` (GET `/auth/v1/user`) | **163,8 ms** | 626,3 ms |
| PostgREST `memberships` (o `vinculosAtivos`) | 19,4 ms | 41,3 ms |
| PostgREST contagem de `appointments` do tenant (140 linhas) | **103,9 ms** | 187,6 ms |

> Em produção a ida custa outra coisa (`docs/28` §9: ~10 ms por ida entre `gru1` e `sa-east-1`). O GoTrue local abre conexão nova por consulta (pids diferentes no log), o que explica os 164 ms. **[NÃO VERIFICADO]** o custo do `getUser()` em produção. Motivo: produção fora do escopo sem autorização. Quem destrava: Eduardo (logs da Vercel/Supabase).

---

## 1. Tabela principal · rota/ação × TTFB × conteúdo útil × INP × JS × idas

Legenda: tempos em ms, **mediana / pior de 5**, perfil **celular** (computador entre colchetes quando muda a leitura). "Idas" = total (REST + auth); "série" = profundidade (onda medida → teto do código). JS = KB **transferidos** na carga fria (brotli; `docs/42` §7: régua certa), entre parênteses o First Load JS do `build.log`.

| # | Rota / ação | TTFB | Conteúdo útil | INP (toque típico) | JS KB | Idas (série medida → código) | Causa principal | Conserto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/admin/hoje` | 608 / 1328 [1574 / 2425] | 1083 / 2156 | 208 / 216 (abrir agendamento) | 190,9 (156) | **28** (4 → 5–6) | 2 `getUser` em série + `memberships` antes de tudo; 23 consultas paralelas, das quais `resumo_central_de_acoes` e 3 de `appointments` pagam RLS por linha | B-01, B-02, B-03, B-09 |
| 2 | `/admin/agenda` | 359 / 1389 | 904 / 2552 | ver §3 (trocar de dia) | 185 (151) | 6 (4 → 4) | auth em série; consulta de `appointments` com RLS por linha | B-01, B-02 |
| 3 | Abrir agendamento (sheet) | — | — | ver §3 | — | **0** (código: `agenda.tsx:80`, usa a linha da lista) | — | — |
| 4 | Criar agendamento `POST /api/v1/appointments` | (servidor) 522–1388 | — | ver §3 | — | **13** (13 → 12–13) | tudo em série; `tenants` relido (`appointments/route.ts:34`); 3 contagens de risco em série | B-04 |
| 4b | `/admin/agenda/novo` (tela) | 902 / 1913 | 1596 / 2979 | — | 184,4 (136) | 7 (7 → 5) + `GET /clients/:id` no cliente | `contextoDePlano` em série; cliente pré-preenchido por `useEffect` | B-04, B-12 |
| 5 | Confirmar / Chegou / Faltou | (servidor) 322–1626 | — | ver §3 | — | **7 cada** (7 → 7) | 7 idas em série; depois `router.refresh()` da tela inteira | B-05, B-06 |
| 6 | Abrir comanda `/admin/comanda/[id]` | 833 / 2164 | 1651 / 2810 | — | 181 (136) | 9 (5 → 5) | auth em série | B-01 |
| 6b | Comanda via agendamento (redirect) | **2226 / 2416** | **3118 / 3270** | — | (136) | 4 + 9 em **2 requisições** | `redirect()` do servidor refaz auth+memberships | B-11 |
| 7 | Adicionar item `POST /tickets/[id]/items` | (servidor) 707 | — | ver §3 | — | **14** (12 → 12) + `GET /tickets/[id]` (3) | série longa; relê o ticket; `contextoDePlano` em série | B-07 |
| 8 | Receber `POST /tickets/[id]/close` | (servidor) 908 | — | ver §3 | — | **22** (19 → ~17) + `router.refresh` dentro da transição | laço por item em série; `monthly_profit` recalculado no caminho; spinner segura até o refresh | B-08 |
| 9 | `/admin/caixa` | 593 / 1302 | 1459 / 1820 | — | 175,6 (109) | 14 (4 → 6) | `tenants.settings` lido 2×; comissão N+1 por profissional | B-10 |
| 10 | `/admin/mes` | 533 / 1435 | 1124 / 2577 | — | 175,2 (108) | **26** (8 → 6) | 13 ramos, 3 deles com série interna; `margemDosServicos` com `.in(ids)` (**quebra com volume**, B-00b) | B-00b, B-10 |
| 11 | `/admin/clientes` | 472 / 2211 | 1080 / 3480 | busca: INP 216 / 352; lista 579 / 717 | 179,8 (122) | 9 (6 → 5) | ok; paginação por cursor existe | — |
| 12 | `/admin/clientes/[id]` (ficha) | 646 / 897 | 1023 / 1620 | — | **208,1** (170) | **32** (5 → 6) | 30 consultas; `services`, `professionals`, `tenants` repetidos | B-10 |
| 13 | `/admin/recuperar` | 770 / 2289 | 1489 / **4724** | filtro: INP 80 / 176 | 186,2 (141) | 17 (4 → 6) | `comNotas` em série no fim (`page.tsx:127`); RLS por linha nas contagens | B-10, B-02 |
| 14 | Chamar cliente `POST /cycle/recover/manual` | (servidor) 380–2055 | — | (fire-and-forget) | — | 7–10 (6 → 9) | `product_events` com `await` no caminho | B-13 |
| 15 | `/admin/campanhas` | 1206 / 1558 | 1839 / 2685 | — | 176,3 (119) | 12 (**9** → 8–9) | **4 `await` em série** (`page.tsx:34, 61, 84, 103`); leitura sem limite | B-14 |
| 16 | `/admin/config/servicos` | 1841 / 2810 [838 / 1418] | 2676 / 3594 [1070 / 1714] | — | 193,9 (150) | 5 (4 → 5) | variância do servidor; `margemDosServicos` com `.in(ids)` (**quebra com volume**) | B-00b |
| 17 | Página pública `/[slug]` | **105 / 140** | **451 / 623** | — | 149,1 (108) | 7 (2 → 2) | ok (sem auth) | — |
| 18 | Agendar público (tela) | 140 / 259 | 478 / 648 | escolher serviço: INP 88 / 128; horários em 178 / 277 | 162,5 (135) | 7 + `availability` 12 (3 → 4–6) | 6 tarefas longas na carga fria (859 ms) | B-15 |
| 18b | `POST /public/[slug]/book` | (servidor) 295–719 | — | — | — | 9 + 3 limitadores (12 → 12) | 3 limitadores + captcha + criação em série | B-16 |
| 19 | Confirmar por link (tela + POST) | 38 / 42 | 389 / 415 | — | 151,5 (120) | tela 0; POST 3 + 1 limitador (4 → 4) | relê o agendamento 2× | B-16 |
| 20 | `/entrar` + `POST /auth/login` | 26 / 33 | 689 / 700 | — | 153 (141) | tela 0; POST 4 (4 → 4) | `push` + `refresh` após login (ver §5) | B-17 |

Fontes: `medidas/B-idas-telas-r1.json`, `medidas/B-idas-acoes.json`, `medidas/B-idas-acoes-r1.json`, `medidas/B-tempos-rotas.json`, `medidas/B-interacoes-celular.json`, `medidas/B-idas-ui.json`.

### 1.1 Tempo por rota nos dois perfis (completo)

`medidas/B-tempos-rotas.json`. Mediana / pior de 5; "fria" = 1ª carga com cache vazio. Tarefas longas = > 50 ms na thread principal, só na carga fria.

| Rota | Celular TTFB | Celular útil (fria) | Computador TTFB | Computador útil | CLS pior | Tarefas longas celular (soma, maior) | Computador | JS transf. KB | JS decodif. KB | HTML KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hoje | 608 / 1328 | 1083 / 2156 (2156) | 1574 / 2425 | 2610 / 3191 | 0,012 | 3 (414 ms, 261) | 2 (311) | 190,9 | 576,3 | 15,6 |
| Agenda | 359 / 1389 | 904 / 2552 (2552) | 1156 / 3267 | 1431 / 4134 | 0 | 2 (270, 273) | 2 (199) | 185,0 | 561,0 | 14,5 |
| Novo agendamento | 902 / 1913 | 1596 / 2979 (2979) | 1395 / 1806 | 1588 / 2684 | 0 | 3 (516, 309) | 3 (305) | 184,4 | 557,5 | 16,3 |
| Caixa | 593 / 1302 | 1459 / 1820 (1820) | 996 / 1570 | 1445 / 1990 | 0 | 3 (344, 238) | 1 (76) | 175,6 | 534,7 | 14,2 |
| Mês | 533 / 1435 | 1124 / 2577 (2577) | 1230 / 1482 | 1897 / 2084 | 0 | 2 (372, 308) | 1 (116) | 175,2 | 533,8 | 14,9 |
| Clientes | 472 / 2211 | 1080 / 3480 (3480) | 564 / 2376 | 922 / 3147 | 0,001 | 3 (379, 341) | 2 (147) | 179,8 | 547,3 | 19,3 |
| Ficha do cliente | 646 / 897 | 1023 / 1620 (1408) | 580 / 1138 | 915 / 1777 | 0,001 | 3 (482, 291) | 2 (186) | 208,1 | 638,4 | 18,7 |
| Recuperar | 770 / 2289 | 1489 / 4724 (4724) | 649 / 1527 | 1341 / 2245 | 0 | 4 (414, 371) | 2 (198) | 186,2 | 561,5 | 14,7 |
| Campanhas | 1206 / 1558 | 1839 / 2685 (2168) | 1360 / 1757 | 2351 / 4195 | 0 | 2 (379, 309) | 1 (97) | 176,3 | 536,3 | 13,4 |
| Config/serviços | 1841 / 2810 | 2676 / 3594 (2676) | 838 / 1418 | 1070 / 1714 | 0 | 3 (346, 371) | 2 (224) | 193,9 | 582,4 | 15,5 |
| Comanda (fechada) | 833 / 2164 | 1651 / 2810 (2568) | 461 / 1894 | 705 / 2393 | 0 | 1 (351, 395) | 1 (114) | 181,0 | 550,4 | 13,5 |
| Comanda via agendamento | 2226 / 2416 | 3118 / 3270 (3200) | 1256 / 1784 | 1515 / 1987 | 0 | 2 (493, 449) | 0 | — | — | 13,5 |
| Página pública | 105 / 140 | 451 / 623 (417) | 69 / 81 | 201 / 537 | 0,001 | 1 (216, 263) | 1 (82) | 149,1 | 461,1 | 15,8 |
| Agendar (público) | 140 / 259 | 478 / 648 (648) | 182 / 265 | 249 / 667 | 0,001 | **6 (859, 335)** | 1 (109) | 162,5 | 496,8 | 9,5 |
| Confirmar por link | 38 / 42 | 389 / 415 (389) | 31 / 51 | 167 / 275 | 0 | 2 (374, 324) | 1 (78) | 151,5 | 467,8 | 6,7 |
| Entrar | 26 / 33 | 689 / 700 (486) | 26 / 40 | 185 / 324 | 0 | 2 (359, 346) | 1 (93) | 153,0 | 470,6 | 8,2 |

Predicado de "conteúdo útil" (o elemento que responde a pergunta da tela): Hoje = `h2` "A seguir"/"Vale a pena"; Agenda = texto "Ocupação do dia"; Novo = `select` do serviço; Caixa = "Entrou no dia"; Mês = "Sobrou"; Clientes/Serviços = 1º `li`; Ficha = `h2` "Como atender"; Recuperar = "Dá para recuperar"; Campanhas = `h2` "Resultados"; Comanda = "Comanda fechada"; Pública = `h2` "Serviços"; Agendar = botão do 1º serviço; Confirmar = botão "Vou sim"; Entrar = campo de e-mail. Todos foram achados nas 5 repetições dos 2 perfis (`utilNaoAchado` = 0).

**Leituras (FATO, da tabela):**
- **Painel × público.** As telas do painel têm TTFB de 359–1841 ms (mediana celular); as públicas, 26–140 ms, mesmo indo ao banco (a pública faz 7 idas). A diferença é o caminho de autenticação: 2 `getUser()` em série (~164 ms cada, local) + `memberships` antes de qualquer outra consulta (§6, B-01).
- **O esqueleto não aparece na carga dura.** O FCP do painel vem **depois** do TTFB (ex.: Hoje FCP 828 ms, Config/serviços 2580 ms, celular): `admin/layout.tsx` é assíncrono e espera `contextoAtual` antes de transmitir qualquer HTML, então o `loading.tsx` (que está **dentro** do layout) só ajuda na navegação suave, não na abertura do app. [INFERÊNCIA: TTFB ≈ FCP − ~200 ms em todas as rotas do painel + leitura de `admin/layout.tsx:90`.]
- **CLS ok:** pior 0,012 (Hoje), meta 0,05.
- **Tarefas longas no celular (CPU 4×):** toda carga fria do painel tem 2–4 tarefas longas, maior 238–449 ms. No computador, 1–3, maior 76–247 ms. A meta "nada congela" não é cumprida no celular médio. Ver B-15.
- **JS:** 175–208 KB transferidos por rota do painel na carga fria (21 arquivos em Hoje), 149–163 KB nas públicas. O compartilhado continua 104 kB (`build.log`, igual ao `docs/42` §1). A ficha é a mais pesada (208 KB / 638 KB decodificados).

---

## 2. Top 20 ações mais lentas

Ordenado pela pior experiência **para o dono** (tempo até o estado final no celular quando medido; senão, profundidade em série × frequência). Frequência é **[INFERÊNCIA]** pela tarefa-régua do contrato (B3).

| # | Ação | Medido hoje (celular) | Idas / série | Frequência [INFERÊNCIA] | Achado |
| --- | --- | --- | --- | --- | --- |
| 1 | Entrar → cair na Hoje | `/admin/hoje` renderizada **3×** em RSC + 7 *prefetch*; **69 idas, 12 `getUser`** num toque | 69 / 16 ondas | todo dia, várias vezes | B-17 |
| 2 | Abrir comanda pelo agendamento ("Ver comanda") | conteúdo útil **3118 / 3270 ms** (computador 1515 / 1987) | 4 + 9 em 2 requisições | todo atendimento | B-11 |
| 3 | Receber (Fechar comanda) | até "Comanda fechada": **761 / 1790 ms**; **30 idas** no clique (POST 22 + refresh + prefetch) | 22 / 19 ondas + refresh | todo atendimento | B-08 |
| 4 | Abrir Hoje (carga dura) | útil **1083 / 2156** (computador 2610 / 3191) | 28 / 4–6 | abrir o app | B-01, B-02, B-03 |
| 5 | Config/serviços (carga) | útil 2676 / 3594 (computador 1070 / 1714); **cai com volume** | 5 / 4–5 | semanal | B-00b |
| 6 | Campanhas (carga) | útil 1839 / 2685 | 12 / **9** | semanal | B-14 |
| 7 | Novo agendamento (tela) | útil 1596 / 2979 | 7 / 5–7 + GET do cliente | várias por dia | B-04, B-12 |
| 8 | Abrir comanda direta | útil 1651 / 2810 | 9 / 5 | todo atendimento | B-01 |
| 9 | Recuperar (carga) | útil 1489 / **4724** (fria) | 17 / 4–6 | diária | B-10, B-00a |
| 10 | Caixa (carga) | útil 1459 / 1820 | 14 / 4–6 | diária | B-10 |
| 11 | Trocar de tela Hoje → Agenda (tab) | 1ª mudança **344 / 516 ms**; útil **1145 / 2002 ms** | 6 / 4 | dezenas por dia | B-09 |
| 12 | Mês (carga) | útil 1124 / 2577; **cai com volume** | 26 / 6–8 | semanal | B-00b, B-10 |
| 13 | Clientes (carga) | útil 1080 / 3480 | 9 / 5–6 | diária | B-01 |
| 14 | Ficha do cliente | útil 1023 / 1620; JS 208 KB | **32** / 5–6 | várias por dia | B-10 |
| 15 | Novo agendamento → Confirmar | até voltar à agenda: **984 / 1027 ms** | 13 / 12–13 | várias por dia | B-04 |
| 16 | Confirmar / Chegou / Faltou | até o toast: **981 / 1445 ms**; **14 idas** no clique (POST 7 + refresh 7) | 7 / 7 + refresh | dezenas por dia | B-05, B-06 |
| 17 | Agenda (carga) | útil 904 / 2552 | 6 / 4 | dezenas por dia | B-01, B-00a |
| 18 | Adicionar item na comanda | até o item aparecer: **723 / 2059 ms**; **19 idas** (POST 14 + GET do ticket) | 14 / 12 + GET | todo atendimento | B-07 |
| 19 | Agenda: trocar de dia | 1ª mudança **516 / 1025 ms** ≈ final (530 / 1032): **nada muda antes** | 6 / 4 | dezenas por dia | B-09 |
| 20 | Clientes: buscar | INP **216 / 352 ms**; lista filtrada 579 / 717 ms | 3 por busca | várias por dia | B-15 |

Fontes: `medidas/B-tempos-rotas.json`, `B-interacoes-celular.json`, `B-idas-ui.json`, `B-idas-acoes.json`.

---

## 3. Interação: toque → 1ª mudança visual, INP, estado final (celular, 5 repetições)

`medidas/B-interacoes-celular.json` (script `B-interacoes.mjs`). Perfil celular (CPU 4×, 1,6 Mb/s / 150 ms). "1ª mudança" = 1ª alteração do DOM depois do toque (`MutationObserver`), contada a partir do 1º evento registrado pelo Event Timing; "INP" = maior duração de evento da interação (o Event Timing só registra eventos > 16 ms; "<16" = abaixo disso); "final" = estado que responde a ação. Mediana / pior de 5.

| Interação | 1ª mudança (meta < 100) | Botão reagiu (travou/sumiu) | INP (meta < 200) | Até o estado final | Estado final usado |
| --- | --- | --- | --- | --- | --- |
| Hoje: tocar no agendamento (abre o detalhe) | 104 / 173 | — | **208 / 216** ✗ | 177 / 234 | `[role=dialog]` |
| Tab: Hoje → Agenda | **344 / 516** ✗ | — | 56 / 96 | **1145 / 2002** ✗ (meta < 1 s) | "Ocupação do dia" |
| Agenda: trocar de dia | **516 / 1025** ✗ | — | 48 / 64 | 530 / 1032 | "quinta-feira, 15 de outubro" |
| Agenda: Confirmar | 62 / 150 | 62 / 150 (otimista) | 104 / 184 | 981 / 1445 (toast) | "Agendamento confirmado" |
| Clientes: digitar "Isa" | 223 / 349 | — | **216 / 352** ✗ | 579 / 717 | lista com "Isadora" |
| Recuperar: filtro "Atrasadas" | 33 / 71 | — | 80 / 176 | 82 / 157 | botão `aria-pressed` |
| Comanda: Adicionar | 37 / 63 | 43 / 76 | 64 / 104 | 723 / **2059** | botão "Remover …" do item |
| Comanda: Fechar comanda (receber) | 33 / 56 | 33 / 56 | 72 / 96 | 761 / **1790** ✗ (meta < 1,5 s) | "Comanda fechada" |
| Público: escolher serviço | 36 / 54 | 47 / 92 | 88 / 128 | 178 / 277 | "N horários livres" |
| Novo agendamento: Confirmar | 76 / 126 | 76 / 126 | 104 / 160 | 984 / 1027 (3 de 5*) | URL `/admin/agenda` |

\* Em 2 das 5 repetições o horário escolhido pelo script já estava ocupado e a tela respondeu "Esse horário acabou de ser reservado." (o tratamento de conflito funcionou); o tempo final dessas duas não entra.

**Leituras:**
- **Ações que gravam dão retorno na hora** (33–76 ms de mediana, todas abaixo de 100 ms): Confirmar é otimista; Adicionar, Fechar e Novo agendamento travam o botão com spinner. FATO.
- **Navegar não dá retorno na hora.** No tab e na troca de dia, a 1ª coisa que muda chega em 344–1025 ms; na troca de dia a 1ª mudança **é** o resultado final (516 × 530 ms): durante meio segundo a pessoa não sabe se o toque pegou. Causa: `router.push` sem estado pendente visível (`agenda.tsx:86`) e o esqueleto do `loading.tsx` só depois da ida ao servidor. Ver B-09.
- **INP acima de 200 ms** em 2 interações frequentes: abrir o agendamento na Hoje (208 / 216) e digitar na busca de clientes (216 / 352). [HIPÓTESE] render do `Sheet` + `DetalheAgendamento` e re-render da lista inteira a cada tecla. Como validar: aba *Performance* do DevTools com CPU 4× nas duas interações.
- [NÃO VERIFICADO] interações no perfil computador. Motivo: tempo e carga da máquina; o celular é o caso que a meta protege. Quem destrava: `node B-interacoes.mjs <saida> computador 5`.

---

## 4. Duplo toque (toda ação que grava)

Duas formas, porque protegem coisas diferentes.

**(a) Na tela, dedo de verdade** (`B-interacoes.mjs`, modo duplo: dois toques crus nas mesmas coordenadas, sem esperar o botão habilitar). Conto POSTs que saíram (`page.on('request')`) e linhas no banco local antes/depois.

| Ação | POSTs que saíram | Gravações no banco | Botão reagiu em | Resultado |
| --- | --- | --- | --- | --- |
| Agenda: Confirmar | 1 | 1 (`audit_log` `appointment.confirm`) | 79 ms | ✓ |
| Comanda: Adicionar item | 1 | 1 (`ticket_items`) | 70 ms | ✓ |
| Comanda: Fechar comanda | 1 | 1 (`audit_log` `ticket.close`) | 30 ms | ✓ |
| Novo agendamento: Confirmar | 1 | 1 (`appointments`) | 51 ms | ✓ |
| Público: Confirmar agendamento (barra fixa) | 1 | 1 (`appointments` `origin = public_page`) | 73 ms | ✓ |
| Recuperar: Chamar | — | — | — | [NÃO VERIFICADO] na tela: no tenant demo ninguém está em atraso, o botão não existe. Coberto em (b) |

**(b) No servidor, sem a trava do botão** (`B-duplo-api.mjs`: duas requisições iguais **simultâneas**, cada uma com a sua `Idempotency-Key`, que é o que acontece se a trava falhar: a chave nasce por clique, `comanda.tsx:28`, `formulario.tsx:166`):

| Ação | Respostas | Gravações | Quem segurou |
| --- | --- | --- | --- |
| Criar agendamento (mesmo horário) | 200, **409** `SLOT_TAKEN` | 1 | constraint `appointments_no_overlap` ✓ |
| Fechar comanda | 200, **422** | 1 fechamento auditado | checagem de estado `open` (`comanda.ts:51`) ✓ |
| Chamar cliente (`recover/manual`) | 200 `registrada: true`, 200 `ja_chamada` | 1 mensagem | deduplicação no serviço ✓ |
| **Adicionar item** | 200, 200 | **2 itens** | **ninguém no servidor**: só a trava do botão |

**Conclusão (FATO):** nenhum duplo toque na tela gravou duas vezes, e todo botão de escrita reage em < 100 ms. A única escrita sem proteção no servidor é **adicionar item**: dois envios que escapem da trava (rede lenta + reenvio com chave nova) viram dois itens na comanda e cobrança a mais. **S2** (o caminho comum está protegido pela tela; o risco é de borda). Conserto: chave de idempotência estável por intenção (gerada ao preparar o item, não por clique); o `apiFetch` de `lib/offline` já faz isso (`api-client.ts:48`). Não proponho deduplicar por conteúdo: dois itens iguais podem ser legítimos.

---

## 5. Idas por clique real na interface (inclui `router.refresh`, `push` e RSC)

`medidas/B-idas-ui.json` (script `B-idas-ui.mjs`): o toque real na tela, contando **tudo** o que ele dispara no banco até a rede assentar (+ 4 s).

| Clique | Requisições HTTP que o clique gerou | Idas (REST + auth) | Ondas |
| --- | --- | --- | --- |
| Tab Hoje → Agenda (navegação suave) | `GET /admin/agenda (RSC)` | 6 (4 + 2 `getUser`) | 4 |
| Agenda: Confirmar | `POST …/confirm` + `GET /admin/agenda (RSC)` (refresh) | **14** (10 + 4) | 12 |
| Comanda: Adicionar item | `POST …/items` + `GET /api/v1/tickets/:id` | **19** (16 + 3) | 17 |
| Comanda: Fechar comanda | `POST …/close` + `GET /admin/comanda/:id (RSC)` (refresh) + `GET /admin/config/taxas (RSC)` (prefetch do link que aparece) | **30** (26 + 4) | 24 |
| Entrar (tela real) | `POST /auth/login` + **3× `GET /admin/hoje (RSC)`** + 7 *prefetch* (`agenda`, `recuperar`, `clientes`, `agenda/novo`, `/demo-salao-encanto`, `caixa`, `campanhas/nova`) | **69** (57 + **12 `getUser`**) | 16 |

**Leituras (FATO):**
- O `router.refresh()` **dobra** as idas do Confirmar (7 → 14) e soma ~8 ao Fechar comanda.
- **Prefetch de rota dinâmica custa autenticação.** Cada `<Link>` visível pré-carrega a rota até o `loading.tsx`, o que roda `admin/layout.tsx` no servidor: 2 `getUser` + `memberships` por link. Na Vercel cada um é uma invocação de função. [INFERÊNCIA: 11 requisições HTTP × layout que chama `contextoAtual` (`admin/layout.tsx:90`) → 12 `getUser` medidos.]
- **Login renderiza a Hoje 3 vezes** (`formulario.tsx:70-71`: `router.push` seguido de `router.refresh`, mais o prefetch do tab da Hoje). Ver B-17.

---

## 6. Achados

Cada achado: taxonomia da Fase 4 · causa **medida** · conserto · ganho esperado · risco · severidade (A8).

### B-00a · RLS calculada linha a linha em `appointments` (e `tickets`/`ticket_items`) · **S1 (escala)**
- **Taxonomia:** Banco.
- **Causa medida:** as políticas `appointments_select`/`_update` são `has_tenant(tenant_id) AND can_see_appointment(tenant_id, professional_id)` (`pg_policies`). As duas funções são `SECURITY DEFINER` com `SET search_path` (`pg_get_functiondef`), então o Postgres **não as embute** e chama as duas **por linha**; `can_see_appointment` chama de novo `has_tenant` e `tenant_role` (3+ consultas em `memberships` por linha). `tickets`/`ticket_items` usam o mesmo desenho (`can_see_ticket`).
  - 140 linhas (tenant demo): contagem **0,28 ms sem RLS → 20–47 ms com RLS** (`B-explain-rls.txt`, 2 rodadas).
  - 10.014 linhas (tenant sintético de outro agente, predicado aplicado com os claims do dono demo): **1,7–3,1 ms sem o predicado → 1.028–4.552 ms com o predicado por linha → 2,2–123 ms com a mesma checagem como *initplan*** (uma vez por consulta). Duas rodadas, carga da máquina diferente.
  - `pg_stat_statements` da sessão (todos os agentes): as 3 consultas mais caras do banco são de `appointments` (média 75–311 ms, **máx 2.243 ms**) e o RPC `resumo_central_de_acoes` (média 200 ms, máx 1.380 ms) — `B-pgss-top.txt`.
  - `resumo_central_de_acoes` (Hoje, toda abertura) faz `count(*)` de **todos** os agendamentos do tenant, e o código só usa o número para testar `=== 0` (`crm.ts:706`, `:713`).
- **Projeção [INFERÊNCIA]:** 0,10–0,45 ms por linha × agendamentos do tenant. Um salão com 60 atendimentos/semana passa de 3.000 linhas no 1º ano → 0,3–1,4 s **por consulta** que varre o tenant (Hoje, Campanhas, risco, atribuição). O `statement_timeout` do PostgREST é **8 s** (parâmetro `'8s'` no `set_config` de cada transação, visto no log) → entre ~18 mil e ~80 mil agendamentos a Hoje para de abrir.
- **Conserto:** (1) imediato e isolado: `exists(...)` no lugar do `count(*)` de agendamentos no RPC (B-02); (2) estrutural: reescrever as políticas quentes para a checagem de pertença rodar **uma vez** por consulta (`tenant_id in (select tenant_id from memberships where user_id = (select auth.uid()) and active)` + papel por `(select …)`), mantendo "profissional só vê o seu", com `pnpm test:rls` e mutação, porque é segurança.
- **Ganho esperado (medido no banco local):** 1.028–4.552 ms → 2,2–123 ms em 10 mil linhas.
- **Risco:** alto (RLS). Migration de política: teste de isolamento verde antes e depois, como `docs/28` §11 fez em `memberships`. Decidir junto com o agente E.

### B-00b · `margemDosServicos` monta URL com a lista de ids e **derruba Serviços e Mês** · **S1**
- **Taxonomia:** Banco / trava tela.
- **Causa medida:** `caixa.ts:265-276` busca `ticket_items` com `.in('ticket_id', <ids das comandas fechadas em 90 dias>)`. É a armadilha que o próprio `caixa.ts:197-204` documenta e evitou em `concentracaoDoMes`.
  - Limite do proxy local (Kong), `B-url-longa.mjs`: **200 ids (7,4 KB) passa; 220 ids (8,1 KB) → HTTP 414**.
  - Reprodução ponta a ponta (`B-repro-414.sh` + `B-repro-414-ver.mjs`): controle → as 3 telas abrem; com **230 comandas fechadas sintéticas** no tenant do agente B → `/admin/config/servicos` e `/admin/mes` mostram **"Não consegui carregar esta tela"**; `/admin/caixa` (que usa join) abre; o log do Kong registrou 2 respostas 414. Linhas sintéticas apagadas no fim.
- **Projeção [INFERÊNCIA]:** ~220 comandas em 90 dias = **2,4 por dia**. Qualquer salão em uso real passa disso no 1º trimestre. Limite do proxy de produção [NÃO VERIFICADO] (motivo: produção fora do escopo; quem destrava: Eduardo); `caixa.ts:197` já afirma que o PostgREST recusa "muito antes" de 30 KB.
- **Conserto:** o mesmo de `concentracaoDoMes`: filtrar `ticket_items` pelo join `tickets!inner(...)` com o mesmo recorte de data, sem lista de ids. Elimina também a 2ª ida em série.
- **Ganho:** a tela volta a abrir (hoje não abre com volume); −1 ida em série. **Risco:** baixo; teste com > 220 comandas.
- **Para os agentes C/E:** é defeito de funcionalidade; está aqui porque saiu da medição.

### B-01 · Duas validações de sessão + vínculo em série antes de qualquer dado, em toda tela do painel · **S2**
- **Taxonomia:** Idas em série + Rede.
- **Causa medida:** toda carga do painel começa com `getUser` (middleware, `middleware.ts:307`) → `getUser` (página, `session.ts:43`) → `memberships` (`tenant.ts:87`), nas 3 primeiras ondas de **todas** as 12 telas medidas (`B-idas-telas-r1.json`). Local, cada `getUser` custa 164 ms (mediana). TTFB do painel 359–1841 ms × público 26–140 ms. O layout espera isso antes de mandar qualquer HTML, então o esqueleto não aparece na carga dura (FCP ≈ TTFB + ~200 ms).
- **Conserto (escolher com medida):** (a) `memberships` **em paralelo** com o `getUser` usando o `sub` do JWT e comparando os ids no fim (o PostgREST já valida a assinatura) → −1 ida em série em **toda** requisição, inclusive API; (b) o layout transmitir o casco antes de esperar o contexto (Suspense em volta do que depende do tenant). "Passar o usuário do middleware por header" foi recusado em `docs/28` §9 por segurança; não reabro.
- **Ganho:** [HIPÓTESE] ~1 ida por requisição em produção (~10 ms, `docs/28` §9); FCP do painel antes do dado. Como medir: TTFB e FCP de `/admin/hoje`, mediana de 10 quentes.
- **Risco:** médio (caminho de autenticação; testar sessão revogada).

### B-02 · `resumo_central_de_acoes` conta todos os agendamentos para saber se é zero · **S2**
- Parte de B-00a, separada porque é pequena e não mexe em RLS. `exists` no lugar de `count(*)`. Medido: o InitPlan da contagem é 55,4 de 58,5 ms do RPC com 140 linhas (`B-explain-quentes.txt`).

### B-03 · Hoje lê demais · **S3** (S2 com volume)
- **Causa (código conferido):** `tenants` lido 3× no mesmo render além do join do contexto (`orcamentos.ts:246`, `planos.ts:98`, `crm.ts:691`); `loyalty_entries` sem filtro nem limite (`crm.ts:685`), e o PostgREST corta em 1.000 linhas em silêncio (`supabase/config.toml:18`, `max_rows = 1000`), então o cartão de fidelidade **erra** acima disso [INFERÊNCIA]; `v_recover_revenue` inteira para usar 1 item (`recuperar-receita.ts:63`); `cycle_predictions` paginado em série (`previsao.ts:217`, já em `docs/70` §4).
- **Conserto:** usar `ctx.tenant`; agregar no banco fidelidade e prestação de contas; `limit` real na view. **Ganho:** [HIPÓTESE] pouco hoje (são paralelas), muito com volume. **Risco:** baixo.

### B-04 · Criar agendamento: 13 idas, 12 em série · **S2**
- **Causa medida** (`B-idas-acoes.json`, ondas): auth → memberships → **`tenants` de novo** (`appointments/route.ts:34`; o fuso já está em `ctx.tenant`, `settings` só serve ao ramo de conflito) → idempotência → `services`/`professionals` → `clients` (`agendamentos.ts:102`, não depende do anterior) → 3 contagens de risco **em série e independentes** (`risco.ts:36, 44, 52`) → insert → auditoria → fecho da idempotência (independente da auditoria).
- **Conserto:** tirar a releitura de `tenants`; `resolverCliente` no `Promise.all` de serviço/profissional; risco em `Promise.all`; auditoria ∥ fecho da idempotência (a auditoria **continua** antes da resposta, `docs/28` §8). Tela: cliente de `?cliente=` como prop (B-12).
- **Ganho:** 12 → ~7 ondas [INFERÊNCIA pela leitura]; ~50 ms em produção [HIPÓTESE, 10 ms/ida]. **Risco:** baixo.

### B-05 · Confirmar / Chegou / Faltou: 7 idas em série · **S3**
- **Causa medida:** auth → memberships → idempotência → `select` → `update` → auditoria → idempotência. `transicaoSimples` lê para depois escrever com `.eq(status, atual)` (`agendamentos.ts:649-667`).
- **Conserto:** `update … where status in (<origens válidas>) returning *` numa ida (o `select` só quando nada foi atualizado, para dar a mensagem certa); auditoria ∥ fecho da idempotência. **Ganho:** 7 → 5 ondas. **Risco:** baixo. A tela já é otimista (retorno em 62 ms): o ganho é de carga, o dono quase não sente.

### B-06 · `router.refresh()` depois de Confirmar/Chegou/Faltou dobra o custo do clique · **S3**
- **Causa medida:** 7 → 14 idas por clique (`B-idas-ui.json`). Já fora da transição (`lib/atualizar-depois.ts:20-30`, conserto do `docs/28` P0-c): o botão solta na hora.
- [HIPÓTESE] "piscada": o valor otimista some quando a transição termina e volta com o refresh. Como validar: vídeo da linha entre o toque e o refresh com CPU 4×. Não medi.
- **Conserto:** `docs/28` P1-c — a resposta do POST traz o agendamento; atualizar a linha localmente e dispensar o refresh. **Ganho:** −7 idas por clique (medido). **Risco:** baixo.

### B-07 · Adicionar item: 19 idas por toque, em 2 requisições seguidas · **S2**
- **Causa medida:** POST com 14 idas em 12 ondas (`contextoDePlano` em série `tenants`→`tenant_modules`; `recalcularSubtotal` relê o ticket) + `GET /api/v1/tickets/:id` logo depois (`comanda.tsx:104, 126`). Até o item aparecer: **723 / 2059 ms** no celular.
- **Conserto:** o POST devolve `{ticket, items}` e a tela usa isso (−1 requisição); `tenant_modules` em paralelo; não reler o ticket. **Ganho:** 19 → ~11 idas, 2 → 1 requisição [INFERÊNCIA]. **Risco:** baixo. Duplo envio: ver §4.

### B-08 · Receber (Fechar comanda): 30 idas por toque e spinner preso até o refresh · **S2**
- **Causa medida:** POST com 22 idas em 19 ondas: laço por item em série (`comanda.ts:285-292`), `tenants` relido (`:251`, `:280`), itens relidos em `estoque.ts:19`, **recalcula `monthly_profit` no caminho** (3 inserts em série no fim). Depois, `router.refresh()` **dentro** da transição (`comanda.tsx:148, 158`): o "enviando" só termina quando a comanda inteira foi re-renderizada. Até "Comanda fechada": **761 / 1790 ms**; 30 idas no clique.
- **Conserto:** (1) tirar o refresh da transição (`useAtualizarDepois`) ou trocar por estado local; (2) laço por item em `Promise.all` com leitura em lote; (3) `congelarMesesFechados` para `after()` — **não** é trilha de auditoria (que fica, `docs/28` §8), é agregado recalculável. **Ganho:** 19 → ~9 ondas [INFERÊNCIA]; o spinner solta na resposta do POST. **Risco:** médio (dinheiro): manter fechamento → auditoria → resposta; `after()` com log de falha (`docs/21`).

### B-09 · Navegar não dá retorno na hora (tab e troca de dia) · **S2**
- **Taxonomia:** Sem feedback + Idas em série.
- **Causa medida:** 1ª mudança 344 / 516 ms (tab) e 516 / 1025 ms (trocar de dia), acima da meta de 100 ms; na troca de dia a 1ª mudança **é** o resultado. `agenda.tsx:86` faz `router.push` sem marcar o botão como pendente; o esqueleto depende da ida ao servidor.
- **Conserto:** estado pendente imediato no chip do dia e no tab (`useTransition`/`useLinkStatus`, ou marcar o dia escolhido antes do push). **Ganho:** 1ª mudança < 50 ms [HIPÓTESE pelo padrão já medido nos botões de escrita, 33–76 ms]. **Risco:** baixo.

### B-10 · Mesmo dado lido várias vezes por tela · **S3**
- **Causa (código + log):** `tenants.settings` 2× no Caixa (`taxas-de-pagamento.ts:28`, `custo-fixo.ts:32`) e 3× no Mês; Ficha com `services`, `professionals` e `tenants` duplicados (32 idas, a tela com mais idas); Caixa com comissão N+1 por profissional (`caixa/page.tsx:100-117`); Recuperar espera tudo para depois buscar notas (`recuperar/page.tsx:127`).
- **Conserto:** `cache()` por requisição para `tenants`/`services`/`professionals` (o padrão de `vinculosAtivos`); encadear `comNotas` no `.then` de `listarParaRecuperar`. **Ganho:** −2 a −6 idas por tela; tempo [HIPÓTESE]. **Risco:** baixo.

### B-11 · "Ver comanda" pelo agendamento passa por um `redirect()` do servidor · **S2**
- **Causa medida:** útil **3118 / 3270 ms** no celular (pior tela medida); duas requisições, auth + vínculo pagos 2× (`comanda/agendamento/[appointmentId]/page.tsx:38-39`).
- **Conserto:** o link apontar direto para `/admin/comanda/<ticketId>` quando o ticket existe; manter a ponte só para dado antigo. **Ganho:** ~metade [INFERÊNCIA: 2 renders → 1]. **Risco:** baixo.

### B-12 · Novo agendamento busca o cliente no navegador depois de montar · **S3**
- `formulario.tsx:94-111`: `GET /api/v1/clients/:id` (3 idas) depois de a tela abrir, para preencher o que a página já sabe pelo `?cliente=`. Com CPU 4×, tocar "Confirmar" antes desse GET terminar faz o formulário recusar (aconteceu na 1ª rodada do script). Conserto: buscar no servidor junto com o resto. Ganho: −1 requisição e botão pronto mais cedo.

### B-13 · Evento de produto com `await` em "Chamar" e outros · **S3**
- `recuperar-receita.ts:434` (`product_events` antes de responder); o cliente usa `keepalive` e não espera, então o dono não sente. Mesma classe (leitura de código): `public-booking.ts:478-484` (disponibilidade sem horário, página pública), `clients/import/route.ts:47-49`, `ja-atendo/route.ts:66-69`, `onboarding.ts:231, 238`. Conserto: `after()` (lição da Hoje). O único `after()` do repositório hoje é o da Hoje (`hoje/page.tsx:140`).

### B-14 · Campanhas: 4 blocos independentes em série e leitura sem limite · **S2**
- **Causa medida:** 9 ondas para 12 idas (`B-idas-telas-r1.json`), a maior proporção série/total do painel; código: `await` em `page.tsx:34`, `:61`, `:84`, `:103`, sem dependência entre eles. `receitaPorCampanha` lê **todas** as mensagens de campanha e **todos** os agendamentos concluídos sem paginação (`atribuicao.ts:236-237`) → corta em 1.000 em silêncio = número errado com volume [INFERÊNCIA].
- **Conserto:** um `Promise.all`; janela de tempo ou agregação no banco. **Ganho:** 9 → ~5 ondas. **Risco:** baixo.

### B-15 · Tarefas longas no celular e INP acima de 200 ms · **S2**
- **Causa medida:** toda carga fria do painel tem 2–4 tarefas longas (maior 238–449 ms, CPU 4×); Agendar público tem 6 (859 ms somados). INP 208 / 216 (abrir agendamento na Hoje) e 216 / 352 (busca de clientes).
- **Causa provável [HIPÓTESE]:** hidratação de componentes cliente grandes presentes em toda rota do painel (`assistente-flutuante.tsx`, 845 linhas, import estático em `admin/layout.tsx:11`; `hoje.tsx`, 553; `agendar.tsx`, 1.356) e re-render da lista inteira por tecla na busca. Como validar: perfil de CPU no DevTools; medir de novo com o assistente em `import()` dinâmico.
- **Conserto:** assistente sob demanda; `useDeferredValue` no filtro. **Ganho:** [HIPÓTESE]. **Risco:** baixo.

### B-16 · Agendar e confirmar públicos: séries evitáveis · **S3**
- `POST /book`: 3 limitadores + captcha em série (`book/route.ts:29, 32, 41, 45`) + 9 idas em série; confirmar por link relê a mesma linha 2× (`confirm/[token]/route.ts:26` + `agendamentos.ts:564`). Conserto: limitadores em paralelo; `update … returning` direto. Os tempos públicos já são bons (TTFB 26–182 ms, útil < 700 ms no celular). `void notificarEquipe` sem `after()` (`public-booking.ts:648`) pode ser cortado na Vercel [INFERÊNCIA]: funcionalidade, para o agente C.

### B-17 · Login renderiza a Hoje 3 vezes e dispara 7 prefetch · **S2**
- **Causa medida:** 69 idas e 12 `getUser` num único toque em "Entrar" (`B-idas-ui.json`). `formulario.tsx:70-71`: `router.push` + `router.refresh` (refresh redundante para rota dinâmica recém-navegada); somam-se os prefetch dos `<Link>` da tab e da Hoje, cada um rodando o layout (auth) no servidor.
- **Conserto:** tirar o `router.refresh()` após o `push`; avaliar prefetch só no toque para links do painel. **Ganho:** −2 renders da Hoje (≈ −56 idas no login, medido: 3 RSC × ~28 idas) e −3 idas por link prefetchado em **toda** carga. **Risco:** sem prefetch a 1ª troca de tela pode ficar mais lenta: medir junto com B-09.

### Achados descartados (medição ingênua, registrado para não voltar)
- **"Campo de busca duplicado em Clientes"**: numa repetição o Playwright achou 2 `#busca-clientes` escondidos. Medido de novo (carga direta e navegação suave, 4 instantes): sempre 1. Era o HTML em *streaming* (cópia escondida antes do React mover o conteúdo). Não é defeito.
- **"1ª mudança negativa" no Fechar comanda (1ª rodada)**: o Event Timing não registra eventos < 16 ms; a referência caiu no `click`, depois da mudança. Na rodada final registrei também o tempo desde o armar (`primeiraMudancaDesdeArmarMs`).
- **"Novo agendamento não envia"** (1ª rodada): o script tocou antes do `GET` do cliente terminar. Virou B-12, não defeito de envio.

---

## 7. Achados de banco (subfase 0.9 do lado de desempenho)

`get_advisors` não está disponível localmente pelo MCP. Substituí por catálogo (`pg_policies`, `pg_proc`, `pg_indexes`, `pg_stat_user_tables`, `pg_stat_statements`) + `explain (analyze, buffers)`.

**Políticas RLS duplicadas nas tabelas quentes** (`pg_policies`):

| Tabela | SELECT permissivas | Situação |
| --- | --- | --- |
| `memberships` | 1 (`memberships_select`) | ✓ conserto do `docs/28` §11 (migration 0044) de pé |
| `profiles` | **2** (`profiles_self` ALL + `profiles_same_tenant`) | mantido de propósito (`docs/28` §11: `profiles_self` cobre o onboarding). Não apareceu em nenhuma das 30+ medições de idas: não está no caminho quente |
| `tenants`, `appointments`, `clients`, `tickets`, `ticket_items`, `services`, `professionals`, `client_cycles`, `tenant_modules` | 1 cada | sem duplicata. **O custo não é duplicata: é função por linha** (B-00a) |

**`explain analyze` das consultas mais quentes** (como o dono demo: `set local role authenticated` + claims; `B-explain-quentes.txt`, `B-explain-rls.txt`):

| # | Consulta (onde) | Tempo | Plano | Leitura |
| --- | --- | ---: | --- | --- |
| 1 | `appointments` concluídos em 56 dias (Hoje, `resumo-hoje.ts:126`) | 13,9 ms (35 linhas) | índice `(tenant_id, starts_at)`; filtro RLS por linha | ~0,4 ms por linha de RLS |
| 2 | `appointments` por `created_at` + nome do cliente (Hoje/atribuição) | 41,9 ms (135 linhas) | índice por tenant + subplano `clients` com `has_tenant` por linha | RLS em 2 tabelas por linha |
| 3 | `resumo_central_de_acoes` (Hoje) | 58,5 ms | InitPlan 2 = `count(*)` de todos os agendamentos: 55,4 de 58,5 ms | B-00a / B-02 |
| 4 | `count(*)` de `appointments` do tenant (140 linhas) | 0,28 ms sem RLS × 20–47 ms com RLS | Index Only Scan | 70–170× |
| 5 | idem em 10.014 linhas | 1,7–3,1 ms × **1.028–4.552 ms** × 2,2–123 ms (initplan) | Index Only Scan + Result | B-00a |
| 6 | `memberships` + `tenants` + `professions` (toda requisição) | 3,7 ms | Seq Scan nas 3 (8–19 linhas) | ok nesse tamanho; `memberships_user_id_idx` existe |
| 7 | `v_recover_revenue` (Hoje/Recuperar) | 0,5 ms | — | ok hoje; lida inteira (B-03) |
| 8 | `loyalty_entries` do tenant (Hoje) | 0,4 ms | — | ok hoje; sem limite (B-03) |
| 9 | `tickets` fechados do mês (Caixa) | 1,4 ms | Seq Scan (poucas linhas) | índice parcial `tickets_tenant_closed_at` existe |
| 10 | `v_carteira_resumo` (Clientes) | 8,7 ms | — | a view mais cara de Clientes |
| 11 | `appointments` concluídos do tenant (Campanhas, `atribuicao.ts:237`) | **75,2 ms** (135 linhas) | RLS por linha | B-00a + B-14 |

**Índices:** todas as consultas acima usam índice por `tenant_id` (+ data quando há recorte). Não achei índice faltando no caminho quente. `appointments` teve 225 *seq scans* lendo 2,1 milhões de tuplas na sessão (`pg_stat_user_tables`) — vem do tenant sintético de 10 mil linhas de outro agente [INFERÊNCIA pelo `n_live_tup` = 10.659]; não reproduzi consulta do app com seq scan nela. `unused_index` não avaliado (ruído em banco de teste, A5).

**`statement_timeout` = 8 s** no PostgREST (parâmetro do `set_config` em toda transação, visto no log): é o teto contra o qual B-00a vai bater.

---

## 8. Comparação com `docs/28`, `docs/42` e `docs/70`

| Item de antes | Onde | Hoje (13/10) | Evidência |
| --- | --- | --- | --- |
| Funções em `gru1` | `docs/28` P0-a | de pé (não medível local) | `vercel.json` (FATO no contrato A5) |
| `cache()` em sessão e vínculo | `docs/28` P0-b | **de pé**: 1 `getUser` por chamada de API, 2 por tela (o 2º é o do middleware, mantido por decisão) | `B-idas-acoes.json` (auth = 1 em toda API), `B-idas-telas-r1.json` (auth = 2) |
| Refresh fora da transição | `docs/28` P0-c | **de pé na agenda e na Hoje** (`atualizar-depois.ts`); **não aplicado** em Fechar comanda e em ~20 outros lugares | B-08; varredura de código |
| API não repete o `getUser` do middleware | `docs/28` P1-a | **de pé** (`/api/*` sai do middleware antes, `middleware.ts:286`) | auth = 1 nas APIs |
| Sentry do servidor só com DSN | `docs/28` §6 | **de pé** (`instrumentation.ts:32-46`, `next.config.ts:66-75`) | leitura de código |
| `sharp` só onde processa imagem | `docs/28` §7 | **de pé** para Hoje: o trace de `/admin/hoje` não tem `sharp` nem `@img` (`page.js.nft.json`, 145 arquivos, 4,13 MB). Surgiram 2 arquivos novos com `sharp` no topo (`portfolio-upload.ts`, `vitrine-upload.ts`), alcançados só pelas próprias rotas (inclusive `DELETE`) | nft.json; leitura de código |
| Tenant "de carona" no vínculo | `docs/28` §8 | **regrediu em parte**: o contexto traz o tenant, mas `appointments/route.ts:34`, `planos.ts:98`, `orcamentos.ts:246`, `crm.ts:691`, `comanda.ts:251/280` voltaram a ler `tenants` — em criar agendamento e adicionar item, **em série** | B-04, B-07 |
| `buscarComanda` em paralelo | `docs/28` §10 | **de pé** (`tickets` ∥ `ticket_items` na mesma onda) | `B-idas-acoes.json` "abrir comanda" |
| RLS duplicada em `memberships` | `docs/28` §11 | **de pé** | `pg_policies` |
| Trilha de auditoria no caminho crítico | `docs/28` §8 (decisão) | mantida; **não proponho mexer** | — |
| JS compartilhado 104 kB | `docs/42` §1 | **igual**: 104 kB | `build.log` |
| "TBT 33 ms: a CPU não é gargalo" | `docs/42` §1 | **não vale para o painel no celular médio**: com CPU 4×, 2–4 tarefas longas por carga, maior até 449 ms; INP > 200 ms em 2 interações. O `docs/42` mediu página pública em produção sem limitar CPU | B-15 |
| Régua de peso: transferido, não cru | `docs/42` §7 | seguida: 149–208 KB de JS transferidos (brotli) | `B-tempos-rotas.json` |
| CLS segurado pela fonte | `docs/42` §4.5 | **de pé**: pior 0,012 | `B-tempos-rotas.json` |
| "INP nas ações nunca foi medido" | `docs/42` §4 P1-7 | **medido agora** (§3) | `B-interacoes-celular.json` |
| Waterfalls de `page.tsx` esgotados | `docs/70` §5 | **de pé no formato que o `awk` procurava**; ficaram formatos diferentes: Campanhas (4 `await` seguidos), Recuperar (`comNotas` no fim) | B-14, B-10 |
| `fichaDoCliente` fail-fast | `docs/70` §4 | igual (decisão defensável); a ficha é a tela com mais idas (32) | `B-idas-telas-r1.json` |
| `prestacaoDeContasDoMotor` pagina em série | `docs/70` §4 | igual; sem dado para medir (0 previsões no tenant demo) | `explain` = 0,08 ms |
| `agendar.tsx` buscava disponibilidade 2× | `docs/70` §2.1 | **de pé**: escolher serviço gerou 1 busca | `B-interacoes-celular.json` |

**Ficou de pé:** tudo que o `docs/28` consertou no caminho de autenticação e no pacote do servidor. **Regrediu:** releituras de `tenants` em série (o padrão que o §8 tinha tirado) e refresh dentro de transição em telas novas. **Novo e maior que tudo isso:** o custo por linha da RLS de `appointments` (B-00a) e a URL longa de `margemDosServicos` (B-00b) — os dois só aparecem com volume, que nenhuma medição anterior tinha.

---

## EVIDÊNCIAS

Todos em `docs/98-aprimoramento/medidas/` (sem cookie, senha ou token; o token de confirmação é gerado em memória e mascarado como `<token>`):

| Arquivo | O que prova |
| --- | --- |
| `B-lib-log.mjs`, `B-idas.mjs`, `B-cenarios-telas.json` → `B-idas-telas-r1.json` | idas por tela (16 cenários) |
| `B-idas-acoes.mjs` → `B-idas-acoes.json` (2ª rodada), `B-idas-acoes-r1.json` (1ª; inclui "chamar" com mensagem nova) | idas por ação de API (15 passos) |
| `B-idas-ui.mjs` → `B-idas-ui.json` | idas por clique real (refresh, push, prefetch) |
| `B-tempos.mjs` → `B-tempos-rotas.json` | TTFB, útil, FCP, LCP, CLS, tarefas longas, JS: 2 perfis × 16 rotas × 5 |
| `B-interacoes.mjs` → `B-interacoes-celular.json` | 1ª mudança, INP e final em 10 interações × 5; duplo toque na tela |
| `B-duplo-api.mjs` | duplo envio simultâneo no servidor (saída em §4) |
| `B-gotrue.mjs` | custo de 1 `getUser` e de 1 consulta REST, local |
| `B-url-longa.mjs`, `B-repro-414.sh`, `B-repro-414-ver.mjs` | 414 a partir de 220 ids; Serviços e Mês caindo |
| `B-explain-rls.sql` → `.txt`, `B-explain-quentes.sql` → `.txt` | custo da RLS por linha; planos das consultas quentes |
| `B-pgss-top.txt` | 15 consultas mais caras da sessão (`pg_stat_statements`) |
| `B-login.mjs` | login real pela tela `/entrar` |

Saídas que não viraram arquivo:
- Log ligado e desligado em cada script (`alter system … / reset` + `pg_reload_conf()` como `supabase_admin`; o usuário `postgres` não tem permissão, erro registrado na 1ª tentativa). Estado final conferido: `log_min_duration_statement` de volta ao padrão.
- `require()` cru no Node (3 rodadas, ms): `web-push` 146/95/90, `libphonenumber-js` 199/132/91, `@supabase/supabase-js` 215/220/141, `zod` 284/172/199, `sharp` 186/208/211, `papaparse` 12/16/7. `web-push` está empacotado no chunk `3090.js` (114 KB), que entra no trace de `/admin/hoje` via `mensageria.ts:2`, sem uso nessa tela. Custo só no cold start (`docs/28` §8: um por período ocioso). [HIPÓTESE] < 50 ms dentro do bundle; não medi isolado. **S3.**
- Carga da máquina: CPU 94% (12 lógicos), 96 processos `chrome`.
- `payments`: **0 linhas no banco inteiro** e nenhum `from('payments')` em `src/server`, embora o `CLAUDE.md` diga "Dinheiro entra em `payments`". Fora do meu escopo; **repassar aos agentes C/E** (fonte única do livro-caixa).

## INCERTEZAS

- **Tempos absolutos inflados** pela máquina saturada (94% de CPU, outros agentes): o TTFB do computador saiu **maior** que o do celular em várias rotas, o que só se explica por carga do servidor. Use os tempos para ordenar, não como linha de base de produção. Contagens de idas e de ondas não dependem disso.
- **Onda medida é piso**: com o banco local respondendo em < 1 ms, idas curtas em série caem na mesma onda; por isso a tabela traz "onda medida → teto do código".
- **Produção [NÃO VERIFICADO]**: custo real de `getUser` e da ida ao banco em `gru1`; limite de URL do proxy do Supabase de produção; volume real de agendamentos e comandas por tenant (decide **quando** B-00a e B-00b chegam ao dono). Motivo: sem autorização de leitura em produção. Quem destrava: Eduardo (logs da Vercel e contagem de linhas por tenant, só leitura).
- **Seed**: o tenant demo tem ~140 agendamentos, 1–3 comandas, 0 previsões e ninguém em atraso. Recuperar e prestação de contas foram medidas no **melhor caso**. O "Chamar" na tela não pôde ser tocado (lista vazia).
- **Projeção de 10 mil linhas** usou um tenant sintético criado por outro agente, com o predicado da política aplicado com os claims do dono demo (não dá para logar como dono daquele tenant). A forma do custo (por linha) é FATO; o número varia 4× entre rodadas (1,0–4,6 s).
- **INP**: o Event Timing não registra eventos < 16 ms ("<16" apareceu 1 vez). Interações no computador [NÃO VERIFICADO].
- **Piscada do otimista** após Confirmar (B-06): [HIPÓTESE], não filmada.
- **Dados que criei no banco local** (só no tenant `demo-salao-encanto`): ~45 agendamentos de teste entre 13 e 21/10 (inclui clientes "Teste Medição B" e "Duplo Toque B"), ~8 comandas fechadas, 2 mensagens de "chamar", `monthly_profit` recalculado. As 230 comandas sintéticas do teste de 414 foram **apagadas** no fim. Quem medir este tenant depois verá esses dados.

## RECOMENDAÇÕES

Em ordem de ganho medido × frequência ÷ esforço (a priorização final é da Fase 4):

1. **B-00b (S1, P ≤ 0,5 d) → Onda U (trava tela):** trocar `.in('ticket_id', ids)` por join em `margemDosServicos`. Aceite: com 230 comandas fechadas em 90 dias, `/admin/config/servicos` e `/admin/mes` abrem (reprodução pronta em `B-repro-414.sh`).
2. **B-02 (S2, P):** `exists` no lugar de `count(*)` em `resumo_central_de_acoes`. Aceite: `explain analyze` do RPC < 5 ms no tenant de 10 mil agendamentos.
3. **B-00a (S1 escala, M–G):** políticas de `appointments`/`tickets`/`ticket_items` checando pertença uma vez por consulta. Aceite: contagem de 10 mil linhas com RLS < 50 ms; `pnpm test:rls` verde antes e depois; mutação na política reprovando o teste de isolamento. Ordem a combinar com o agente E.
4. **B-08 + B-06 (S2, P cada):** tirar o `router.refresh()` da transição em Fechar comanda; trocar refresh por atualização local em Confirmar/Chegou/Faltou. Aceite: "Comanda fechada" < 800 ms no celular (pior de 5); idas por clique de Confirmar = 7.
5. **B-09 (S2, P):** estado pendente imediato no tab e no chip de dia. Aceite: 1ª mudança < 100 ms (pior de 5, celular).
6. **B-17 (S2, P):** remover `router.refresh()` depois do `push` no login; medir o custo do prefetch. Aceite: 1 render da Hoje por login (`B-idas-ui.mjs`).
7. **B-04, B-07, B-14, B-10 (S2/S3, P cada):** paralelizar as séries listadas e tirar as releituras de `tenants`. Aceite: ondas ≤ 7 (criar agendamento), ≤ 8 (adicionar item, 1 requisição só), ≤ 5 (Campanhas), medidas com `B-idas-acoes.mjs`/`B-idas.mjs`.
8. **B-01 (S2, M):** `memberships` em paralelo com `getUser`; casco do layout transmitido antes do contexto. Aceite: FCP do painel < TTFB + 100 ms e −1 onda em toda requisição.
9. **B-15 (S2, M):** perfil de CPU e assistente sob demanda. Aceite: nenhuma tarefa > 200 ms na carga fria da Hoje com CPU 4×; INP < 200 ms em "abrir agendamento" e "buscar cliente".
10. **Idempotência de "adicionar item" (S2, P):** chave estável por intenção. Aceite: duas requisições com a mesma chave = 1 item.

**Orçamentos da Fase 4 preenchidos com o medido (celular, mediana / pior; nenhuma meta ajustada):**

| Tipo | Feedback medido (meta) | Conclusão medida (meta) |
| --- | --- | --- |
| Navegar entre telas | 344–516 / 516–1025 ms (< 100) ✗ | 530–1145 / 1032–2002 ms (< 1 s) ✗ |
| Salvar simples (Confirmar, Novo agendamento) | 62–76 / 126–150 ms (< 100) ✓ na mediana | 981–984 / 1027–1445 ms (< 800) ✗ |
| Dinheiro (Fechar comanda) | 33 / 56 ms (< 100) ✓ | 761 / 1790 ms (< 1,5 s) ✗ no pior |
| Busca de clientes | 223 / 349 ms por tecla (< 50) ✗ | 579 / 717 ms (< 500) ✗ |
| Página pública (4G lenta) | útil 451–478 / 623–648 ms (< 2 s) ✓ | — |
