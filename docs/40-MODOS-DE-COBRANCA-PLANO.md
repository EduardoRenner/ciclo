# 40 · Serviço sob orçamento

**Data:** 2026-09-04 · **Estado:** fase 1 implementada, fase 2 desenhada e não implementada

## A pergunta que originou

O CICLO é desenhado para quem tem tabela de preço (barbearia: "Corte R$ 45, 40min"). Mas o
`docs/09-PLATAFORMA.md` inclui eletricista, faxineira e personal no alvo, e boa parte dessa gente
não tem preço de tabela: visita, avalia e orça. A pergunta era se o produto precisa de **dois
modos** (um por conta, para quem tem preço, e outro para quem só orça).

## A resposta: não. O eixo é o SERVIÇO, não a conta.

E a evidência é do concorrente que tem exatamente as duas naturezas. O Jobber, que atende tanto
serviço de preço fechado quanto obra orçada, resolve a bifurcação **por serviço**:

> *"You might not want all your services to be available for online booking. For example, you
> might prefer to use a quote request form when you need to collect information and specifications
> from your customer before providing an estimate."* — Jobber, documentação de Online Booking

E descreve os dois caminhos convivendo na mesma conta:

> *"Some allow clients to schedule services immediately, while others use booking to schedule
> consultations or on-site assessments before creating a quote."*

**Por que isto derruba o modo por conta.** O negócio híbrido é o caso comum, não a exceção: a
manicure tem tabela e orça alongamento; o eletricista tem "visita técnica R$ 120" fechada e orça o
resto. Um modo binário na conta obrigaria essa pessoa a escolher um lado e mentir no outro — seria
**pior que o estado atual**, que pelo menos não força escolha nenhuma.

## O defeito real, medido

Três medições, todas confirmadas por varredura em 2026-09-04:

1. **`tenants.cobranca` tem 1 escritor e 1 leitor, e o leitor não desenha tela.** É escrito no
   onboarding a partir da profissão (`server/services/onboarding.ts`) e lido só em
   `server/services/planos.ts`, para recomendar plano. O produto pergunta como a pessoa cobra e
   ignora a resposta em toda superfície que ela enxerga. Mesma classe de `fee_cents`,
   `media.consent_id`, `clients.referred_by`, `vault_access_log.actor_label` e
   `appointments.deposit_cents`: coluna escrita que ninguém lê.

2. **`services.pricing_model` não tem como dizer "eu orço".** A constraint da `0029` aceita
   `fixed`, `hourly`, `visit_hourly` e `daily`, e **os quatro exigem um número**. Quem não tem
   preço só consegue cadastrar mentindo.

3. **Metade da saída já existia por acidente.** `core/pricing/formatar.ts` devolve `"Consultar"`
   quando `fixed` tem `priceCents` igual a zero. Ou seja: o produto já sabia dizer "não tem preço
   fechado", mas como efeito colateral de um campo zerado, sem ninguém ter decidido isso e sem
   nada mais no produto reagir.

**Conclusão:** não falta um modo. Falta o quinto valor de `pricing_model`, e ele resolve o híbrido
de graça, porque a granularidade já é a certa.

## Por que o botão muda, e não só o rótulo

Pedir orçamento e marcar horário não são o mesmo compromisso, e o dado de mercado é consistente:
pedido de orçamento converte na faixa de **5-10%** do visitante inicial, contra **2-3%** de quem
precisa marcar de cara — e, uma vez que o orçamento chega e recebe decisão, a mediana de conversão
para trabalho fechado é **73,9%**. Forçar "agendar" em serviço sem preço troca o degrau barato
pelo caro logo na entrada.

## Fase 1 (implementada)

| Superfície | O que muda |
|---|---|
| `services.pricing_model` | ganha `'quote'`. Migration nova, sem tocar nas quatro existentes. |
| `core/pricing/formatar.ts` | `'quote'` devolve **"Sob orçamento"**. O `"Consultar"` acidental do preço zerado continua, porque é rede para dado velho, mas deixa de ser o único caminho. |
| Catálogo do painel | a pessoa escolhe "Sob orçamento" e os campos de preço somem. |
| Vitrine pública | mostra "Sob orçamento" no lugar do valor. |
| SEO (`core/seo/dados-estruturados.ts`) | **nada muda, e isso é a decisão**: o filtro já é `fixed` com preço maior que zero, então serviço sob orçamento nunca vira `Offer` com preço inventado. Ganhou guarda para não regredir. |
| Sinal (`deposit`) | não se aplica: é percentual sobre `price_cents`, que aqui não existe. |

