# 43 · Posicionamento 10x — por que o CICLO não deve competir com o AppBarber

**2026-09-05.** Pesquisa de mercado nova, com uma lente específica: *Zero a Um* (Peter Thiel).
A pergunta não é "o que falta no CICLO para ficar competitivo". É **onde o CICLO já é
estruturalmente diferente dos líderes, de um jeito que eles não conseguem copiar sem se
destruir**. Competição de feature contra o líder do nicho é jogo de soma zero; o valor está em
ser o único a fazer uma coisa.

Convenção herdada do `25`: **[M]** medido no código/banco deste repositório, **[P]** vem da
pesquisa de mercado, **[E]** estimado.

---

## 1. O mercado, medido

| Produto | Entrada paga | Modelo | Escala declarada |
|---|---|---|---|
| **AppBarber** | R$ 79,90/mês (1 profissional) · R$ 164,50 (2-5) · R$ 219,90 (6+) **[P]** | App do cliente **compartilhado** entre barbearias + painel | 1M+ instalações no Play Store, ~12 anos **[P]** |
| **BestBarbers** | Clube de assinatura como produto principal, app próprio **[P]** | App do cliente, clube de assinatura | 1.200+ barbearias **[P]** |
| **Trinks** | R$ 76 (anual) / R$ 110 (mensal) **[P]** | Painel + marketplace de beleza | Líder em salão |
| **Fresha** | US$ 19,95 solo / US$ 14,95 por membro **+ 20% de comissão (mín. US$ 6) em todo cliente novo vindo do marketplace** **[P]** | Marketplace com comissão | 450k+ profissionais, global |
| **Booksy** | US$ 29,99 + US$ 20 por membro extra **[P]** | Marketplace, comissão só no "Boost" | Global |
| **CICLO** | **R$ 0 · R$ 49 · R$ 99 · R$ 179** **[M]** (`PRECO_MENSAL_CENTS`) | Site próprio do negócio, sem app, sem comissão | Zero pagantes **[M]** |

O preço do CICLO já é o mais baixo da tabela e **isso não é o diferencial** — é o argumento mais
fácil de copiar que existe. Qualquer um dos cinco baixa o preço numa tarde. Preço não é monopólio.

---

## 2. O segredo — a ferida que o líder não pode fechar

Esta é a parte que muda a estratégia, e ela veio das **reclamações de donos**, não do material
de marketing dos concorrentes.

As duas queixas recorrentes de donos de barbearia sobre o AppBarber **[P]**:

1. **O atrito do "baixe nosso app".** Cliente novo às vezes não baixa — e vai marcar em outro
   lugar. O download fica entre a vontade de marcar e o agendamento.
2. **O app mostra a lista de concorrentes para o cliente dele.** Ao se cadastrar, o cliente vê
   outras barbearias. Donos pedem uma forma de o cliente entrar pelo link/QR sem ver a
   concorrência.

E o BestBarbers, a alternativa mais citada, **tem a mesma limitação** — também se comunica por
app próprio, então não resolve o atrito do download **[P]**.

**Por que isso é um segredo e não só um defeito:** eles não podem consertar. O app do cliente só
tem valor de rede porque agrega várias barbearias; tirar a lista de concorrentes esvazia o
próprio ativo que justifica o app existir. A reclamação nº 1 do dono **é o modelo de negócio
deles**. É o dilema clássico do incumbente — a Fresha cobrando 20% de todo cliente novo do
marketplace **[P]** é a forma mais explícita do mesmo desenho: o cliente é do marketplace, e o
salão aluga o acesso a ele.

Traduzido para a frase que o dono entende:

> **Nos outros, o cliente é da plataforma e o salão aluga o acesso. No CICLO, o cliente é do salão.**

---

## 3. O que o CICLO já tem, medido no repositório

Nada nesta seção é trabalho a fazer. É arquitetura **já escolhida** que ninguém está usando como
argumento.

- **Não existe marketplace, e "vitrine" aqui é do próprio negócio** **[M]**. `/[slug]` é a página
  daquele estabelecimento; `src/core/text/vitrine.ts` e `/api/v1/tenant/vitrine` são as imagens
  do salão, não um diretório. Não há nenhuma rota que liste tenants para o público.
- **Zero download.** O agendamento roda no navegador. O `sitemap.ts` indexa **a página do
  negócio** no Google (`/{slug}`), não uma vitrine central que fica com o tráfego **[M]**.
- **Zero comissão por agendamento** **[M]** — não existe cobrança por transação em
  `PRECO_MENSAL_CENTS`. Contra os 20% da Fresha em cliente novo **[P]**, isso é diferença de
  natureza, não de grau.
- **O Motor de Ciclo, com prova de ROI.** `receitaAtribuidaAoCiclo()` responde *quanto dinheiro
  o Motor trouxe de volta este mês* **[M]**. Nenhum concorrente pesquisado demonstra ter isso
  (`25` §2.1 já havia registrado).

---

## 4. Onde isso está hoje na comunicação — o achado desta rodada

O `h1` da landing é **"A lista de quem devia ter voltado e não voltou."** **[M]** — boa manchete,
e é sobre o Motor de Ciclo.

