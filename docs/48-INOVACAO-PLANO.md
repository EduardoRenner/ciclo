# 48 · INOVAÇÃO — PLANO (Fases 2, 3 e 4)

> Baseado em `docs/47-INOVACAO-PESQUISA.md`. Executado fora do repositório: todos os
> custos e prazos são `[E]`, nenhum é `[M]`.

---

# FASE 2 · OS 8 CANDIDATOS

| # | Candidato | O que é, em uma linha |
|---|---|---|
| **C1** | **Lucro por atendimento** | Cada agendamento mostra, além do preço, quanto sobrou: preço − comissão − insumo − taxa |
| **C2** | **Lucro por cliente (LTV real)** | C1 × ciclo de retorno = quanto cada pessoa deixa de lucro por ano |
| **C3** | **Fila de recuperação priorizada por valor** | A lista de sumidos ordenada por quanto vale trazer de volta, não por data |
| **C4** | **Ciclo individual explícito** | "O João vem a cada 18 dias, está há 31" — em vez de um corte fixo de 45 dias igual pra todos |
| **C5** | **Previsão auditada** | "Dos 40 que previmos em agosto, 31 voltaram — 78% de acerto" |
| **C6** | **Margem viva do clube de assinatura** | Alerta quando um assinante passou a dar prejuízo |
| **C7** | **Concentração por profissional** | "62% do seu lucro depende do Rafa" |
| **C8** | **Sugestão de preço para horário ocioso** | Yield management com aprovação do dono |

## Tabela de avaliação

| Dimensão | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|---|
| **10x ou incremental?** | **10x** — ninguém no setor mostra lucro | **10x** — categoria nova | **10x** — muda a decisão do dia | Incremental+ (fresta real, estreita) | Incremental (credibilidade) | **10x** no nicho de clube | 10x pontual | **10x** — inédito no setor |
| **Vira categoria nova?** | Começa a virar | ✅ **Sim** | ✅ Sim, junto com C2 | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ✅ Sim |
| **Muda o banco?** | ✅ Custos por serviço + lucro por atendimento | ✅ Agregado por cliente | ✅ Score de prioridade | ⚠️ Já existe (Motor de Ciclo) | ✅ Tabela append-only previsão×real | ✅ Consumo × margem do plano | ⚠️ Só query | ✅ Ocupação por faixa |
| **Dono ENXERGA sem explicação?** | ✅ Número ao lado do preço | ✅ Ranking de clientes | ✅ A lista muda de ordem | ⚠️ Só se exibir o ciclo de cada um | ❌ **Invisível** | ✅ Alerta vermelho | ✅ Um percentual | ✅ Sugestão na agenda |
| **Escolheria o CICLO só por isso?** | ✅ **Sim** | ✅ Sim | ⚠️ Junto com C2 | ❌ Não sozinho | ❌ Não | ⚠️ Só quem tem clube | ❌ Não sozinho | ✅ Sim |
| **Fere veto?** | Não | Não | Não (dono dispara) | Não | Não | Não | ⚠️ Cuidado com exposição interna | ⚠️ **Só como sugestão aprovada** |
| **Funciona no dia 1?** | ✅ **Sim, no 1º atendimento** | ❌ ~3 meses | ❌ Precisa de ciclo | ✅ Com ~3 visitas | ❌ ~6 meses | ✅ Sim | ✅ Sim | ✅ Sim |
| **Tempo até demonstrável** `[E]` | 2–3 tickets | 2 tickets após C1 | 2 tickets | 1 ticket | 2 tickets | 2 tickets | 1 ticket | 4–5 tickets |
| **Tenants necessários** | **1** | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

**Observação que vale a rodada inteira:** nenhum candidato precisa de escala. Todos funcionam
com **um único tenant**, porque o valor vem do dado do próprio salão — não de agregação entre
salões. Isso resolve a maior fragilidade do doc 45 (mecanismo que só faz sentido com 500 pagantes).

## A combinação escolhida

**Âncora: C1 + C2** — o eixo *lucro*, que é a categoria nova.
**Ação: C3** — o lucro só vira decisão quando ordena a fila do dia.
**Visível no dia 1: C4** — a fresta contra o Gendo, explicável em uma linha.
**Complementares: C6 e C7** — baratos, visíveis, e reforçam a mesma tese ("onde seu dinheiro está").
**Credibilidade no tempo: C5** — entra depois, como prova, não como promessa.
**Guardado para a fase 2 da empresa: C8** — é 10x de verdade, mas é o mais caro e o mais
delicado com o veto de preço. Não descartado; adiado e nomeado.

**A história única que amarra tudo:** *o CICLO não organiza sua agenda — ele mostra onde
está o seu lucro e o protege.* C1 mede, C2 acumula, C3 age, C4/C6/C7 mostram onde vaza,
C5 prova que acertou. Não é lista de features: é uma tese com cinco evidências na tela.

## Por que os outros perderam

- **C5 sozinho** (o candidato herdado do doc 45): rebaixado. Invisível no dia 1, e um investidor
  não muda de categoria por causa de higiene metodológica. Vira prova, não âncora.
- **C4 sozinho**: a fresta é real (Gendo entrega 45 dias fixos) mas estreita — o Gendo fecha
  isso numa sprint. Só vale acompanhado.
- **C8**: adiado por custo e por risco de veto — precifica sem que o dono peça se mal desenhado.
  Registrado como **aposta de fase 2**, não como descarte.

---

# FASE 3 · RED TEAM

## Ângulo ambição

**A suposição mais frágil, e ela é séria:** C1 exige que o sistema saiba os custos — e a
pesquisa diz que **73% dos donos não sabem calcular o custo real do serviço** (P02). Pedir
que ele configure o custo é pedir exatamente a coisa que ele não sabe fazer. **Se a resposta
for um formulário de custos, C1 morre na primeira tela de onboarding.**

