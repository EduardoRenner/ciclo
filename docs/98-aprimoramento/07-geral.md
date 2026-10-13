# 07 · Aprimoramento geral (Fase 6)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`, Parte C, Fase 6. Base: `origin/main` em `33058dd0`, 13/10/2026.
Insumos: relatórios dos agentes A–F, `03-funcionalidade.md` a `06-copy.md` desta rodada, `docs/DECISOES.md` (decisões de 31/08 sobre Playwright e de 19/08 sobre computador), leitura de `eslint.config.mjs`, `package.json`, `src/app/robots.ts`, `public/sw.js`, `capacitor.config.ts`.

**Como ler.** Cada item tem **valor para o dono** (o que ele sente ou o que o protege), **custo** (P ≤ 0,5 d · M 1–2 d · G 3–5 d), **risco** do conserto e **prioridade** (Alta · Média · Baixa). O ID `G-xx` é deste documento; entre parênteses, a origem. Nenhuma decisão do `DECISOES.md` é reaberta sem motivo novo escrito na própria linha.

---

## 1 · Segurança e LGPD visíveis

| ID | Item | Evidência | Valor para o dono | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-01 | **Comanda fechada editável e apagável por qualquer membro** pelo REST: gatilho que congela dinheiro em `closed/paid` + `revoke delete` | FATO: `pg_policies` (`tickets_delete`, `tickets_update`, `ticket_items_*` = `has_tenant`), 0 gatilhos (conferido nesta fase); a 0073 justifica com premissa falsa (E-04) | Ninguém da equipe muda a própria comissão nem apaga comanda; o caixa não muda depois de fechado | M | Médio (o estorno precisa passar pelo gatilho) | **Alta** (Onda U) |
| G-02 | Views com `GRANT ALL` para `anon`; funções `security definer` executáveis por `anon` | FATO (catálogo, E-10). Hoje sem vazamento (`security_invoker=true`, views não atualizáveis) | Defesa em profundidade | P | Baixo (`test:rls` antes) | Média |
| G-03 | **Nome real volta** depois de eliminação LGPD (corrida com o cron `segments`) | FATO: `segmentos.ts:49-69` faz upsert com `name` (C-24) | Pedido de eliminação cumprido de verdade | P | Baixo | **Alta** |
| G-04 | Fila offline **sem dono**: o próximo usuário do aparelho envia a fila do anterior | FATO: `queue.ts:8-14` (C-46) | Trilha de auditoria com o autor certo | P | Baixo | Média |
| G-05 | Páginas com token **sem `noindex`** e fora do `robots.txt` (`/confirmar`, `/avaliar`, `/orcamento`, `/lista-espera`) | FATO: `robots.ts` só bloqueia `/admin`, `/api`, `/entrar`… (lido nesta fase); F-14 (`medidas/F/tokens-*.json`) | Link com nome e horário de cliente não vai parar no buscador | P | Baixo | **Alta** |
| G-06 | Nome completo do cadastro vira público na página do negócio ("Quem atende: Dono faxina Agente F") sem perguntar | FATO (F-20) | Dono escolhe o nome de exibição | P | Baixo | Média |
| G-07 | Dado de saúde e assistente: a auditoria de 09/09 achou dado de saúde indo para o modelo | Memória da casa ("CICLO — auditoria do assistente": 8 defeitos) · [NÃO VERIFICADO] nesta rodada se o conserto está de pé | Regra inviolável 9 do `CLAUDE.md` | P (conferir) | — | **Alta** (conferir antes de qualquer outra coisa do assistente) |
| G-08 | Contexto do assistente recebe `no_show_count = 0` para todos (coluna sem escritor) | FATO (E-08) | O assistente não afirma "nunca faltou" de quem faltou | P | Baixo | Média |
| G-09 | Exportar dados do cliente só para o dono; cofre com trilha | FATO: `rbac.ts` (`client:export` só owner); decisão "### 2. A exportação da ficha… Fica?" em `DECISOES.md` | Já protege; manter | — | — | (manter) |
| G-10 | Excluir conta descarta a fila offline sem avisar | FATO (C, "Excluir conta") | O dono sabe o que perde | P | Baixo | Baixa |

