# 37 · INDICAÇÃO ENTRE PROFISSIONAIS — QUAL PRÊMIO, COM FOCO EM ESCALA

Pedido do Eduardo em 2026-09-03: *"pesquise o que dá para fazer de prêmio com foco em escala e
conversão"*.

O convite B2B foi entregue em 2026-09-03 (`core/billing/convite-do-ciclo.ts`): o dono do salão
manda o CICLO para um colega pelo WhatsApp, com texto pronto na voz dele. **O prêmio ficou
desligado** (`temRecompensa: false`), porque o `docs/18` §13.1 já decidiu *um mês para quem indica
e um para quem entra* e não existe `billing_credits` para conceder isso.

Este documento é **pesquisa e decisão**, no mesmo padrão do `docs/30`. Nenhuma cobrança nova é
implementada.

---

## 1 · O achado que resolve o problema, e ele já estava no banco

**`tenants.trial_ends_at` existe desde a migration `0001` e tem ZERO leitores e ZERO escritores.**
Conferido por varredura em `src/`, `tests/`, `supabase/`, `scripts/`: a única menção no repositório
inteiro é a linha que a cria.

Isso é a **sexta** ocorrência da classe que esta base já nomeia — coluna lida por todo mundo e
escrita por ninguém, ou aqui a variante pior: nem lida. As anteriores foram `fee_cents` (quadro
"Taxa" sempre zerado), `media.consent_id` (portfólio que nunca listava), `tenants.plan` (trava de
plano sem escritor), `clients.referred_by` (programa de indicação inteiro desligado da tomada) e a
frase "fale com a gente" sem canal.

**E é exatamente o veículo que a recompensa precisa.** Um prêmio de "um mês do Essencial" é, em
mecânica, `plan = 'essencial'` mais uma data de validade — que é o que aquela coluna significa. Sem
migration, sem PSP, sem `billing_credits`, sem cobrança.

---

## 2 · A pesquisa, e o princípio que decide a moeda

Consultado em 2026-09-03.

### 2.1 · A lição do Dropbox e do PayPal não é "dê algo", é QUAL algo

O Dropbox copiou o programa do PayPal e trocou a moeda de propósito:

| | PayPal | Dropbox |
|---|---|---|
| Prêmio | **US$ 20** por lado | **500 MB** de espaço por lado |
| Por quê | é uma empresa de **pagamentos**: dinheiro circulando no produto é o uso | é uma empresa de **armazenamento**: espaço é o que limita o uso |
| Resultado | 7–10% de crescimento ao dia, ~US$ 60 mi gastos em incentivo | +3.900% em 15 meses, 35% dos cadastros diários |

> **O princípio:** a moeda ótima é o que é o sangue do próprio produto — e, nos dois casos, o que
> o prêmio faz é remover o limite que impedia a pessoa de usar mais.

Isto é o que decide a recomendação da §4, e é o que descarta dinheiro no caso do CICLO.

### 2.2 · Os números que valem para calibrar

- **Crédito no produto rende ~18% mais que dinheiro** em indicação de SaaS.
- **Prêmio dos dois lados aumenta participação em ~85%** contra prêmio de um lado só.
- **Programa em degraus rende ~35% mais** que prêmio fixo.
- **Cliente que chega por indicação converte 3–5× melhor** que tráfego pago e tem **~16% mais valor
  ao longo da vida** — o mesmo 16% que o `docs/30` §2.4 já tinha achado pelo estudo do banco alemão.
- **Processamento manual deixa de ser viável acima de ~50 indicações por mês.**

Esse último número é o mais importante para o CICLO hoje, e por um motivo invertido: **abaixo de 50
por mês, manual é a resposta certa** — e o CICLO tem zero pagantes. A trava de "≥ 20 pagantes" do
`docs/18` Fase H protegia o antifraude e a proração de `billing_credits`; ela nunca justificou não
ter prêmio nenhum, porque prêmio pago à mão não precisa de nenhuma das duas.

### 2.3 · O que a pesquisa recomenda e este documento RECUSA

| Recomendação | Por que não aqui |
|---|---|
| Dinheiro por indicação (modelo PayPal) | §2.1: a moeda tem que ser o sangue do produto, e o do CICLO não é dinheiro. E dinheiro saindo com zero receita entrando é o que a Fase H temia com razão |
| Payout percentual da receita atribuída | exige receita recorrente medida e PSP. Não existe |
| Plataforma de indicação (Rewardful, Cello, Reditus) | mensalidade em dólar para gerenciar um programa com zero pagantes |
| Ranking público de quem mais indicou | o `docs/30` §8 já recusou o equivalente B2C: num mercado que se conhece por bairro, ranking é constrangimento |
| Exclusividade por convite, tipo Superhuman (fila de espera de 180 mil) | funciona quando a demanda já existe e o produto é escasso de propósito. O CICLO precisa do contrário: entrada sem atrito |

