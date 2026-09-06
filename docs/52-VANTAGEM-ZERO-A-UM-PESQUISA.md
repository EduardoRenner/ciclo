# 52 · VANTAGEM REAL, DE ZERO A UM — PESQUISA

> **Rodada de 2026-09-06.** Sucessora de duas famílias: `docs/45`/`46` (vantagem em geral) e
> `docs/47`/`48`/`49`/`50`/`51` (a tese de lucro granular). Esta rodada é **só pesquisa e
> auditoria** — nenhuma linha de `src/`, `supabase/migrations/` ou `tests/` foi tocada.
> O plano está no `docs/53`.

| Tag | Significado |
|---|---|
| `[M]` | Medido no código/banco deste repositório em 2026-09-06, com caminho |
| `[P]` | Pesquisa externa, com link e data de acesso |
| `[E]` | Estimativa — não vira fato por repetição |
| `[V]` | Fere veto de produto |

**Estado do código no momento desta auditoria** `[M]`: a tese de lucro **não** está em `main`. Ela
vive em `lucro/custo-que-o-ciclo-inventou` (PR #76, aberto), que contém
`vantagem/fosso-competitivo` (PR #75, aberto) inteira — 59 commits à frente de `main`, migrations
`0063` a `0072`. `main` está em `8784321` (PR #73). Toda auditoria interna abaixo parte da branch
mais avançada, não de `main`.

---

# 1 · O parágrafo de estado atual

O `docs/43` produziu **comunicação** (sem app, sem vitrine, sem comissão) e o dono respondeu que
isso não era vantagem. O `docs/45`/`46` procurou **mecanismo** e achou um: registrar a previsão
antes do resultado e calibrar a régua por salão — poder de **custo de troca**, não de rede. O
`docs/47`/`48` mudou a tese do produto de *agenda com CRM* para *"quanto sobra de cada
atendimento"*, e o `docs/49`/`50`/`51` construiu isso: taxa de pagamento congelada (`0066`), custo
de material saindo da ficha de consumo, lucro em risco ordenando a fila (`0067`), custo semeado
zerado (`0069`), ressalva congelada no item (`0070`), série mensal (`0071`) e hora de cadeira
(`0072`). Esta rodada foi procurar **outros eixos** com o mesmo rigor — e o achado mais importante
dela é uma correção: **a afirmação "0 de 27 concorrentes mostram lucro" é falsa**, e a verdade que
a substitui é mais forte, não mais fraca.

---

# 2 · Auditoria interna — o que o CICLO já É, medido

## 2.1 · A tabela de capacidades

Cada linha responde três coisas: existe? alguém do mercado tem? já é argumento de venda, ou é
**capacidade sem holofote**?

| # | O que o CICLO faz hoje `[M]` | Onde | Alguém mais faz? | Estado comercial |
|---|---|---|---|---|
| A1 | **Previsão de retorno registrada ANTES do resultado**, append-only, com versão do algoritmo | `cycle_predictions` (`0064`), `server/services/previsao.ts` | **Ninguém** `[P]` — não é reconstruível de histórico | **Escondido.** Aparece em `/admin/recuperar` e `/admin/mes` como "prestação de contas". Não está na `/precos` nem na landing |
| A2 | **Régua de retorno medida por salão** ao lado da configurada, com piso de amostra e amortecimento | `core/cycle/calibracao.ts`, `0065` | Ninguém `[P]`. O setor entrega 45 dias fixos | **Escondido.** Só na lista de serviços |
| A3 | **"Sobrou" por atendimento congelado no fechamento**, com 4 parcelas: material, taxa, comissão, hora de cadeira | `tickets.profit_cents`, `fee_bps`, `0066`/`0072`, `core/comanda/sobra-explicada.ts` | **Parcialmente — ver §4.1.** Ninguém desconta taxa nem custo fixo | **Escondido.** Nem landing nem `/precos` (decisão consciente do `51` §5.4) |
| A4 | **Lacuna honesta congelada no item**: a ressalva "falta descontar X" nasce junto do custo, não é recalculada do catálogo de hoje | `0070`, `ticket_items` | Ninguém `[E]` — é uma classe de defeito, não uma feature que se anuncia | Escondido, e correto que seja |
| A5 | **Série mensal de lucro congelada, sem depender de cron** | `0071`, `core/caixa/serie-mensal.ts` | Ninguém `[E]` | Escondido |
| A6 | **Extrato de comissão congelado por item**, no fuso do salão, paginado, que fecha com a soma | `server/services/comissao.ts`, `ticket_items.commission_bps` | Vagaro congela para folha `[P]`; ninguém no BR expõe ao profissional `[P]` | **Escondido, e pior — ver §2.2** |
| A7 | **Cofre de dado de saúde cifrado** (AES por registro, `key_version`), com **trilha de acesso** (quem leu, quando, IP) e **consentimento com hash do texto exibido** | `health_records`, `vault_access_log`, `consents.text_hash` (`0001`) | **Sim — ver §4.3.** Agendiva e Belle têm equivalente `[P]` | Escondido, e **não é vantagem** |
| A8 | **Produtos utilizados por atendimento**, imutáveis, com origem: `stock_moves(source='ticket', source_id)` | `0001:205`, `server/services/estoque.ts` | Agendiva tem estoque com lote e validade `[P]`; o CICLO **não tem lote** | Escondido, e **incompleto** |
| A9 | **Alerta de validade de produto** (`products.expires_at` com `estadoValidade`) | `server/services/alertas-estoque.ts:60` | Agendiva `[P]` | Escondido |
| A10 | **Preço fixo que não sobe com a equipe** — R$ 0 / 49 / 99 / 179 | `core/billing/planos.ts` | **Ninguém** — ver §4.2, toda a concorrência escalona | **Já é argumento** (`/precos`, item C do `43`) |
| A11 | **Zero comissão por transação, zero vitrine, zero app do cliente** | Arquitetura + veto com guarda | Só BestBarbers e Gendo/Simples Agenda não têm vitrine `[P]` | **Já é argumento** (dobra da landing) |
| A12 | **Serviço "sob orçamento" + pedido público de orçamento**, para quem não tem tabela de preço (eletricista, faxineira) | `0059`, `0061`, `docs/40` | Nenhum sistema de beleza BR `[E]`; é padrão em field service (Jobber) `[P]` | **Escondido.** Não está em nenhuma página pública |

## 2.2 · A capacidade sem holofote mais gritante, e ela é medida

**O CICLO calcula o extrato de comissão de quem trabalha, e quem trabalha não tem como abrir.**

Medido `[M]`:

- `extratoDeComissao` (`server/services/comissao.ts:53`) devolve, por item, `commissionBps` e
  `commissionCents` **congelados no fechamento** — mudar o percentual do profissional depois nunca
  reescreve uma linha fechada. A soma das linhas é exatamente `totalCents`, e o período é dito no
  fuso do salão, não em UTC. Três defeitos de dinheiro já foram consertados ali (auditoria de
  2026-08-28, documentada no próprio arquivo).
- Ela tem **dois** chamadores: `src/app/admin/caixa/page.tsx` e
  `src/app/api/v1/commissions/extract/route.ts`.
- A página exige `report:read` (`caixa/page.tsx:56`) e o bloco de comissão exige adicionalmente
  `commission:read` (`:121`). A rota de API exige `commission:read`.
- Em `server/auth/rbac.ts:12-25`, `commission:*` alcança **`finance`** e `owner` (via `*`).
  `professional` tem `['appointment:own', 'client:own', 'vault:own', 'comanda:own']` — **não tem
  `commission:own`, e esse verbo não existe na tabela**.
- Não há rota `/admin/extrato` nem nada equivalente: `ls src/app/admin/` dá `agenda, caixa,
  campanhas, clientes, comanda, config, error.tsx, estoque, hoje, layout.tsx, mes, orcamentos,
  page.tsx, recuperar, series`.

**Consequência:** o `docs/50` L-10 item 3 escreve *"O profissional comissionado continua vendo o
próprio extrato de comissão e nada mais"* como se fosse o estado atual. **Não é.** Ele não vê nada.
O registro que resolveria a discussão existe, é congelado, é auditável — e a pessoa de quem é aquele
dinheiro não alcança.

Isso não é um defeito de segurança (falhar fechado é o certo). É uma capacidade construída e sem
consumidor, na classe que esta base já nomeou: *coluna sem escritor* tem irmã, e ela é **função sem
leitor**.

## 2.3 · Duas afirmações de documento que a medição desmente

O `docs/44` §5 manda reconferir o que o documento afirma. Rendeu de novo:

| Documento afirma | Medido em 2026-09-06 `[M]` | Veredito |
|---|---|---|
| `docs/40` §1: *"`media.consent_id` … coluna escrita que ninguém lê"* | É lida em `admin/clientes/[id]/ficha.tsx:589-590`, `fotos.tsx` e `api/v1/clients/[id]/media/route.ts:41`. O TICKET-114 fechou isso | **Desatualizado** |
| `docs/40` §1: *"`vault_access_log.actor_label` … ninguém lê"* | É escrito em `services/cofre-trilha.ts:67` e lido em `services/trilha-cofre.ts:34,69`, com fallback `'Usuário removido'` | **Desatualizado** |
| `docs/50` L-10.3: *"o profissional continua vendo o próprio extrato"* | §2.2 acima | **Falso hoje** |

Nenhuma das três é grave. As três são a mesma armadilha: **o documento envelheceu mais rápido que
o código**, e a rodada seguinte teria proposto construir o que já existe (as duas primeiras) ou
suposto pronto o que não existe (a terceira).

---

# 3 · A matriz de concorrentes

## 3.1 · Os 27 já pesquisados

Não repetidos aqui. Brasileiros (`docs/47` §1.1): Trinks, AppBarber, BestBarbers, Gendo, HAIRZON,
Relinq, Barba na Hora, Barbeiro.app, Vatro, ZapCorte, Corthy, Frizzar, SuaAgenda, Belio, Agendiva,
Pandami. Internacionais (`docs/45`/`47`): Fresha, GlossGenius, Booksy, Mangomint, Zenoti, Phorest e
os demais. **Uma mudança de estado nos antigos, medida nesta rodada:**

| Concorrente antigo | Mudança verificada | Fonte, acesso 06/09/2026 |
|---|---|---|
| **Gendo** | **Mudou de nome para Simples Agenda.** Escala declarada muito maior do que o `docs/47` registrou: *"mais de 250 mil negócios"*, *"53 milhões de agendamentos"*, *"21 milhões de clientes atendidos"*. IA própria chamada **GAIA** + "Gendo Zap". Preço a partir de R$ 39,90/mês | [gendo.com.br/segmento/sistema-para-barbearias](https://www.gendo.com.br/segmento/sistema-para-barbearias) · [simplesagenda.com.br](https://www.simplesagenda.com.br/site/sistema-para-barbearia) |
| **Fresha** | Em março de 2025 tornou a assinatura **por membro da equipe** praticamente obrigatória, com pouco aviso. As três queixas recorrentes hoje: taxa por membro, comissão de 20% em cliente novo, e **repasses retidos** sem telefone para ligar (principalmente no Reino Unido) | [sorttheclicks.com/fresha-reviews-reddit](https://sorttheclicks.com/fresha-reviews-reddit/) `[P]` |
| **Trinks** | Reputação **ÓTIMO**, 8.1/10 nos últimos 6 meses, 95 reclamações no período, 511 ativas, 90% resolvidas | [Reclame Aqui · Trinks](https://www.reclameaqui.com.br/empresa/trinks/lista-reclamacoes/) |
| **AppBarber** | Reputação **RUIM**, 5.9/10, 105 reclamações ativas, **53,3% resolvidas**, **40% voltariam a fazer negócio** | [Reclame Aqui · App Barber](https://www.reclameaqui.com.br/empresa/app-barber/lista-reclamacoes/) |
| **Agendiva** | Tem **anamnese por procedimento com assinatura digital em todos os planos** e **estoque com lote e validade** | [agendiva.com.br/melhores-sistemas-para-clinica-de-estetica](https://agendiva.com.br/melhores-sistemas-para-clinica-de-estetica) `[P]` |

## 3.2 · Os novos brasileiros e os movimentos de 2026

Seis entradas que a pesquisa anterior não cobriu. Duas delas mudam o campo de batalha.

| # | Quem | O que é, medido na fonte | Por que importa | Fonte · acesso 06/09/2026 |
|---|---|---|---|---|
| **N1** | **InfinitePay (CloudWalk) — Agendamentos** | Lançado em **19/01/2026**. Agenda com link, sinal por Pix ou cartão, **confirmação automática e lembrete no dia anterior**. *"A funcionalidade de agendamento está disponível gratuitamente para todos os usuários"*. A empresa declara ter **dobrado a base de 3 para 6 milhões de empreendedores** e presença em **100% das cidades brasileiras** | **O maior evento competitivo do ano.** A agenda deixou de ser produto e virou custo de aquisição de quem monetiza o fluxo de dinheiro. E ela **manda lembrete**, que é justamente o que o CICLO não faz com o F0 parado | [newsroom](https://www.infinitepay.io/newsroom/infinitepay-lanca-recurso-de-agendamentos-e-transforma-a-organizacao-de-servicos-de-empreendedores) · [agendamento-automatico](https://www.infinitepay.io/agendamento-automatico) |
| **N2** | **modoPAG — Plano Barber** | Maquininha + sistema `modo GESTOR` **grátis por 3 meses**, depois R$ 47,90/mês (anual). Traz agenda por link, **comissão por barbeiro calculada na hora**, pagamento antecipado, retenção anti-falta, chatbot. Taxas 1,45% débito / 2,99% crédito | Segundo processador dando o sistema de graça para vender a maquininha. Confirma o padrão de N1 e mostra que ele não é evento isolado | [modopag.com.br/modo-gestor](https://modopag.com.br/modo-gestor/) |
| **N3** | **Barberia.io** | 119 funcionalidades, 14 módulos, IA no WhatsApp, app próprio iOS/Android com a marca da barbearia, NFS-e, multiunidade. Relatórios declarados: *"Faturamento, serviços mais pedidos, horários de pico"*. Preço **R$ 49 → 99 → 199 → 349 → 499**, escalonado por número de profissionais | Entrante 2026 completo. O relatório dele é **faturamento**, e o preço **sobe** com a equipe — as duas premissas do CICLO seguem de pé contra ele | [barberia.io](https://barberia.io/) |
| **N4** | **BarberAI** | *"O único sistema de gestão para barbearias com inteligência artificial nativa no WhatsApp que agenda, vende e fideliza"* | IA no WhatsApp virou paridade em 2026, não diferencial | [barberai.com.br](https://barberai.com.br/) |
| **N5** | **EiBarber** | Declara IA (Jarvis, sobre GPT-4), WhatsApp integrado e **"motor de precificação"** | O único entrante que nomeia precificação. **Não foi possível verificar ao vivo**, por **dois caminhos independentes** em 06/09/2026: busca HTTP (`ENOTFOUND eibarber.com.br`) e navegador (navegação negada/falha). Fica registrado como **não verificado**, e é o ticket `A-00` do `docs/53` — o único portão capaz de invalidar a classificação do candidato V4 | busca; site inalcançável em duas tentativas no acesso |
| **N6** | **BarberFlow AI / BarberConec / HardLogic** | Três entrantes de 2025-26 no mesmo molde: IA + WhatsApp + gestão | Densidade do nicho: a categoria "sistema com IA para barbearia" tem pelo menos **seis** entrantes novos | [barberflow.app](https://barberflow.app/) · [barberconec.com](https://www.barberconec.com/) |

**Adjacente que compete por atenção do mesmo dono, verificado:** a **NFS-e de padrão nacional entra
em vigor em 01/01/2026**, com layout único substituindo os sistemas municipais — a reboque da
reforma do consumo. Barberia.io já responde "emite NFS-e" no FAQ; o CICLO tirou NFS-e do MVP
(`docs/00` §3). Isso não é vantagem de ninguém: é **higiene regulatória que vira motivo de troca de
sistema** ([Gendo, blog](https://www.gendo.com.br/blog-post/novas-regras-para-saloes-clinicas-e-barbearias-em-2026-o-que-muda-e-como-se-preparar), acesso 06/09/2026).

## 3.3 · Os novos internacionais

Quatro, lidos pela **central de ajuda** e pelo **catálogo de relatórios**, não pela landing.

| # | Quem | O que a central de ajuda diz, literal | Consequência para a tese do CICLO |
|---|---|---|---|
| **I1** | **Vagaro** | Existe **`Business Cost`** por serviço, add-on, aula e produto. E ele está arquivado em **Payroll**: *"Commissions are calculated as (Price Charged for Service − Business Cost) × Commission Percentage"*. O **Sales Summary** traz as colunas `Business Cost`, `Total Sale`, `Revenue Total`, `Tax Total` e **`Profit (Revenue − Business Cost − Tax)`**; o detalhe de transação traz `Business Cost` linha a linha | **Corrige o `docs/48` §Fase 4.** Vagaro mostra um número que chama de lucro por transação. Ele **não desconta comissão** (comissão é outra linha do sumário), **não desconta taxa de cartão** e **não desconta custo fixo** | [Specify & Deduct Business Costs](https://support.vagaro.com/hc/en-us/articles/204347950-Specify-Deduct-Business-Costs-from-Payroll) · [Sales Summary](https://support.vagaro.com/hc/en-us/articles/360000348493-Run-the-Sales-Summary-Report) · acesso 06/09/2026 |
| **I2** | **Zenoti** | Existe o **"Service - Profitability report (v1)"**, com `Cost of Consumables(A)`, `Cost To Center(B)`, `Commission (C)`, `Total Cost(A+B+C)`, `Profit(Total Sale − Total Cost)` e `Profit Margin (%)`. E, no topo da página: **"This is a legacy report. Businesses that have signed up with Zenoti after April 2022 do not have access to this report."** Ainda depende do ajuste *Show profitability reports* estar ligado | **O achado mais forte da rodada.** A maior plataforma do mundo **construiu lucro por serviço com insumo e comissão — e tirou de todo cliente novo desde abril de 2022** | [help.zenoti.com · Service - Profitability report (v1)](https://help.zenoti.com/en/reports/finance/sales/service---profitability-report--v1-.html) |
| **I3** | **Boulevard** | O material próprio ensina o dono a *"comparar receita do serviço contra duração e custo de produto para **estimar** a margem bruta"* | Mesmo padrão de Trinks/Booksy: **blog ensinando a conta**, não relatório entregando o número. `[P]`, e mais fraco que I1/I2 porque é conteúdo, não documentação de produto | [joinblvd.com/blog/salon-analytics-software](https://www.joinblvd.com/blog/salon-analytics-software) |
| **I4** | **Treatwell / Mindbody** | Treatwell fica com **até 35%** da primeira reserva do marketplace. Mindbody vai de ~US$ 129 (Starter) a US$ 349 (Accelerate) e US$ 599+ (Ultimate); Vagaro escalona por calendário (~US$ 30 solo → ~US$ 90 com 7+) | Reforça A10: **todo mundo escalona**. Nenhum tem preço fixo | comparativos, acesso 06/09/2026 `[P]` |

**Entrantes AI-native de 2025-26 verificados:** ProBeauty AI (booking AI-native para beleza),
Qlient.ai e BookingBee (ocupando o espaço deixado pela saída da TrueLark do vertical de beleza),
Voksha (US$ 49-99/mês), Futuro (US$ 200/mês), AgentZap (US$ 109/mês, integra com Fresha, Vagaro e
Boulevard). **Todos são recepcionista de IA — nenhum toca em custo, margem ou lucro** `[P]`
([cloudtalk](https://www.cloudtalk.io/blog/best-ai-receptionist-for-salons-spas/),
[probeauty.ai](https://www.probeauty.ai/blog/best-salon-software-ai-features-2026), acesso
06/09/2026).

---

# 4 · Fraquezas mineradas — com fonte e data

Regra aplicada: **3 fontes independentes antes de chamar de padrão de mercado.** Queixa com menos
de 3 aparece marcada como isolada.

## 4.1 · O lucro do serviço: onde a afirmação do `docs/48` quebra, e o que sobra

| Sistema | Tem custo do serviço? | Tem número chamado lucro? | Desconta comissão? | Desconta taxa de cartão? | Desconta custo fixo? |
|---|---|---|---|---|---|
| **Vagaro** `[P]` | ✅ `Business Cost` | ✅ `Profit (Revenue − Business Cost − Tax)` | ❌ (comissão é outra linha) | ❌ | ❌ |
| **Zenoti** `[P]` | ✅ consumíveis + custo do centro | ⚠️ **legado, cortado para quem entrou depois de abr/2022** | ✅ opcional | ❌ | ❌ |
| **Boulevard** `[P]` | ⚠️ só no material educativo | ❌ "estimar" | — | — | — |
| **16 brasileiros + Barberia.io + InfinitePay + modoPAG** `[P]` | ❌ | ❌ faturamento | — | — | — |
| **CICLO** `[M]` | ✅ ficha de consumo × custo médio | ✅ `tickets.profit_cents` congelado | ✅ | ✅ (`0066`) | ✅ (`0072`) |

**A afirmação honesta, que substitui a do `docs/48` §Fase 4:**

> Não é verdade que ninguém mostra lucro por serviço. **Dois de 31 mostram** — um deles (Vagaro)
> sem comissão, e o outro (Zenoti) só para quem assinou antes de abril de 2022. O que continua
> sendo verdade, e agora com prova documental, é que **nenhum dos 31 desconta a taxa de pagamento
> nem o custo fixo**. Essas duas parcelas são exatamente as que o `docs/51` §2.3 acusou o próprio
> CICLO de esconder, e são o que as `0066` e `0072` acrescentaram.

Isso muda o argumento de venda de *"só nós temos"* para *"só nós temos completo"* — que é mais
difícil de dizer e infinitamente mais difícil de derrubar.

## 4.2 · A queixa que aparece em 4 fontes independentes: a cobrança que não se cancela

| Fonte | Data | O que diz |
|---|---|---|
| Reclame Aqui · App Barber | 25 dias antes de 06/09/2026 | *"Cobrança indevida após cancelamento da assinatura. **Pela terceira vez**, fui cobrado indevidamente no meu cartão"* — **NÃO RESOLVIDO** |
| Reclame Aqui · App Barber | ~1 mês | *"Solicitei cancelamento pois minha barbearia foi fechada, pedi para que cancelassem as parcelas futuras"* — **NÃO RESOLVIDO** |
| Reclame Aqui · Trinks | 3 dias antes de 06/09/2026 | *"Cobrança indevida e impossibilidade de cancelamento de plano … cobrança indevida por diversos meses, inclusive sem utilização"* |
| Fresha (UK/global) `[P]` | mar/2025 em diante | Assinatura por membro tornada obrigatória com pouco aviso; **repasses retidos sem telefone para ligar** |

**Quatro fontes, três empresas, dois continentes. É padrão de mercado.** E o `docs/45` §1.5 já
tinha classificado isso como *"operação, não modelo — não é fosso"*. **Essa classificação continua
certa e esta rodada não a reverte:** um concorrente conserta cobrança em um trimestre. O que ela
acrescenta é que a queixa é **estável há mais de um ano e em escala global**, o que a torna útil
como *mensagem*, ainda que não como fosso. Ver `docs/53` §5.

## 4.3 · A queixa de instabilidade que toca o dinheiro — 3 fontes, uma empresa

Reclame Aqui · Trinks, as cinco reclamações mais recentes em 06/09/2026, **três delas em 24 horas**:

- *"Instabilidade no site impede acesso a **relatórios de comissões e pagamentos**"* (há 4 horas)
- *"Instabilidade no sistema com **fechamento automático de comandas**"* (há 16 horas)
- *"Falha no **sistema de recorrência** … causando prejuízo financeiro por cobrança incorreta"* (há 3 dias)

Fora do Brasil, o mesmo formato: um plugin de agendamento de salão *"muito instável desde janeiro
de 2025, com erros novos aparecendo constantemente"*, com clientes sem ver disponibilidade
([Capterra · Salon Booking System](https://www.capterra.com/p/166320/Salon-Booking-System/reviews/),
acesso 06/09/2026) `[P]`.

**Só uma empresa no lado brasileiro** → registrado como forte, **não** como padrão de mercado
confirmado. Precisaria de duas outras empresas com a mesma queixa.

## 4.4 · A queixa que o setor escreve no blog e não resolve no produto — a comissão

Padrão idêntico ao dos 45 dias fixos do `docs/45` §1.1: **o setor sabe a resposta e entrega outra
coisa.**

| Fonte | O que o material do próprio concorrente diz |
|---|---|
| [ZapCorte, blog](https://blog.zapcorte.com.br/como-gerenciar-comissao-de-barbeiros-sem-erro-e-sem-briga-mmp37wnc) `[P]` | *"Mostrar o registro pro barbeiro, calcular junto, pagar. Transparência evita desconfiança."* |
| [Graces, blog](https://graces.com.br/blog/gestao/calculo-de-comissao/) `[P]` | *"forneça acesso a **relatórios individuais de comissão**"* |
| `docs/47` P03 (BestBarbers) | *"a maioria define um percentual **no olho** … e nunca revisa"* |

E o que o produto entrega: **Barberia.io** — *"Cada barbeiro vê só a própria **agenda**"* (agenda,
não dinheiro) ([barberia.io](https://barberia.io/), acesso 06/09/2026). **Vagaro** — o custo do
serviço existe para **reduzir a base da comissão do funcionário**, e mora dentro de Payroll.

**No CICLO, o registro que resolveria a discussão existe e o profissional não alcança** (§2.2).
Todo o setor está do mesmo lado dessa parede, inclusive nós.

---

# 5 · As dez perguntas, respondidas uma por uma

### 1. Qual é o fosso mais forte que o CICLO já tem hoje, mesmo sem usar como tal?

**A série de previsões feitas antes do resultado, por salão** (`cycle_predictions`, `0064`) — pelo
mesmo argumento do `docs/46` §Fase 5, que continua de pé e que esta rodada não conseguiu derrubar:
previsão registrada depois do fato não é previsão, e nenhum volume de histórico bruto a produz
retroativamente. Ele é **por salão**, então os 250 mil negócios do Simples Agenda e os 6 milhões de
comerciantes da InfinitePay não ajudam em nada no salão que já usa o CICLO.

O que mudou desde o `46`: o fosso **está gravando** (`[M]`, `0064` + `c87e9d6`), e continua **fora**
da `/precos` e da landing. Fosso que só o tempo enche não precisa de holofote cedo — mas precisa
existir na conta de alguém, e não existe em nenhuma (`docs/51` §5.2: as migrations `0066`-`0072`
não estão aplicadas em produção).

### 2. Existe uma "verdade aceita" do setor que pode estar simplesmente errada?

**Sim, e é o segredo desta rodada:**

> **O custo de um serviço é insumo de folha de pagamento, não número de gestão.**

A evidência não é opinião:

- **Vagaro** coleta o `Business Cost` de cada serviço e o arquiva **dentro de Payroll**, com uma
  única finalidade documentada: `(Preço − Business Cost) × %comissão`. O número existe para **pagar
  menos ao funcionário**, não para dizer ao dono o que sobrou `[P]`.
- **Zenoti** construiu o relatório que faz a outra coisa — e **desligou para todo cliente novo
  desde abril de 2022** `[P]`. Não foi falta de ideia: foi uma decisão de tirar do catálogo.
- **Trinks, Booksy, Boulevard e Zenoti** publicam blog **ensinando o dono a fazer a conta na mão**
  — a Zenoti chega a publicar a fórmula: `((custo por minuto × duração) + custo de produto) ÷
  (1 − margem alvo)` `[P]`.

O setor inteiro sabe calcular, tem o campo, e usou o campo para outra coisa. **Isso é melhor que
"ninguém pensou nisso"**, pela mesma razão que o `docs/45` deu sobre os 45 dias: "todo mundo sabe e
ninguém entrega" é uma posição muito melhor para atacar do que um vazio.

**A segunda verdade aceita, e ela é sobre nós:**

> **A agenda é o produto.**

Em 19/01/2026 isso deixou de ser verdade. A InfinitePay entrega agenda, link público, sinal por Pix
e **lembrete no dia anterior** de graça para 6 milhões de comerciantes em 100% das cidades do país
`[P]`. Agenda virou custo de aquisição de quem monetiza o fluxo de dinheiro. Um produto que cobra
R$ 49 tem que cobrar por outra coisa — e a boa notícia é que a tese do `47`/`48` já apontou para
qual.

### 3. Que dado o CICLO já coleta que nenhum concorrente coleta, e que ainda não virou produto nenhum?

Três, medidos:

1. **`stock_moves` com `source='ticket'` e `source_id`** (`0001:205`) `[M]` — o registro imutável de
   **quais produtos foram usados em qual atendimento**, com a regra 11 do `CLAUDE.md` proibindo
   apagar. Hoje ele tem exatamente um leitor: o custo. Ele é, ao mesmo tempo, o "produtos
   utilizados" que a vigilância sanitária exige no prontuário — e **isso não virou nada**. Ressalva
   honesta: falta **lote**, e a Agendiva já tem (§4 e pergunta 7).
2. **`vault_access_log`** `[M]` — quem abriu o dado de saúde de qual cliente, quando, de que IP. Há
   tela de trilha (`services/trilha-cofre.ts`), e ela é vista como conformidade, nunca como
   produto. Ninguém no setor **vende** isso.
3. **`consents.text_hash`** `[M]` — o sha256 do texto exatamente como foi exibido no momento da
   assinatura. Um consentimento cujo texto não pode ser trocado depois é mais forte que um PDF
   escaneado, e nenhuma tela do CICLO diz isso a ninguém.

### 4. Onde a concorrência tem uma fricção estrutural, e não escolhida — uma segunda, além do custo?

**Sim, e é a mais limpa da rodada: a taxa de pagamento.**

Quem hoje dá a agenda de graça é um processador (InfinitePay, modoPAG). A receita dele é o
percentual da transação. Logo, ele **nunca** pode mostrar a taxa como um custo a reduzir — o custo
dele é a receita dele. A prova está na própria central de ajuda:

- A resposta da InfinitePay para margem é **repassar a taxa ao cliente**: com o repasse, *"o cliente
  paga o custo do parcelamento e você recebe o valor integral da venda, mantendo sua margem intacta"*
  `[P]`.
- O outro artigo é ["Como obter taxas ainda mais baixas?"](https://ajuda.infinitepay.io/pt-BR/articles/9455289-como-obter-taxas-ainda-mais-baixas) —
  isto é, **transacione mais conosco** `[P]`.

Nenhuma das duas respostas é *"esta taxa comeu R$ X do seu mês; no Pix ela seria zero"*. Elas não
podem ser. É exatamente o mesmo desenho do counter-positioning que o `docs/43` §2 achou no app do
cliente, e da comissão de 20% da Fresha — só que aplicado ao número que a `0066` acabou de
introduzir no CICLO.

E os SaaS que **não** processam (Trinks, AppBarber, Simples Agenda, Barberia.io) estão livres do
conflito e mesmo assim não fazem — porque não têm modelo de custo nenhum (§4.1). Os dois grupos
estão travados por motivos diferentes, e o CICLO não está em nenhum dos dois.

### 5. Que comportamento tratado como "não dá para evitar" poderia cair para 10% do esforço?

**A cadeira parada.** O setor trata metade da agenda vazia como natureza do negócio. O dado é do
próprio líder enterprise:

> Salões medianos operam a **47–49% de utilização**; os melhores, a **76–79%**. A diferença de ~30
> pontos é **a maior de qualquer métrica do conjunto**, que vem de **mais de 30 mil negócios**. O
> intervalo entre 50% e 75% vale cerca de **US$ 850 por semana**, ou **mais de US$ 44 mil por ano
> por profissional**.
> — [Zenoti · 2026 Beauty and Wellness Benchmark Report](https://www.zenoti.com/blog/2026-beauty-wellness-benchmark-report), acesso 06/09/2026 `[P]`

Metade da cadeira está parada e o setor inteiro publica "cadeira cheia" como promessa de marketing
(Gendo: *"Cadeira cheia de segunda a sábado"*) sem tocar no preço daquele horário. É o candidato
**V2** da §6.

### 6. Existe efeito de rede real, compatível com o veto de vitrine?

**Não, e a resposta honesta é essa.** Foram testadas as três formas que o veto permite:

- **Entre profissionais do mesmo salão** — é o candidato V1. É valor, não rede: o segundo
  profissional não melhora a experiência do primeiro.
- **Entre unidades do mesmo dono** — multiunidade está fora do MVP (`docs/00` §3), e mesmo com ele
  o ganho é agregação de relatório, não rede.
- **Entre cliente e salão** — já existe (a página do salão), e crescer dali para qualquer forma de
  descoberta cruzada é o veto permanente.

O `docs/46` §Fase 3 já tinha chegado a isto por outro caminho e classificado o poder como **custo de
troca**, não rede. Esta rodada confirma, e acrescenta o motivo estrutural: **um mecanismo cuja
força cresce com o tamanho da base é o campo onde a InfinitePay vence com 6 milhões antes de
acordar.**

### 7. Que fraqueza recorrente ninguém resolveu, e por quê — é difícil, ou ninguém tentou?

Três fraquezas, três diagnósticos diferentes, e a distinção é o que importa:

| Fraqueza | Alguém resolveu? | Por que não |
|---|---|---|
| Cobrança que não se cancela (§4.2) | Não, em 3 empresas e 2 continentes | **Ninguém tentou.** É operação e receita retida; conserta-se em um trimestre, e nenhum incumbente tem incentivo enquanto o churn doer mais que a reclamação. **Não é difícil — é indesejado** |
| Lucro por serviço completo (§4.1) | Parcialmente, e **um deles desfez** | **Estruturalmente incômodo.** O campo de custo já tem dono (a folha), e completar a conta exige pedir ao dono o que a pesquisa diz que ele não sabe (`47` P02: 73%). Zenoti tentou e recuou |
| Extrato que o profissional confere (§4.4) | **Ninguém** | **Ninguém tentou**, e o motivo é que o comprador é o dono. Um produto vendido ao dono não constrói a tela que dá poder de conferência a quem ele paga. Isso é um viés de comprador, não uma dificuldade técnica |

A terceira linha é a mais interessante e a mais perigosa: é território vazio **por desenho de quem
paga a conta**, e por isso mesmo pode estar vazio com razão.

### 8. Se o CICLO cobrasse zero por algo que todo mundo cobra caro, mudaria a decisão de compra?

**A pergunta ficou obsoleta em 19/01/2026, e essa é a resposta.** O CICLO não pode ser "o grátis" —
a InfinitePay já é, para 6 milhões de comerciantes, com lembrete funcionando. Zerar preço contra um
processador que subsidia com a taxa é escolher o campo onde se perde por definição, exatamente
como o benchmark do `docs/46` candidato A.

O que **continua** valendo, e é aritmético e não retórico: **o preço do CICLO não sobe quando a
equipe cresce** (`docs/43` item C, já na `/precos`). Contra Barberia.io (R$ 49→499 por número de
profissionais), Mindbody (US$ 129→599+), Vagaro (por calendário), Fresha (por membro, obrigatório
desde mar/2025) e Treatwell (até 35% da primeira reserva), essa é a única linha de preço que não é
copiável numa tarde — porque copiá-la significa desmontar o próprio modelo de receita deles.

### 9. Qual seria a "aposta única" para três anos?

**Continuar a tese de lucro, com o eixo da taxa como ponta de lança** — candidato V4 da §6. Ver
§7 para a defesa disso contra a tentação de trocar de tese.

### 10. Dos sobreviventes, qual tem menor dependência de coisa que o CICLO não controla?

**V4.** Ele não depende de F0 (nenhuma mensagem sai), não depende de credencial de terceiro (o dono
digita um percentual que já digitou na `0066`), não depende de volume (funciona com um tenant), não
depende de decisão de preço e não cruza fronteira de tenant. A única dependência é o `supabase db
push` das `0066`-`0072`, que já é o item 1 da lista do `docs/51` §5.2 e já era necessário de
qualquer forma.

V2 (cadeira vazia) depende de histórico de ocupação e flerta com o veto de precificação — é o
segundo em dependência, não o primeiro.

---

# 6 · Os candidatos, com os cinco filtros

Dez avaliados. **Dois sobrevivem.** Os oito reprovados estão aqui com o motivo, para a próxima
rodada não refazer o caminho morto.

## V1 · O extrato que o profissional confere sozinho — **REPROVADO**

Dar ao profissional comissionado acesso ao próprio extrato congelado (§2.2, §4.4).

| Filtro | Veredito |
|---|---|
| 0→1 / 1→n | **`1→n-10x`** no Brasil (ninguém expõe ao profissional `[P]`), mas Vagaro tem portal de folha nos EUA |
| Regra do 10x | **Falha.** Não consigo escrever o número. "Menos briga" não é medida, e o `CLAUDE.md` diz que sem número é opinião |
| Fosso | Nenhum dos quatro |
| Cópia em 6 meses | **Sim, em semanas** — é uma rota e uma permissão |
| Veto | Nenhum |

**Reprovado como vantagem, e vira ticket de backlog.** O motivo de existir mesmo assim: o `docs/50`
L-10.3 afirma que já é o comportamento, e não é (§2.2). Corrigir uma afirmação falsa de documento é
trabalho, não vantagem.

## V2 · A cadeira vazia com piso de lucro — **SOBREVIVE**

O horário ocioso ganha uma sugestão de preço **que o dono aprova**, e o piso da sugestão é o custo
real daquele serviço (material + taxa + comissão + hora de cadeira) — nunca abaixo do que dá
prejuízo. É o C8 do `docs/48`, adiado lá, agora com número de mercado.

| Filtro | Veredito |
|---|---|
| 0→1 / 1→n | **`1→n-10x`.** Yield management é padrão em hotelaria e aviação há 40 anos (`docs/47` §1.3); **em beleza não existe em nenhum dos 31** `[P]`. O 10x não está em ter a ideia, está em ter o piso |
| Regra do 10x, **com número** | A diferença entre 49% e 76% de utilização vale **~US$ 850/semana ≈ US$ 44 mil/ano por profissional** `[P]`, e é a maior lacuna de todo o conjunto de 30 mil negócios da Zenoti. Contra um plano de R$ 99/mês (R$ 1.188/ano), a ordem de grandeza é **~180×** se capturar um quarto da lacuna `[E]` |
| Fosso | **Tecnologia proprietária (eixo 1), condicional.** Sugerir desconto é trivial; sugerir desconto **que ainda dá lucro** exige o modelo de custo completo, que §4.1 mostra que ninguém tem. O fosso não é o yield — é o piso |
| Cópia em 6 meses | **Do yield: sim.** Um time de dez pessoas com 10× dinheiro entrega "desconte a terça vazia" num trimestre. **Do piso: não**, porque exige as quatro parcelas de custo, e a Zenoti já mostrou que essa é a parte que se abandona |
| Veto | `[V]` **se mal desenhado.** Preço automático é vedado. Só sobrevive como sugestão com confirmação humana, e é a mesma trava do `docs/48` |

**Sobrevive, com a ressalva escrita:** é o candidato mais caro (4-5 tickets, `docs/48`) e o único
com risco de veto. Ver `docs/53` §3.

## V3 · O prontuário que a fiscalização pede — **REPROVADO**

Compor anamnese + consentimento + produtos utilizados + validade num prontuário que atende a
exigência sanitária (prontuário individual com identificação, anamnese, procedimentos, **produtos
utilizados** e intercorrências, guarda mínima de 5 anos, TCLE assinado, fotos antes/depois sob LGPD).

| Filtro | Veredito |
|---|---|
| 0→1 / 1→n | **`1→n-paridade`.** A **Agendiva** — que já está nos 16 pesquisados — entrega *"anamnese por procedimento com assinatura digital em **todos os planos**"* e *"estoque com **lote/validade**"* `[P]`. A **Belle** é recomendada *"para clínicas com viés médico e prontuário robusto"* `[P]`. E existe uma vertical inteira de sistemas de clínica de estética no Brasil (Esthetis, FAAL360, Iter Clinic, Estetia, Lumave) `[P]` |
| Regra do 10x | Falha. O CICLO está **atrás**: não tem lote em `stock_moves` `[M]`, e a guarda de 5 anos conflita com a eliminação LGPD sem ninguém ter decidido a precedência |
| Fosso | Nenhum |
| Cópia em 6 meses | Irrelevante — já existe |
| Veto | Nenhum |

**Reprovado, e o registro vale ouro para a próxima rodada:** este era o candidato que parecia 0→1
por dentro (o CICLO tem cofre cifrado, trilha de acesso e hash do consentimento, §2.1 A7) e é
paridade por fora. **É o exemplo mais limpo desta rodada de "medição ingênua dá falso positivo":
ler o próprio schema e concluir que ninguém mais tem.**

## V4 · O conselheiro neutro da taxa — **SOBREVIVE. É a aposta.**

O CICLO passa a dizer, com o número do próprio salão, **quanto a forma de pagamento custou no mês**
e quanto o mesmo mês teria custado nas outras formas que aquele salão já usa — porque ele é o único
que tem o custo de serviço completo **e** não ganha um centavo do fluxo.

| Filtro | Veredito |
|---|---|
| 0→1 / 1→n | **`0→1`, por counter-positioning duplo.** O processador que dá a agenda de graça **não pode** fazer, porque a taxa é a receita dele — e a prova é a própria central de ajuda dele, que responde *"repasse a taxa ao cliente… mantendo sua margem intacta"* e *"como obter taxas ainda mais baixas"* = transacione mais `[P]`. O SaaS que não processa **não tem como** fazer, porque não tem modelo de custo (§4.1: 0 de 31 descontam a taxa) |
| Regra do 10x, **com número** | Uma barbearia com 500 atendimentos/mês a R$ 45, 60% no crédito a 2,69% `[P]`, paga **~R$ 363/mês** de taxa `[E]`. Contra o plano de R$ 49, o número que o CICLO mostra vale **7,4× a mensalidade** — e é a única linha do "Sobrou" que o dono pode mudar na semana seguinte, sem mexer no preço nem na comissão. Nenhuma outra parcela tem essa propriedade: material exige compra, comissão exige conversa, aluguel é contrato |
| Fosso | **Counter-positioning** (Helmer #2 / Christensen), o único dos 7 poderes que **prende o líder**. Mais **recurso cativo** como matéria-prima: a série mensal congelada (`0071`) transforma isso numa curva que só o tempo dá |
| Cópia em 6 meses | **Um concorrente com 10× dinheiro e dez pessoas NÃO copia** — não porque seja difícil, mas porque para copiar ele precisa (a) não ganhar da transação e (b) construir as quatro parcelas de custo. A InfinitePay reprova em (a) por definição; a Zenoti já provou que desiste de (b). **É o único candidato desta rodada que passa neste teste** |
| Veto | **Nenhum, e isso é raro.** Não sugere preço (mostra custo consumado, não futuro). Não pede credencial nova — o percentual já é digitado desde a `0066`. Não depende de F0. Não cruza tenant. Não agrega entre salões |

**Sobrevive. É o candidato com o menor número de dependências externas de toda a rodada
(pergunta 10) e o único que passa no teste dos seis meses.**

**A honestidade que este candidato exige, e ela está no plano:** V4 **não é um eixo novo**. Ele é o
eixo de dinheiro do `47`/`48`, olhado por uma lente diferente — de *medição* para *conflito de
interesse*. A missão pedia eixos novos e este não é um. Ele entra porque **o filtro da Parte 2 é
mais importante que a novidade**: dos dez candidatos, é o único que passa nos cinco. Forçar um eixo
novo mais fraco para parecer produtivo seria o erro que o `docs/43` cometeu e o `docs/45` corrigiu.

## V5 · NFS-e de padrão nacional — **REPROVADO (higiene, não vantagem)**

Vale a partir de 01/01/2026, com layout único nacional `[P]`. Barberia.io já entrega.
**`1→n-paridade`**, sem fosso, copiável por definição (é norma pública). **Mas é motivo real de
troca de sistema**, e o CICLO tirou do MVP. Vai para o backlog como risco competitivo, não como
vantagem — `docs/53` §5.

## V6 · Benchmark anônimo entre salões — **REPROVADO, e a rejeição ficou mais forte**

Já rejeitado no `docs/46` candidato A. **A rejeição não só continua valendo como endureceu:** a
Zenoti publica benchmark de **30 mil negócios** e o Simples Agenda declara **250 mil**; o CICLO tem
**zero pagantes** `[M]`. Mecanismo cuja força é proporcional ao tamanho da base é o campo onde se
perde por definição. `1→n-paridade` invertida, risco LGPD alto, e fere o espírito do veto.

## V7 · IA no WhatsApp que agenda — **REPROVADO**

**`1→n-paridade`, e tarde.** Seis entrantes brasileiros de 2025-26 já entregam (Barberia.io,
BarberAI, EiBarber, BarberFlow, BarberConec, HardLogic), o Simples Agenda tem GAIA + Gendo Zap, e o
internacional tem seis recepcionistas de IA vendidos por assinatura `[P]`. Além disso **depende de
F0**, que é veto da Parte 5. Reprovado duas vezes.

## V8 · Margem viva do clube de assinatura — **JÁ CONSTRUÍDO, não é candidato**

`core/loyalty/margem-do-clube.ts` existe `[M]` (`docs/51` T8). Continua sendo verdade que nenhum
concorrente alerta quando o assinante virou prejuízo `[P]`. **Não é candidato novo — é capacidade
sem holofote**, e entra na §2.1 e no plano como comunicação, não como construção.

## V9 · App próprio do cliente — **REPROVADO por veto**

Barberia.io e BestBarbers vendem app com a marca da barbearia `[P]`. O `docs/43` §5.2 já
transformou isso em veto permanente com guarda. **Descartado sem amolecer a trava.**

## V10 · Conciliação: o que a maquininha depositou × o que a comanda diz — **REPROVADO por dependência**

Seria o fecho perfeito do V4: em vez de perguntar a taxa, lê-la. **Exige credencial de terceiro
nova**, o que a Parte 5 só permite se for o ponto central do plano — e, se fosse, entregaria o
fosso ao processador: quem tem a credencial tem o número, e ele já tem os dois. **Reprovado, e o
motivo é o mais estratégico da lista: a força do V4 vem justamente de o CICLO NÃO estar ligado ao
fluxo de dinheiro.**

---

# 7 · Contagem e veredito

| | |
|---|---|
| Candidatos avaliados | **10** |
| Sobreviventes aos cinco filtros | **2** — V4 (aposta) e V2 (segundo) |
| Reprovados por `1→n-paridade` | 4 — V3, V5, V6, V7 |
| Reprovados por falhar na regra do 10x | 1 — V1 |
| Reprovados por veto ou dependência | 2 — V9, V10 |
| Já construídos, não candidatos | 1 — V8 |

**O veredito, dito primeiro e claramente, como a Parte 7 da missão exige:**

> **Não achei um eixo de vantagem estrutural genuinamente novo nesta rodada. A tese de lucro
> granular continua sendo a melhor aposta disponível.**

O que esta rodada entrega não é um eixo novo — são **três correções que mudam como essa aposta tem
que ser jogada**, e cada uma delas invalida algo que estava escrito:

1. **A afirmação central do `docs/48` §Fase 4 está errada.** Vagaro mostra
   `Profit (Revenue − Business Cost − Tax)` por transação e a Zenoti construiu o relatório completo
   com comissão. A frase honesta é mais estreita e muito mais forte: **nenhum dos 31 desconta a
   taxa de pagamento nem o custo fixo**, e **a líder mundial cortou a versão dela para todo cliente
   novo desde abril de 2022**.
2. **O campo de batalha mudou em 19/01/2026.** A agenda passou a ser grátis, com lembrete, para 6
   milhões de comerciantes em 100% das cidades. Um produto que cobra por agenda perdeu; um produto
   que cobra pelo que sobra ainda não.
3. **A mudança 2 é o que cria a única vantagem `0→1` da rodada.** O processador que dá a agenda de
   graça não pode dizer que a taxa dele é um custo. Quanto mais fintech entra na agenda, **mais
   valioso fica** o único sistema do mercado que não ganha um centavo do fluxo e sabe o que sobra.

Se a rodada anterior achou o ouro, esta descobriu por que ele está no chão e ninguém pegou.