## 2 · Observabilidade e falha silenciosa

| ID | Item | Evidência | Valor | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-11 | **Crons sem gatilho**: `expirar-graca` (plano nunca cai), `lgpd-retention`, `legal-intimacoes` | FATO: `grep expirar-graca .github/workflows/cron.yml` = 0 (conferido); C, tabela de crons | Cobrança e retenção LGPD funcionam sem depender de alguém lembrar | M | Médio (cobrança) | **Alta** (antes de ligar o Mercado Pago) |
| G-12 | Guarda "toda rota de cron tem gatilho **ou** motivo escrito" | Proposta do C (C-06) | O próximo cron sem gatilho reprova o build | P | Baixo | **Alta** |
| G-13 | **200 sem processar**: `campaigns`, `reminders`, `legal-intimacoes` batem heartbeat incondicional; `recompute-cycles` e `segments` ficam verdes com N−1 tenants falhando | FATO (C-23; C, "Respondem 200 sem processar") | O vigia acusa quando o Motor para de calcular | P | Baixo | **Alta** |
| G-14 | **Vigia do vigia**: o único leitor automático de `/api/health` é um job do GitHub Actions, que atrasa 5–6,5 h e já parou 54 h por cobrança | FATO (`cron.yml:32-36`; memórias "cron do GitHub atrasa em horas", "cron parado por billing") | Saber em minutos, não em dias, que o Motor parou | P–M (ex.: pg_cron que grava alerta, ou monitor externo grátis lendo `/api/health`) | Baixo | Média |
| G-15 | **Telas que engolem erro e mostram zero**: Hoje (4 de 5 consultas com `.catch` que loga e devolve zero), Campanhas (`.catch` devolve zero) | FATO: `hoje/page.tsx:83-126`; A §2.3 | Zero que é falha não parece "dia fraco" | P | Baixo | **Alta** (junto com I-04) |
| G-16 | `conferir-schema-prod` compara **contagem** com o código **publicado**: migration faltando no meio passa | FATO: `conferir-schema-prod.mjs:9-11,42-44` (C-27) | "Produção atrás do código" vira alarme, não surpresa | P | Baixo | **Alta** |
| G-17 | `notificarEquipe` com `void` sem `after()` na página pública: pode ser cortado pela Vercel | [INFERÊNCIA] (B-16) | O dono recebe o aviso de horário novo | P | Baixo | Média |
| G-18 | Keep-alive `pg_cron` a cada 5 min **ignora o 503** | FATO (C, tabela de crons) | — (só mantém acordado) | P | Baixo | Baixa |

## 3 · Testes

