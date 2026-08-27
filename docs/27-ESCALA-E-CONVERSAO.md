# 27 · Escala e conversão — a camada que falta entre o produto e o dinheiro

**2026-08-27.** Este documento responde a um pedido específico: *o que grandes produtos fazem para
converter, e o que disso cabe no CICLO*. Ele é escrito com duas lentes ao mesmo tempo — analista de
negócio (onde o dinheiro vaza) e desenvolvedor sênior (onde no código isso mora).

Convenção dos marcadores, a mesma do `18`, `20` e `25`: **[M]** medido (conferido no código ou no
banco desta sessão), **[E]** estimado, **[P]** vem de pesquisa de mercado.

Este documento **não substitui** o `18` (preço, empacotamento, PSP, unit economics) nem o `25`
(ordem de execução). Ele preenche o que os dois não cobrem: **a mecânica de conversão e o
raciocínio psicológico por trás de cada peça** — e, no caminho, discorda do `25` em um ponto de
sequenciamento, com justificativa explícita na §6.

---

## 0. O diagnóstico, em uma frase

> **O CICLO não tem problema de conversão. Tem problema de entrada.**

Zero pagantes **[M]**. Dois tenants reais, um deles é demonstração **[M]**. Nenhuma
instrumentação de funil **[M]**. As duas rotas de cron que falam com o cliente final não rodam
**[M]**.

Isso importa porque muda o que "fazer o produto converter mais" significa. Instalar contador
regressivo, prova social e programa de indicação num funil sem tráfego é **multiplicar zero**.
A ordem certa não é *otimizar a conversão* — é **construir a máquina que converte, na sequência em
que cada peça paga a próxima**, e colocar a psicologia onde ela é honesta.

O que segue é essa máquina. São seis achados, ordenados por dinheiro-por-esforço.

---

## 1. Os seis achados

### Achado 1 · `trial_ends_at` é andaime morto desde a migration 0001 **[M]**

```sql
-- supabase/migrations/0001_initial.sql:53
trial_ends_at   timestamptz,
```

A coluna existe desde o primeiro dia do projeto. **Nenhuma linha de código a lê ou escreve** —
conferido por varredura em `src/`, `tests/` e `scripts/` **[M]**. Todo tenant nasce `gratis`
(`plan_tier not null default`) e fica `gratis` para sempre.

Ou seja: **o CICLO não tem período de demonstração de espécie alguma.** Quem se cadastra hoje
nunca experimenta um único recurso pago. Ele lê na `/precos` que existe "chamar a base inteira de
uma vez" e nunca vê aquilo funcionando — precisa pagar para descobrir se resolve o problema dele.

Esse é o defeito de conversão mais caro que um SaaS de ticket baixo pode ter, e a correção mais
barata disponível neste repositório.

---

### Achado 2 · A prova de valor é calculada, exibida, e nunca **entregue** **[M]**

`receitaAtribuidaAoCiclo()` responde a pergunta que decide a assinatura:

> *"O Motor de Ciclo trouxe R$ 1.240 este mês (8 agendamentos)."*

O `25` F1 já subiu isso para a home **[M]**. Mas **ninguém é avisado**. A informação existe e
espera que a pessoa abra o app e olhe. Não há nenhum momento no mês em que o produto diga isso.

Isso desperdiça o ativo comercial mais forte do produto — o único número que responde
simultaneamente *"funciona?"* e *"vale R$ 49?"*.

---

### Achado 3 · O motor está preso atrás de credencial de terceiro há ~10 dias — e não precisava estar inteiro **[M]**

O `25` F0 bloqueia todas as outras fases, e depende do passo 2: confirmar
`WHATSAPP_PHONE_NUMBER_ID` / `ACCESS_TOKEN` / `APP_SECRET` na Meta. Isso está pendente desde
2026-08-18 **[M]** (é o mesmo TICKET-043 que trava a mensageria desde o começo).

Mas o F0 mistura **dois laços diferentes** numa fase só:

| Laço | Quem recebe | Depende de | Risco |
|---|---|---|---|
| **Lembrete / confirmação / campanha** | o **cliente final** do salão | WhatsApp (Meta) ou e-mail (Resend) | Alto — mandar mensagem para pessoa errada queima o número e a reputação do salão |
| **"3 clientes sumiram, R$ 240 parados"** | o **dono** do salão | **nada de terceiro** | Nenhum — é o próprio usuário do app |

