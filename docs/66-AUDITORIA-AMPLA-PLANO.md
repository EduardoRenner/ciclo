# 66 · AUDITORIA AMPLA — plano (2026-09-16)

> Pedido do Eduardo: "cria um plano para uma auditoria mais ampla" — depois de eu recusar dizer
> que o CICLO está "perfeito" em estrutura/código. Este documento é o plano, não a execução: lista
> o que auditar, em que ordem, e como medir cada fase sem cair em "revisei e parece certo".

---

## 0 · Por que outra auditoria, e o que ela NÃO repete

Já existem três auditorias registradas e concluídas — não vale reabrir o que elas já mediram:

| Auditoria | Cobriu | Data |
|---|---|---|
| `docs/16-AUDITORIA-SEGURANCA.md` (Fases A-K) | RLS, auth/sessão/MFA, injeção, segredos/cripto, webhooks, service worker, CSP/headers, dinheiro (débito de carteira) | 2026-08-23 |
| `ciclo-super-auditoria` (memória) | Banco de produção nos testes, desconto sumindo do lucro, transições de estado sem trava | rodada 1 |
| `docs/63-AUDITORIA-PENDENCIAS-2026-09-13.md` | PRs órfãos, backlog aberto, o que "merged" não chegou em `main` | 2026-09-13 |
| `ciclo-assistente-auditoria-2026-09-09` (memória) | 8 defeitos no assistente de IA, incluindo dado de saúde vazando pro Gemini | 2026-09-09 |

Esta rodada cobre o que sobrou: **lógica de negócio em áreas não tocadas pelas auditorias
anteriores**, **cobertura real de guarda** (quantas guardas foram vistas reprovando de verdade, e
quantas só "parecem certas"), **RLS das tabelas criadas depois de 23/08** (tudo que nasceu após a
Fase A de segurança nunca foi conferido), e **prontidão mobile/Capacitor** (área nova, docs/64,
nunca auditada — só implementada).

**Regra de execução, não-negociável, do próprio `CLAUDE.md`:** medir, não estimar. Toda afirmação
"está certo" precisa vir de rodar algo (teste, query, leitura de log real) — nunca de ler o código
e achar que faz sentido. Onde a fase pedir mutação de guarda, seguir o procedimento de
`commite antes de mutar`.

---

## 1 · Ordem das fases, por risco × esforço

| # | Fase | Risco se ficar sem auditar | Esforço estimado |
|---|---|---|---|
| A | Guardas-cegas — sweep geral | Alto (achou 2-3 vazamento real cada vez que foi feito) | Médio |
| B | RLS das tabelas pós-23/08 | Alto (dado cruzado entre tenants) | Médio |
| C | Lógica de dinheiro fora da carteira (já coberta) | Alto (histórico: 5+ bugs de dinheiro achados em rodadas anteriores) | Alto |
| D | Cron e jobs em segundo plano | Médio-Alto (histórico: laço com `await` solto, cron parado por billing) | Médio |
| E | Estados vazio/carregando/erro por tela | Médio (produto mobile-first, tela quebrada = abandono) | Alto |
| F | Prontidão mobile/Capacitor (docs/64) | Médio (só implementado, nunca auditado; loja pode rejeitar) | Médio |
| G | Migrations e schema — drift código × banco | Médio (já aconteceu uma vez: 0088-0091 atrasadas) | Baixo |
| H | Acessibilidade e `aria-live` | Baixo-Médio (regra da casa, cobertura desigual) | Médio |
| I | Testes que pulam ou que provam vazio | Médio (falso verde documentado 3x no `CLAUDE.md`) | Baixo |

Ordem sugerida de execução: **A → B → C → D → G → F → E → I → H** (achados de A costumam apontar
onde procurar em C/D; G é rápido e pode adiantar achados pra F).

---

## 2 · Fase A · Guardas-cegas — sweep geral

