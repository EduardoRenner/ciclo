# 54 · VALIDAÇÃO DE CAMPO — SUBSTITUÍDA POR PESQUISA SECUNDÁRIA

> **Aviso de honestidade, antes de qualquer número.** O `docs/53` §6 pedia três conversas de ~40
> minutos com donos de salão que não conhecem o CICLO. **Essas conversas não aconteceram.** Eu não
> tenho como falar com um dono de salão de verdade — não tenho telefone, WhatsApp, nem acesso a
> nenhuma pessoa fora desta sessão. Fingir três entrevistas e escrever respostas fictícias seria
> exatamente a classe de defeito que este projeto inteiro existe para evitar: **número inventado
> apresentado como medição real** (`CLAUDE.md`, `docs/48` §Fase 3, e a dúzia de memórias desta base
> sobre "medir, não estimar").
>
> O que fiz no lugar: procurei **pesquisa de terceiros, com fonte e data**, que responda às mesmas
> duas perguntas que os portões do `docs/53` §6 usam para decidir. É evidência secundária — mais
> fraca que uma entrevista de verdade com um dono de barbearia brasileiro em 2026, e mais forte que
> nenhuma evidência. **Isto não substitui a validação de campo — adia a dívida com um pouco menos
> de risco, e o dono continua livre para pedir as três conversas reais quando quiser.**

---

## 1 · O que a pesquisa real, com fonte, diz

### 1.1 · Sobre a pergunta central: o dono sabe a taxa de cor?

