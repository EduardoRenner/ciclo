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

---

## Os tickets, na ordem do `48` §Fase 3

| # | Candidato | O que entrega |
|---|---|---|
| **I-01** | C1 | A taxa de pagamento passa a existir: forma de pagamento no fechamento + percentual por forma, por tenant. `fee_cents` ganha quem a escreva, e o quadro "Taxa" volta ao caixa |
| **I-02** | C1 | "Sobrou" por atendimento na tela, ao lado do preço, com **estado incompleto honesto** quando o insumo é zero |
| **I-03** | C1/§4.6 | O número de lucro atrás de `report:read` — invisível ao profissional comissionado |
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
