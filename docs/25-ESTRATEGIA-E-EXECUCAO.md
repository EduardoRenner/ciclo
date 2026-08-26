# 25 · Estratégia e execução — o que a pesquisa de mercado muda no CICLO

**2026-08-26.** Este documento nasce de duas coisas colocadas lado a lado: uma pesquisa de
mercado (Trinks, Booksy, AppBarber e os pequenos) e uma leitura do código que já existe neste
repositório. As duas juntas mudam a ordem das prioridades — não o produto.

Convenção dos marcadores, a mesma do `18` e do `20`: **[M]** medido (conferido no código ou no
banco), **[E]** estimado, **[P]** vem da pesquisa de mercado.

---

## 0. Três correções antes de qualquer plano

A conversa que originou este documento propôs três coisas. As três estavam calibradas para um
produto que não é este. Registrar isso importa mais do que o plano em si, porque é o mesmo erro
que vai se repetir na próxima sessão que não ler o código antes de opinar.

**"Construir um Radar de Retorno."** Já existe, e é melhor do que a proposta. Há
`client_cycles` com estado (`late`, `at_risk`, `lost`), `v_client_segments`, `/admin/recuperar`
alimentado por `listarParaRecuperar()`, e — o que nenhum concorrente da pesquisa demonstra ter —
`receitaAtribuidaAoCiclo()`, que responde **quanto dinheiro o Motor trouxe de volta este mês**
**[M]**. Isso não é uma feature a construir; é um ativo a expor.

**"Abrir para além da beleza."** A virada multi-profissão já aconteceu — há catálogo de
profissões, onboarding com busca de profissão (TICKET-072) e precificação de faxina/eletricista
**[M]**. O que está desatualizado é o `CLAUDE.md`, que ainda abre com *"profissionais da beleza
(barbearia, unhas, cílios, sobrancelha, depilação, estética)"*. Isso é dívida de documento, e
faz toda sessão nova começar com o posicionamento errado na cabeça.

**"Definir três planos."** Já definidos **[M]**: Grátis R$ 0 · Essencial R$ 49 · Equipe R$ 99 ·
Avançado R$ 179. E a entrada paga é **mais barata que todos os concorrentes pesquisados** —
Trinks R$ 76 (anual) / R$ 110 (mensal), AppBarber R$ 79,90, Booksy R$ 99,99 **[P]**. R$ 49 não
precisa de ajuste; precisa de alguém pagando.

---

## 1. O diagnóstico, em uma frase

> **O Motor de Ciclo calcula e não fala.**

Esse é o estado real do produto no ar. Não é opinião — está no agendador.

| Rota de cron | Existe | Roda em produção | O que faz |
|---|---|---|---|
| `recompute-cycles` | ✅ | ✅ `schedule` | Recalcula quando cada cliente volta |
| `segments` | ✅ | ✅ `schedule` | Recalcula segmentos da carteira |
| `stock-alerts` | ✅ | ⚠️ só `workflow_dispatch` | Alerta de estoque |
| `jobs` | ✅ | ⚠️ só `workflow_dispatch` | Processa a fila |
| **`reminders`** | ✅ | ❌ **não roda** | **Confirmação e lembrete de agendamento** |
| **`campaigns`** | ✅ | ❌ **não roda** | **Campanha de recuperação** |

Fonte: `.github/workflows/cron.yml` **[M]**. O `vercel.json` com `{"crons": []}` está vazio de
propósito e para sempre (`18` §L.5) — o agendador de verdade é o GitHub Actions, cinco disparos
diários cobrindo hora local 3 e 4 nos quatro fusos do Brasil.

As duas rotas desligadas são exatamente as duas que **falam com o cliente final**. E estão
desligadas por uma razão boa, escrita no rodapé do próprio `cron.yml`: o tenant `dom-rocha` tem
**46 clientes cadastrados em produção** **[M]**, e ligar um `schedule` que dispara mensagem é
começar a falar com 46 pessoas reais sem saber se os telefones são de gente ou de semente.

O efeito prático: **hoje o CICLO sabe quem tem que voltar e não avisa ninguém.** Todo o
posicionamento "faz seu cliente voltar" depende do dono lembrar de abrir a aba Recuperar e
apertar enviar. Isso é uma agenda com relatório bom — não é o produto que o `docs/00` descreve,
nem o que a `/precos` promete.