O segundo é o **laço de retenção** que o `18` §I.2 nomeia como hábito recorrente do produto. E ele
está tecnicamente pronto: `push_subscriptions` (migration 0015/0016), provider
(`providers/messaging/push.ts`), e **VAPID é chave autogerada — não exige conta em lugar nenhum**
**[M]**.

Hoje o push só é usado como *fallback* na cadeia de mensagem para o cliente
(`enviarComFallback`) **[M]**. **Nenhum código manda push para o dono.**

> **O laço de retenção mais forte do produto está bloqueado por uma credencial que ele não usa.**

---

### Achado 4 · A indicação que existe é a errada — e a certa é melhor negócio **[M]**

O pedido foi *"aquele sistema de indicação que ganha desconto"*. Existem dois, e vale não
confundi-los:

**(a) Indicação B2B — tenant indica tenant, ganha desconto na mensalidade.**
Desenhada inteira no `18` Fase H (crédito em `billing_credits`, recompensa só no 1º pagamento do
indicado, antifraude, teto de 12 meses/ano). **Não existe em código** e está deliberadamente
travada atrás de **≥20 pagantes** **[M]**.

**Concordo com a trava e recomendo mantê-la.** Programa de indicação com zero pagantes é máquina
sem combustível: ninguém tem mensalidade para descontar, e o antifraude que ele exige (mesmo CPF,
mesmo `phone_hash`, mesmo instrumento no PSP) é trabalho real defendendo receita que não existe.

**(b) Indicação B2C — a cliente do salão indica outra cliente, as duas ganham pontos.**
Isso **já está construído e funcionando** **[M]**: `clients.referred_by` (migration 0001),
`referralBonusPoints` (config em `tenants.settings.loyalty`), e `pontuarAtendimentoConcluido()`
credita **os dois lados** automaticamente na primeira visita da indicada
(`fidelidade.ts:120-132`).

E está **invisível**. O único caminho para uma indicação acontecer é o dono lembrar de abrir
mensagens prontas e mandar o modelo `indicacao` na mão **[M]**.

Aqui está o reenquadramento que vale dinheiro:

> **O programa de indicação que faz o CICLO ganhar dinheiro não é o do CICLO — é o do salão.**

Um salão cuja base **cresce sozinha dentro do CICLO** não cancela o CICLO. É retenção, que num
produto de R$ 49 vale mais que aquisição (o `18` §F.4 mostra que uma hora de suporte já dá
prejuízo de R$ 4,43 por cliente — cliente que fica e não pergunta é o único cliente lucrativo).

E de quebra: cada link de indicação que a cliente compartilha **é uma página `/{slug}` do CICLO**,
com o selo do plano Grátis. É o laço de distribuição do `18` §G, alimentado por quem não é usuário
do produto.

---

### Achado 5 · Não existe plano anual **[M]**

`PRECO_MENSAL_CENTS` é a única tabela de preço no código **[M]**. O `18` §E.5 desenhou o anual e
ele nunca virou código.

Três razões, e a terceira é a que decide:

1. **Ancoragem de preço.** Um mensal sozinho na tela não tem com o que ser comparado. Ao lado de
   "R$ 490/ano — 2 meses grátis", o R$ 49 vira a opção *cara*. É o efeito de contraste, e é
   honesto: os dois preços são reais.
2. **Churn mecânico.** Assinante anual não decide 12 vezes se continua; decide uma.
3. **Caixa, e esta é a real.** O `18` §F.6 mediu: **cobrar tem custo fixo de R$ 194/mês antes do
   primeiro cliente** (MEI é vedado para software → ME no Simples + contabilidade) **[M]**. Com
   assinatura mensal, o negócio passa meses no vermelho esperando volume.

   > **Dez assinantes anuais pagam a contabilidade do ano inteiro no primeiro mês.**

   Num produto sem investidor, isso não é otimização de conversão — é fôlego.

---

### Achado 6 · Zero instrumentação de funil — e a solução recomendada não é comprar ferramenta **[M]**

