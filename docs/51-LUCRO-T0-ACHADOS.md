# 51 · T0 — os achados, e por que o plano recebido mudou de alvo

> **Origem.** Missão autônoma "Lucro sem planilha" (`CICLO-LUCRO-EXECUTAR.md`, 2026-09-06). Aquele
> documento declara, na Parte 4: *"Este plano foi escrito SEM acesso ao repositório. Onde a
> realidade divergir, a realidade ganha."* Foi o que aconteceu, e em cheio.
>
> O número `51` também é o entregável do `L-05` (validação de campo) no `docs/50`. Os dois podem
> coexistir — já há precedente com dois arquivos `39-` nesta pasta.

| Tag | Significado |
|---|---|
| `[M]` | Medido no repositório em 2026-09-06, com caminho e linha |
| `[D]` | Decisão tomada nesta rodada, sem consultar ninguém (autonomia total) |

---

## 0 · A divergência, em uma frase

**O plano pedia para construir T1–T9. Eles já existem** — a rodada `47`/`48`/`49` entregou os nove
na branch `vantagem/fosso-competitivo`, que está 30 commits à frente de `main` `[M]`. Construir de
novo produziria uma segunda fonte para o mesmo dinheiro, que é o defeito de livro-caixa que esta
base já pagou uma vez.

O que **não** existia é o que esta rodada foi fazer: o mecanismo estava sendo alimentado por um
custo que o próprio CICLO inventou, e a tela exibia isso como conta fechada.

---

## 1 · As 8 respostas do T0

**1. Tabelas, colunas e tenant.** `appointments`, `clients`, `services`, `client_cycles` e
`tickets` em `supabase/migrations/0001_initial.sql`. Tenant é sempre a coluna `tenant_id uuid`
(`0001_initial.sql:317`, `:338`, `:143`), nunca claim de JWT solto — e a RLS é a segunda camada,
com `set_tenant_context()`. `client_cycles` tem chave `(tenant_id, client_id, service_id)`
(`0001_initial.sql:328`) `[M]`.

**2. Centavos.** Sim, `bigint` com sufixo `_cents`, e percentual em basis points `_bps` — regra 3
do `CLAUDE.md`, cumprida em todo o schema. `numeric` só aparece em quantidade física
(`service_products.qty`, `stock_moves.qty`) `[M]`.

**3. Onde o atendimento fecha.** `fecharComanda` em `src/server/services/comanda.ts:253`, que grava
`closed_at` na linha 304. É onde a comissão e a taxa congelam. **O gancho do T3 já está usado** `[M]`.

**4. Comissão.** Existe e é rica: `comp_model` enum (`commission`/`rent`/`hybrid`/`owner`,
`0001_initial.sql:30`), `professionals.commission_bps` (`:102`), sobrescrita por serviço
(`:171`), e o valor **congelado** por item em `ticket_items.commission_bps`/`commission_cents`
(`:371-372`, comentário literal *"congelado no momento"*). O T1 **não** ganha escopo `[M]`.

**5. Forma de pagamento no fechamento.** Existe desde a `0066`: `tickets.payment_method` e
`tickets.fee_bps` congelado, com o percentual por forma em `tenants.settings.payment_fees_bps`
(`0066_taxa_de_pagamento.sql:33-40`). A completude **não** cai para `partial` por falta de
modalidade `[M]`.

**6. `predicted_on` é sobrescrito?** Sim na `client_cycles` — mas o histórico **já existe** e é
append-only: `cycle_predictions` (`0064_registro_de_previsao.sql:43`), uma linha por visita
(`unique (tenant_id, client_id, service_id, last_visit_on)`), com `predicted_on`, `predicted_at`,
`actual_return_on` e `resolved_at`. **O T9 está pronto e gravando** `[M]`.

**7. Clube de assinatura.** Existe: `subscription_plans` (`0019_crm_profundo.sql:61`), com
`src/core/loyalty/margem-do-clube.ts` já calculando a margem viva por assinante. **O T8 está
pronto** `[M]`.

**8. Papéis.** `src/server/auth/rbac.ts:12-25`, cinco papéis. `report:read` alcança `owner`,
`manager` e `finance`; **não** alcança `professional` nem `reception`. É a trava que a comanda já
usa (`src/app/admin/comanda/[id]/page.tsx:46`) `[M]`.

### Mapa T0 para a realidade

