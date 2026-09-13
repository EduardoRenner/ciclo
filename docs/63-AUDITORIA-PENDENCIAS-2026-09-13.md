# 63 · AUDITORIA DE PENDÊNCIAS — o que falta de verdade (2026-09-13, noite)

> Pedido do Eduardo: "verifica tudo que falta fazer esses PRs, aquele backlog para acelerar e
> deixar quente o número do zap, e tem mais um monte de coisa que ficou incompleto pendurado."
> Este documento é a resposta — medida no repositório real (`git`, `gh pr`), não deduzida de
> memória ou de título de commit.

---

## 0 · O achado que muda tudo: PRs "mergeados" que nunca chegaram na `main`

**Confirmado com `git merge-base --is-ancestor` — não é suposição.** Quando um PR usa como *base*
outro branch de feature (em vez de `main`), o GitHub marca `MERGED` ao fechar — mas o código cai
no branch de baixo, não em `main`. É a armadilha já registrada em
`pr-empilhado-nao-chega-na-main` (memória), e ela comeu peça **grande**:

| PR | Título | Base real | Está em `main`? |
|---|---|---|---|
| **#91** | `feat(assinatura): I/O do Mercado Pago — service, rotas e o botão Assinar` | `feat/mp-cliente-api` (não `main`) | **NÃO** |
| **#94** | `feat(assinatura): rota de cron para expirar a graça vencida` | `feat/mp-service-rotas` (empilhado no #91, também órfão) | **NÃO** |
| #93 | `fix(rls): client_cycles/loyalty_entries/monthly_profit sem DELETE` | `fix/rls-lote-2-1-capacidade-morta` | Não, **mas o conteúdo já está em `main` de outro jeito** (ver §1) |
| #100 | `fix(rls): a carteira da cliente para de aceitar UPDATE e DELETE` | `fix/rls-lote-2-2-v2` | Não, **mas idem** (ver §1) |

### O que isso significa na prática, hoje, em produção