| ID | Item | Evidência | Valor | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-19 | **Teste-bomba de calendário**: `HOJE='2026-10-08'` fixo reprova todo dia desde 09/10; CI do `main` provavelmente vermelha | FATO (C-36): 2 falhas determinísticas em série; CI [NÃO VERIFICADO no GitHub] | CI vermelha por motivo conhecido esconde o próximo vermelho de verdade | P (meia hora) | Baixo | **Alta** (1º da fila) |
| G-20 | **Guarda cega de raiz**: `rede-nao-derruba-tela` só varre `src/app`; o defeito mora em `src/components` (C-05, reproduzido nesta fase) | FATO: `rede-nao-derruba-tela.test.ts:80`; o mesmo detector sobre `src/components` acusa o arquivo (C) | A tela não cai quando a rede pisca | P | Baixo | **Alta** |
| G-21 | **e2e inexistente.** Decisão de 31/08 (`DECISOES.md`, "Não montei o Playwright"): "a CI não roda e2e, o harness precisaria de navegador baixado e servidor de pé". **Motivo novo:** esta auditoria achou **10 defeitos S0/S1 que só aparecem no navegador** (F-01, F-02, C-05, C-07, C-13, C-19, C-45, C-48, A-01, A-03), todos com teste unitário verde. **Proposta sem violar a decisão:** manter o Playwright **fora** do `package.json` (como nesta rodada, `C:\temp\ciclo-medicao`) e versionar os roteiros como `.txt` em `docs/` (padrão já usado), com um gate manual "roteiros da Onda U passam" antes de cada deploy. **Proposta que revê a decisão** (para o Eduardo escolher): 5 fluxos e2e na CI (agendar público com corrida, receber, chegou, fila offline, folga sem rede) | FATO dos 10 casos (`03-funcionalidade.md` §1) | Defeito de tela pego antes do cliente | Fora do repo: P · na CI: G | Na CI: tempo de CI (~5 min a mais por push, lição "vários commits num PR") | **Alta** (decisão do Eduardo) |
| G-22 | **Fuso nos testes**: a CI roda em UTC e a máquina do Eduardo em UTC−3; nada obriga um terceiro fuso | FATO: `vitest.config.ts` sem `TZ`; suíte passa em UTC, SP, Tóquio, Manaus (C) | O próximo teste dependente de fuso aparece no PR, não na Vercel | P (job com `TZ=Pacific/Kiritimati`) | Baixo | Média |
| G-23 | **Testes que passam vazios**: 9 casos com `return` por condição; asserções de vazio sem positivo (`crm.test.ts:233`, `:591`; `rls/isolation.test.ts:645`) | FATO (C, EVIDÊNCIAS) | Verde que prova o cenário | M | Baixo | Média |
| G-24 | **Suíte de banco intermitente** em paralelo (6 de 7 vermelhos eram carga) | FATO (C, saída do verify) | `pnpm verify` confiável na máquina do Eduardo | P (`--no-file-parallelism` no verify local ou timeouts) | Baixo | Média |
| G-25 | Sem jsdom: componentes com estado (C-09, C-13, C-19, C-20) não têm teste de unidade | FATO: `vitest.config.ts` `environment: 'node'`; decisões em `DECISOES.md` (linhas 1039, 3062, 7726) aceitam a limitação | — | — | — | **Não fazer agora** (ver §11): cobrir pelos roteiros de G-21 |
| G-26 | Guardas novas desta rodada, todas com controle positivo e vistas reprovando: `horaLocal` com fuso (C-07), `.in(` sem teto (B-00b, N-01), rota de escrita com chamador (C-37, C-38, C-40, C-41), `page.tsx` com referência (C-39), `${APP_URL}/<seg>/` com pasta (C-37), chave de idempotência fora do handler (C-12), consulta sem teto em tabela que cresce (E-02), cron com gatilho (C-06), copy (gênero, travessão em `route.ts`, "em breve", plano por nome) | `03`, `05`, `06` | Regressão pega no build | M (somadas) | Guarda cega é o risco: seguir o procedimento do `CLAUDE.md` | Alta (cada uma no ticket do seu defeito) |

## 4 · Dívida técnica que trava evolução

| ID | Item | Evidência | Valor | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-27 | **Arquivos gigantes** nas telas mais mexidas: `agendar.tsx` 1.356 linhas, `ficha.tsx` 1.004, `crm.ts` 901, `assistente-flutuante.tsx` 845, `agendamentos.ts` 772, `hoje.tsx` 553 | FATO (`wc -l`, nesta fase) | Consertos da Onda U (F-01, C-01, C-07) ficam menores e revisáveis | M por arquivo | Médio (refatorar junto com conserto de S0 mistura riscos) | **Média**: extrair só o que o ticket toca (ex.: a grade de horários de `agendar.tsx` vira componente compartilhado em I-10) |
| G-28 | **Fórmulas duplicadas**: "Atendido" × "Entrou" × "Motor trouxe" (C-26); comissão do clube × comanda (E-13); 3 mapas de estado do horário (D); `horaLocal` com fuso opcional (C-07) | FATO | Um número certo em todas as telas | M | Médio | **Alta** (antes de redesenhar Caixa, Mês e Hoje) |
| G-29 | **Capacidade morta**: `payments` (0 leitor, 0 escritor), `commissions`, `service_categories`, `webhook_events`, `v_daily_cash` (dia em UTC), `messages.scheduled_for` + índice, `clients_name_trgm` (5 MB, 0 leitura), `cron/jobs` com `HANDLERS = {}` | FATO (E-08, E-12, C-35, C-52) | Menos armadilha para quem vier depois; escrita de cliente mais leve | M | Médio (conferir funções SQL antes; lição "capacidade morta em produção não é morta") | Média. **`payments` depende da decisão do pacote (C-02)**: não apagar antes |
| G-30 | **Releituras de `tenants`** voltaram em 6 lugares depois do `docs/28` §8 | FATO (B §8) | Menos idas | P | Baixo | Média (vai junto com B-04, B-07, B-08) |