Não existe nenhum evento de produto. Só Sentry, para erro **[M]**. O `25` F2 ticket 11 registra
isso como "decisão de ferramenta do dono" (PostHog vs. self-hosted, com implicação de custo e de
compartilhar dado de tenant com terceiro sob LGPD) e deixou em aberto.

**Recomendação: não compre ferramenta. Construa uma tabela.**

O funil inteiro deste produto cabe em ~8 eventos. O dado já está no Postgres, a RLS já funciona,
já existe `withTenant`. Uma migration de ~30 linhas (`product_events`) e uma view resolvem — sem
terceiro vendo dado de cliente de salão, sem pergunta de LGPD nova, sem mensalidade.

PostHog resolveria mais problemas do que este produto tem, cobrando por isso e abrindo uma
conversa de conformidade que hoje não existe.

---

## 2. A camada de persuasão — o que construir, e por que funciona

Cada peça abaixo tem três partes: **o que é**, **a psicologia** (por que converte, com o mecanismo
nomeado) e **o dev** (onde no código isso mora).

---

### P1 · Teste reverso — 14 dias de Avançado, aterrissando no Grátis

**O que é.** Tenant novo nasce com o plano mais alto ligado por 14 dias. No fim, **não bate num
paywall** — ele *desce* para o Grátis, com a base intacta.

Isso é diferente das duas coisas que normalmente se chama de "teste":

| Modelo | Fim do prazo | Exige cartão | Problema |
|---|---|---|---|
| Teste tradicional (14 dias → paywall) | perde acesso | quase sempre | penhasco de churn; exige cartão, o que contradiz o "sem cartão" da `/precos` **[M]** |
| Grátis para sempre (**o estado atual**) | nada acontece | não | **nunca experimenta o pago** — é o Achado 1 |
| **Teste reverso** | desce para o Grátis | **não** | nenhum dos dois |

**A psicologia.** É **efeito de posse + aversão à perda** (Kahneman e Tversky: a dor de perder é
medida em cerca de o dobro do prazer de ganhar). A pergunta que o tenant responde no dia 14 não é

> *"vale R$ 49 ligar campanhas?"*

que é uma pergunta abstrata sobre um benefício futuro. É

> *"vale R$ 49 **não perder** as campanhas que eu usei nas últimas duas semanas?"*

São perguntas diferentes, com taxas de resposta diferentes. É o modelo do Slack, Notion, Canva,
Figma e Linear — e é o único dos três que **não tem nada de manipulativo**: ninguém é trancado
fora, e o Grátis continua exatamente o que a `/precos` promete ("Para sempre, sem cartão").

**Restrição de honestidade — e ela é séria.** O Avançado inclui `envio_em_lote`, que depende de
`campaigns`, que **não roda** (Achado 3). Dar teste de Avançado hoje é entregar um recurso
quebrado — exatamente a classe de defeito que este repositório já tem teste-guarda para
(`precos-nao-promete-demais`, `home-nao-promete-demais`).

> **O teste reverso concede o que funciona hoje.** Enquanto o F0b não estiver ligado, o teste
> concede tudo **menos** as capacidades que dependem de cron de mensagem. Quando o motor ligar,
> uma linha muda.

**O dev.**
- Migration: `tenants.trial_tier plan_tier` (a coluna `trial_ends_at` **já existe**) + backfill
  `null` para os tenants atuais.
- `src/core/billing/planos.ts`: função pura nova `planoVigente(plan, trialTier, trialEndsAt, agora)`
  — decide entre plano e teste. Pura, testável, sem I/O; é onde a regra tem que morar (regra 5 do
  `CLAUDE.md`).
- `src/server/services/planos.ts`: `contextoDePlano` passa a usar `planoVigente`.
- `src/server/services/onboarding.ts`: carimba `trial_ends_at = now() + 14 dias` na criação.
- UI: faixa persistente com dias restantes + o que se perde no dia 15 (nomeando os recursos, não
  "faça upgrade").
- **Teste-guarda:** teste puro do relógio (dia 13 → Avançado, dia 15 → Grátis, `trial_ends_at`
  nulo → plano da coluna) **visto reprovando por mutação** — o padrão da casa.

---

