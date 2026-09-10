# 59 · Bloco 4 — reconferência do `docs/55` contra o estado de hoje

Escrito em 2026-09-09. O `docs/57` (playbook de execução autônoma) fecha com um **Bloco 4** curto:
*"levantar o `docs/55` (Fase 2/3) e o `docs/31` contra o estado atual, separar código de decisão, e
fazer os de código em PRs pequenos"*. Isto é esse levantamento — **medido ao vivo**, não estimado.

> Método: `curl https://seuciclo.com.br/api/health`, `gh pr list`, `grep` no `src`, livro de
> migrations. Cada linha abaixo diz como foi conferida.

---

## 1 · O placar do `docs/55`, item por item

| # (docs/55) | Item | Estado hoje | Como sei |
|---|---|---|---|
| Fase 0.1 | Aplicar `0066`–`0072` em produção | **Feito.** Produção em `0080`; `/api/health` → `schema: {ok:true}` | health ao vivo |
| Fase 0.2 | Fundir a fila de PRs abertos | **Feito** para a leva do `docs/55` (30+ PRs mergeados na semana). Nova fila de 7 PRs (#90–#96) é do `docs/57`, não deste | `git log`, `gh pr list` |
| Fase 0.3 | Action que aplica migration antes do deploy | **Não feito.** Continua manual (SQL Editor / `supabase db push`). O classificador bloqueia escrita em `.github/workflows/`; a alternativa sem Action é `scripts/conferir-schema-prod.mjs` (este PR) — um gate que grita quando a produção está atrás do código | `ls .github/workflows` |
| Fase 1.4 | Integração de PSP | **Código feito, aguardando merge + credenciais.** Mudou de Asaas para **Mercado Pago** (assinatura recorrente `preapproval` + Pix, decisão em `docs/DECISOES.md` 2026-09-09). PRs #90 (cliente da API + webhook), #91 (service + rotas + botão Assinar), #94 (cron `expirar-graca`). Núcleo puro já em produção (PR #81) | `gh pr list`, `grep mercado` |
| Fase 1.5 | Fluxo do sinal (Pix) fim a fim com dinheiro real | **Bloqueado em Eduardo.** As colunas existem desde a `0001`; o `preapproval` do MP cobre a assinatura. O teste com dinheiro de verdade e a decisão de ligar são fora do repo | `docs/18` §J.4 |
| Fase 1.6 | Ligar o F0 (WhatsApp) | **Bloqueado em Eduardo.** Precisa de `WHATSAPP_PHONE_NUMBER_ID`/`ACCESS_TOKEN`/`APP_SECRET` reais (conta comercial da Meta). As duas travas (teto diário, interruptor de pausa) já estão prontas. `reminders`/`campaigns` seguem fora do `on.schedule` de propósito | `cron.yml` linhas 196+ |
| Fase 2.7 | Fechar o buraco de RLS em `tickets`/`ticket_items` | **Feito** na `0073` (PR #80). `can_see_ticket` delega para `can_see_appointment`; `select` por profissional, `insert`/`update`/`delete` seguem `has_tenant` porque todo caminho do app passa por `withTenant` | migration no disco |
| Fase 2.8 | Testes verdes com bug dentro (guarda cega) | **Processo, não item.** A regra está no `CLAUDE.md` (§ "Teste-guarda") e no portão 3 do `docs/57`. Cada PR de RLS desta leva registrou a mutação vista reprovando no corpo. Não há — e não vale a pena — uma meta-guarda automática | `CLAUDE.md` |
| Fase 2.9 | Rodar RLS/integração contra banco de teste real na CI | **Resolvido pelo repo ter virado público.** O job `Banco e RLS` do `ci.yml` sobe um Supabase efêmero, aplica TODAS as migrations do disco e roda `test:integration` + `test:rls` em todo PR. É o banco de teste com schema completo — não depende de Docker local nem do DEV alinhado | `docs/57` § "Como o loop funciona" |
| Fase 3 | Apps mobile, multi-unidade, escala | **Adiado de propósito** até domínio/CNPJ/pagamento (`docs/ciclo-apps-mobile-lojas`). Nada a fazer | — |

---

## 2 · O que sobra de CÓDIGO no Bloco 4

Só um item, e é pequeno:

### 2.1 · `scripts/conferir-schema-prod.mjs` (neste PR)

O `docs/57` PR 3.2 pediu um gate de "produção atrás do código". Como o classificador não deixa
escrever `.github/workflows/`, o formato é um script que:

- bate em `https://seuciclo.com.br/api/health`;
- lê `checks.schema.ok`;
- sai `1` (com a mensagem `detail` da própria rota) se estiver `false`, `0` se `true`.

O Eduardo roda antes de um deploy sensível, ou põe num Action quando tiver um. Não substitui o
`supabase db push` — só torna barulhento o silêncio de "código no ar dependendo de coluna que o
banco não tem" (o incidente de 2026-09-04, `docs/62`).

Fora isso, **o Bloco 4 não tem trabalho de código**: o que o `docs/55` Fase 2/3 listava ou já foi
feito (2.7, 2.9), ou é decisão do Eduardo (1.5, 1.6), ou é adiado de propósito (Fase 3).

---

## 3 · O que continua sendo só do Eduardo (`docs/55` § 3, inalterado)

CNPJ · domínio no nome certo · conta no PSP (agora Mercado Pago) · conta comercial WhatsApp ·
revisão jurídica de `/termos` e `/privacidade` · preço final · primeiro cliente real · canal de
suporte.

Nenhum destes andou desde o `docs/55` — são trâmites de semanas por fora de qualquer sessão. O
`docs/55` § 4 já dizia que **começar esses trâmites é o item de maior alavancagem da lista inteira**.

---

## 4 · Frentes de código ativas (não são Bloco 4, mas é onde o loop está)

- **Assinatura MP:** #90 → #91 → #94 verdes, aguardando merge. Depois: credenciais sandbox do MP +
  1 assinatura de teste ponta a ponta.
- **RLS Bloco 2:** #92 (`0081`, `cycle_predictions`/`package_uses`) e #93 (`0082`, `client_cycles`/
  `loyalty_entries`/`monthly_profit`) verdes. Lote 2.3 (`health_records`, `consents`, `media`,
  `client_notes`, `client_reviews`, `client_subscriptions`, `subscription_plans`) espera 3 decisões
  de papel do Eduardo — a matriz está no `docs/58` (#95). Pré-requisito de código do lote 2.3
  (erase da LGPD via `service_role`) feito em #96.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