## 5 · Acessibilidade além do axe

| ID | Item | Evidência | Valor | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-31 | **Leitor de tela real** (TalkBack e VoiceOver) nunca usado | [NÃO VERIFICADO] (A, incertezas): sem aparelho | Quem usa leitor consegue agendar e confirmar | M (1 rodada com aparelho) | — | Média |
| G-32 | **Zoom 200%** não medido como zoom | [INFERÊNCIA] do A pela largura CSS de 640 px | — | P | — | Baixa |
| G-33 | `--ok` sobre `--surface-2` = **4,18:1** (abaixo de 4,5): achado no protótipo pelo axe; é a combinação de `config/automacoes` (`automacoes.tsx:85`, A-17) | FATO (axe nesta fase) | Texto de estado legível | P | Baixo | Média; guarda: o teste de contraste (`tests/unit/design/contraste.test.ts`) passa a medir **texto semântico sobre `--surface-2`** |
| G-34 | Foco depois de abrir sheet, de um 409 e de trocar de dia | Proposto nos protótipos (aviso de 409 recebe foco); [NÃO VERIFICADO] no produto | Leitor e teclado sabem o que mudou | P | Baixo | Média |
| G-35 | Alvos abaixo de 48: onboarding "Pular" (16–18 px), dias a 360 (43–44 px), "Registrar compra" (15 px), links dos termos (17 px) | FATO (A-11, A-15, A-19) | Toque com uma mão | P | Baixo (atenção ao `toque-48` em 2 links do mesmo parágrafo) | Média |
| G-36 | Overline de 11 px em 22 telas | FATO (A-20) | Leitura | P | Baixo | Baixa |

## 6 · SEO e páginas públicas

| ID | Item | Evidência | Valor | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-05 | `noindex` nas páginas com token (ver §1) | FATO | Privacidade | P | Baixo | **Alta** |
| G-37 | Descrição padrão "profissionais da beleza… Motor de Ciclo… recuperação de receita" em entrar, cadastro, 404 e páginas de token; 5 versões da descrição do produto | FATO (D-15, F-14) | Prévia certa no WhatsApp e no buscador para as 17 profissões | P | Baixo | Média |
| G-38 | Sem `og:image` em `/precos`, `/calculadora`, `/links`, `/[slug]/agendar`; título das páginas de token sem nome do negócio | FATO (F-14) | Link compartilhado parece do negócio | P | Baixo | Média |
| G-39 | **Slugs que o redirect 308 sequestra** (`agenda`, `caixa`, `config`, `clientes`, `comanda`, `recuperar`): aceitos no cadastro | FATO: `next.config.ts:31`; `slugs-reservados.ts:24-48` (C-43) | A página do negócio abre | P | Baixo | **Alta** (barato e permanente: 308 é cacheável) |
| G-40 | `llms.txt` com travessão e "salão" | FATO (D-29, D-48) | Robôs de IA descrevem o produto certo | P | Baixo | Baixa |
| G-41 | Prova de produto na 1ª dobra da landing (`docs/38` peça 2) | FATO (F) | Conversão | M | Baixo | Baixa (decisão de marketing) |

## 7 · App nas lojas (Capacitor)