A resposta à queixa nº 1 do mercado inteiro está na **quarta de cinco perguntas do FAQ**, no
rodapé da página **[M]**:

> *"Quem vai marcar precisa baixar app ou criar conta?" — "Não. A pessoa abre seu link, escolhe o
> serviço e o horário, e o agendamento entra na sua agenda esperando você confirmar."*

Está tratado como **objeção a ser neutralizada**. É o contrário: é a diferença estrutural entre o
CICLO e os dois líderes do nicho, escrita como nota de rodapé. E a parte mais forte — "e o seu
cliente não vê a lista dos seus concorrentes" — **não está escrita em lugar nenhum do produto**
**[M]**.

---

## 5. Os cinco eixos de Zero a Um, respondidos com honestidade

**1 · Tecnologia proprietária 10x melhor.** Sim, e não é a agenda. É o Motor de Ciclo com
atribuição de receita: cadência por pessoa, não média do salão, e a resposta em reais. Agenda é
paridade; "quanto o Motor trouxe" é a categoria onde não há segundo colocado na pesquisa **[P]**.

**2 · Efeitos de rede — a lacuna, e a armadilha.** O CICLO **não tem** e a tentação óbvia é
construir um marketplace para ter. **Isso destruiria o produto.** O momento em que o cliente do
salão A vê o salão B numa tela do CICLO é o momento em que o CICLO vira um AppBarber pior, sem os
12 anos e sem o 1M de instalações. O efeito de rede que cabe aqui é **do lado do dono**
(indicação B2B, já desenhada no `18` Fase H e no `37`), nunca do lado do cliente final. Registrar
isto como veto permanente vale mais do que qualquer feature deste documento.

**3 · Economia de escala.** O custo marginal de um agendamento no CICLO é ~zero e o preço é fixo.
No modelo de comissão (Fresha 20% em cliente novo **[P]**), o custo do salão **cresce com o
sucesso dele**. Quanto melhor o salão vai, pior fica o negócio de usar o concorrente. Esse
argumento fica mais forte com o tempo, sozinho.

**4 · Marca e distribuição.** A frase de uma linha, que hoje não existe: **"Seu cliente é seu."**
Ela cobre as duas queixas de mercado ao mesmo tempo (sem download, sem concorrente na tela) e
nomeia o que os outros quatro não podem dizer.

**5 · O segredo.** §2: a queixa nº 1 dos donos é o modelo de negócio dos líderes, então eles não
vão consertar. O CICLO, por ser focado e não ser marketplace, já está do lado certo — por
arquitetura, não por escolha de marketing.

---

## 6. O que isto muda no backlog

O plano do `25` continua válido e não é substituído: **F0 (ligar o motor) segue bloqueando tudo**
— posicionamento não conserta um produto que calcula e não fala.

O que este documento acrescenta é uma classe de trabalho que não existia na lista: **tornar
dizível o que já é verdade**. Custa pouco, não constrói regra de negócio nova, e é o único
trabalho que mexe no eixo 4 (marca).

| # | Trabalho | Eixo | Origem | Estado |
|---|---|---|---|---|
| A | "Seu cliente é seu" sai do FAQ e vira argumento de primeira dobra na landing | 4 · marca | §4 | **feito** — subtítulo da dobra + a resposta do FAQ deixou de ser só "Não." |
| B | Nomear a segunda metade — o cliente não vê a concorrência — em algum lugar do produto | 4 · marca | §4 | **feito** — cartão "Sua página, sua clientela" (`f18e3bf`) |
| C | Comparação honesta de custo com modelo de comissão, na `/precos` | 3 · escala | §5.3 | **feito** — seção "O preço não sobe quando você cresce" |
| D | **Veto documentado: nunca construir vitrine/diretório de tenants para o cliente final** | 2 · rede | §5.2 | **feito** — `DECISOES` + `pagina-do-negocio-e-so-dele.test.ts` |

O item D é o mais importante da tabela e é o único que não produz tela nenhuma.

---

## 7. O que o item A ensinou, e que o §4 não previa (2026-09-05)

A frase de marca do §5.4 é **"Seu cliente é seu"**, e ela **não entrou assim em lugar nenhum**. O
motivo importa mais que a decisão: para quem nunca usou app de marketplace, ela não quer dizer
nada — é resumo de um argumento que a pessoa ainda não ouviu. O que entrou foi o fato verificável
("quem for marcar abre no navegador: sem baixar app e sem ver seus concorrentes"), e o slogan fica
sendo o que ele é de verdade: o resumo, para quem já entendeu.

Isso não é desvio do §5.4, é a aplicação do §D.3 do `docs/20`, que já tinha matado o tricolon
abstrato da dobra pelo mesmo raciocínio. **Registrado aqui porque a próxima rodada vai reler o
§5.4, não achar a frase no produto e concluir que o item A não foi feito.**

E o `h1` continua sendo o Motor de Ciclo, de propósito: ele é o eixo 1 (tecnologia 10x). Trocar um
diferencial por outro na posição de maior atenção não é ganho — a dobra comporta os dois, e isso foi
medido (375 px: o subtítulo vai de 46 px para 70 px, o bloco de preço de y=503 para y=526, com a
dobra em 812).