### P2 · O extrato mensal do Motor — push para o dono

**O que é.** Todo dia 1, cada tenant recebe um push:

> **O Motor trouxe R$ 1.240 em agosto**
> 8 agendamentos de clientes que estavam sumindo.

E um card correspondente na home durante os primeiros dias do mês.

**A psicologia.** Três mecanismos empilhados, todos honestos porque o número é medido:

1. **Reenquadramento de custo em retorno.** R$ 49 ao lado de R$ 1.240 não é uma despesa, é uma
   razão de 25×. Ninguém cancela uma razão de 25× — o cancelamento passa a exigir justificar a
   perda dos R$ 1.240, não economizar R$ 49.
2. **Ancoragem.** O primeiro número que a pessoa vê no mês passa a ser o que o produto rendeu,
   não o que ele custa.
3. **Efeito Zeigarnik / laço aberto.** "3 clientes sumiram, R$ 240 parados" é trabalho pendente
   com valor nomeado. Agenda só se abre quando há agendamento; dinheiro parado se abre sozinho —
   é literalmente o `18` §I.2.

**Por que é a peça de maior alavancagem do documento.** Ela é ao mesmo tempo o gatilho de
**retenção** (motivo semanal de abrir), de **upgrade** (o extrato do tenant no teto de 50 clientes
diz o que ele está deixando na mesa) e de **recuperação de churn** (o e-mail do `18` §I.4). Uma
peça, três funções.

**E não depende de credencial nenhuma** — VAPID é autogerado, o destinatário é o próprio usuário
logado. Sai hoje.

**O dev.**
- Rota `src/app/api/cron/motor-extrato/route.ts`, no mesmo padrão das outras (janela de hora local,
  `dentroDaJanela`, heartbeat guardado por `processados > 0`).
- Entra em `ROTAS_DE_CRON` **e** em `ROTAS_AGENDADAS` de `src/core/cron/agendadas.ts` — as guardas
  `saude-vigia-so-o-que-roda` e `cron-cobre-os-fusos` já cobram isso automaticamente.
- Reusa `receitaAtribuidaAoCiclo()` e `enviarPush`. Zero regra de negócio nova.
- Uma linha nova no `schedule` do `cron.yml` (dia 1, hora local ~9h).
- **Cuidado medido:** o `CLAUDE.md` já registra que promessa de canal só vale com rota **agendada**
  e credencial existente. Push satisfaz os dois — mas só depois que a rota estiver no `schedule`,
  não antes.

---

### P3 · O anual, com a âncora certa

**O que é.** `PRECO_ANUAL_CENTS` ao lado do mensal, a 10× o mensal (2 meses grátis):
Essencial R$ 490/ano · Equipe R$ 990 · Avançado R$ 1.790.

**A psicologia.** **Efeito de contraste + custo de troca.** Mostrar os dois lado a lado, com o
anual em destaque e a economia escrita em reais ("economize R$ 98"), não em porcentagem — em
ticket baixo, R$ 98 é mais concreto que 17%.

**O que NÃO fazer:** esconder o mensal, ou pré-selecionar o anual sem dizer. Ancoragem honesta é
mostrar as duas opções com clareza; escura é dificultar a menor.

**O dev.** `PRECO_ANUAL_CENTS` no `core/billing/planos.ts` (a mesma fonte única que já governa
`PRECO_MENSAL_CENTS`), `tenants.billing_period`, e o cartão em `lib/planos-cartoes.ts`. A guarda
`preco-em-um-lugar-so` já impede a quinta cópia aparecer.

---

### P4 · A indicação do salão, deixada de ser invisível

**O que é.** Transformar o `referred_by` que já funciona num laço automático:

1. Cada cliente ganha um link próprio: `/{slug}?ind={token}` — o mesmo HMAC de
   `token-assinado.ts`, sem coluna nova.
2. Quem agenda por esse link nasce com `referred_by` preenchido.
3. Os pontos dos dois lados já são creditados sozinhos na primeira visita **[M]**.
4. Card na home do dono: *"Suas clientes trouxeram 4 novas este mês."*
5. Botão "Pedir indicação" na ficha, mandando o link pelo `wa.me` que já existe.