| Pedido | Estado | Onde |
|---|---|---|
| T1 modelo de custo | pronto | `payment_fees_bps`, `service_products`, `products.avg_cost_cents` |
| T2 cálculo puro | pronto | `core/comanda/sobra-explicada.ts` (`lacunas` = `missing`) |
| T3 persistência congelada | pronto | `tickets.fee_bps`/`fee_cents` na `0066` |
| T4 tela | pronto | comanda fechada, atrás de `report:read` |
| T5 lucro por cliente | pronto | `core/crm/lucro-do-cliente.ts` |
| T6 fila por lucro | pronto | `client_cycles.profit_at_risk_cents` (`0067`) |
| T7 concentração | pronto | `core/caixa/concentracao.ts` |
| T8 clube | pronto | `core/loyalty/margem-do-clube.ts` |
| T9 log de previsão | pronto | `cycle_predictions` (`0064`) |

---

## 2 · O achado que mudou o trabalho

**`apply_vertical_pack` semeia o custo do produto, e a tela do lucro não sabia disso.**

`0002_vertical_packs.sql:299-306` cria os produtos do pack já com `avg_cost_cents` vindo do
catálogo, e `:308-316` semeia a ficha de consumo que os liga aos serviços. O catálogo de cabelo
(`0057:49-55`) traz tintura a R$ 22,00 o tubo, oxigenada a R$ 0,03 o ml, luva a R$ 0,40 `[M]`.

Um salão de cabelo criado hoje fecha a primeira "Coloração / retoque de raiz" de R$ 180,00 com
**R$ 24,60 de material que ninguém comprou**.

O valor não é o problema. **O silêncio é.** As duas lacunas que o produto sabe levantar são:

- `custoDoServico` conta produto com custo **zero** (`core/comanda/custo-do-servico.ts:59`);
- `contarServicosSemFicha` contava serviço **sem ficha** (`services/ficha-de-consumo.ts:125`).

Custo semeado não é nenhum dos dois — tem ficha, e tem custo. Então `explicarSobra` recebia
`servicosSemFicha: 0`, não levantava lacuna nenhuma, e a comanda mostrava **"Sobrou" limpo, sem
uma ressalva**, com um quarto do material saindo de um número que o CICLO escreveu sozinho no
cadastro.

É exatamente o que o `docs/47` P05 acusa o setor de fazer, e o que o `docs/48` §Fase 3 proíbe em
todas as letras: *estado incompleto honesto, nunca número inventado*.

### O `docs/50` está errado em dois pontos, e eles se sustentavam

- §1 mede *"`service_products` — vazia"*. Falso para as 8 verticais legadas (`barber`, `nails`,
  `lashes`, `brows`, `waxing`, `aesthetics`, `tattoo`, `hair`), que são o mercado central do
  produto. Verdadeiro só para as 9 profissões novas, cujo `apply_profession_pack`
  (`0031_profession_onboarding.sql:22-39`) semeia **só serviços** `[M]`.
- §5.1 escreve a regra *"Não semear custo de produto. Nunca."* como se ela já valesse. Ela nunca
  valeu — é violada desde a `0002`.

O `L-03` daquele plano pedia para **começar** a semear a ficha. A realidade é que ela já é semeada,
com o custo junto, e o trabalho era o inverso: **tirar o custo e ensinar a tela a perceber**.

---

## 3 · O que foi construído

| # | Commit | O quê |
|---|---|---|
| 1 | `fix(lucro)` `0069` | Pack para de semear custo; custo já semeado em produto sem compra volta a zero; `explicarSobra` ganha a lacuna que faltava |
| 2 | `fix(guarda)` | O cortador de comentário `--` não cortava nada em arquivo CRLF — achado ao **mutar**, não ao escrever |
| 3 | `fix(guarda)` | Mesmo cortador inerte na guarda de cobertura LGPD (zero mudanças de veredito, medido) |
| 4 | `feat(lucro)` `L-01` | A completude entra em "Hoje" e **some quando respondida, inclusive com zero** |
| 5 | `fix(lucro)` | A lacuna chega ao **caixa** e ao **clube** — o vizinho que a `0069` deixou mentindo para baixo |
| 6 | `fix(lucro)` | `materialIncerto` volta para dentro de `custoDoServico`: três chamadores remontavam a pergunta, e o do clube remontava errado |
| 7 | `test(guarda)` | A pergunta do material tem um dono, e a varredura cobra isso |
| 8 | `fix(lucro)` | A **fila de recuperação** prometia descontar um produto que não desconta — e é o lucro que ORDENA aquela fila |
| 9 | `feat(lucro)` `L-02` | A faixa da comanda leva à ficha **daquele** serviço, não ao catálogo |
| 10 | `fix(lucro)` `0070` | A lacuna era **refeita todo dia** e agora congela no item — ver §2.1 |
| 11 | `test(guarda)` | Calcular a ressalva e não gravá-la é o defeito de `fee_cents` de volta |
| 12 | `feat(lucro)` `L-06` | Margem por serviço na lista, com a parcela dominante — a razão ao lado do número |
| 13 | `test(guarda)` | O veto de precificação vira **molde de permitidos**, não lista de proibidos |
| 14 | `feat(lucro)` `L-07` | `/admin/mes` — os cinco números da tese numa página só |
| 15 | `fix(mes)` | "não sei" e "zero" saem do JSX e viram regra guardada |

