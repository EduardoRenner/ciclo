# 49 · INOVAÇÃO — EXECUÇÃO

**2026-09-06.** Continuação local dos `docs/47` (pesquisa) e `docs/48` (plano). Aqueles dois
rodaram **fora** do repositório: toda linha deles é `[P]` ou `[E]`. Este aqui é o primeiro da
série com tag `[M]` — medido no código e nas migrations.

---

## A pergunta pendente desde o `docs/45` §1.6 — respondida

> *"hoje o `predicted_on` é sobrescrito a cada recálculo?"* — `48` §4.5 mandou verificar isso
> antes de qualquer outra coisa.

**Era sobrescrito. Não é mais** `[M]`. `client_cycles` é upsert por
`(tenant_id, client_id, service_id)`; a previsão anterior sumia a cada `recompute-cycles`. A
migration `0064_registro_de_previsao.sql` criou `cycle_predictions`, append-only, uma linha por
visita, com `algo_version` — e o commit `c87e9d6` a colocou em uso. A série
previsão↔realidade **começou a acumular**, e é ela que o C5 vai ler.

Consequência para o `48`: o item 5 da lista de arquitetura (`§4`) **já está feito**. O C5 deixa de
ser "criar a tabela" e passa a ser só a tela de prestação de contas.

---

## O inventário que o `48` §4 pediu, medido

| # do `48` §4 | O que o plano pede | Estado real no repositório `[M]` |
|---|---|---|
| 1 · Custos por serviço | comissão + insumo por serviço + taxa de pagamento | **Dois terços já existem.** `professionals.commission_bps` e `professional_services.commission_bps` (congelados em `ticket_items.commission_bps` no fechamento); `services.cost_cents` (insumo estimado, default 0) e a ficha de consumo `service_products`. **Falta a taxa** — ver abaixo, é a lacuna mais grave |
| 2 · Lucro por atendimento persistido | coluna calculada e congelada no fechamento | **Existe** `tickets.profit_cents`, escrita por `fecharComanda` via `calcularSobraDaComanda`. Congelada: `ticket_items.commission_bps` e `cost_cents` são gravados na hora, não relidos |
| 3 · Agregado por cliente (LTV) | lucro acumulado + ciclo | **Não existe** |
| 4 · Score de prioridade de recuperação | lucro esperado × probabilidade de retorno | **Não existe.** Há a view `clientes_a_recuperar` (`0058`), ordenada por risco, não por valor |
| 5 · Append-only previsão × realidade | tabela nova | **Existe** (`0064`) — ver acima |
| 6 · Permissão por papel | lucro invisível ao profissional comissionado | **Parcialmente.** `PERMISSIONS` (`server/auth/rbac.ts`) já nega `report:read` a `professional` e a `reception`. Falta *usar* essa permissão como porta do número de lucro nas telas novas |

### A lacuna mais grave, e ela já estava documentada

`tickets.fee_cents` **existe na tabela, é subtraída por `calcularSobraDaComanda`, é somada pela
API do caixa — e nada no projeto escreve nela** `[M]`. Nem a comanda, nem o pagamento, nem job
nenhum; `payments` não tem uma única escrita em `src/`. A auditoria de 2026-09-03 já tinha achado
isso e feito a coisa honesta: **removeu o quadro "Taxa"** do caixa em vez de mostrar R$ 0,00 para
sempre, com uma guarda (`caixa-nao-promete-taxa`) para ele não voltar antes de existir quem
preencha.

Ou seja: o "Sobrou" que o CICLO mostra hoje **não desconta a maquininha**. É exatamente o número
que o `47` P05 acusa o setor inteiro de esconder — *"faturar não é ganhar"* — só que um passo à
frente. E é a mitigação do `48` §Fase 3 ao contrário: lá, o insumo desconhecido podia ficar em
zero porque *"a taxa da maquininha é um único percentual que todo dono sabe de cor"*. **A premissa
do plano é que a taxa já está lá. Ela não está.**

Por isso o C1 não começa na tela: começa na taxa.

### E não era uma coluna só — eram três, em fila

Medido depois, executando o I-01 `[M]`: o mesmo padrão aparece três vezes seguidas no caminho do
lucro de um serviço, cada uma escondendo a próxima.