FATO: `capacitor.config.ts`, `android/` e `ios/` existem; `docs/64-APP-STORE-CAPACITOR-PLANO.md` descreve o plano; a memória da casa registra "adiado até…". **Não proponho subir agora.** O que muda na interface **quando** for (pré-requisitos medidos nesta rodada):

| ID | Pré-requisito | Por quê |
| --- | --- | --- |
| G-42 | Página offline para `/admin` (hoje o navegador mostra o dinossauro, C-48, reproduzido) | No app embrulhado a tela de erro do Chrome seria pior: parece app quebrado |
| G-43 | Fila offline que drena ao abrir (C-45) | App é aberto e fechado; o evento `online` raramente acontece com ele aberto |
| G-44 | Voltar do Android segue `paiDaRota` (Campanhas e Orçamentos voltam para Configurações hoje, A-13) | Botão físico de voltar |
| G-45 | Assistente fora de cima da ação (I-01) e área segura (notch, barra de gestos) | Barra de gestos cobre a barra inferior |
| G-46 | Push nativo × web push | `web-push` hoje entra no bundle da Hoje sem uso (B §6) |

## 8 · Custos de infraestrutura ligados a desempenho

| ID | Item | Evidência | Valor | Custo | Prioridade |
| --- | --- | --- | --- | --- | --- |
| G-47 | **Prefetch de rota dinâmica custa invocação**: cada `<Link>` visível roda o layout no servidor (2 `getUser` + vínculo); 1 login = 69 idas e 11 requisições | FATO (B-17, `B-idas-ui.json`) | Menos invocações da Vercel por usuário ativo | P (medir com B-09) | Média |
| G-48 | **RLS por linha** é CPU do banco em toda leitura de agenda e comanda; cresce com o histórico | FATO (B-00a, E-01) | Banco menor por mais tempo (o plano do Supabase sobe por CPU e por tamanho) | M | Alta (já na Onda U) |
| G-49 | Custo fixo mensal e ponto de equilíbrio | `docs/88-CUSTOS-PREVISAO-E-METAS-PLANO.md` (memória: fixo ~R$ 433/mês, equilíbrio 8 pagantes) · [NÃO VERIFICADO] nesta rodada | — | — | (referência) |
| G-50 | Limite de e-mail do Supabase é **por projeto**: script ou teste em `/recuperar-senha` queima a cota de todos | Memória da casa ("Supabase · limite de e-mail é do projeto") | Cadastro de cliente novo não para por cota | P (SMTP próprio, decisão do Eduardo) | Média |

## 9 · Documentação obsoleta

| ID | Onde | O que diz | O que é | Prioridade |
| --- | --- | --- | --- | --- |
| G-51 | `CLAUDE.md` | "Workbox" na deny-list | Service worker escrito à mão (`public/sw.js`) (C) | Média |
| G-52 | `CLAUDE.md` | "Dinheiro entra em `payments`, receita em `ticket_items`" | `payments` sem leitor nem escritor (C-02) | **Alta** (é regra que alguém vai seguir) |
| G-53 | `docs/97` (contrato) | 64 páginas, 118 rotas, migrations até 0101 | 70 páginas, 137 handlers, 116 migrations até 0117 sem a 0101 (A, C) | Baixa |
| G-54 | `docs/02-API.md` | ~12 rotas que não existem (`POST /tickets`, `tickets/:id/pay`, `refund`, `clients/merge`…) | Árvore real em `src/app/api` (C-44) | Média |
| G-55 | Migration 0073 | "as rotas do app usam service_role" | Usam o cliente do usuário (`close/route.ts:22`) (E-04) | Alta (vai junto com G-01) |
| G-56 | Comentários de `cron/jobs` | `registro.ts` | Não existe (C-35) | Baixa |
| G-57 | `lib/formato.ts:32-38` | "o fuso do navegador da profissional já é o do salão" | O HTML sai do servidor em UTC (C-07, reproduzido) | Alta (vai junto com C-07) |

## 10 · Build, desenvolvimento, migrations e seed