**Como isso se resolve sem cair:** o sistema já tem a comissão (ele a calcula), e a taxa da
maquininha é um único percentual que todo dono sabe de cor. Só o insumo é desconhecido — e
esse pode ficar em zero. Mesmo com insumo zerado, o número exibido já é **radicalmente mais
verdadeiro que o preço**, e a tela deve dizer isso na cara: *"sobra R$24 depois da comissão e
da taxa — falta descontar produto"*. Estado incompleto honesto, nunca número inventado.

**Dá para 2 pessoas construírem?** C1+C4+C3+C6+C7 sim `[E]`. C2 e C5 vêm com o tempo, sem
esforço extra de engenharia (é acúmulo). C8 não — por isso foi adiado.

**Ainda é 10x depois do corte de MVP?** Sim, e é a melhor notícia da rodada: o corte mínimo
(C1 sozinho) já é a única tela do mercado que mostra lucro. O 10x **não depende** das partes
que precisam de histórico.

**Ordem de construção:** C1 → C4 → C7 → C6 → C3 → C2 → C5 → (C8 na fase 2).

**O que quebra se crescer:** nada de dado cruzando tenant — tudo é intra-salão. O risco real é
**social, não técnico**: C7 expõe dependência de um profissional e C1 expõe que a comissão está
alta. Isso é dado sensível dentro do próprio salão — precisa de permissão por papel, nunca
visível ao profissional comissionado.

## Ângulo decisão de compra

**Objeção 1 — "isso é só marketing?"** Não: o número sai da comissão que o próprio dono
configurou. É aritmética verificável, não promessa.

**Objeção 2 — "só funciona depois de meses de uso?"** É a objeção que mata o Gendo e mataria
o doc 45. Aqui ela não pega: **C1 funciona no primeiro atendimento**. C2 e C5 melhoram com o
tempo, mas o gancho de venda não depende deles.

**Objeção 3 — "o Gendo já tem cliente sumido."** Tem, **por prazo fixo de 45 dias**. A resposta
cabe numa linha: *"eles avisam quando faz 45 dias pra todo mundo igual; a gente sabe que o João
some em 18 dias e a Maria em 60 — e diz qual dos dois vale mais a pena buscar."*

**Veredito:** a combinação sobrevive aos dois ângulos. A fragilidade real (custo desconhecido)
tem mitigação honesta e é a primeira coisa a testar com cliente real.

---

# FASE 4 · A FRASE DE FUNDAÇÃO

### 1. Para investidor
> **Todo software de beleza vende agenda; o CICLO vende a demonstração de resultado — ele é o
> único que sabe quanto cada cliente deixa de lucro e quanto está prestes a sumir com ele.**

### 2. Para o dono de barbearia (10 segundos)
> **"Os outros mostram quanto você faturou. O CICLO mostra quanto sobrou — por corte, por
> cliente, e avisa antes do cliente sumir."**

### 3. A tabela comparativa — o teste de aceite da rodada

| | **CICLO** | AppBarber | Trinks | BestBarbers | Fresha | Booksy | Gendo |
|---|---|---|---|---|---|---|---|
| **Mostra quanto SOBRA de cada corte** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Mostra quanto cada cliente deixa de lucro** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Avisa quem vai sumir** | ✅ ciclo de **cada pessoa** | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ prazo fixo 45 dias |
| **Diz quem vale a pena recuperar primeiro** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Avisa se o clube de assinatura virou prejuízo** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Mostra o cliente do salão a concorrentes** | **Nunca** | ⚠️ Sim (app único) | ⚠️ Sim | ✅ Não | ⚠️ Sim (20%) | ⚠️ Sim (~30%) | ✅ Não |
| **Preço sobe se você contratar** | Não | Sim | Sim | — | Sim | Sim | Sim |

Cinco linhas em que **só o CICLO tem ✅** — e nenhuma delas precisa de parágrafo explicativo.
Isso passa no teste de aceite.

### 4. O que muda na arquitetura `[E]`

1. **Custos por serviço** — nova estrutura: comissão (já existe), insumo por serviço (novo,
   opcional, default zero), taxa de pagamento (um percentual por tenant).
2. **Lucro por atendimento** — coluna calculada e **persistida no fechamento do atendimento**,
   não recalculada depois: se a comissão mudar em novembro, o lucro de agosto não pode mudar
   junto. Isso é registro contábil, não view.
3. **Agregado por cliente** — lucro acumulado + ciclo → LTV. Deriva de 2 + do Motor de Ciclo.
4. **Score de prioridade de recuperação** — função de (lucro esperado × probabilidade de retorno).
5. **Tabela append-only de previsão × realidade** — a pergunta pendente do doc 45 (seção 1.6,
   nunca executada): **hoje o `predicted_on` é sobrescrito a cada recálculo?** Se sim, C5 exige
   essa tabela nova. **Continua sendo a primeira coisa a verificar no repositório.**
6. **Permissão por papel** — C1 e C7 não podem ficar visíveis ao profissional comissionado.

### 5. É outra startup ou a mesma com capa nova?

**É outra.** O produto que existe hoje é "SaaS de agendamento com CRM e previsão de receita" —
descrição que serve para os sete concorrentes. O produto desta tese é **um sistema de resultado
por cliente que usa a agenda como sensor**. A agenda deixa de ser o produto e vira o meio de
coleta. Muda a primeira dobra do site, muda a demo, muda a pergunta que o vendedor faz na porta
da barbearia — de *"como você organiza os horários?"* para *"você sabe quanto sobra de cada corte?"*.

E, pela pesquisa (P01), a resposta a essa segunda pergunta é **não** em nove de cada dez portas.