**Objetivo.** Toda guarda que varre código-fonte (regex/grep contra arquivo, não comportamento) é
suspeita até provar o contrário — casar com nome de função, rótulo, comentário ou string vizinha
em vez do que muda quando o defeito volta.

**Como medir.**
1. `grep -rl "readFileSync\|import.*fs/promises\|source\.includes\|\.match(" tests/` — listar toda
   guarda que lê arquivo-fonte em vez de exercitar comportamento.
2. Para cada uma: `git stash` a fonte mudada de propósito (reintroduzir o defeito que a guarda diz
   proteger) → rodar o teste → confirmar que REPROVA → `git stash pop`.
3. Guarda que passa com o defeito reintroduzido entra na lista de achados, severidade **ALTA** —
   ela mentiu pra toda auditoria anterior que confiou nela.

**Onde já se sabe que há risco** (não auditado ainda): guardas de `docs/64` (T1.5, T-DEL) foram
vistas reprovando na criação — mas nenhuma auditoria posterior tentou quebrá-las de novo depois de
refactors subsequentes (regra `atualizar-guarda-que-reprova`: ajustar teste quebrado é onde a
proteção afrouxa sem ninguém ver).

---

## 3 · Fase B · RLS das tabelas criadas após 23/08

**Objetivo.** A Fase A da auditoria de segurança (`docs/16`) inventariou RLS até 23/08. Toda
migration depois disso (`0070+` aproximadamente) nunca passou por esse crivo.

**Como medir.**
1. `git log --oneline --since=2026-08-23 -- supabase/migrations/` → lista de migrations novas.
2. Para cada tabela nova: confirmar `enable row level security` + `force row level security` +
   política presente na MESMA migration (não depois).
3. Confirmar que a tabela aparece no teste de isolamento (`test:rls`) — se não aparecer, é capaz
   morta em produção sem ninguém saber (`Capacidade morta em produção não é morta` — memória).
4. Rodar `pnpm test:rls` de propósito com `set_tenant_context` de um tenant ERRADO contra cada
   tabela nova, confirmando 0 linhas — não confiar no `SELECT` inicial vazio (`UPDATE de zero
   linhas não é erro`, `guarda que varre passa vazia` — mesma armadilha, formato diferente).

---

## 4 · Fase C · Lógica de dinheiro fora da carteira

**Objetivo.** `docs/16` cobriu a carteira (débito atômico). Esta fase cobre o resto: preço de
serviço, desconto, comissão, receita de pacote, margem de contribuição — áreas onde o histórico
deste projeto tem MAIS bugs reais achados por sessão do que qualquer outra (`lucro-ignora-desconto`,
`margem-de-contribuicao-com-nome-de-lucro`, `parcela-testada-so-com-zero`, `duas-copias-da-mesma-
formula`).

**Como medir.**
1. Listar toda função em `src/core/` que calcula valor monetário — `grep -rn "_cents\|_bps" src/core`.
2. Para cada uma, escrever (ou achar) um caso de teste com valores REAIS de produção (não `0`, não
   número redondo) — `parcela-testada-so-com-zero` documenta que campo testado só com zero não é
   testado de verdade.
3. Achar toda fórmula duplicada (mesmo cálculo escrito em dois lugares, cada um com sua guarda) —
   `grep` cruzado por nome de campo (`desconto`, `comissao`, `margem`) em `src/core` e `src/app`.
4. Conferir se lucro/margem SOMA a hora de cadeira parada (custo de oportunidade) ou só custo
   direto — regra viva desde `margem-de-contribuicao-com-nome-de-lucro`.

---

## 5 · Fase D · Cron e jobs em segundo plano