| Coluna / tabela | Quem lê | Quem escreve, antes de 2026-09-06 |
|---|---|---|
| `tickets.fee_cents` | `calcularSobraDaComanda`, resumo do caixa | **ninguém** |
| `services.cost_cents` | `adicionarItemComanda` → `ticket_items.cost_cents` → `material_cost_cents` | **ninguém** (excluída de `listarServicos` de propósito, sem campo e sem rota) |
| `service_products` (ficha de consumo) | `baixarEstoqueDaComanda`, e agora o custo do serviço | **ninguém** — nenhuma tela, nenhuma rota |

Ou seja: o "Sobrou" de um salão que só vende serviço era **preço − comissão**. Nem material, nem
taxa. O `docs/48` §Fase 3 imagina esse estado como o *pior* caso ("mesmo com insumo zerado…") e ele
era o **único** caso, para todo tenant.

A terceira linha é a que muda a resposta do plano. A mitigação do `48` para o custo desconhecido é
"deixe em zero e diga que falta"; a ficha de consumo permite algo melhor, sem pedir ao dono o que o
`47` P02 diz que ele não sabe: ele não informa o custo do serviço, informa **o que o serviço gasta**
— que é o que ele já compra, conta e cadastra para o estoque não furar. O custo se deduz.

---

## Os tickets, na ordem do `48` §Fase 3

| # | Candidato | O que entrega |
|---|---|---|
| **I-01** | C1 | A taxa de pagamento passa a existir: forma de pagamento no fechamento + percentual por forma, por tenant. `fee_cents` ganha quem a escreva, e o quadro "Taxa" volta ao caixa |
| **I-02** | C1 | O insumo do serviço sai da **ficha de consumo** × custo médio do produto, e não de `services.cost_cents` — outra coluna sem escritor. Inclui a tela da ficha, que também faltava |
| **I-03** | C1/§4.6 | "Sobrou" por atendimento na tela, atrás de `report:read`, com **estado incompleto honesto** quando falta ficha ou taxa |
| **I-04** | C4 | O ciclo de cada pessoa dito com todas as letras: *"vem a cada 18 dias, está há 31"* |
| **I-05** | C7 | Concentração de lucro por profissional |
| **I-06** | C6 | Margem viva do pacote/clube: alerta quando o assinante virou prejuízo |
| **I-07** | C3 | A fila de recuperação ordenada por **valor**, não por data |
| **I-08** | C2 | Lucro por cliente (LTV real) |
| **I-09** | C5 | Prestação de contas do Motor, lendo `cycle_predictions` |

C8 (preço por ociosidade) fica adiado pelo próprio `48`, e não entra nesta série.

---

## Restrições que valem para os nove

- **Nada de número inventado.** Onde o dado falta, a tela diz o que falta — a regra que o `48`
  §Fase 3 chamou de *estado incompleto honesto*, e a mesma que fez o quadro "Taxa" ser removido em
  vez de mostrar zero.
- **Congelar no fechamento, nunca recalcular.** `48` §4.2: se a comissão mudar em novembro, o
  lucro de agosto não pode mudar junto.
- **Nada cruza tenant.** Todos os nove leem só o dado do próprio estabelecimento — é o que o `48`
  §Fase 2 registra como a maior diferença para o `45`: nenhum precisa de escala.
- **Lucro é dado sensível dentro do salão.** `48` §Fase 3: o risco real destes tickets é social,
  não técnico.

---

# O que foi entregue, e o que a execução mediu

**2026-09-06.** Os nove tickets estão em `main`-de-branch (`vantagem/fosso-competitivo`), um commit
cada. Abaixo, o que mudou de fato — e as três coisas que a execução descobriu e que o `48` não
podia saber, porque rodou fora do repositório.

## Os nove

| # | Commit | O que passou a existir |
|---|---|---|
| I-01 | `feat(caixa)` | Forma de pagamento no fechamento + percentual por forma. `tickets.fee_cents` e `fee_bps` ganham escritor; o quadro "Taxa" volta ao caixa — só para quem respondeu |
| I-02 | `feat(comanda)` | O insumo sai da ficha de consumo × custo médio, e não de `services.cost_cents` |
| I-02b | `feat(servicos)` | A ficha de consumo ganha tela. Dois mecanismos prontos desde a `0001` param de esperar |
| I-03 | `feat(comanda)` | "Sobrou" por atendimento, com o que ainda falta descontar, atrás de `report:read` |
| I-04 | `feat(ciclo)` | *"Vem a cada 18 dias, veio faz 31"* na ficha — e as duas réguas do ciclo viram uma |
| I-05 | `feat(caixa)` | De quem depende o que sobra, com as fatias somando o "Sobrou no mês" exatamente |
| I-06 | `feat(clube)` | Margem por assinante no ciclo de cobrança, com prejuízo e estouro de limite separados |
| I-07 | `feat(recuperar)` | A fila ordenada por **lucro** em risco, não por receita. `0067` |
| I-08 | `feat(clientes)` | Lucro por cliente e projeção anual, com a cobertura dita em voz alta |
| I-09 | `feat(motor)` | A prestação de contas do Motor, lendo `cycle_predictions` sem viés de sobrevivência |