- **Não existe `iniciarAssinatura`, nem `POST /api/v1/billing/assinar`, nem o botão "Assinar" em
  `/admin/config/meu-plano`.** Confirmado por grep: zero ocorrências em `src/app/api` ou no
  arquivo da tela (`meu-plano/page.tsx` ainda tem o comentário "nenhum botão assinar, porque não
  existe assinatura automática" — e é verdade, mas não devia ser mais).
- **`GET /api/cron/expirar-graça` também não existe.** Sem ele, uma assinatura pausada com graça
  vencida nunca volta para `gratis` sozinha.
- **O webhook que JÁ está em produção (`PR #122`, `assinatura-mp.ts`, G-13 do `docs/60`) é hoje um
  ouvinte sem escritor.** `processarWebhookMP` lê/atualiza `tenants.settings.assinatura` — mas nada
  no código de produção jamais CRIA esse registro. `docs/60` marca G-13 como **"Feito"**, dizendo
  que "fica inerte sem `MERCADOPAGO_ACCESS_TOKEN`/`WEBHOOK_SECRET`" — **isso está incompleto**: o
  webhook fica inerte mesmo COM as credenciais, porque não existe fluxo nenhum que inicie uma
  assinatura para ele processar.
- **Conclusão prática:** o item que o `docs/55` chamou de *"o que mais importa"* (poder cobrar de
  alguém) segue tão bloqueado quanto em 06/09, apesar de 4 PRs (#90, #91, #94, #122) sugerirem o
  contrário no histórico. Só #90 e #122 realmente chegaram a `main`.

### O que fazer

O código de #91/#94 existe, funciona, tem 13+8 casos de teste, e foi revisado — só está no branch
remoto `feat/mp-cliente-api` (que contém #91 empilhado) e `feat/mp-service-rotas` (que contém #94).
**Não é reconstrução do zero.** Mas também não é um merge cego: `#91` foi escrito contra
`src/server/services/assinatura.ts`, e o que está em `main` hoje é `assinatura-mp.ts` (nome e forma
diferentes, escrito depois, no `#122`). Precisa reconciliar as duas antes de reaplicar — recomendo
tratar isso como o próximo ticket de maior alavancagem do projeto, e não uma tarefa de uma sessão
só, dado que é código de cobrança.

---

## 1 · Falso alarme corrigido: a carteira JÁ está protegida

A memória `ciclo-pilha-8-prs-set-2026.md` registrava "carteira ficou fora do aperto de RLS (PR
#100)" como pendência. **Verificado agora: é falso.** O PR #92 (que está em `main`, título "o lote
2 inteiro de RLS — capacidade morta, append-only e a carteira (0081, 0082, 0083)") já incluía a
migration `0083` inteira — mesmíssimo conteúdo que #100 tentava adicionar depois, por outro
caminho. Idem para #93 (`client_cycles`/`loyalty_entries`/`monthly_profit`): o conteúdo já está em
`0082`, dentro do #92. Os branches `fix/rls-lote-2-2-v2` e `fix/rls-carteira-e-livro-razao` são
**duplicatas órfãs, seguras para apagar** — não são gaps. A memória citada foi corrigida (ver
seção de memória, no fim).

---

## 2 · Migration aplicada no código, não confirmada em produção

`docs/60` (G-05a) já registra isto por conta própria: a migration `0088` (`product_events`) **"e
ainda não foi aplicada em produção"**. Como o padrão de atraso de banco já se repetiu várias vezes
nesta base (`docs/DECISOES.md`, incidentes de 25/08 e 05/09), e as migrations locais chegam a
`0090`, **há boa chance de `0088`, `0089` e `0090` estarem todas por aplicar**. Esta sessão não tem
acesso ao Supabase de produção para confirmar — é item do Eduardo (`scripts/conferir-schema-prod.mjs`
contra a URL real resolve isso em um comando).

---

## 3 · "Deixar quente o número do zap" — não existe plano escrito, e devia

Busca completa em `docs/` e `src/` por aquecimento/warmup/rampa de volume: **zero resultado.** O
que existe é proteção de teto (`docs/25` item 5: teto diário por tenant + interruptor de pausa,
`0087` pg_cron) — isso impede um LAÇO de mandar mensagem demais, mas não é a mesma coisa que uma
**rampa de aquecimento** de número novo. `docs/53` já registra o risco em palavras fortes: *"o
número do WhatsApp Business do CICLO pode ser banido pela Meta, e isso afeta TODOS os tenants"* —
mas não há, em lugar nenhum, um plano de dias/volume para escalar o envio com segurança quando o
F0 (lembretes automáticos) for ligado pela primeira vez.

**Recomendação concreta**, para registrar antes que vire urgência: quando a conta comercial da Meta
existir (item de negócio, `docs/55` §3.4) e antes de descomentar `reminders`/`campaigns` no
`cron.yml`, definir e documentar uma rampa — por exemplo, começar só com os tenants de
`plan='essencial'` mais antigos e de menor volume, dobrar o teto diário por tenant a cada X dias
sem bloqueio da Meta, e só then abrir para todos. Isso não existe hoje nem como rascunho.

---

## 4 · Itens que ficaram para o Eduardo decidir (não são bug, são decisão pendente)

| Item | Onde | Estado |
|---|---|---|
| Matriz de papéis do "lote 2.3" de RLS — 38 de 40 tabelas `_tenant_all` (grupo `health_records`, `consents`, `media`, `client_notes`, `client_reviews`, `client_subscriptions`, `subscription_plans`) | `docs/58-RLS-LOTE-2-3-MATRIZ.md` | Aberto de propósito, esperando 3 perguntas de papel (profissional ver anotação, gerente ver ficha de saúde, recepção matricular no clube) |
| "Sobrou" vs "Lucro" — nomenclatura inconsistente na tela | `docs/DECISOES.md` 09-09 | Sem decisão |
| Score de risco de no-show (⚡) nunca aparece nos dados de demo | idem | Não é bug de código — demo não foi re-semeada com esse caso |
| Assimetria do "C" da logo | `docs/DECISOES.md` 09-13 | Esperando aprovação do Eduardo (aceitar como está ou corrigir) |
| Cláusula CDC de 7 dias no FAQ de `/precos` | idem | Fato de negócio/jurídico, não verificável em código |
| CNPJ, domínio, conta MP real, conta WhatsApp Business, termos revisados, preço final, canal de suporte | `docs/55` §3 | Nenhum mudou desde 06/09 — trâmite fora do repositório |

---

## 5 · Adiado por decisão consciente (não é "esquecido", é escopo)

Achados via varredura de código (`ainda não`, comentário explícito), todos legítimos e já
justificados no próprio arquivo — listados aqui só para existir num lugar só:

- Job de retenção LGPD (`lgpd_retention`) — `src/server/services/lgpd.ts:213`
- Cron de agendamento recorrente — `src/server/services/recorrencia.ts:17`
- Geração de mensagem de recuperação por IA (`mode: 'ai'`) — fora do MVP, `recuperar-receita.ts:151`
- Filtro de estado do clube de fidelidade (C-09) — `clube.ts:171`
- Resolução genérica de conflito de fila offline por URL — fora do v1, `resolucao-de-fila.tsx:15`
- Fases 4 e D do `docs/62` (ganchos de upsell, visão por profissional) — aguardando uso real
- Apps mobile (Capacitor) — orçado, adiado até domínio/CNPJ/pagamento resolverem

---

## 6 · Faxina de branch — 26 branches remotos não mesclados

Todos conferidos um a um com `gh pr view --json baseRefName,mergeCommit` + `git merge-base
--is-ancestor`. Resultado: **24 são ruído normal** (squash-merge muda o hash, `git branch
--no-merged` sempre vai listá-los, o conteúdo já está em `main`). Os únicos com conteúdo real fora
de `main` são os já tratados acima (`feat/mp-cliente-api`, `feat/mp-service-rotas`) e:

- `manutencao-noturna-0902` — 2 commits órfãos de documentação (`ESPECIFICACAO-COMPLETA.md`,
  registrando colunas que já existem no schema), 221 commits atrás de `main`. Baixo valor, baixo
  risco — cereja-pick os 2 commits ou descarte.

Recomendo apagar os branches remotos já absorvidos (`fix/rls-lote-2-2-v2`,
`fix/rls-carteira-e-livro-razao`, e os demais da lista de "ruído normal") depois que o Eduardo
confirmar — apagar branch remoto é ação que este documento não executa sozinho.

---

## Resumo — por ordem de impacto

1. **Recuperar e reconciliar o checkout do Mercado Pago** (`iniciarAssinatura` + rota `/assinar` +
   botão + cron de graça) contra o `assinatura-mp.ts` atual. Maior alavancagem do repositório
   inteiro — sem isso, cobrar de alguém continua impossível mesmo com credencial real.
2. **Confirmar migrations `0088`-`0090` em produção** (Eduardo, via `conferir-schema-prod.mjs`).
3. **Escrever o plano de aquecimento do número de WhatsApp** antes de ligar o F0 — não existe hoje.
4. Resto é decisão do Eduardo (§4) ou escopo conscientemente adiado (§5) — não é trabalho perdido.
