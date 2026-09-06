# 47 · INOVAÇÃO — PESQUISA (Fase 1)

> Rodada executada em 06/09/2026. Sucessora de `docs/45-VANTAGEM-PESQUISA.md`.
> A rodada 45 perguntou "o que não copiam". Esta pergunta "**por que alguém trocaria de sistema amanhã**".
> Executada fora do repositório — nenhuma afirmação tem tag `[M]`.

`[P]` pesquisa externa com link · `[E]` estimativa minha · `[V]` fere veto de projeto

---

# 1.1 · RECLAMAÇÕES PROFUNDAS — o modelo mental limitado do setor

Não são as queixas óbvias de billing (já mapeadas no doc 45). São as que revelam **como
o produto pensa o negócio** — e todas apontam para o mesmo buraco.

| # | Evidência | Fonte | O modelo mental que ela denuncia |
|---|---|---|---|
| P01 | **"Pergunte a dez donos de barbearia quanto eles ganham por corte e nove vão responder o preço do corte."** | [Blog BestBarbers — Gestão Financeira](https://www.bestbarbers.app/blog/gestao-financeira-barbearia) | O sistema registra **preço**, nunca **lucro**. Um corte de R$45 sobra ~R$20 antes dos custos fixos — **~56% do preço some** e nenhum sistema mostra isso |
| P02 | **"73% não sabem calcular o custo real de cada serviço"** e **"67% dos salões fecham por gestão financeira fraca"** | [Pandami](https://pandami.com.br/en/blog/gestao-de-salao-de-beleza) | A causa nº 1 de morte do negócio **não tem ferramenta nenhuma no mercado** |
| P03 | Comissão: "a maioria define um percentual **no olho**… e nunca revisa" (padrão 40–50%) | [BestBarbers](https://www.bestbarbers.app/blog/gestao-financeira-barbearia) | O sistema **calcula** a comissão, mas nunca pergunta se ela faz sentido |
| P04 | Gestores não sabem "qual é a **margem de lucro real**" nem "quais serviços trazem a **maior margem**" | [Corthy](https://corthy.com/principais-problemas-na-gestao-de-barbearia-e-como-resolver/) | Relatório = faturamento. Nunca resultado |
| P05 | "Faturar não é ganhar. **Movimento não é resultado.**" — distinção entre faturamento, caixa e lucro real que o dono confunde | [BestBarbers](https://www.bestbarbers.app/blog/gestao-financeira-barbearia) | Todo dashboard do setor mostra o primeiro e esconde o terceiro |
| P06 | Assinatura: "**receita antecipada não é lucro antecipado**". Plano ilimitado — basta uma parcela usar acima da média e "a margem despenca" **sem aviso prévio** | [Frizzar](https://frizzar.com.br/blog/barbearia-por-assinatura-modelos-preco-margem-sem-prejuizo/) | Todos vendem clube de assinatura (Trinks, BestBarbers, Gendo, AppBarber) e **nenhum alerta quando o assinante virou prejuízo** |
| P07 | "um barbeiro bom pede as contas — e **leva metade da clientela junto**… o cliente era 'do' barbeiro, não da barbearia" | [HAIRZON](https://hairzon.com.br/blog/fidelizacao-de-clientes/cliente-vai-embora-com-barbeiro) | Ninguém mede **concentração de clientes por profissional** — o dono só descobre o risco no dia da demissão |
| P08 | Problemas sem ferramenta: "horários ociosos não preenchidos", "conflitos internos pela disputa de clientes", "ausência de dados para decisões estratégicas" | [Corthy](https://corthy.com/principais-problemas-na-gestao-de-barbearia-e-como-resolver/) | Agenda = grade de horário. Nunca capacidade com valor |
| P09 | Estoque: produtos vencidos, falta em pico, compras por impulso, **"desvio ou sumiço de produtos de revenda sem auditoria"** | [Corthy](https://corthy.com/principais-problemas-na-gestao-de-barbearia-e-como-resolver/) | Estoque é lista, não custo que entra na conta do serviço |
| P10 | Dono do AppBarber, 22/08/2025: *"tenho que seguir fazendo a gestão **no caderninho**"* (estoque e pacotes quebrados) | [Reclame Aqui](https://www.reclameaqui.com.br/app-barber/app-barber-nao-cumpre-o-que-promete-falhas-no-agendamento-estoque-e-controle-de-pacotes_YQQypRdlbb6F1pEr/) | Largura de features sem profundidade |

**O padrão, dito de uma vez:** todo sistema do setor trata o negócio como **agenda + cadastro**.
Nenhum trata como **operação com margem**. O dono compra um organizador de horário e continua
sem saber se está ganhando dinheiro — que é, segundo P02, exatamente o que mata 67% deles.

---

# 1.2 · DECISÕES CARAS DO DONO SEM FERRAMENTA NENHUMA

| # | Decisão | Por que é cara | Alguém resolve? |
|---|---|---|---|
| D-A | **"Quanto sobra de cada serviço, e qual serviço vale a pena empurrar?"** | Decide preço, mix de serviços, promoção e comissão. Erra por ~56% do ticket (P01) | ❌ **Ninguém.** Trinks e Booksy escrevem blog **ensinando a fazer a conta na mão**; nenhum entrega o número pronto `[P]` |
| D-B | **"Esse cliente vale o esforço de recuperar?"** | O dono tem tempo/WhatsApp limitado por dia. Hoje trata todo cliente sumido igual | ❌ **Ninguém.** Gendo lista quem sumiu; **não diz quanto vale** |
| D-C | **"Contrato mais um profissional / aluguel de cadeira ou comissão?"** | Decisão de dezenas de milhares de reais/ano; muda regime jurídico e margem | ❌ Só conteúdo educativo ([Trinks](https://blog.trinks.com/aluguel-cadeira-barbearia-comissao/), YouTube). Zero ferramenta |
| D-D | **"Meu clube de assinatura está dando lucro ou prejuízo, agora?"** | P06: margem despenca em silêncio | ❌ Todos vendem o clube. **Nenhum monitora a margem dele** |
| D-E | **"Quanto do meu faturamento depende de um único barbeiro?"** | P07: metade da clientela sai junto | ❌ Ninguém. HAIRZON descreve o medo e vende "cliente é da barbearia" — que é posicionamento, não medida |
| D-F | **"Terça 14h está vazia há 6 semanas. Vale baixar o preço nesse horário?"** | Cadeira parada é 100% de prejuízo sobre custo fixo | ❌ Ninguém no setor. Resolvido há 40 anos em hotel/aviação (ver 1.3) |

**Números de referência do setor** `[P]`:
- No-show: **15–20% da agenda** sem confirmação automatizada; 92% de comparecimento com confirmação ([Pandami](https://pandami.com.br/en/blog/gestao-de-salao-de-beleza))
- Ocupação saudável: **75–85%** — caso relatado de 68% → 82%
- Meta de retorno: **>60% em 60 dias**
- Margem de contribuição: serviço abaixo de **40%** não sustenta crescimento
- Reter custa **5x menos** que adquirir; LTV deve ser ≥3x CAC
- Mercado: **R$242,3 bi em 2025**, **1,3 milhão de MEIs** em beleza (doc 45, F27)

---

# 1.3 · O QUE OUTROS SETORES JÁ RESOLVERAM E BELEZA NÃO TEM

| Setor | O que já é padrão lá | Existe em beleza? | Cabe no CICLO sem ferir veto? |
|---|---|---|---|
| **SaaS / assinatura** | Churn prediction com intervenção **priorizada por valor da conta** — não se trata cliente de R$50 e de R$5.000 igual | ❌ Gendo lista sumidos por **prazo fixo de 45 dias**, sem valor `[P]` | ✅ Sim — é D-B |
| **SaaS** | **Health score** agregado da base, acompanhado no tempo | ❌ Nenhum sistema BR tem | ✅ Sim |
| **Hotelaria / aviação** | **Yield management**: mesmo assento/quarto custa diferente conforme ocupação e antecedência ([Stripe](https://stripe.com/resources/more/yield-management), [Cloudbeds](https://www.cloudbeds.com/articles/yield-management/)) | ❌ Barbearia cobra igual em terça vazia e sábado lotado | ⚠️ Só como **sugestão que o dono aprova** — preço automático fere veto `[V]` |
| **Varejo/e-commerce** | **Margem por SKU** na tela, não em planilha | ❌ É D-A | ✅ Sim |
| **Academia/clube** | Gestão de **capacidade** e alerta de assinante que virou custo | ❌ É D-D | ✅ Sim |
| **Fintech p/ autônomo** | Projeção de recebíveis e fluxo de caixa futuro | ⚠️ Parcial — Fresha tem "Fresha Capital" (crédito), não projeção `[P]` | ✅ Sim, com o ciclo já existente |

**O paralelo mais forte é o de SaaS**, e a ironia é boa de contar: o CICLO **é** um SaaS.
Todo fundador de SaaS sabe que não se trata churn sem olhar o MRR da conta. O setor de
beleza faz retenção às cegas, tratando todo cliente como igual, porque nenhum sistema
sabe quanto cada cliente vale.

---

# 1.4 · ATAQUE AO CANDIDATO HERDADO DO DOC 45

O doc 45 sobreviveu com um candidato: **previsão auditada (histórico previsão × realidade)**.

**Isso é 10x ou é "o óbvio que dá trabalho"?**
Sozinho, `[E]` **não é 10x** — é credibilidade. Um investidor entediado ouve "medimos nossa
própria acurácia" e responde "ótima higiene, e daí?". Não muda a categoria do produto e,
pior, **não existe no dia 1** (precisa de meses de histórico). Como gancho de venda para
o primeiro cliente, vale zero.

**Existe versão maior?** Sim, e ela apareceu na 1.2. A previsão de retorno só vira decisão
quando ganha **valor**: não "quem sumiu", e sim **"quem sumiu, quanto essa pessoa deixa de
lucro por ano, e quanto custa trazê-la de volta"**. Isso é D-A + D-B fundidos — e nenhum
concorrente tem nenhuma das duas metades.

**Vira produto novo virado do avesso?** Sim. Se o sistema sabe o lucro de cada atendimento
e o ciclo de cada pessoa, ele deixa de ser agenda e passa a ser **a demonstração de resultado
viva do negócio**, atualizada a cada corte. O agendamento vira o meio de coletar o dado,
não o produto.

**Veredito:** a previsão auditada é rebaixada de âncora para **prova de credibilidade** de
uma tese maior. Entra na combinação, não a lidera.

---

# 1.5 · CATEGORIA NOVA?

Se D-A + D-B derem certo, o CICLO deixa de ser descrito como "sistema de agendamento com CRM"
e passa a ser:

> **"O sistema que mostra quanto cada cliente deixa de lucro — e avisa antes de você perder ele."**

Nenhum dos 7 concorrentes pesquisados pode dizer essa frase hoje sem mentir, porque
**nenhum calcula lucro** (P01–P05) e só um calcula sumiço — por prazo fixo (1.6).
Isso é categoria nova: sai de *agenda* e entra em *resultado*.

---

# 1.6 · A TELA DE COMPARAÇÃO — o que o dono vê em 10 segundos

Primeira dobra literal de cada concorrente `[P]` — é isto que o dono lê antes de decidir:

| Concorrente | Headline da primeira dobra | Promete o quê |
|---|---|---|
| **AppBarber** | *"Uma nova experiência para uma antiga tradição."* + "Aumente seu movimento em até 40%" | Movimento |
| **Gendo** | *"Cadeira cheia de segunda a sábado."* | Ocupação |
| **BestBarbers** | App próprio com a marca da barbearia, "sem ver concorrentes" | Marca própria |
| **Trinks** | Gestão completa + comunidade + suporte humanizado | Completude |
| **Fresha** | Marketplace + reservas + pagamentos | Clientes novos |
| **Booksy** | Diretório onde clientes procuram e agendam | Descoberta |

**Ninguém, em nenhuma primeira dobra, fala de LUCRO.** Todos falam de movimento, agenda,
alcance ou marca. Um sétimo entrante que chega dizendo *"veja quanto sobra de cada corte"*
não está competindo na mesma frase — está mudando a pergunta.

### Achado crítico sobre o Gendo — o concorrente mais próximo

O doc 45 registrou que o **blog** do Gendo descreve ciclo individual ("a Mônica vinha a cada
21 dias"). A **página de produto** entrega outra coisa `[P]`:

> "**Relatório de clientes sumidos: Veja quem não volta há 45 dias**"
> — [gendo.app/br/segmento/barbearia](https://www.gendo.app/br/segmento/barbearia), acesso 06/09/2026

**Prazo fixo de 45 dias, igual para todo mundo.** O blog vende ciclo individual; o produto
entrega um filtro de data. Isso reabre uma fresta que o doc 45 tinha dado como fechada —
mas é uma fresta **estreita e explicável em uma linha**, não um fosso.

O Gendo também ancora com números fortes de marketing: "75% de retenção vs 40% do mercado"
e "R$47 mil/ano recuperados". Qualquer comparação do CICLO vai bater nesses números.

### Classificação de visibilidade (insumo obrigatório da Fase 2)

| Ideia | Aparece na tela em 10s? | Funciona no dia 1? |
|---|---|---|
| Lucro por atendimento (D-A) | ✅ **Sim** — é um número ao lado do preço | ✅ **Sim** |
| Lucro por cliente / LTV (D-B) | ✅ Sim — ranking de clientes por lucro | ⚠️ Parcial (precisa de histórico) |
| Priorização de recuperação por valor | ✅ Sim — a lista muda de ordem | ⚠️ Precisa de ciclo |
| Ciclo individual vs. 45 dias fixos | ⚠️ Só se mostrar o ciclo de cada um explicitamente | ✅ Sim, com pouco histórico |
| Previsão auditada | ❌ **Não** — invisível até ter meses de dado | ❌ Não |
| Margem do clube de assinatura (D-D) | ✅ Sim — alerta vermelho | ✅ Sim |
| Concentração por profissional (D-E) | ✅ Sim — um percentual | ✅ Sim |
| Sugestão de preço por ociosidade (D-F) | ✅ Sim | ✅ Sim |

---

## Fontes

Todas linkadas nas tabelas acima, acesso 05–06/09/2026. Base herdada: `docs/45-VANTAGEM-PESQUISA.md` (F01–F29).