## Os três achados da execução

### 1. Não era uma coluna sem escritor — eram três, em fila

`tickets.fee_cents`, `services.cost_cents` e `service_products` (a ficha inteira). Cada uma
escondia a próxima: consertar a taxa revelou que o material também era zero; consertar o material
revelou que não havia como preencher a ficha. Enquanto isso durou, o "Sobrou" de um salão que só
vende serviço era **preço − comissão**, e mais nada.

O `48` §Fase 3 imagina esse estado como o *pior* caso — *"mesmo com insumo zerado, o número já é
radicalmente mais verdadeiro que o preço"*. Ele era o **único** caso, para todo tenant.

### 2. A mitigação do plano para o custo desconhecido tinha uma opção melhor

O `48` propõe: insumo em zero, e a tela diz que falta. O `47` P02 dá a razão — 73% dos donos não
sabem calcular o custo de um serviço.

Só que o dado já estava no banco por outro motivo: a ficha de consumo alimenta a baixa de estoque,
e `products.avg_cost_cents` é a média móvel das compras. **O dono não precisa saber o custo do
serviço; ele precisa saber o que o serviço gasta e quanto pagou no produto** — que é o que ele já
cadastra para o estoque não furar. O custo se deduz. Estado incompleto honesto continua valendo
onde a ficha não existe, mas deixou de ser o único caminho.

### 3. As duas réguas do ciclo já tinham divergido

A `0065` deu ao serviço `cycle_days` e `cycle_days_observado`. O job noturno passou a preferir a
medida; o recálculo de "concluir atendimento" continuou lendo só a configurada. **As duas escrevem
a mesma linha de `client_cycles`**: concluir um atendimento revertia a previsão daquela pessoa para
o palpite de catálogo, e a madrugada seguinte a trazia de volta. Nada ficava vermelho, porque cada
caminho estava certo por si.

Consertado em I-04, e a guarda pergunta *"a régua sai de um lugar só?"*, não *"o recálculo ao vivo
está certo?"* — caminho novo nasce coberto.

---

# A tabela do `48` §Fase 4, agora com estado real

O `48` propôs a comparação como **teste de aceite** da rodada. Este é o estado medido `[M]` no
repositório, não o desejado:

| | Estado |
|---|---|
| Mostra quanto SOBRA de cada corte | ✅ I-01 + I-02 + I-03 |
| Mostra quanto cada cliente deixa de lucro | ✅ I-08 |
| Avisa quem vai sumir, pelo ciclo de **cada pessoa** | ✅ já existia; I-04 passou a **dizer** o número |
| Diz quem vale a pena recuperar primeiro | ✅ I-07 |
| Avisa se o clube de assinatura virou prejuízo | ✅ I-06 |
| Mostra o cliente do salão a concorrentes | **Nunca** — veto de projeto, com guarda |
| Preço sobe se você contratar | Não |

## O que continua faltando, e é honesto dizer

1. **As migrations `0066` e `0067` não foram aplicadas em produção.** Não existe Action que rode
   `supabase db push` (`docs/05` B24 era uma promessa falsa, já corrigida). `compararSchema` vai
   acusar "banco ATRÁS do código" até alguém aplicar — que é exatamente para isso que ele existe.
2. **Os testes de banco não rodaram nesta máquina.** Sem Docker local, `test:rls` e
   `test:integration` não sobem. Rodaram `typecheck`, `lint`, `test:unit` (1.930 casos) e `build`,
   todos verdes; os 9 casos de integração novos dependem da CI.
3. **C8 (preço por ociosidade) continua adiado**, pelo próprio `48`: é 10x de verdade e é o mais
   caro, e o mais delicado com o veto de preço.
4. **Nada disso foi visto por um dono de salão.** O `48` §Fase 3 nomeia a fragilidade real — o
   custo desconhecido — e diz que ela *"é a primeira coisa a testar com cliente real"*. Continua
   sendo.