**A psicologia.** **Reciprocidade** (a cliente ganha algo por indicar) e **prova social de par**
(recomendação de conhecido vale ordens de grandeza mais que anúncio — é o `18` §H.4 aplicado um
nível abaixo). Para o **dono**, o card é **progresso visível**: o produto mostrando que trabalhou
sem ele.

**Por que essa e não a B2B.** A B2B precisa de ≥20 pagantes para significar alguma coisa. Esta
funciona com **um** tenant e ataca a métrica que mais importa agora — retenção. E cada link
compartilhado carrega uma página do CICLO com o selo.

**O dev.** Sem migration (token assinado, não coluna). Serviço em `public-booking.ts` para resolver
o token no agendamento; card em `hoje.tsx`; botão na ficha. O módulo `loyalty` é do plano Equipe —
**decisão a tomar:** o *link* de indicação deveria estar no Grátis, com só os *pontos* no Equipe?
Recomendo que sim: o laço de distribuição interessa ao CICLO em todo degrau.

---

### P5 · Instrumentação: `product_events`

**O que é.** Uma tabela, oito eventos, uma view de funil:

```
conta_criada → profissao_escolhida → primeiro_cliente → primeiro_agendamento
→ pagina_publica_visitada → primeiro_agendamento_pelo_link  ← o "aha" do §I.1
→ teste_terminou → assinou
```

**Por que importa aqui e não é desvio.** Sem isto, tudo acima vira anedota. Com isto, a pergunta
*"o teste reverso converte?"* tem resposta numérica em 30 dias, e o piloto do `25` F3 gera dado em
vez de impressão.

**O dev.** Migration com RLS (`enable` + `force` + política por tenant, o padrão da casa — a
revisão de 2026-08-27 confirmou que todas as 18 tabelas novas seguem isso). Um helper
`registrarEvento(db, tenantId, tipo, meta)` que **nunca lança** (evento perdido não pode derrubar
o fluxo que ele observa — mesma regra do heartbeat). View `v_funil_ativacao` com
`security_invoker = true`.

---

## 3. O que **não** fazer — e por quê

O pedido citou "o que apps e sites grandes usam para converter". Boa parte do que eles usam é
manipulação, e neste repositório ela não passaria nem no teste automatizado.

| Tática comum | Por que está fora |
|---|---|
| *"Restam 2 vagas neste horário"* | Falso. E `home-nao-promete-demais.test.ts` **já reprova prova social inventada** — proposto aqui, o build quebra. Corretamente. |
| Contador regressivo na `/precos` | O preço não sobe quando ele zera. Urgência falsa em produto de ticket baixo compra uma conversão e perde a confiança do bairro inteiro. |
| Cobrar cartão no cadastro para "reservar" o teste | Contradiz o "Para sempre, sem cartão" da `/precos` **[M]**. O teste reverso existe justamente para não precisar. |
| Cancelamento escondido | O `18` Fase K exige que cancelar custe os mesmos toques que assinar. Além de ser lei (CDC art. 49). |
| Cobrança automática no fim do teste | Não há cartão para cobrar — e o teste reverso não cria essa expectativa. |
| Anúncio pago | O `18` §13.1 já mediu: o CAC não fecha nesta categoria. |

**A linha que separa as duas coisas é simples: urgência honesta é urgência verdadeira.**
*"Seu teste acaba em 3 dias"* é verdade e é útil. *"Restam 2 vagas"* não é.

---

## 4. A ordem

Três fases. O critério de ordenação não é esforço — é **o que destrava medição, e depois o que
compõe**.

### E1 · Agora — não depende de decisão de ninguém

| # | Peça | Depende de | Retorno |
|---|---|---|---|
| 1 | **`product_events`** (P5) | nada | destrava medir tudo abaixo |
| 2 | **Teste reverso** (P1) | nada | maior conversão-por-esforço do documento |
| 3 | **Extrato do Motor por push** (P2) | rota nova + linha no `cron.yml` | retenção + upgrade + churn-save |

Nenhuma das três toca WhatsApp, cartão de crédito ou conta em terceiro. As três podem ser
construídas e verificadas com `pnpm test:unit`.

### E2 · Quando houver sinal (≥1 tenant ativo de verdade)