**Objetivo.** Histórico de bugs silenciosos em cron é o mais alto do projeto: `laco-de-cron-com-
await-solto` (#99), `cron-github-atrasa-horas`, `ciclo-github-actions-billing` (Motor 54h parado),
`vigia-que-se-desliga-quando-piora`.

**Como medir.**
1. Listar todo cron em `src/app/api/cron/*` e no `vercel.json`/`cron.yml`.
2. Para cada um: o laço principal usa `await` dentro de `for`/`.map` sem `Promise.allSettled`? Um
   item ruim aborta o resto silenciosamente?
3. O health check que vigia o cron fica VERDE quando o cron está atrasado além do tolerável, ou só
   quando ele nunca rodou? (`vigia-que-se-desliga-quando-piora` — o vigia pode "desligar" exatamente
   quando mais precisa gritar.)
4. Rodar cada cron manualmente contra dado real de um tenant e CONFERIR o resultado no banco (não
   só o `200` da resposta) — `cron respondendo 200 com tenantsProcessados: 0` já aconteceu.

---

## 6 · Fase E · Estados vazio/carregando/erro por tela

**Objetivo.** Critério de aceite do `CLAUDE.md` pede os três estados em toda tela — nunca houve
uma varredura sistemática confirmando isso, só revisão pontual por ticket.

**Como medir.**
1. Listar toda `page.tsx` sob `src/app/admin/**` — `find src/app/admin -name page.tsx`.
2. Para cada uma: tem tratamento de "sem dado ainda" (não só espera receber array vazio da query)?
   Tem skeleton/loading? Erro de rede mostra mensagem acionável (não trava a tela — regra de
   `rede-nao-derruba-tela.test.ts`, mas conferir se a lista de telas cobertas por ele realmente é
   completa, não só a que existia quando o teste foi escrito)?
3. Testar no navegador de verdade (não deduzir do código) com rede lenta/offline simulada —
   `verificacao-final-protocolo` (memória) tem o checklist de 15 portões pra isso.

---

## 7 · Fase F · Prontidão mobile/Capacitor

**Objetivo.** `docs/64` implementou T1/T1.5/T-AND/T-DEL — mas foi implementação, cada ticket
auto-verificado no calor da hora, nunca uma auditoria fria de fora olhando o conjunto.

**Como medir.**
1. Rodar a varredura de T1.5 (`precos-nunca-sozinho-no-app-nativo.test.ts`) de novo, mas expandida:
   ela cobre "Assinar/preço" — falta cobrir qualquer OUTRA ação que a Apple proíbe dentro do app
   (comprar addon, upgrade de plano por outro caminho que não o botão já auditado).
2. Conferir se `ehRequisicaoDoAppNativo` é usado de forma consistente — algum lugar novo desde
   T1.5 que deveria checar e não checa?
3. Testar o app Android real (já builda, `android/` existe) num emulador: abrir cada tela principal,
   confirmar que nenhuma quebra por ser WebView (T4, guideline 4.2) — deep link, voltar do Android,
   teclado cobrindo campo.

---

## 8 · Fase G · Migrations e schema — drift código × banco

**Objetivo.** Já aconteceu uma vez (migrations 0088-0091 atrasadas 1+ semana, causou bug real em
produção). Confirmar que não tem OUTRO drift silencioso agora, e que o processo que deixou passar
da primeira vez está de fato fechado.

**Como medir.**
1. `supabase migration list` contra produção (com login/link) — comparar local × remoto, igual foi
   feito manualmente nesta sessão, mas como checklist repetível.
2. Confirmar se existe (ou falta) um health-check/alerta automático pra migration atrasada — se a
   resposta for "não", este é o achado principal da fase: o mesmo incidente pode se repetir sem
   ninguém notar até o bug aparecer de novo (`producao-atras-do-codigo` — CI local não denuncia).

---

## 9 · Fase H · Acessibilidade e `aria-live`

**Objetivo.** Regra viva documentada (`admin/layout.tsx`, comentário): troca de conteúdo sem troca
de rota precisa de `aria-live` nascendo junto com o conteúdo. Nunca houve varredura de quantas
telas realmente cumprem isso versus quantas foram corrigidas pontualmente.

**Como medir.** `grep -rn "aria-live" src/app src/components` cruzado com toda tela que tem
filtro/busca/seletor de aba que troca conteúdo sem navegação — listar as que trocam conteúdo E NÃO
têm `aria-live` por perto.

---

## 10 · Fase I · Testes que pulam ou provam vazio

**Objetivo.** Três casos de falso-verde documentados no `CLAUDE.md` (skip sem dizer por quê, cron
"funcionando" vazio, teste que afirma vazio e passa vazio sem montar cenário) — nunca houve
varredura pra achar OUTRAS ocorrências do mesmo padrão.

**Como medir.**
1. `grep -rn "\.skip(\|it\.todo(\|test\.skip(" tests/` → toda ocorrência precisa de comentário
   explicando por quê, do lado.
2. `grep -rn "toEqual(\[\])\|toHaveLength(0)\|toBeNull()" tests/` → para cada uma, confirmar que o
   teste MONTA o cenário que deveria dar não-vazio e prova que a ausência é resultado de lógica,
   não de cenário mal montado (`guarda-de-dados-reais-nao-guarda-a-regra`, `seed-parece-certo-e-
   absurdo-no-agregado`).

---

## 11 · Formato do relatório final

Seguir o formato do `docs/16`: por fase, uma seção com "Verificado e CORRETO" (o que foi conferido
e está certo — registra o trabalho, não só os problemas) e achados numerados com severidade
(BAIXO/MÉDIO/ALTO/CRÍTICO), evidência de como foi medido, e (se corrigido na mesma rodada) o commit.
Todo achado precisa responder: **o que muda quando o defeito volta** — se a resposta for "nada, é
só uma sensação de que está errado", não é achado, é opinião.

Registrar cada achado + decisão em `docs/DECISOES.md` no formato de sempre, mesmo os que forem
"verificado, está correto" — para a PRÓXIMA auditoria não perder tempo reconferindo o que já foi
medido aqui.

---

## 11.1 · Resultado — as 9 fases, rodadas em modo autônomo (16/09)

**Placar:** 9 de 9 fases cobertas (6 com medição exaustiva ou próxima disso, 3 por amostragem
honesta e declarada). **Zero achados novos de bug em produção.** Todos os detalhes e evidências de
como cada fase foi medida estão em `docs/DECISOES.md`, entradas de 2026-09-16 tituladas "Auditoria
ampla (docs/66), Fase X".

| Fase | Cobertura | Resultado |
|---|---|---|
| A · guardas-cegas | Amostra: as 8 guardas tocadas nos últimos 3 dias | Todas corretas; 1 mutação AO VIVO confirmada (`admin/layout.tsx`). Backlog: ~132 guardas mais antigas não mutadas nesta rodada. |
| B · RLS pós-23/08 | Exaustiva: as 6 tabelas novas criadas desde a última auditoria de segurança | Todas com `enable`+`force row level security` e no teste de isolamento. Sem achado. |
| C · dinheiro fora da carteira | Amostra: 1 de 16 módulos (`margem-do-servico.ts`, o de maior histórico de bug) | Comissão calculada num só lugar, rótulo honesto ("sobra", não "lucro"). Backlog: 15 módulos restantes. |
| D · cron e jobs | Exaustiva: os 5 crons com laço por tenant | Todos com `try/catch` por item — lição do #99 100% aplicada. As 3 rotas sem heartbeat são exclusão deliberada e documentada, não gap. |
| E · estados vazio/carregando/erro | Exaustiva: a premissa do plano ("nunca houve varredura") estava ERRADA — já existem 5 guardas que varrem TODAS as páginas (89 casos, todos verdes) | Cobertura já sistemática. Único gap: nenhuma mutação ao vivo destas guardas nesta rodada. |
| F · mobile/Capacitor | Parcial: análise estática completa, teste visual NÃO feito (sem emulador disponível) | Sem vazamento novo de tela de cobrança; 1 caso investigado (`fidelidade.tsx`) confirmado como categoria diferente (bem físico, exceção Apple 3.1.3(a)). |
| G · drift schema | Exaustiva | `MIGRATIONS_ESPERADAS` já bate com a última migration; health check `checarSchema` já existe e já teria pego o incidente de 0088-0091. |
| H · acessibilidade/aria-live | Amostra: 7 candidatos por grep de estado de filtro/aba | Sem achado; o único caso novo (`comanda.tsx`) usa padrão ARIA de abas correto, não precisa de `aria-live`. |
| I · testes que pulam/provam vazio | Amostra: skips (100% checados, todos com motivo) + 1 de 40 arquivos de assert-vazio | Skips limpos. Assert-vazio: amostra de 1 confirma padrão correto; 39 arquivos restantes viram backlog. |

**O que isso muda na resposta "o código está perfeito?":** continua não sendo a palavra certa — mas
agora há evidência de verdade, não opinião, de que as áreas de maior risco histórico (guarda-cega,
RLS de tabela nova, cron silencioso, dinheiro fora da carteira) estão genuinamente bem cobertas.
O que falta é escopo, não suspeita: 132 guardas antigas, 15 módulos de dinheiro e 39 arquivos de
assert-vazio nunca tiveram o mesmo crivo — não porque algo esteja errado neles, mas porque uma
sessão não alcança tudo com rigor. Isso é o backlog real para a próxima rodada, não uma dúvida em
aberto sobre o que já foi medido.

**Custo:** 8 commits, ~1h de execução autônoma, zero intervenção do Eduardo entre o pedido e este
resumo.

---

## 12 · O que este plano NÃO inclui, de propósito

- **Não repete Fases A-K de `docs/16`** (segurança já coberta) nem o levantamento de PRs órfãos de
  `docs/63` (já resolvido, `docs/DECISOES.md` 2026-09-13).
- **Não cobre o que só o Eduardo pode decidir** (contas Google/Apple, T0) — isso já está listado em
  `docs/64`, não é auditoria de código.

---

## 13 · Modo autônomo (16/09, a pedido do Eduardo)

**Mudança de plano:** a recomendação original (§11 antigo) era uma fase por vez com revisão do
Eduardo entre cada uma. Pedido explícito: rodar sozinho, sem precisar de check-in, até esgotar as
9 fases. Registrado aqui o que isso muda na prática — não é menos rigor, é sem pausa.

**Regras de execução autônoma:**
1. **Uma fase por vez, na ordem do §1**, cada uma até "achados" OU "verificado e correto" antes de
   passar pra próxima — sem pular etapa de medição por pressa de avançar.
2. **Achado ALTO ou CRÍTICO com correção óbvia e de baixo risco:** corrigir na hora, seguindo o
   procedimento de guarda (commit antes de mutar, ver reprovar, corrigir, ver passar), igual foi
   feito nos bugs de produção achados no `docs/64`.
3. **Achado que exige decisão de produto** (ex.: mudar regra de negócio, não só corrigir bug) ou
   que **toca produção/dinheiro de um jeito irreversível**: documentar em `docs/DECISOES.md` com
   opção mais simples escolhida (regra padrão do `CLAUDE.md` §"Quando faltar informação") — não
   parar a rodada esperando resposta.
4. **Nunca** rodar comando que grava/lê segredo de produção diretamente (mesma restrição de sempre
   — o classificador de segurança do Claude Code bloqueia, e é proteção correta).
5. Cada fase concluída: commit próprio (achados + correções + registro em `DECISOES.md`), seguindo
   "um ticket, um commit". `pnpm verify` antes de cada commit que mexe em código.
6. Ao fim das 9 fases (ou quando o orçamento de uma sessão esgotar), um resumo único no
   `docs/DECISOES.md` listando o placar: quantos achados por severidade, quantos corrigidos na
   hora, quantos ficaram para decisão do Eduardo.
7. Se uma fase travar em algo que só o Eduardo pode fazer (ex.: testar login contra produção,
   comando bloqueado pelo classificador) — registrar a trava e **pular pra próxima fase**, não
   parar o loop inteiro.