---

## 3 · Qual é o "espaço em disco" do CICLO

Aplicando o §2.1: qual limite impede a pessoa de usar mais o produto? A resposta está no
`core/billing/planos.ts`, e há três candidatos.

| Moeda candidata | O que é | Serve como prêmio? |
|---|---|---|
| `maxClientes` (50 no Grátis) | teto de fichas | **Não.** É limite **suave** (§L.1: avisa e deixa passar). Dar mais de um teto que já não bloqueia é dar nada, e a pessoa percebe |
| `maxProfissionais` (1 no Grátis) | teto **duro** | Não. Quem atende por conta não quer um segundo profissional — é prêmio para um problema que ela não tem |
| **`envio_em_lote`** | chamar a base inteira de uma vez, em vez de um a um | **Sim.** É a fronteira real do paywall, é o que o Essencial vende, e é o que a pessoa mais quer no momento em que a lista de quem sumiu enche |

**A moeda do CICLO é o envio em lote.** É o análogo exato do espaço do Dropbox: o limite que a
pessoa encosta justamente quando o produto começou a funcionar para ela.

E há uma simetria que o `docs/30` §5.1 já tinha desenhado para o laço B2C e que fecha aqui: o
convite faz a base crescer → a base encosta no teto → o upgrade acontece porque **o produto
funcionou**. Premiar com envio em lote é premiar com a coisa que o próprio laço faz a pessoa querer.

---

## 4 · As opções, com prós e contras

### Opção A — Um mês de Essencial para cada lado, concedido à mão *(recomendada)*

**Mecânica:** quando o indicado cria a conta e diz quem o indicou, o Eduardo põe os dois no
Essencial por 30 dias. `plan = 'essencial'` + `trial_ends_at = hoje + 30 dias`, com um job diário
que devolve para `gratis` quando a data passa.

| Prós | Contras |
|---|---|
| A moeda certa pelo §2.1 e §3: entrega envio em lote, que é o sangue do produto | precisa de um leitor e um escritor para `trial_ends_at`, mais um job de expiração |
| Zero dinheiro sai. Nenhum PSP, nenhum `billing_credits`, nenhuma proração | manual deixa de escalar em ~50/mês (§2.2) — mas isso é problema de sucesso |
| Dois lados, que é +85% de participação | quem já é pagante não pode receber "um mês grátis" sem crédito de fatura, então o prêmio é assimétrico entre grátis e pagante |
| Já é o prêmio DECIDIDO no `docs/18` §13.1 — não reabre decisão comercial | |
| O período pago é também o melhor teste de conversão que existe: a pessoa experimenta o degrau que ela ainda não compra | |

**A assimetria do último contra tem resposta, e ela é honesta:** enquanto ninguém paga, ela não
existe. Quando existir o primeiro pagante que indica, o prêmio dele vira desconto combinado na
conversa — que é exatamente como toda mudança de plano funciona hoje.

### Opção B — Aumentar o teto de clientes do indicador

**Mecânica:** cada indicação convertida sobe o `maxClientes` do Grátis em +25, acumulável.

| Prós | Contras |
|---|---|
| Mecânica de degrau, que rende +35% (§2.2) | **o teto de clientes é SUAVE**: já não bloqueia nada. O prêmio é decorativo, e num público que confere as coisas isso queima confiança |
| Barra de progresso pronta (§5.3 do `docs/30`) | precisaria de coluna nova de override por tenant |

**Não recomendo.** Falha no teste do §5.10: a tática não continuaria funcionando se a pessoa
soubesse como funciona — ela descobriria que ganhou permissão para algo que já podia fazer.

### Opção C — Acesso antecipado a recurso novo

**Mecânica:** quem indica entra primeiro no que está sendo construído.

| Prós | Contras |
|---|---|
| Custo zero, e a pesquisa lista "feature access" como alternativa legítima ao dinheiro | exige uma fila de recursos que a pessoa QUEIRA, e o CICLO ainda está fechando o básico |
| Não promete dinheiro nenhum | prêmio que depende de roadmap é prêmio que atrasa quando o roadmap atrasa |

**Guardar como complemento**, não como prêmio principal.

### Opção D — Nada, e manter só o convite

| Prós | Contras |
|---|---|
| É o estado de hoje, e é honesto | perde os 85% de participação do prêmio dos dois lados |
| Zero risco | o colega que recebe o convite não tem motivo nenhum para agir hoje |

**É a opção segura, e ela tem um mérito real:** o convite sozinho já distribui o produto, e o
`docs/30` §2.2 mostra que prêmio mal enquadrado atrapalha. Fica como referência de comparação.

---

## 5 · Recomendação

**Opção A, e o gatilho é o PRIMEIRO ATENDIMENTO CONCLUÍDO do indicado, não o cadastro.**