| ID | Item | Evidência | Valor | Custo | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| G-58 | **Migrations 0101 e 0118 de outras branches vão colidir**: a 0101 da fila (PR #142) é menor que a 0117 já aplicada (o `db push` recusa); a 0118 do PR #149 colide com a próxima de qualquer branch. Se a antiga `0101_pacote_advocacia` chegou a ser aplicada em produção na janela de ~1h20, a 0101 nova seria **pulada em silêncio** | FATO (`git`, E-09); produção [NÃO VERIFICADO] | Nenhuma coluna "existe no repositório e não no banco" | P (renumerar no merge; conferir `schema_migrations` por nome) | Médio | **Alta** (antes de mesclar #142 ou #149) |
| G-59 | **Conferir a `0102` em produção** antes de qualquer deploy: `tenant.ts:89` lê `professions(vocab, pacote)` em todo request | [NÃO VERIFICADO] (C, S0 condicional) | Painel não cai para todos | P (leitura autorizada) | — | **Alta** (Eduardo) |
| G-60 | **Seed de demonstração não serve de prova**: 100% de comparecimento, 57% na terça, 81% às 9h, 0 comandas e 0 pagamentos nos 6 negócios, Motor não rodado, só login de dono, sem login da advocacia; `seed-demo-dinheiro` quebra em negócio sem "Barba" (`:279`) e dá lucro = faturamento | FATO (E-07; `01-diagnostico.md` §6) | Medir Caixa, Mês, Comissão, Recuperar e papéis de verdade antes de redesenhar | M | Baixo (seed local) | **Alta** (antes da Onda 1 nas telas de dinheiro) |
| G-61 | Guarda de distribuição do seed (comparecimento 80–95%, nenhum dia > 30%, comandas > 0) | Proposta do E | O seed não volta a ser absurdo | P | Baixo | Média |
| G-62 | **Build local de 10 min 12 s** neste Windows (Smart App Control) | FATO (`01-diagnostico.md` §1; memória "Smart App Control deixa build lento") | Ciclo de verificação mais curto | — (configuração da máquina) | — | Baixa |
| G-63 | **Scripts de medição em `docs/98-aprimoramento/medidas/*.mjs`** (35 arquivos dos agentes) entram no `eslint .` | FATO: `eslint.config.mjs` não ignora `docs/**`; rodei `npx eslint docs/98-aprimoramento/medidas/*.mjs`: **0 erros, 3 avisos**; `lint` = `eslint .` sem `--max-warnings` → **não quebra hoje** | Commit desta branch sem surpresa | P (renomear para `.txt` ou ignorar `docs/**/medidas/**`) | Baixo | Média (antes de commitar) |
| G-64 | Variáveis de contato (`NEXT_PUBLIC_CONTATO_*`) e remetente do SMTP de produção | [HIPÓTESE] (F-25) | Termos, privacidade e "Me manda que eu faço" com canal real | P (Eduardo) | — | **Alta** (pré-lançamento) |

---

## 11 · O que **não** fazer agora, e por quê

| Não fazer | Por quê |
| --- | --- |
| Otimizar a trilha de auditoria | Decisão do `docs/28` §8: a auditoria fica no caminho crítico |
| Pôr Playwright no `package.json` sem a decisão do Eduardo | Decisão de 31/08; G-21 dá o caminho que não a viola e expõe o motivo novo |
| Montar jsdom para testar componente | As decisões de `DECISOES.md` aceitam a limitação; os roteiros de navegador cobrem melhor o que quebrou (toque, fuso, rede) |
| Subir o app nas lojas | `docs/64` adiado; os pré-requisitos G-42 a G-46 ainda falham |
| Apagar `payments` | Depende da decisão do épico de pacote (C-02); "capacidade morta em produção não é morta" |
| Refatorar arquivo gigante inteiro junto com conserto de S0 | Mistura risco; extrair só o pedaço que o ticket toca |
| Ligar `reminders` e `campaigns` | Latentes conhecidos (janela de 3 h com cron que atrasa 5–6 h; lembrete que manda "responder") |
| Prettier em massa | Decisão registrada (o projeto não tem config de Prettier) |
| Biblioteca nova (`.xlsx`, virtualização, cache) | Custo de peso e cold start não medido (D5) |
| Reabrir "duas colunas no computador" como prioridade | Fica no fim da Onda 1 (I-05), depois do que o dono sente no celular |

## 12 · Gate G6

Cada item tem valor, custo, risco e prioridade; o que não fazer está na §11. Decisões reabertas com motivo novo escrito: **G-21** (e2e, motivo: 10 S0/S1 só visíveis no navegador) e **I-05** em `02-interface.md` (duas colunas, motivo: vazio medido e pedido explícito do contrato). **G6 fechado.**

---

## Correções após a revisão adversarial (prevalecem)

Fonte: `09-revisao-adversarial.md`. Onde esta seção contradiz o que está acima, **vale esta seção**.

1. **G-01 (R-02).** O gatilho é só `before update`, por `OLD.status` e só nas colunas de dinheiro. O DELETE de item fora de `open` sai por política, e `revoke delete` só em `tickets`. Não existe estorno de dinheiro, só "cancelar comanda fechada".
2. **G-02 / E-10 (R-10).** A `0117` já revogou as tabelas de `anon`. Faltam as 5 views e as sequências. **Não** revogar EXECUTE de `has_tenant`, `tenant_role`, `my_professional_id` e `can_see_appointment`: a `0004` e a `0036` explicam que isso transforma "0 linhas" em erro e quebra a RLS.
3. **G-05 (R-09).** Só `noindex` (metadata + `X-Robots-Tag`). Pôr as rotas no `Disallow` do `robots.txt` impede o buscador de ler o `noindex` (documentação pública do Google, `developers.google.com/search/docs/crawling-indexing/block-indexing`). Prioridade: Média (as páginas quase não têm tráfego com o lembrete desligado).
4. **G-07 (R-15).** A guarda já existe e está de pé (`tests/unit/assistente/contexto-do-modelo-nao-leva-saude.test.ts`; `ferramentas.ts:177-234`). A lacuna real é o `client_note` (texto livre). Prioridade: Média.
5. **G-21 (R-26).** São **6** S0/S1 que só aparecem no navegador (F-01, F-02, C-05, C-07, C-45, C-48), e não 10: A-01, A-03, C-13 e C-19 são S2. O motivo novo continua válido.
6. **G-14 (R-27).** O `pg_cron` já existe (`0087`, keep-alive em `0090`). O "vigia do vigia" pode usar a mesma base, sem serviço novo.
7. **G-26 e segurança (R-31).** Toda função nova leva `revoke execute … from public, anon` (o Postgres dá EXECUTE a `PUBLIC` por padrão), e toda view nova leva `revoke all … from anon`. Uma guarda de catálogo confere as duas coisas.
8. **G-60 (R-30, R-31).** A guarda de distribuição do seed é integração ou script com saída numérica, não `tests/unit`. O seed aborta se a URL do banco não for local. As senhas dos papéis são geradas e não versionadas. Os papéis do seed passam a 4 (profissional, recepção, gerente, financeiro).
9. **Novo, G-65 (R-01).** A execução do plano começou antes do G8, na mesma branch dos documentos. Valor: plano e código separados, e PR de plano sem código. Custo: P. Prioridade: **Alta**.
10. **Novo, G-66 (R-27).** O agente G (concorrentes) não entregou: o item "Referências com fonte" do G0 está aberto. Prioridade: Baixa (decisão do Eduardo: fazer ou dispensar).
11. **Novo, G-67 (R-06).** `idempotency_keys.response_body` guarda por 30 dias o que a rota devolve. Na rota pública, isso incluiria o `reconhecimentoToken`, que tem o telefone legível em base64url (`token-assinado.ts:53-55`). Valor: LGPD. Custo: P (dentro da APR-004). Prioridade: Alta, junto com a APR-004.
12. **§7 App nas lojas (R-27).** Os pré-requisitos G-42 a G-45 estão cobertos pelas APR-611, 021, 121 e 101: marcá-los como "pré-requisito das lojas" nesses tickets.