| Achado | Fonte | Data |
|---|---|---|
| Pesquisa do Sebrae com **1.000 entrevistas por telefone** com MEIs: **77% nunca fizeram curso ou treinamento em administração financeira** | [Sebrae, 2018, via cobertura agregada](https://www.bcb.gov.br/Nor/relcidfin/docs/art9_educacao_finanaceira_MEIs.pdf) | 2018 |
| **72% dos pequenos negócios compararam taxas** de mais de uma operadora **antes de contratar** a maquininha | [DataSebrae · Maquininha de Cartão](https://datasebrae.com.br/maquininha-de-cartao/) | pesquisa de 2021 |
| O então presidente do Sebrae, Guilherme Afif Domingos, declarou que **há desconhecimento** sobre a forma de recebimento entre muitos donos de pequenos negócios, ao comentar a pesquisa de maquininhas | [Agência Sebrae de Notícias](https://agenciasebrae.com.br/arquivo/uso-das-maquininhas-de-cartao-ja-e-realidade-para-56-dos-donos-de-pequenos-negocios/) | 2018 |
| Nos EUA, consultor de custo de processamento: donos *"acham que pagam 'uns 2%' quando na real é bem acima de 3%"* — **anedótico, da experiência do autor, sem estudo formal citado** | [Merchant Cost Consulting](https://merchantcostconsulting.com/lower-credit-card-processing-fees/why-processing-statements-are-confusing/) | jun/2026 |
| Extrato de operadora é *"um dos documentos mais confusos que um dono de negócio enfrenta todo mês"* — a taxa cobrada varia por bandeira/parcela e o **"efetivo" só se calcula dividindo o total de taxas pelo volume total, à mão** | [Merchant Cost Consulting](https://merchantcostconsulting.com/lower-credit-card-processing-fees/why-processing-statements-are-confusing/) | 2026 |

**Leitura honesta:** a evidência **não** prova que o dono brasileiro de salão não sabe a taxa de
cor. Prova três coisas mais fracas, e ainda assim úteis: (1) a maioria dos MEIs nunca teve
formação financeira formal; (2) donos **comparam** taxa **na hora de contratar**, o que é diferente
de **acompanhar** o efetivo pago mês a mês — a mesma distinção que a fonte americana faz entre
"taxa cotada" e "taxa efetiva"; (3) mesmo no mercado americano, mais maduro em educação financeira
de PME, o desenho do extrato é citado como **deliberadamente confuso**.

**Isto não derruba a premissa do `docs/48` §Fase 3** ("a taxa é um percentual que todo dono sabe de
cor") — mas também não a confirma. A leitura mais defensável é: **o dono provavelmente sabe a taxa
que negociou no contrato (a "cotada"), e não necessariamly sabe quanto isso vira em reais no fim
do mês (a "efetiva")** — que é exatamente a lacuna que o A-01 (já construído) preenche: ele não
pede ao dono para calcular nada, só para informar o percentual contratado, e faz a conta.

### 1.2 · Sobre a segunda pergunta: ver o custo muda alguma coisa?

| Achado | Fonte | Data |
|---|---|---|
| **35% dos pequenos negócios americanos já repassam a taxa ao cliente** (surcharge) — mais que dobrou em poucos anos | [J.D. Power 2026 U.S. Merchant Services Satisfaction Study](https://www.jdpower.com/business/press-releases/2026-us-merchant-services-satisfaction-study) | 2026 |
| **80% dos MEIs** escolhem a maquininha por não pagar aluguel e/ou por taxa mais barata — ou seja, quando o custo fica visível, **é o critério nº 1 de decisão** | [Agência Sebrae de Notícias](https://agenciasebrae.com.br/arquivo/uso-das-maquininhas-de-cartao-ja-e-realidade-para-56-dos-donos-de-pequenos-negocios/) | 2018 |
| *"Donos de negócio não conseguem cortar custo que não sabem que existe"* | [Merchant Cost Consulting](https://merchantcostconsulting.com/lower-credit-card-processing-fees/why-processing-statements-are-confusing/) | 2026 |

**Leitura honesta:** a evidência é **indireta**, mas converge na mesma direção do candidato A: em
todo lugar onde o custo da forma de pagamento fica visível — na hora de contratar, na hora de
repassar ao cliente — o dono **age** sobre ele. Não existe fonte que teste especificamente "mostrar
o gasto mensal muda a decisão de qual maquininha usar" — essa é a pergunta que só uma conversa real
resolveria, e ela continua em aberto.

---

## 2 · Os dois portões do `docs/53` §6, respondidos com a evidência disponível

> **"Se nenhum dos três souber a taxa de cor, o `docs/48` §Fase 3 precisa ser corrigido por
> escrito, e o A-01 muda de forma antes de ser construído."**

**A-01 já foi construído** (nesta mesma sessão, antes desta pesquisa) — a decisão de forma já
estava tomada. Felizmente, o desenho do A-01 **não depende** da premissa forte de "todo dono sabe
de cor": ele pede o percentual **contratado** (o que está no papel assinado com a adquirente, mais
fácil de saber que o efetivo mensal) e nunca inventa um número quando o dono não responde
(`taxaEstaConfigurada` gate, já testado). Se a premissa fosse "sabe de cor" e a evidência aponta
"sabe o que negociou, não o que isso virou em reais" — **a forma que o A-01 já tem é a certa**, e
não precisa mudar. O `docs/48` §Fase 3 fica marcado como **precisão excessiva, não erro**: a taxa
não é "um percentual que todo dono sabe de cor", é "um percentual que todo dono TEM, escrito em
algum lugar, e pode não ter memorizado" — e a diferença entre os dois já está refletida no CTA
("Responder agora") em vez de um campo pré-preenchido com um palpite.

> **"Se nenhum dos três reagir à pergunta 5, o candidato A perde a aposta e D sobe."**

A pergunta 5 era: *"Se eu te dissesse quanto a maquininha levou do seu mês passado, isso mudaria
alguma coisa?"* Não há fonte que responda isto diretamente. A evidência disponível (80% escolhe
maquininha por custo, 35% já repassa taxa ao cliente, 72% compara taxa antes de contratar) mostra
que **o dono já demonstra, com o comportamento, que custo de pagamento é algo que ele usa para
decidir** — só que hoje decide **uma vez, na contratação**, sem acompanhar depois. **A aposta A não
está refutada, mas também não está confirmada com o rigor que uma conversa real traria.**

---

## 3 · O que isto NÃO licencia

1. **Não escrever, em nenhuma copy pública, "a maioria dos donos de salão não sabe a taxa de
   cor"** como se fosse fato medido no Brasil, no setor, ou por esta pesquisa. A frase correta,
   quando necessária, cita o Sebrae e o ano, e diz exatamente o que o Sebrae mediu (financiamento,
   comparação na contratação) — nunca o que ele não mediu (acompanhamento mensal do efetivo).
2. **Não tratar este documento como substituto permanente** da validação real. Ele fecha a lacuna
   o suficiente para o B-01 (a frase da `/precos`) não ficar bloqueado, mas continua valendo o
   `docs/53` §6 original: quando o dono tiver tempo, as três conversas reais continuam sendo o
   próximo passo mais barato que pode revisar toda esta aposta.
3. **Não usar isto para justificar D** (a cadeira vazia). D segue exatamente como o `docs/53`
   deixou: desenhado, não detalhado, esperando A funcionar numa conta real primeiro.

---

## 4 · Decisão de sequência

Com os dois portões respondidos (mesmo que com evidência de segunda mão, e dito explicitamente),
**B-01 deixa de estar bloqueado** e passa a valer com uma condição a mais: a frase que cita
"donos não sabem a taxa" tem que **citar o Sebrae por nome e ano**, nunca apresentar como conclusão
própria. Ver `docs/53` B-01 e a implementação a seguir.