O gatilho é a parte que a pesquisa erra se copiada sem pensar. O `docs/18` §H.1 já decidiu "no
primeiro pagamento, não no cadastro" porque cadastro é convite para fraude. Como não há pagamento,
o equivalente mais próximo de "esta conta é real" é **um atendimento concluído**: exige uma pessoa
de verdade numa cadeira de verdade, e é o mesmo sinal que o laço B2C usa para creditar pontos
(`pontuarAtendimentoConcluido`).

**Antifraude proporcional, e nada além disto** (mesma régua do `docs/30` §4.5):

- não dá para indicar a si mesmo (o `phone_hash` do dono, e o e-mail, precisam ser diferentes);
- o prêmio existe uma vez por indicado, e o livro-razão é a fonte — nunca um contador derivado
  (é a lição do `bonus-de-indicacao-paga-uma-vez`);
- teto de indicações premiadas por indicador por ano, para fazenda de convite não virar Essencial
  vitalício de graça. **[S]** — o número é decisão comercial.

Nada de CPF, nada de instrumento de pagamento: isso é o desenho do B2B com dinheiro em jogo, e aqui
não há dinheiro em jogo.

---

## 6 · O que dá para implementar HOJE sem tocar em cobrança, e o que não

| Peça | Toca cobrança? | Estado |
|---|---|---|
| Convite com texto pronto no WhatsApp | não | ✅ **feito** (2026-09-03) |
| Campo "quem te indicou" no cadastro | não | ⬜ implementável hoje |
| Escritor + leitor de `trial_ends_at` e job de expiração | não | ⬜ implementável hoje |
| Conceder o mês à mão pelo painel | não | ⬜ script, como `promover-tenant.mjs` já faz |
| Copy do prêmio na tela (`temRecompensa: true`) | não, mas **promete** | 🔒 só depois das três de cima |
| Crédito em fatura para indicador pagante | **sim** | 🔒 Fase H do `docs/18`, com PSP |

**A ordem importa e a trava é a última linha do que está feito:** a guarda
`tests/unit/core/convite-do-ciclo.test.ts` reprova qualquer tela que ligue `temRecompensa` — e ela
deve continuar reprovando **até o prêmio poder ser concedido de verdade**. Ligar a copy antes do
escritor é publicar promessa de dinheiro sem lastro, que é a promessa mais cara que esta base pode
fazer.

---

## 7 · O que é decisão do Eduardo

1. **Opção A, B, C ou D?** Recomendo A.
2. **Se A: 30 dias é o número?** É o que o §13.1 decidiu, e a conta abaixo sugere revisar.

   `ciclo_padrao_dias` das oito profissões de beleza, lido da migration `0022`: unhas 15, cílios 21,
   barbearia 21, depilação 21, sobrancelhas 28, estética 30, cabelo 30 — e tatuagem 180, que é fora
   da curva. Ou seja, **30 dias é ~1 volta** na maioria, e o Motor de Ciclo precisa de **duas ou
   três voltas** para ter o que mostrar (é o que a FAQ da home passou a dizer nesta mesma rodada).

   Um prêmio de 30 dias entrega o degrau pago justamente enquanto a lista ainda está enchendo.
   **Recomendo considerar 60**, que dá duas voltas na maioria das profissões de beleza e é onde o
   valor fica visível — e onde a conversão para pagante tem chance real de acontecer. Nas profissões
   de ciclo longo (tatuagem, e as de casa) nem 60 resolve, e isso é limite do prêmio, não do número.
3. **Teto de indicações premiadas por ano.** **[S]**, precisa de número.
4. **Autoriza o trabalho de ligar `trial_ends_at`?** É a parte de engenharia, e ela não toca em
   cobrança — mas cria um caminho que muda plano de tenant, então quero autorização antes.

---

## 8 · Fontes

- [Here's How Dropbox Copied Its Referral Program From PayPal — ReferralCandy](https://www.referralcandy.com/blog/dropbox-referral-program)
- [The Dropbox Referral Program: 3900% Growth in 15 Months — GrowSurf](https://growsurf.com/blog/dropbox-referral-program/)
- [The PayPal referral program: getting to 100M users — Viral Loops](https://viral-loops.com/blog/paypal-referral-program-case-study/)
- [40+ SaaS Referral Statistics and Benchmarks — GrowSurf](https://growsurf.com/statistics/saas-referral-statistics/)
- [7 Psychological Drivers of Referral Behavior for B2B — Cello](https://cello.so/incentives-for-b2b-saas-referral-programs/)
- [4 B2B SaaS Referral Program Types — Cello](https://cello.so/blog/4-categories-of-referral-programs-for-b2b-saas/)
- [B2B SaaS Referral Program Software: 2026 requirements — Track360](https://track360.io/blog/b2b-saas-referral-program-software-2026)
- [How Superhuman Uses Exclusivity To Drive Word Of Mouth — Truested](https://truested.com/story/superhuman)