## Fase 2 (desenhada, NÃO implementada)

**O cliente final ainda não tem como pedir orçamento.** O `/orcamento/[token]` exibe um orçamento
que já existe; quem cria é sempre o profissional, pelo painel. Falta a entrada: uma rota pública
onde a pessoa descreve o que precisa e isso vira um pedido no painel.

Fica fora da fase 1 de propósito, porque envolve decidir campo de entrada, anti-abuso (é formulário
público sem autenticação) e como o profissional é avisado — e **avisar depende de canal que o cron
não agenda hoje**, que é a regra vigente contra prometer canal. Enquanto a entrada não existir, o
botão do serviço sob orçamento leva ao contato que já existe, sem prometer retorno automático.

---

# Fase 2 · A cliente pede o orçamento

**Data:** 2026-09-04

## O buraco

A fase 1 deixou o serviço dizer "Sob orçamento" na vitrine. E aí a pessoa toca no card e **não
acontece nada de útil**: o `/orcamento/[token]` só exibe um orçamento que já existe, e quem cria é
sempre o profissional, pelo painel. Ou seja, o produto anuncia "sob orçamento" e não tem por onde
pedir um.

Para a barbearia isso é indiferente. Para o eletricista e a faxineira — que é quem o `docs/09`
coloca no alvo e quem a fase 1 existe para atender — é o caminho inteiro.

## O que a tabela não comportava

`quotes` nasceu na `0001` para o fluxo do profissional, e duas colunas provam isso:

- `professional_id` é **`not null`**. Um pedido que acabou de chegar não tem profissional: ninguém
  pegou ainda. Atribuir um arbitrariamente cria dono falso, e obrigar a cliente a escolher no
  formulário é fricção sobre alguém que ainda nem sabe o que precisa.
- `status` começa em `'draft'`, que quer dizer *"o profissional começou a escrever"*. Empilhar
  pedido da cliente ali apaga a distinção que faz o painel saber o que exige resposta.

Por isso a migration `0061` acrescenta o status `'requested'` e torna `professional_id` opcional.
Nenhuma linha existente muda de sentido.

## O formulário

Quatro campos, e a ordem é a do agendamento público porque é o mesmo par de mãos preenchendo:

| Campo | Obrigatório | Por quê |
|---|---|---|
| O que você precisa | sim | é o pedido. Textarea, porque descrever obra em uma linha não dá. |
| Nome | sim | mesma resolução de cliente do agendamento (`resolverCliente`). |
| Telefone | sim | é por onde a resposta volta. |
| Serviço | não | só os `quote` do catálogo. Ajuda quem já sabe, não trava quem não sabe. |
| Endereço | não | eletricista e faxineira orçam no local. Mesmo campo do agendamento. |

**Sem escolha de profissional**, de propósito: a pergunta não faz sentido antes de existir orçamento,
e a coluna agora aceita vazio.

## Anti-abuso: reaproveitar, não inventar

O agendamento público já resolve o mesmo problema, e a solução dele vale igual aqui:

- **Honeypot** (`website`): campo real no DOM, invisível por posição. Preenchimento automatizado
  não pula; gente nunca vê. Quando vem preenchido, a rota responde sucesso e **não grava nada** —
  quem automatiza não descobre que foi barrado.
- **Limitador por IP em duas janelas** (`limitador`), os mesmos números do `book`: 5 por minuto e
  o teto por hora. Formulário público sem autenticação não pode depender só do honeypot.

## O que a tela promete depois de enviar

Ela **não promete canal**. Não existe rota agendada que mande WhatsApp ou e-mail de pedido novo, e
prometer isso é a armadilha mais cara do `CLAUDE.md` — quem fica mal é o salão, não o CICLO.

O que ela diz é o que é verdade: o pedido chegou e está na lista de quem atende. E oferece o atalho
que já existe — o botão de WhatsApp do salão — para a pessoa poder cutucar por conta própria, que é
o mesmo "dois caminhos" que a floricultura adotou quando o checkout não convertia.

## No painel

O pedido entra na lista de orçamentos com selo próprio (**"Pedido novo"**), que é o que separa
"alguém está esperando" de "eu comecei a escrever". O profissional abre, preenche os itens e segue
pelo fluxo que já existe: envia, a cliente aprova, vira agendamento.

## O que fica de fora desta fase

Aviso automático de pedido novo. Depende de rota agendada e de credencial de mensageria
(TICKET-043), e a regra vigente é não prometer canal que o cron não agenda. Enquanto isso, o pedido
aparece no painel como qualquer outro trabalho do dia.