**Nada mais neste plano importa antes disso.**

---

## 2. Os outros dois achados

### 2.1 · A prova de valor está enterrada

`receitaAtribuidaAoCiclo()` é o ativo comercial mais forte do produto. Ele permite dizer:

> *"O Motor de Ciclo trouxe R$ 1.240 este mês (8 agendamentos)."*

Isso é resposta a ROI. Trinks e Booksy vendem **funcionalidade** ("agenda, financeiro,
fidelização") **[P]**; isso vende **resultado**. É a diferença entre um custo e um investimento
na cabeça de quem paga R$ 49.

Onde ele aparece hoje: dentro de `/admin/recuperar`, e **só se `count > 0`** **[M]**. Ou seja,
na quinta aba, atrás de um clique, e invisível justamente para quem ainda não usou o recurso.

Onde deveria aparecer: na **home**, que é a tela mais aberta do app.

### 2.2 · A home mostra fracasso no dia 1

Do print do painel real (tenant `Lang barber`, 26/08): o número herói da tela é
**"FATURADO HOJE · R$ 0,00"**, seguido de um card vazio que ocupa meia tela dizendo *"Nada mais
para hoje — a agenda de hoje está livre a partir de agora."*

A ordem de render em `hoje.tsx` é **[M]**: faturamento → próximo cliente (ou vazio) → alertas →
**Central de Ações** → estoque → resto do dia. A Central de Ações — que é boa, e que já traz
*"N clientes estão sumindo"* com link para `/admin/recuperar` — está **abaixo da dobra, depois
do card vazio**.

Isso inverte a prioridade no pior momento possível. Para o barbeiro em teste, dia 1, agenda
ainda vazia, a primeira coisa que o produto comunica é R$ 0,00 e "não tem nada aqui". O motivo
para ele continuar está a um scroll de distância.

A regra é simples: **em dia sem movimento, a tela não deve reportar o vazio — deve mostrar o
trabalho que o Motor achou.**

---

## 3. O plano

Seis fases. F0 bloqueia todas as outras. F3 é a única que não é código.

### F0 · Ligar o motor `bloqueia tudo`

O `cron.yml` já documenta o portão de três passos. Ele vira ticket.

| # | Ticket | Critério de aceite | Status |
|---|---|---|---|
| 1 | Auditar a base do `dom-rocha` | Saber, por consulta, quantos dos 46 clientes têm telefone/e-mail de gente real vs. semente. Registrar o número em `DECISOES.md`. | ✅ Resolvido sem consulta — ver `DECISOES.md` 2026-08-26: `dom-rocha` já era confirmado 100% fictício (`docs/20-COPY-PLANO.md` §A.4.1), e o item A abaixo torna a pergunta irrelevante para segurança de envio de qualquer forma. |
| 2 | Confirmar credenciais WhatsApp em produção | `WHATSAPP_PHONE_NUMBER_ID`, `ACCESS_TOKEN`, `APP_SECRET` existem e respondem. Sem elas o provider cai no fallback de e-mail — que **também é envio real**. | Pendente — decisão/ação do dono do produto. |
| 3 | Disparo manual único de `reminders` | `workflow_dispatch`, depois inspecionar a tabela `messages`. Nenhuma mensagem para número não confirmado no passo 1. | Preparado, não executado — `reminders`/`campaigns` já estão nas opções de `workflow_dispatch` (`cron.yml`); falta o passo 2 para o disparo ter efeito real. |
| 4 | Agendar de verdade | `reminders` a cada 15 min, `campaigns` 1×/dia — as duas linhas já estão escritas e comentadas no rodapé do `cron.yml`. | Pendente — decisão do dono do produto, deliberadamente fora desta execução. |
| 5 | Freio antes do acelerador | Teto de envio por tenant/dia e interruptor por tenant, **antes** do passo 4. Um bug de laço com o motor ligado não custa erro na tela; custa a reputação do número de WhatsApp. | ✅ Teto diário implementado (`mensageria.ts`, `dentroDoTetoDiario`, via `limitador()`) — falta o "interruptor por tenant" manual (não construído; não há sinal de que seja necessário além do teto ainda). |
| 6 | Alarme de silêncio | `cron_heartbeats` (migration 0014) já existe **[M]**. Falta alguém ser avisado quando um job para. Job que falha em silêncio é a armadilha nº 1 deste repositório (`21`). | ✅ Código pronto (`campaigns` agora grava heartbeat, `/api/health` checa os dois jobs com limiares próprios) — o step de CI que FALHA o Action com base nisso fica para o mesmo momento do passo 4 (ativá-lo antes faria o Action falhar sempre, heartbeat nunca rodado = sempre atrasado). |

**Por que 5 e 6 não são zelo excessivo:** o `20` §A.4 já registrou que a home e a `/precos`
prometem lembrete e confirmação enquanto as rotas nunca rodaram. No dia em que rodarem, o erro
troca de lado — de "prometeu e não entrega" para "entrega demais, para a pessoa errada". O
segundo é mais caro.

**Sobre indicação/desconto (pedido numa sessão seguinte, "quem indica ganha desconto/grátis"):**
já está inteiramente desenhado, não faz parte deste F0. `docs/18-MONETIZACAO-PLANO.md` Fase H
decidiu o mecanismo inteiro (crédito em `billing_credits`, recompensa só no 1º pagamento do
indicado, antifraude, teto de 12 meses/ano) e o mesmo documento trava a fase atrás de **≥20
pagantes** — hoje zero. Ver `DECISOES.md` 2026-08-26. Durante o piloto manual (F3 abaixo), a
recompensa pode ser oferecida **à mão**, do mesmo jeito que a cobrança do piloto já é manual —
sem código novo até o sinal de ≥20 pagantes aparecer.

### F1 · Tornar o diferencial visível

Nenhum destes constrói regra de negócio nova. São quatro mudanças de superfície em cima de
dados que já existem.

| # | Ticket | Onde | Status |
|---|---|---|---|
| 7 | Herói condicional na home: sem agendamento hoje, o card de faturamento **não** é R$ 0,00 — é o que o Motor encontrou | `hoje.tsx` | ✅ `deveMostrarHeroiDoMotor()`, testado |
| 8 | Subir `receitaAtribuidaAoCiclo` para a home | `hoje/page.tsx` | ✅ Mesmo cálculo de `/admin/recuperar` (mês corrente) |
| 9 | Central de Ações **acima** do card de agenda quando não há próximo cliente | `hoje.tsx` (ordem de render) | ✅ |
| ~~10~~ | ~~Ícone de "Recuperar" na nav~~ | ~~`components/shell/`~~ | ❌ **Descartado** — o "C" (`icone: 'Anel'` em `tabs.ts`) não é acidente: é a marca do CICLO, escolhida deliberadamente para substituir um `Sparkles` que os designers descreveram como "o emblema universal de feito por IA" (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §F1/§8). Eu tinha lido isso como inconsistência visual só olhando o print, sem ler o código — era decisão, não descuido. |

Não verificado em navegador ao vivo (typecheck/lint/testes/build passam): `.env.local` deste
ambiente aponta para o Supabase de produção, sem credencial de login de tenant real disponível
nesta sessão para abrir a tela de verdade.

### F2 · Ativação — o buraco entre cadastro e valor

O `10-PROXIMOS-PASSOS` §3 já registra que **não há instrumentação do funil de onboarding**,
por falta de tráfego real **[M]**. Com o piloto da F3 isso deixa de ser justificativa.

| # | Ticket | Por quê |
|---|---|---|
| 11 | Instrumentar o funil: cadastro → primeira profissão → primeiro cliente → primeiro agendamento → primeira mensagem enviada | Sem isso a F3 gera anedota, não dado |
| 12 | Colocar `/admin/clientes/importar` no caminho crítico do onboarding | É o *aha moment*. Já existe e está escondido. |
| 13 | "Primeira previsão": ao terminar a importação, mostrar imediatamente o que o Motor calculou em cima da base dele | Transforma importar-contatos (chato) em ver-o-futuro (o produto) |

O 13 é o ticket com maior retorno da lista inteira. O momento em que o barbeiro importa 200
contatos e a tela responde *"37 destes já passaram do tempo de voltar"* é o momento em que o
CICLO deixa de ser uma agenda e vira outra coisa. Hoje esse momento não acontece em lugar nenhum.

### F3 · Piloto de 10 — a única fase sem código

Não é marketing; é a fase que decide se o resto vale. Três verticais, para descobrir qual morde:

- **Barbearia** — recorrência alta, ciclo curto e previsível, indicação forte entre pares
- **Unhas / beleza independente** — profissional sozinha, WhatsApp é o sistema atual, ticket acessível
- **Serviços residenciais** (limpeza, elétrica, ar-condicionado) — onde Trinks e Booksy **não estão** **[P]**

**A métrica do piloto não é número de cadastros.** É:

> Quantos reais o Motor de Ciclo trouxe, por tenant, no mês.

O produto já sabe calcular isso. É a única métrica que responde ao mesmo tempo "o produto
funciona?" e "vale R$ 49?".

Meta honesta: **um** tenant onde a receita atribuída ao Motor supere com folga a mensalidade.
Um caso desses é argumento de venda; dez cadastros que não usam não são.

### F4 · Cobrança

Em curso, e já bem avançado — os commits recentes (`feat/fix/test(planos)`) fecharam travas de
servidor que faltavam. O que resta é decisão de negócio registrada no `18`, não código:
Asaas bloqueado, Pix Automático liberado, MEI vedado para software.

Uma observação de sequência: **cobrar antes da F0 é vender o que não está ligado.** O Essencial
a R$ 49 tem `envio_em_lote` como capacidade paga **[M]** — e envio em lote depende de
`campaigns`, que não roda. Ligar o motor não é só produto; é pré-requisito de honestidade
comercial.

### F5 · Aquisição

Um achado que já está construído e não está sendo contado como canal: **`remover_selo` é
capacidade paga** **[M]**. Ou seja, todo tenant do plano Grátis exibe o selo do CICLO na página
pública de agendamento — e cada profissional manda esse link para a base inteira dele.

Isso é um laço de distribuição embutido no produto, do tipo que a pesquisa mostra que nem
Trinks nem AppBarber têm **[P]**. Vale medir antes de gastar em anúncio: quantas visitas
chegam à `/precos` vindas de um `/[slug]/agendar`.

O resto da aquisição orgânica (conteúdo por profissão, SEO de "sistema para X", indicação) só
faz sentido depois que a F3 disser **qual** profissão.

---

## 4. O posicionamento

O produto já faz isso. Falta a `/precos` e a home dizerem.

> **CICLO — a gestão do seu serviço, do primeiro agendamento ao próximo.**

Quatro verbos, na ordem em que o dinheiro acontece: **Agende · Atenda · Receba · Faça voltar.**

O peso da diferenciação está inteiro no quarto. Os três primeiros todo concorrente tem.

E a frase que não deve aparecer em lugar nenhum: *"CRM para profissionais"*. Ninguém acorda
querendo comprar um CRM.

---

## 5. O que não fazer

Cada item aqui é uma tentação real, e cada um custaria meses.

- **Não competir com Trinks em beleza completa.** Estoque, comissão de 15 profissionais, nota
  fiscal, clube de assinatura — eles têm 13 anos e 44 mil negócios **[P]**. Esse terreno está
  perdido e não é onde está o dinheiro do CICLO.
- **Não construir marketplace.** O Booksy tem 44 milhões de consumidores **[P]**. Marketplace
  sem os dois lados é um diretório vazio.
- **Não adicionar funcionalidade nova antes da F3.** O produto tem 20+ rotas de admin **[M]**.
  O problema não é falta de recurso; é que o principal está desligado e escondido.
- **Não fazer app nativo.** É PWA e resolve. App entra quando usuário pedir, não antes.
- **Não subir para Vercel Pro por causa de cron.** US$ 20/mês = 2,4 assinantes Essencial
  trabalhando só para pagar o agendador **[M]**. O GitHub Actions já resolve a R$ 0.

---

## 6. A ordem, resumida

```
F0  ligar o motor        ← nada mais conta antes disto
F1  mostrar o motor      ← 4 mudanças de superfície, dados já existem
F2  ativação             ← o ticket 13 é o de maior retorno da lista
F3  piloto de 10         ← decide a vertical; sem código
F4  cobrança             ← depois da F0, por honestidade comercial
F5  aquisição            ← depois da F3, quando souber qual profissão
```

**Higiene, e não é detalhe:** atualizar a primeira frase do `CLAUDE.md` para refletir a virada
multi-profissão. Enquanto ele disser "profissionais da beleza", toda sessão nova começa
projetando para o mercado onde a concorrência é mais dura e o CICLO é mais fraco.
