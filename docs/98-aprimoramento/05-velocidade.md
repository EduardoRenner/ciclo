# 05 · Clique rápido, display sem travar (Fase 4)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`, Parte C, Fase 4 (taxonomia de causas, política de otimista, orçamento por tipo de ação). Base: `origin/main` em `33058dd0`, 13/10/2026.
Insumos: `agentes/B-desempenho.md` (medição por rota e por ação, idas ao banco, `explain`), `agentes/E-dados.md` (RLS e truncamento), `agentes/F-publico-primeiro-dia.md` (públicas), `docs/28`, `docs/42`, `docs/70` (o que já foi feito e ficou de pé, conferido pelo B §8).

**Regras desta fase.**
- **Medida principal de servidor = número de idas ao banco e quantas são em série** (log do Postgres, B §0). Os tempos do B foram medidos com a CPU em **94–99%** (outros agentes rodando): servem para ordenar, não como linha de base. Reexecutar os mesmos scripts com a máquina livre antes de fechar cada ticket.
- **Ganho esperado só com base medida.** Sem medida, [HIPÓTESE] com "como medir".
- **Metas da A7 não foram ajustadas** depois de medir.
- **Lições da casa conferidas** (A5): região `gru1` em `vercel.json` (FATO); região do banco de produção [NÃO VERIFICADO, Eduardo]; Sentry fora do topo e `sharp` separado continuam de pé (B §8); trilha de auditoria **fica** no caminho crítico (`docs/28` §8): nenhum conserto abaixo mexe nela.

---

## 1 · Orçamento por tipo de ação (medido hoje × meta)

Celular 390×844, CPU 4×, 4G lenta, mediana / pior de 5 (B, `medidas/B-interacoes-celular.json`, `B-tempos-rotas.json`).

| Tipo | Feedback visual hoje (meta < 100 ms) | Conclusão hoje (meta) | Passa? |
| --- | --- | --- | --- |
| Navegar entre telas principais | aba 344/516 ms; trocar de dia 516/1025 ms | 1145/2002 ms aba; 530/1032 dia (< 1 s) | **Não** nos dois |
| Salvar simples (Confirmar, Marcar) | 62–76 / 126–150 ms | 981–984 / 1027–1445 ms (< 800 ms) | Feedback sim na mediana; conclusão **não** |
| Ação com dinheiro (Receber) | 33 / 56 ms | 761 / **1790** ms (< 1,5 s) | **Não** no pior |
| Busca de clientes | 223 / 349 ms por tecla (< 50 ms local) | 579 / 717 ms (< 500 ms) | **Não** |
| Página pública (4G) | útil 451–478 / 623–648 ms (< 2 s) | agendar 7 toques; < 1 min humano [HIPÓTESE] | **Sim** |
| CLS | pior 0,012 (< 0,05) | — | **Sim** |
| INP nas interações frequentes | abrir horário na Hoje **208/216**; busca **216/352** (< 200) | — | **Não** em 2 |
| Idas em série por clique (≤ 3) | criar agendamento 12; receber 19; adicionar item 12; confirmar 7 | — | **Não** |

---

## 2 · Tabela principal: rota/ação × hoje × meta × causa × conserto × ganho

Ordem por **prioridade = ganho × frequência ÷ esforço**, com ganho (1 pouco · 2 médio · 3 alto ou "volta a abrir"), frequência (1 semanal · 2 diária · 3 várias por hora ou todo atendimento) e esforço (P = 1 · M = 2 · G = 3). "Idas" = total (série). Taxonomia da Fase 4 entre colchetes.