**Decisões tomadas sozinho** `[D]`:

1. **Branch a partir de `vantagem/fosso-competitivo`, não de `main`.** O plano pede `main`, mas
   `main` não tem a `0066`/`0067` de que este trabalho depende. A realidade ganha.
2. **Zerar o custo semeado, em vez de marcá-lo com uma coluna de procedência.** O critério é
   objetivo e não adivinha intenção: `registrarEntradaEstoque` (`services/estoque.ts:140`) é o
   **único** escritor de `avg_cost_cents` no projeto e sempre grava um `stock_moves` de
   `source='purchase'` junto. Produto com custo e sem nenhuma compra é, por construção, semeado.
   Uma coluna de procedência guardaria para sempre um número que ninguém quer ler.
3. **Não recalcular `tickets.material_cost_cents` de comanda fechada.** Registro contábil
   congelado; reescrever faria o caixa de agosto mudar em setembro. As comandas fechadas sob o
   custo semeado ficam como estão.
4. **Uma ação de completude para as duas causas do material**, não duas. O destino é o mesmo e a
   ficha explica a diferença lá dentro; dois cards com o mesmo link seriam ruído com cara de
   checklist.
5. **`papel` opcional em `centralDeAcoes`, com a ausência ESCONDENDO as ações.** Falhar fechado:
   um `undefined` distraído não pode virar porta aberta para dado de dinheiro.


### 2.1 · O segundo achado, que só apareceu depois do primeiro

**A lacuna era recalculada do catálogo de hoje, sobre um custo congelado ontem.**

`ticket_items.cost_cents` é congelado no lançamento. A faixa que avisa "falta descontar o produto"
era medida a cada abertura da tela, sobre o estado atual de `service_products` e
`products.avg_cost_cents`. As duas divergem em silêncio:

1. o dono fecha uma comanda em agosto sem ter registrado a compra → `cost_cents = 0`, a faixa avisa;
2. em outubro ele registra a compra → `avg_cost_cents` deixa de ser zero;
3. **a comanda de agosto para de exibir a faixa**, e o `material_cost_cents` dela continua zero.

O número segue errado e o aviso sumiu. É a regra que a `0066` escreveu para a taxa, quebrada uma
tela adiante: *o lucro é registro, não view* — e ela vale para o valor **e** para a ressalva sobre
ele. Na direção oposta o estrago é igual: apagar uma linha da ficha faz comandas antigas, fechadas
com material correto, passarem a acusar uma lacuna que nunca existiu.

A `0070` põe a ressalva no ITEM, que é quem carrega o custo congelado, nascendo da mesma consulta e
no mesmo instante. De passagem, o caminho que ninguém tinha olhado: **produto de revenda** sem
compra registrada entra com custo zero e infla o lucro igual ao insumo.

### 2.2 · A fila que o primeiro conserto abriu

Consertar uma tela revelou a próxima, três vezes seguidas — o padrão de *"coluna sem escritor vem
em fila"*. Todas eram a mesma pergunta errada em lugares diferentes:

| Tela | O que dizia | O que era |
|---|---|---|
| Caixa | quadro "Material" com R$ 0,00 pelado | lido como *"hoje não teve material"* — a frase que tirou o quadro "Taxa" daqui em 28/08 |
| Clube | *"o serviço ainda não tem ficha de consumo"* | a ficha do pack já estava lá; o dono voltaria achando que o sistema se enganou |
| Fila de recuperação | *"o que sobra depois da comissão e do produto"* | sem material, uma coloração parece tão lucrativa quanto um corte — e o lucro é o que ORDENA aquela fila |