| # | Peça | Gate |
|---|---|---|
| 4 | **Anual** (P3) | precisa de cobrança funcionando — `18` Fase J |
| 5 | **Indicação do salão** (P4) | 1 tenant com base real; não precisa de pagante |
| 6 | **Reativação de quem desceu** (`18` §I.4) | precisa do evento `teste_terminou` do item 1 |

### E3 · Travado, e a trava está certa

| # | Peça | Gate | Fonte |
|---|---|---|---|
| 7 | **Indicação B2B com crédito** | **≥20 pagantes** | `18` Fase H, `DECISOES.md` |
| 8 | **Cobrança automática** (Mercado Pago / Pix Automático) | decisão de negócio | `18` Fase J |

---

## 5. Como saber se funcionou

Uma métrica por peça, todas calculáveis com o que a E1 constrói:

| Peça | Métrica | Alvo honesto **[E]** |
|---|---|---|
| Teste reverso | % que assina até 7 dias depois do fim | 3–5% (referência de mercado para produto sem vendedor) |
| Extrato do Motor | % de tenants que abrem o app em 48h do push | > 40% |
| Anual | % dos assinantes que escolhem anual | 20–30% |
| Indicação do salão | clientes novos com `referred_by` / total | > 10% |
| Funil | conta criada → 1º agendamento pelo link | é o "aha" do `18` §I.1; medir antes de mirar |

**A métrica que continua sendo a única que importa** é a do `25` F3: *quantos reais o Motor trouxe,
por tenant, no mês*. Tudo acima existe para que esse número aconteça mais vezes.

---

## 6. Onde este documento discorda do `25` — e por quê

O `25` §3 diz: **F0 bloqueia todas as outras fases**, e F0 depende da credencial da Meta.

Concordo com a regra e discordo do recorte. O motivo do bloqueio é honestidade comercial: *"cobrar
antes da F0 é vender o que não está ligado"*. Isso é correto **para a promessa que fala com o
cliente final** — lembrete, confirmação, campanha.

Mas o F0 embala junto o laço que fala **com o dono**, e esse não tem a mesma dependência nem o
mesmo risco (Achado 3). Proposta:

- **F0a — voltado ao dono.** Push do extrato do Motor. Sem credencial de terceiro, sem tocar em
  telefone de cliente, risco reputacional zero. **Destravado hoje.**
- **F0b — voltado ao cliente final.** Lembrete, confirmação, campanha. **Continua travado** nos
  passos 2–4 do `25`, exatamente como está escrito.

E a restrição que amarra os dois: enquanto o F0b não ligar, **o teste reverso não concede
capacidade que dependa do F0b**. É a mesma regra da casa — não prometer canal sem rota agendada.

Com isso, a E1 inteira sai do bloqueio sem furar a regra que criou o bloqueio.

---

## 7. Riscos, ditos antes

1. **O teste reverso pode canibalizar o Grátis.** Se o Grátis já resolve, 14 dias de Avançado só
   adiam a descoberta. **Mitigação:** é justamente o que o evento `teste_terminou` + conversão
   mede. Se a conversão vier perto de zero, o problema não é o teste — é que os degraus pagos não
   resolvem dor suficiente, e isso é informação cara e boa.
2. **Push tem taxa de permissão baixa em PWA** **[E]**, sobretudo no iOS (exige o app instalado na
   tela de início). **Mitigação:** o extrato **também** é card na home; o push é o empurrão, não o
   único canal.
3. **Anual sem cobrança automática é boleto na mão.** Não construir o anual antes da Fase J.
4. **Tudo isto pressupõe tráfego que ainda não existe.** A E1 é barata de propósito: se o piloto
   do `25` F3 não trouxer ninguém, perdeu-se pouco — e a instrumentação continua valendo para a
   próxima tentativa.

---

## 8. Higiene, herdada do `25` §6 e ainda pendente

O `CLAUDE.md` ainda abre com *"SaaS multi-tenant de gestão para profissionais da beleza"*. A virada
multi-profissão já aconteceu no código **[M]**. Enquanto a primeira frase disser beleza, toda
sessão nova — e todo raciocínio de posicionamento, inclusive de preço — começa mirando o mercado
onde a concorrência é mais dura e o CICLO é mais fraco.