| Prio. | ID | Rota/ação | Hoje (medido, B) | Meta | Causa [taxonomia] | Conserto | Ganho esperado (base) | Como medir depois | Risco |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **9,0** | B-00b | `/admin/mes`, `/admin/config/servicos` com ~220 comandas em 90 dias | **Não abre** (414 no gateway) | Abrir em < 1 s | [Banco / trava] `.in('ticket_id', ids)` em `caixa.ts:265-276` | Join `tickets!inner(status, closed_at)` como `concentracaoDoMes` (`caixa.ts:197-208`) | Volta a abrir; −1 ida em série (FATO: reprodução com 230 comandas, `B-repro-414.sh`) | `B-repro-414.sh` + `B-repro-414-ver.mjs` → 200 nas duas telas | Baixo |
| **9,0** | B-17 | Entrar → Hoje | **69 idas, 12 `getUser`**, Hoje renderizada 3× (`B-idas-ui.json`) | 1 render da Hoje | [Recarga total + Idas em série] `router.push` + `router.refresh` (`(auth)/entrar/formulario.tsx:70-71`); 7 prefetch, cada um roda o layout com auth | Tirar o `refresh` após o `push`; medir o prefetch junto com B-09 | **−56 idas** por login (FATO: 3 renders × ~28 idas → 1) | `B-idas-ui.mjs` (passo "entrar") | Baixo; tirar prefetch pode deixar a 1ª troca de tela mais lenta: medir junto |
| **9,0** | B-09 | Aba e chip de dia | 1ª mudança **344/516** e **516/1025 ms** | < 100 ms | [Sem feedback] `router.push` sem estado pendente (`agenda.tsx:86`) | Pendente no mesmo quadro (`useTransition` / `useLinkStatus`, ou marcar o chip antes do `push`) (I-03) | < 100 ms [HIPÓTESE pelo padrão medido nos botões de escrita, 33–76 ms] | `B-interacoes.mjs` (tab, dia) | Baixo |
| **6,0** | B-06 | Confirmar / Chegou / Faltou | **14 idas** por clique (7 do POST + 7 do refresh); toast 981/1445 ms | ≤ 7 idas; < 800 ms | [Recarga total] `router.refresh()` depois da ação (`lib/atualizar-depois.ts:20-30`) | A resposta do POST traz o agendamento; atualizar a linha local (`docs/28` P1-c) | **−7 idas** por clique (FATO, `B-idas-ui.json`) | `B-idas-ui.mjs` (confirmar) | Baixo |
| **6,0** | B-08 | Receber (Fechar comanda) | **30 idas** no clique (22 do POST em 19 ondas + refresh + prefetch); 761/**1790 ms** até "Comanda fechada" | < 1,5 s no pior; spinner solta na resposta | [Idas em série + Recarga total] laço por item em série (`comanda.ts:285-292`); `tenants` relido (`:251`, `:280`); itens relidos (`estoque.ts:19`); `monthly_profit` recalculado no caminho; `router.refresh()` **dentro** da transição (`comanda.tsx:148,158`) | (1) refresh fora da transição ou estado local; (2) laço em `Promise.all` com leitura em lote; (3) `congelarMesesFechados` para `after()` (é agregado recalculável, **não** é auditoria); auditoria continua antes da resposta | 19 → ~9 ondas [INFERÊNCIA pela leitura]; spinner solta no fim do POST [INFERÊNCIA] | `B-idas-acoes.mjs` (fechar) + `B-interacoes.mjs` (pior de 5 < 1,5 s) | **Médio (dinheiro)**: ordem "fecha → audita → responde" mantida; `after()` com log de falha |
| **6,0** | B-11 | "Ver comanda" pelo horário | Útil **3118/3270 ms** (pior tela medida); 2 requisições | < 1 s | [Idas em série] `redirect()` do servidor refaz auth + vínculo (`comanda/agendamento/[appointmentId]/page.tsx:38-39`) | Link direto para `/admin/comanda/<ticketId>` quando existe | ~metade [INFERÊNCIA: 2 renders → 1] | `B-tempos.mjs` (rota "comanda via agendamento") | Baixo |
| **4,5** | B-00a / E-01 | Toda leitura de `appointments`, `tickets`, `ticket_items` | 140 linhas: 0,28 ms sem RLS × **20–47 ms** com RLS; 10 mil linhas: **1.028–4.552 ms** | Contagem de 10 mil < 50 ms | [Banco] política com `security definer` e argumento de **coluna** → função por linha (`can_see_appointment`, `can_see_ticket`) | Pertença calculada **uma vez** (initplan): `tenant_id = any((select meus_tenants()))` e papel/profissional por `(select …)` (E-01) | 1.028–4.552 → **2,2–123 ms** em 10 mil linhas (FATO local, `B-explain-rls.txt`) | Mesmo `explain` com `authenticated` emulado; `pnpm test:rls` antes e depois; mutação na política reprovando | **Alto (RLS)** |
| **4,5** | B-04 | Criar agendamento `POST /appointments` | **13 idas, 12 em série** | ≤ 7 ondas | [Idas em série] `tenants` relido (`appointments/route.ts:34`; fuso já em `ctx.tenant`); `resolverCliente` não depende do anterior (`agendamentos.ts:102`); 3 contagens de risco independentes em série (`risco.ts:36,44,52`); auditoria e fecho da idempotência em série | Tirar a releitura; `Promise.all` em serviço/profissional/cliente e no risco; auditoria ∥ fecho da idempotência (auditoria segue antes da resposta) | 12 → ~7 ondas [INFERÊNCIA]; ~50 ms em produção [HIPÓTESE, ~10 ms/ida, `docs/28` §9] | `B-idas-acoes.mjs` (criar) | Baixo |
| **4,5** | B-07 | Adicionar item na comanda | **19 idas** em 2 requisições; 723/2059 ms até o item | 1 requisição, ≤ 8 ondas | [Idas em série] `contextoDePlano` em série (`tenants` → `tenant_modules`); `recalcularSubtotal` relê o ticket; `GET /tickets/:id` logo depois (`comanda.tsx:104,126`) | POST devolve `{ticket, items}`; `tenant_modules` em paralelo; sem reler o ticket | 19 → ~11 idas, 2 → 1 requisição [INFERÊNCIA] | `B-idas-ui.mjs` (adicionar) | Baixo |
| **4,0** | B-01 | **Toda** tela do painel | `getUser` (middleware) → `getUser` (página) → `memberships`, nas 3 primeiras ondas de 12 de 12 telas; TTFB do painel 359–1841 ms × públicas 26–140 ms; esqueleto não aparece na carga dura (FCP ≈ TTFB + ~200 ms) | −1 onda em toda requisição; casco antes do dado | [Idas em série + Rede] `middleware.ts:307`, `session.ts:43`, `tenant.ts:87`; `admin/layout.tsx:90` espera o contexto antes de mandar HTML | (a) `memberships` em **paralelo** com o `getUser` usando o `sub` do JWT e conferindo os ids no fim; (b) o layout transmite o casco antes do contexto (Suspense). "Passar o usuário por header" foi **recusado** em `docs/28` §9: não reabro | [HIPÓTESE] ~1 ida por requisição em produção (~10 ms); FCP antes do dado. Local: `getUser` custa 164 ms de mediana (FATO, `B-gotrue.mjs`), mas o GoTrue local abre conexão por consulta | TTFB e FCP de `/admin/hoje`, mediana de 10 quentes; ondas em `B-idas.mjs` | Médio (autenticação; testar sessão revogada) |
| **3,0** | B-02 | Abrir a Hoje (`resumo_central_de_acoes`) | RPC 58,5 ms com 140 linhas, dos quais **55,4 ms** são um `count(*)` de todos os agendamentos | RPC < 5 ms em 10 mil | [Banco] `count(*)` só para testar `=== 0` (`crm.ts:706,713`) | `exists(...)` | −55 ms com 140 linhas (FATO, `B-explain-quentes.txt`); cresce com o histórico | `explain analyze` do RPC no tenant de 10 mil | Baixo |
| **3,0** | B-15 | Carga fria do painel; abrir horário; buscar cliente | 2–4 tarefas longas por carga (maior 238–449 ms, CPU 4×); Agendar público 6 (859 ms somados); INP 208/216 e 216/352 | Nenhuma tarefa > 200 ms na carga da Hoje; INP < 200 | [Render no cliente + Hidratação] [HIPÓTESE] assistente (845 linhas) importado no topo do layout (`admin/layout.tsx:11`); lista inteira re-renderizada por tecla | Perfil de CPU **antes**; assistente sob demanda (`import()` ao tocar); `useDeferredValue` no filtro | [HIPÓTESE]. Como medir: aba Performance com CPU 4× nas 2 interações; repetir `B-tempos.mjs` com o assistente dinâmico | `B-tempos.mjs` (tarefas longas) + `B-interacoes.mjs` (INP) | Baixo; no celular o assistente vai para o topo (I-01), o que facilita carregar sob demanda |
| **3,0** | B-14 | `/admin/campanhas` | 12 idas em **9 ondas** (a pior proporção do painel); útil 1839/2685 ms | ≤ 5 ondas | [Idas em série] 4 `await` independentes em série (`campanhas/page.tsx:34, 61, 84, 103`); `receitaPorCampanha` sem limite (`atribuicao.ts:236-237`, corta em 1.000: E-02) | Um `Promise.all`; janela de tempo ou agregação no banco | 9 → ~5 ondas [INFERÊNCIA] | `B-idas.mjs` (Campanhas) | Baixo |
| **3,0** | B-10 | Ficha (32 idas), Caixa (14), Mês (26), Recuperar (17) | Ficha é a tela com mais idas | −2 a −6 idas por tela | [Idas em série] `tenants.settings` 2× no Caixa (`taxas-de-pagamento.ts:28`, `custo-fixo.ts:32`) e 3× no Mês; Ficha com `services`, `professionals`, `tenants` repetidos; comissão N+1 por profissional no Caixa (`caixa/page.tsx:100-117`); Recuperar espera tudo para buscar notas (`recuperar/page.tsx:127`) | `cache()` por requisição para `tenants`/`services`/`professionals` (o padrão de `vinculosAtivos`); `comNotas` no `.then` de `listarParaRecuperar`; comissão em 1 consulta | −2 a −6 idas por tela (FATO da contagem); tempo [HIPÓTESE] | `B-idas.mjs` por tela | Baixo |
| **2,0** | B-03 | Hoje lê demais | `tenants` 3× além do contexto (`orcamentos.ts:246`, `planos.ts:98`, `crm.ts:691`); `loyalty_entries` sem limite (`crm.ts:685`); `v_recover_revenue` inteira para 1 item (`recuperar-receita.ts:63`) | — | [Idas + Banco] | `ctx.tenant`; agregar no banco; `limit` real | Pouco hoje (paralelas); muito com volume [HIPÓTESE] | `B-idas.mjs` (Hoje) | Baixo |
| **2,0** | B-05 | Confirmar/Chegou/Faltou no servidor | 7 idas em série | 5 ondas | [Idas em série] `select` antes do `update` (`agendamentos.ts:649-667`) | `update … where status in (<origens>) returning *` numa ida; `select` só se nada atualizou | 7 → 5 ondas (FATO da contagem); o dono quase não sente (a tela já é otimista) | `B-idas-acoes.mjs` | Baixo |
| **2,0** | B-12 | Agenda/novo com `?cliente=` | `GET /clients/:id` no navegador depois de montar (3 idas); tocar antes faz o formulário recusar | Botão pronto na carga | [Idas em série + Sem feedback] `formulario.tsx:94-111` | Buscar no servidor junto com o resto | −1 requisição (FATO) | `B-idas.mjs` | Baixo |
| **1,5** | B-16 | `POST /public/[slug]/book`, confirmar por link | 3 limitadores + captcha em série (`book/route.ts:29,32,41,45`); confirmar relê a linha 2× (`confirm/[token]/route.ts:26` + `agendamentos.ts:564`) | — | [Idas em série] | Limitadores em paralelo; `update … returning` | Pequeno: as públicas já estão dentro da meta (útil < 700 ms) | `B-idas-acoes.mjs` | Baixo |
| **1,0** | B-13 | "Chamar" e 4 outros pontos | `product_events` com `await` antes de responder (`recuperar-receita.ts:434`; `public-booking.ts:478-484`; `clients/import/route.ts:47-49`; `ja-atendo/route.ts:66-69`; `onboarding.ts:231,238`) | — | [`await` no caminho crítico] | `after()` (lição da Hoje; o único `after()` do repositório é `hoje/page.tsx:140`) | O dono quase não sente no "Chamar" (o cliente usa `keepalive`) | Leitura do handler | Baixo |

**Escala (o que só aparece com volume e precisa de conserto antes de existir volume):**

| ID | O que quebra | Quando [INFERÊNCIA] | Conserto | Base |
| --- | --- | --- | --- | --- |
| B-00b / E-05 | Mês e Serviços não abrem | ~220 comandas em 90 dias (2,4 por dia) | Join (acima) | FATO: limite medido 200 ✓ / 220 ✗ |
| **N-01** (novo) | Recuperar inteiro cai | Lista com > ~210 pessoas; hoje o teto da lista é 200 (`recuperar-receita.ts:49`), a ~10% do limite medido | Sem lista de ids na URL (`notas-do-cliente.ts:83`) | [INFERÊNCIA]: limite do B + código |
| B-00a / E-01 | Hoje e Campanhas lentas; com ~18 mil a 80 mil agendamentos, consultas batem no `statement_timeout` de 8 s | 0,10–0,45 ms por linha × histórico do tenant | Initplan | FATO da forma do custo; número varia 4× entre rodadas |
| E-02 | 7 números cortados em 1.000 linhas, sem aviso | Tenant com > 1.000 `done` em 56 dias, ou > 1.000 ciclos `on_track` | Agregar no banco | FATO: `max_rows = 1000` |
| F-21 | Clientes com 295: 6,6 s até o título no celular 4× | Já com a base importada do 1º dia | [HIPÓTESE] lista inteira no 1º render; medir antes de escolher entre paginação real e virtualização | Medida única do F |

---

## 3 · As cinco causas estruturais, com arquivo e linha

### 3.1 RLS por linha (initplan)
- **FATO:** `appointments_select`/`_update` = `has_tenant(tenant_id) AND can_see_appointment(tenant_id, professional_id)`; as funções são `SECURITY DEFINER` com `SET search_path` (não são embutidas) e recebem **coluna** como argumento → uma chamada por linha (`pg_policies`, `pg_get_functiondef`; B-00a, E-01). `can_see_appointment` chama de novo `has_tenant`, `tenant_role`, lê `tenants.settings` e `my_professional_id`. `tickets`/`ticket_items` usam `can_see_ticket` → mesmo custo.
- **Medida:** 1.000 chamadas de `can_see_appointment` = 450,9 ms; de `has_tenant` = 16,5 ms; de `auth.uid()` = 0,5 ms (E). Comparação da Hoje com 30 linhas: 15,49 ms como `authenticated` × 0,053 ms como `postgres` (E).
- **Também:** 3 políticas jurídicas com `auth.role()` sem `(select …)` (E-11).
- **Conserto:** funções **sem** argumento de coluna, chamadas como `(select …)` (initplan), devolvendo conjuntos (E-01, SQL no relatório E). Semântica igual; `pnpm test:rls` prova. É o maior ganho por linha de código desta auditoria (E, recomendação 3).

### 3.2 `.in()` com URL longa
- **FATO:** `caixa.ts:265-276` (`margemDosServicos`, 90 dias de comandas) derruba Mês e Serviços com ~220 comandas (B-00b, reproduzido). O próprio `caixa.ts:197-204` explica por que `concentracaoDoMes` trocou esse padrão por join.
- **[INFERÊNCIA] latente:** `notas-do-cliente.ts:83` (`comNotas`, até 200 ids; limite medido ~210) (N-01).
- **Com teto (sem risco hoje):** `crm.ts:464` (lotes de `TAMANHO_LOTE_IN`), `importacao-clientes.ts:274` (grupos), `orcamentos.ts:283`, `quem-ja-atendo.ts:185` (dezenas).
- **Guarda proposta:** "nenhum `.in(` com lista sem teto em `src/server`", com a lista dos que têm teto e o motivo; piso = os 2 conhecidos (`caixa.ts`, `notas-do-cliente.ts`) devem reprovar antes do conserto.

### 3.3 Dois `getUser` em série + vínculo, antes de qualquer dado
- **FATO:** `middleware.ts:307` (`await db.auth.getUser()`, renova o token de 15 min) → `session.ts:43` (`sessaoAtual`, com `cache()`) → `tenant.ts:87` (`vinculosAtivos`, `memberships` com join de `tenants` e `professions`). Nas 3 primeiras ondas de **todas** as 12 telas medidas (B-01). As APIs pagam 1 `getUser` (o middleware sai antes em `/api/*`, `middleware.ts:286`: conserto do `docs/28` P1-a, de pé).
- **Decisão registrada:** o 2º `getUser` é mantido de propósito (`docs/28` §9: não confiar em header vindo do middleware). Não reabro.
- **Conserto possível sem reabrir:** pôr `memberships` em paralelo com o `getUser` da página, usando o `sub` do JWT, e conferir no fim que os ids batem (se não baterem, descartar e lançar). E o layout transmitir o casco antes de esperar o contexto, para o esqueleto aparecer na carga dura.

### 3.4 `router.refresh()`
- **FATO:** 32 chamadas em 21 arquivos (`grep -rn "router.refresh()" src --include=*.tsx`, conferido nesta fase). As que custam mais, medidas: Confirmar/Chegou/Faltou (+7 idas, `atualizar-depois.ts:20-30`); Fechar comanda (dentro da transição: segura o spinner, `comanda.tsx:158`); login (`entrar/formulario.tsx:70-71`, +2 renders da Hoje); cadastrar cliente (`clientes/nova/formulario.tsx:76-77`, `push` + `refresh`).
- **Regra para os tickets:** onde a resposta da API traz o dado, atualizar localmente; onde não traz, fazer a API trazer. `refresh` só onde a tela depende de dado que a ação não conhece, e sempre **fora** da transição (`useAtualizarDepois`).

### 3.5 Consultas em série que podem ir em paralelo

| Onde | O que espera o quê | Proposta |
| --- | --- | --- |
| `campanhas/page.tsx:34, 61, 84, 103` | 4 blocos independentes | `Promise.all` |
| `recuperar/page.tsx:127` | `comNotas` só depois de tudo | Encadear no `.then` de `listarParaRecuperar` |
| `caixa/page.tsx:100-117` | Comissão por profissional, uma por vez (N+1) | 1 consulta agrupada |
| `appointments/route.ts:34` | Relê `tenants` (o fuso já está no contexto) | Usar `ctx.tenant`; `settings` em paralelo |
| `agendamentos.ts:102` | `resolverCliente` depois de serviço/profissional | No mesmo `Promise.all` |
| `risco.ts:36, 44, 52` | 3 contagens independentes | `Promise.all` |
| `comanda.ts:285-292` | Laço de comissão por item | `Promise.all` com leitura em lote |
| `comanda.ts:251, 280`; `estoque.ts:19` | Relê `tenants` e itens | Passar o que já foi lido |
| `contextoDePlano` (vários) | `tenants` → `tenant_modules` | Paralelo |
| `book/route.ts:29, 32, 41, 45` | 3 limitadores + captcha | Paralelo |
| `confirm/[token]/route.ts:26` + `agendamentos.ts:564` | Mesma linha lida 2× | `update … returning` |

---

## 4 · Política de resposta otimista, ação por ação

Regra do contrato: pode ser otimista o que reverte sem dano; **não** pode o que mexe com dinheiro ou com conflito de agenda. Quem não é otimista mostra "enviando" **na hora** (< 100 ms).

| Ação | Otimista? | O que aparece no toque | Se falhar | Por quê |
| --- | --- | --- | --- | --- |
| Confirmar horário | **Sim** (já é, `useOptimistic` na Agenda) | Estado novo | Volta ao anterior + toast com o motivo | Reverte sem dano |
| Chegou / Faltou | **Sim** | Estado novo; na Hoje, também com `useOptimistic` (hoje não, C-09) | Volta + toast | Reverte sem dano |
| Mover item / filtros / trocar de dia / aba | **Sim** (marcar a escolha na hora) | Chip ou aba marcados + esqueleto | Volta à escolha anterior + aviso (C-20) | É navegação |
| Editar nota "Como atender" | **Sim** | Texto novo | Volta + "Não salvou, o texto ficou aqui" | Reverte sem dano |
| Favoritar / "Não chamar mais" | **Sim**, com desfazer | Item sai da fila | Volta | Reverte sem dano |
| **Criar agendamento** (painel e público) | **Não** | Botão "Marcando…"/"Enviando o pedido…" em < 100 ms (já é: 51–76 ms, B §4) | 409 com alternativas que ficam | Conflito decidido pela constraint `appointments_no_overlap` |
| **Remarcar** | **Não** | "Remarcando…" | 409 com alternativas (C-10) | Conflito |
| **Cancelar horário** | **Não** (mas com desfazer depois) | "Cancelando…" | Mensagem + horário volta | Libera vaga que outra pessoa pode pegar |
| **Receber (fechar comanda)** | **Não** | "Recebendo R$ X…" em < 100 ms (já é: 33 ms) | "Não tive resposta. Toque de novo: não fecha duas vezes." (chave estável) | Dinheiro |
| **Adicionar/remover item, desconto** | **Não** | Linha "adicionando…" | Mensagem; nada some | Dinheiro (B-07: o servidor ainda não segura duplicata) |
| **Desfazer fechamento / estorno** | **Não** | "Desfazendo…" | Mensagem | Dinheiro |
| **Vender pacote, usar sessão, crédito** | **Não** | "Registrando…" | Mensagem | Dinheiro |
| Excluir (cliente, serviço, conta) | **Não** | "Apagando…" | Mensagem | Irreversível ou LGPD |

---

## 5 · Retorno ao toque (sem feedback)

- **Ações que gravam** já reagem em 33–76 ms (FATO, B §3): manter o padrão do `Button` (`carregando` + `aria-busy`).
- **Navegação** é o furo: aba e chip de dia (B-09). Conserto I-03 (`02-interface.md`).
- **Toque engolido** (C-13): o `onBlur` dispara `pendente` e o botão vira `disabled` antes do `click`. Regra para os tickets: **nenhum `onBlur` que grava** num formulário que tem botão de enviar; o envio leva tudo.
- **Haptics:** existe `lib/haptics` (contrato B1). [NÃO VERIFICADO] onde é chamado; não proponho ampliar sem medir.

---

## 6 · Cold start, bundle e servidor pesado

- **De pé (B §8):** Sentry do servidor só com DSN; `sharp` fora do trace de `/admin/hoje` (145 arquivos, 4,13 MB). Dois arquivos novos importam `sharp` no topo (`portfolio-upload.ts`, `vitrine-upload.ts`), alcançados só pelas próprias rotas: manter assim, com a lição "separar o arquivo".
- **Novo, S3:** `web-push` entra no chunk `3090.js` (114 KB) que vai no trace da Hoje via `mensageria.ts:2`, sem uso nessa tela. `require` cru: 90–146 ms (B). Custo só no cold start, que é **um** por período ocioso (`docs/28` §8). [HIPÓTESE] < 50 ms dentro do bundle. Conserto barato: separar o envio de push num arquivo próprio, como o `sharp`. Prioridade baixa.
- **JS no cliente:** 175–208 KB transferidos por rota do painel (brotli), 149–163 KB nas públicas; compartilhado 104 kB, igual ao `docs/42`. A régua certa é transferido + tempo de execução (`docs/42` §7). O ganho maior está em B-15 (hidratação), não em bytes.

---

## 7 · O que só a produção responde (pedir ao Eduardo, só leitura)

| Pergunta | Por que importa | Como (com autorização) |
| --- | --- | --- |
| Região do banco de produção | Lição "função longe do banco" | Painel do Supabase |
| Custo real de 1 `getUser` e de 1 ida em `gru1` | Decide o tamanho do ganho de B-01 e B-04 | Logs da Vercel/Supabase |
| Limite de URL do gateway de produção | Decide quando B-00b e N-01 chegam | Logs de 414, ou teste numa conta de teste |
| Volume real por tenant (agendamentos, comandas em 90 dias, clientes) | Decide **quando** B-00a, B-00b, E-02 e N-01 chegam ao dono | `count(*)` por tenant |

---

## 8 · O que **não** fazer

- **Otimizar a trilha de auditoria** (decisão do `docs/28` §8).
- **Resposta otimista em dinheiro ou conflito de agenda** (seção 4).
- **Passar o usuário do middleware por header** (recusado no `docs/28` §9).
- **Cortar bytes crus** como meta (`docs/42` §7; memória "byte cru é a régua errada").
- **Biblioteca nova** de cache, estado ou virtualização sem medir peso e cold start (D5).
- **Medir com `pnpm dev`** e chamar de desempenho; **ler o cache uma vez** e chamar de medida (repetir 5×, mediana e pior).
- **Tirar o prefetch** de todos os links sem medir a 1ª troca de tela (B-17 × B-09).

## 9 · Gate G4

Cada conserto da tabela tem causa **medida** pelo B ou pelo E (contagem de idas, ondas, `explain`, reprodução de 414) ou arquivo e linha conferidos nesta fase. Os ganhos sem medida estão marcados [INFERÊNCIA] ou [HIPÓTESE] com como medir. **Ressalva:** tempos absolutos foram medidos com a máquina saturada; antes de fechar cada ticket, repetir o script do B com a máquina livre e reportar mediana e pior de 5. **G4 fechado com ressalva.**

---

## Correções após a revisão adversarial (prevalecem)

Fonte: `09-revisao-adversarial.md`. Onde esta seção contradiz o que está acima, **vale esta seção**.

1. **Base de comparação (R-21, R-26).** Nenhum aceite de tempo usa como "hoje" um número medido com a CPU a 94–99%. Exemplo: o "1.790 ms" do Receber. Antes de cada ticket, a base é medida de novo com a máquina livre (mediana e pior de 5) e o aceite compara com ela.
2. **Contra-aceites (R-21).** B-09/I-03: o tempo até o conteúdo novo não pode piorar. B-17: tirar o `refresh` ou o prefetch não pode deixar a 1ª troca de aba depois do login mais lenta. B-08: contar idas não basta; o "Recebido" no pior de 5 tem que cair contra a base refeita.
3. **B-00a / E-01, urgência (R-12).** É escala projetada (18–80 mil agendamentos) com volume de produção [NÃO VERIFICADO]. Sai da onda urgente imediata (U1) para a U2. Antecipa se a leitura de produção mostrar um negócio com > 5 mil agendamentos. Semântica a preservar: `restrict_professional_view`, `limit 1` do `my_professional_id` e `memberships.active` (R-11). As tabelas irmãs (`appointment_series`, `quotes`, comissões) vão para a APR-419.
4. **B-08 (R-03, R-04).** O laço por item e a baixa de estoque vão para a RPC `definer` de fechamento (APR-033a), que também conserta o profissional que hoje não consegue baixar estoque. `congelarMesesFechados` em `after()` continua certo (agregado recalculável). Atenção: `monthly_profit` é só inserção (R-28).
5. **E-02 (R-19).** "Agregar no banco" vale só para soma e contagem sem regra. A atribuição fica em `src/core` com paginação.
6. **Prioridade 1,5 (B-16, R-06).** O paralelismo dos limitadores do `/book` não pode mexer na ordem "limitador antes de qualquer leitura por telefone" (proteção contra sondagem).