A raiz era uma só: `custoDoServico` devolvia `produtosSemCusto` e os **três** chamadores o
descartavam, cada um remontando a pergunta por conta própria. O do clube remontou errado. A
resposta voltou para dentro da função, e uma guarda impede o próximo chamador de repetir a conta
por fora.

---

## 4 · As lições de guarda desta rodada

Foram **quatro** guardas cegas nesta rodada, todas pegas pelo procedimento de mutação e nenhuma
pela leitura. Vale listar, porque as quatro têm caras diferentes:

| Guarda | Como estava cega | O conserto |
|---|---|---|
| pack não semeia custo | cortador de comentário `--` inerte em CRLF (abaixo) | `sqlSemComentarios` em `helpers/fonte.ts` |
| margem do clube | testava o NÚCLEO, e o defeito estava no SERVIDOR | a decisão voltou para `custoDoServico` |
| a ressalva é gravada | ninguém cobrava a ESCRITA, só o cálculo | casa com o INSERT, como a guarda de `fee_cents` |
| "sem amostra" ≠ zero | casava com `acertoBps === null` do texto VIZINHO | virou `percentualOuTraco`, com teste de comportamento |

A terceira e a quarta são a mesma lição do `CLAUDE.md` em roupas novas: varrer fonte prova que um
texto existe, nunca que um caminho executa — e o texto vizinho é o disfarce mais comum disso.

### O cortador que não cortava

O cortador de comentário quebrado **só apareceu ao mutar**. A guarda reprovou a mutação — resultado
esperado do exercício — **pelo motivo errado**: acusou o comentário que explicava o defeito, e não
o defeito.

A causa vale para toda guarda desta base que varre `.sql`: as migrations estão em CRLF no disco,
`\r` é terminador de linha em JavaScript, `.` não casa com ele e `$` sem `/m` só casa no fim
absoluto da string. Com `split('\n')`, **toda** linha terminava em `\r` e `/--.*$/` não casava com
nenhuma. O cortador existia, rodava, e não cortava.

Ele passava verde porque nenhum caso exercitava a prosa — a família de falso verde que o
`CLAUDE.md` já nomeia (*"verde não é prova"*), num lugar novo.

`sqlSemComentarios` mora agora em `tests/helpers/fonte.ts`, ao lado do irmão de JS/TS, pelo mesmo
motivo que aquele foi para lá: eram duas cópias divergentes da mesma regra.

---

## 5 · O que ficou faltando

1. **`supabase db push` das migrations `0066`, `0067`, `0068` e `0069`** — nenhuma está aplicada em
   produção, e não existe Action que faça isso `[M]`. A `0069` é a que devolve o custo semeado a
   zero: **enquanto ela não rodar, o "Sobrou" de todo salão de vertical legada continua saindo com
   material inventado**, agora com a tela já pronta para avisar.
2. `test:rls` e `test:integration` não rodaram: não há Postgres nesta máquina, e o `CLAUDE.md` diz
   que quem valida é a CI.
3. `L-05` (as três conversas com donos de salão) continua sendo a coisa mais barata que pode
   derrubar a tese inteira, e continua não sendo trabalho de código.
4. `L-09` (série mensal congelada) e `L-10` (papéis mais finos) do `docs/50` seguem abertos, e
   `L-04`/`L-08` (landing e `/precos`) também — os dois últimos são copy, e esta rodada evitou
   fechar por copy de propósito: foi assim que as duas rodadas anteriores falharam.
5. `L-03` está cumprido pela `0069`, mas ao contrário do que o `docs/50` supunha: ele pedia para
   **começar** a semear a ficha, e a realidade era que ela já vinha semeada com o custo junto. O
   critério que importava (*"nenhum custo é semeado"*, item 3, e a guarda do item 4) está de pé.

## 6 · O que este PR entregou, em uma linha

Quatro defeitos de silêncio na conta do lucro — o custo inventado pelo pack, a lacuna que não
chegava a três telas, a ressalva recalculada do dia de hoje sobre um custo de ontem, e o produto de
revenda sem compra —, mais `L-01`, `L-02`, `L-06` e `L-07` do `docs/50`. **Nenhuma linha de copy de
landing**: o diff é código, e as duas rodadas anteriores falharam exatamente por não ser.
