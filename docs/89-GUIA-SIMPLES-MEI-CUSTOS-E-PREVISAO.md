# 89 · Guia simples: o CICLO pode ser MEI? E quanto entra, quanto sai e quanto volta

> **Escrito em 2026-09-30 para o Eduardo**, que pediu duas coisas: (1) pesquisar a fundo se o CICLO realmente não pode ser MEI, já que ele
> tem um MEI; (2) explicar investimento e previsão sem jargão. **Eu não sou contador nem advogado.** Onde a resposta muda o seu bolso, eu digo o que
> perguntar (§1.8). Os números de custo e os cenários vêm do `docs/88` e da planilha `docs/modelo-financeiro-ciclo.xlsx`; aqui eles são só explicados.
>
> Legenda: **[P]** dado público conferido em 28 a 30/09/2026 · **[E]** estimativa minha · **[H]** hipótese que só o campo confirma.

---

# Parte 1 · O CICLO pode ser MEI?

## 1.1 Resposta curta

**Não pode.** E não é opinião de blog: li a lista oficial inteira da Receita Federal. O CICLO cobra assinatura de um software, e software não está na lista
do que o MEI pode fazer.

**Mas você não precisa abrir empresa nova.** O seu CNPJ de MEI vira ME (microempresa) sozinho, sem trocar de número, quando você põe o software nele (§1.3).
Isso é mais simples do que parece, e o custo é bem menor do que o susto inicial sugere (§1.5).

## 1.2 O que eu conferi (fontes oficiais)

**A lista.** É o **Anexo XI da Resolução CGSN nº 140/2018** (Receita Federal, [normas.receita.fazenda.gov.br](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=64455)). Baixei o PDF e li as
34 páginas. São cerca de 467 ocupações. Procurei tudo que tem a ver com informática, internet e software. O que existe:

| Ocupação permitida ao MEI | Código (CNAE) |
|---|---|
| Instrutor de informática (dar aula) | 8599-6/03 |
| Técnico de manutenção de computador | 9511-8/00 |
| Instalador de rede de computadores | 6190-6/99 |
| Comerciante de equipamentos de informática | 4751-2/01 |
| Proprietário de sala de acesso à internet (lan house) | 8299-7/07 |
| Editor de lista de dados | 5819-1/00 |
| Fornecedor de recortes de jornais e revistas | 6399-2/00 |

**O que NÃO existe na lista, e é o que o CICLO faz:** desenvolvimento e licenciamento de programas de computador (códigos **6201, 6202, 6203, 6204 e 6209**) e
hospedagem e provedores de serviços de aplicação (códigos **6311 e 6319**). Vender assinatura de um sistema pela internet se encaixa em **6203-1/00**
(programa de computador que não é feito sob medida) ou **6311-9/00** (provedor de aplicação). Os dois estão fora.

**A regra da própria Receita** (Manual do Desenquadramento do SIMEI, item 4.3, [PDF oficial](https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_DESENQUADRAMENTO_SIMEI.pdf)):
> "Se a ocupação não constar do referido Anexo, ela não é permitida ao MEI."

E um aviso importante do mesmo manual: **vale a descrição da ocupação, não só o código.** Ou seja, não adianta cadastrar "instrutor de informática" e vender assinatura
de software por baixo: a nota fiscal e o que você faz de verdade dizem outra coisa. Eu não recomendo esse atalho.

## 1.3 A boa notícia: o seu CNPJ vira ME sozinho

Tudo abaixo vem do mesmo manual oficial da Receita.

| O que acontece | Como funciona |
|---|---|
| **Todo MEI já está no Simples Nacional** | MEI é um "modo simplificado" dentro do Simples. Sair do MEI **não** tira você do Simples (item 6 do manual) |
| **Colocar o software no CNPJ tira você do MEI automaticamente** | Se você incluir no CNPJ uma atividade que não está na lista, a Receita desenquadra sozinha, **a partir do dia 1º do mês seguinte** (item 5) |
| **O número do CNPJ continua o mesmo** | Você segue sendo "empresário individual". Só deixa de ser MEI e passa a ser **ME** (microempresa) |
| **Você não precisa "optar" pelo Simples** | Quem sai do MEI passa a pagar imposto pelas regras normais do Simples "a partir da data de início dos efeitos", sem pedir nada (item 6) |
| **Sair por vontade própria** | Pode pedir **a qualquer tempo**. Vale **a partir de 1º de janeiro do ano seguinte**. **Se pedir em janeiro, vale retroativo a 1º de janeiro do mesmo ano** (item 3) |
| **Se você fizer a atividade e não avisar** | Tem que comunicar **até o último dia útil do mês seguinte**. Atrasar ou não comunicar dá **multa de R$ 50** (Lei Complementar 123, art. 36-A). Não há "cancelamento do CNPJ" |
| **Não dá para ter MEI e outra empresa** | MEI não pode ser sócio, administrador ou titular de outra empresa (LC 123, art. 18-A, §4º). Por isso não adianta abrir um segundo CNPJ e manter o MEI |

**Correção minha:** o `docs/18` dizia que "operar como MEI em atividade vedada leva a cancelamento do CNPJ". A Receita diz outra coisa: o que acontece é o **desenquadramento**
(você vira ME, paga pela regra do Simples e leva R$ 50 de multa se não avisar no prazo). É um custo, não uma catástrofe. Vou corrigir o `docs/18`.

## 1.4 MEI × ME, lado a lado

| | **MEI (o que você tem)** | **ME no Simples (o que o CICLO exige)** |
|---|---|---|
| Imposto por mês | **R$ 86,05 fixos** (serviços) [P]: R$ 81,05 de INSS (5% do salário mínimo de R$ 1.621) + R$ 5 de ISS | **Um percentual do que você fatura**: 6% se você está no Anexo III; 15,5% no Anexo V (explicação no §1.6) |
| Se você não faturar nada | paga os R$ 86,05 mesmo assim | **paga R$ 0 de imposto** (mas ainda precisa entregar a declaração mensal) |
| Contador | **não precisa** | na prática, **precisa**: declaração mensal até o dia 20 (mesmo sem faturar) e declaração anual até 31/03 |
| Quanto custa um contador [P] | R$ 0 | **R$ 189 a R$ 329 por mês** para ME de serviços (Contabilizei a partir de R$ 195, Agilize a partir de R$ 259). O modelo usa **R$ 195** |
| Teto de faturamento por ano | **R$ 81 mil** (R$ 6.750 por mês); passar até 20% (R$ 97.200) ainda é tolerado, acima disso você é desenquadrado | **R$ 360 mil** |
| Nota fiscal | emite | emite (nota de serviço da prefeitura) |
| INSS (aposentadoria) | 5% do mínimo (R$ 81,05). Vale aposentadoria por idade, **não conta tempo de contribuição** | você precisa de um **pró-labore** (uma "retirada" com registro): **11% do valor**, no mínimo R$ 178. Contribuição completa |
| Quem responde pelas dívidas | você, com o seu patrimônio | você, com o seu patrimônio (só uma sociedade limitada separa) |

**O teto do MEI não seria problema para o CICLO no cenário Base:** em dez/28 o faturamento chega a R$ 5.668 por mês, cerca de R$ 68 mil por ano, abaixo dos R$ 81 mil. **O
problema é só a lista de atividades.** Se um dia a lista mudar, o CICLO cabe. Hoje, não.

## 1.5 O que a mudança custa para você, de verdade

O que você **já paga hoje**: R$ 86,05 por mês de DAS do MEI. Ao virar ME, esse valor some e entra o outro:

| Custo da mudança | Valor | Quando começa |
|---|---|---|
| Contador | **R$ 195 por mês** (R$ 189 a R$ 329) | no mês em que você virar ME |
| Imposto do Simples | **6% do que você faturar do CICLO** (R$ 0 enquanto não cobrar) | só a partir do primeiro pagamento, em 11/01/2027 |
| INSS do pró-labore | R$ 178 por mês, contra R$ 81 do MEI: **R$ 97 a mais**, mas é **a sua** contribuição, não custo do produto | quando você abrir o pró-labore |
| Você deixa de pagar | os **R$ 86,05 do MEI** | no mês do desenquadramento |

**Entre virar ME em novembro e o primeiro pagamento em janeiro, o imposto é zero.** O único custo é o contador (uns R$ 390 em nov e dez), e é ele que garante que o
desenquadramento saia direito. Isso já está nos R$ 195 por mês do modelo.

**E a receita atual do seu MEI?** Se ele já fatura algo (o seu negócio de hoje), essa receita **também passa a pagar imposto em percentual**, e soma no teto. Pergunte ao contador
como o seu caso fica (§1.8, pergunta 4).

## 1.6 "Fator R", o motivo de o pró-labore importar

Isso é o que mais confunde, então vai devagar. No Simples, quem presta serviço de software pode pagar **6%** (Anexo III) ou **15,5%** (Anexo V) do faturamento. **Quem decide é o Fator R**:

> **Fator R = tudo que você pagou de "folha" (pró-labore e salários) nos últimos 12 meses ÷ tudo que você faturou nos últimos 12 meses.**
> Se der **28% ou mais → 6%**. Se der **menos → 15,5%**.

Na prática, com **um pró-labore de um salário mínimo (R$ 1.621)**, você fica nos 6% enquanto o faturamento for **até cerca de R$ 5.790 por mês** (1.621 ÷ 0,28). No cenário Base isso cobre até dez/28.
**Por isso a sua contribuição de INSS sobre o pró-labore não é um "custo do CICLO" no sentido de dinheiro que sai da empresa, mas é a chave para pagar 6% em vez de 15,5%.**
A diferença é grande: em R$ 3.455 de faturamento, 6% são R$ 207 por mês; 15,5% seriam R$ 536. **O contador precisa confirmar qual anexo vale para o código que você escolher** (as fontes que li divergem: uma diz que 6311-9/00 é direto Anexo III, outras dizem que depende do Fator R).
O modelo usa 6% e mostra o efeito de 15,5% na tabela de sensibilidade (perda de R$ 7,6 mil no caixa de dez/28).

## 1.7 Três caminhos, e o que eu faria

O `docs/87` (D6) exige **um CNPJ pronto antes da janela pública, 09/11**. Você já tem um CNPJ. O que falta é ele estar com a atividade certa.

| | **A. Virar ME em outubro** | **B. Ficar MEI e pedir em janeiro** | **C. Abrir outro CNPJ** |
|---|---|---|---|
| Como | inclui o código do software no CNPJ; vira ME em 01/11 (o pedido precisa sair até 31/10) | segue MEI até dez; pede o desenquadramento **em janeiro**, com efeito retroativo a 01/01/2027 | não funciona: MEI não pode ser sócio ou titular de outra empresa |
| Custo extra até janeiro | contador nov e dez (~R$ 390); imposto zero | R$ 0 de contador, mais o DAS de R$ 86 até dez | (n/a) |
| Risco | baixo: o CNPJ já cobre o que você faz | **você oferece o software (mesmo grátis) a até 40 contas com um CNPJ que não cobre isso**, de novembro a dezembro. A consequência esperada é o desenquadramento e R$ 50, mas você lida com dado de terceiros num cadastro que não bate com a atividade | (n/a) |
| Protege o `docs/87` D6 | **sim** | parcialmente | não |

**Eu faria a A.** Custa uns R$ 390 e resolve o CNPJ antes da janela pública, com dado de 40 salões dentro. A B economiza esse dinheiro e cria uma zona cinza justamente na fase em que você recebe base de clientes de terceiros.
A decisão é sua, e **antes de mexer no CNPJ conversa 20 minutos com um contador** (a primeira conversa costuma ser grátis). Passo a passo da A: (1) escolher o contador; (2) ele define o código (6203-1/00 ou 6311-9/00) e o anexo;
(3) ele inclui no CNPJ (o desenquadramento sai sozinho no mês seguinte); (4) você abre o pró-labore; (5) o contador configura a nota fiscal de serviço da prefeitura.

## 1.8 O que perguntar ao contador (leve isto impresso)

1. Para vender assinatura do CICLO, qual código de atividade eu uso (6203-1/00 ou 6311-9/00) e **em qual anexo do Simples** eu caio?
2. Com um pró-labore de um salário mínimo, eu fico no **Fator R** de 28% até quanto de faturamento?
3. Qual é a **alíquota de ISS** do meu município para esse serviço, e a prefeitura usa o emissor nacional de nota?
4. **O meu MEI já fatura hoje.** Como essa receita entra quando eu virar ME, e o que muda no imposto dela?
5. Em que mês exato eu peço a mudança para não ter multa nem imposto retroativo?
6. Vou emitir **uma nota por mensalidade** (50 assinantes = 50 notas por mês). O plano de contabilidade cobra por nota? O preço sobe com o faturamento?
7. A **reforma tributária de 2027** (IBS e CBS): fico dentro do DAS ou escolho o modelo "híbrido"? (A regra geral é continuar dentro do DAS; o "híbrido" só pesa se os seus clientes forem empresas que aproveitam crédito, o que não é o caso de barbearia.)
8. O que cai em **imposto de renda pessoa física** quando eu tenho pró-labore e lucro da empresa?

## 1.9 O que isso muda nos números do `docs/88`

Nada além do que já está lá: a contabilidade a **R$ 195 por mês** é o custo de ser ME. O **equilíbrio** é 8 pagantes. Se você achar um contador que cobre menos ou já tenha um de confiança, o equilíbrio cai para 5.

---

# Parte 2 · Investimento e previsão, sem jargão

## 2.1 A ideia numa imagem

Pense em abrir uma **academia**. Antes de o primeiro aluno pagar, você já gastou: a **obra** (uma vez só), o **aluguel** (todo mês, tenha aluno ou não) e a **gasolina** para divulgar.
Nos primeiros meses você **gasta mais do que recebe**. Depois, quando entram alunos suficientes, a mensalidade passa a cobrir o aluguel e a sobra vai **pagar o buraco** que você abriu no começo.

Com o CICLO é igual, com uma diferença: **você dá 60 dias grátis** (sem cartão), então o buraco fica mais fundo e demora mais para fechar. É o preço de provar o produto antes de cobrar.

## 2.2 Para onde vai o dinheiro (o que sai)

| Grupo | O que é | Quanto | Quando |
|---|---|---|---|
| **A obra** (uma vez só) | abrir a mudança de CNPJ e certificado digital (R$ 500), registrar a marca no INPI (R$ 400), advogado para revisar os termos e a política de privacidade (R$ 3.000), material de visita (R$ 400) | **R$ 4.300** | outubro |
| **O aluguel** (todo mês) | Supabase (o banco de dados, R$ 130,50), Vercel (o servidor do site, R$ 104,40), contabilidade (R$ 195), domínio (R$ 3,33) | **R$ 433 por mês** | desde outubro |
| **A gasolina** (só nos dias de rua) | transporte, estacionamento, café | **R$ 25 por dia**, uns R$ 500 por mês | enquanto você sair para visitar |
| **Degraus** (só quando o CICLO cresce) | banco maior na Supabase e serviços que deixam de ser grátis (e-mail, monitor de erros) | +R$ 26 a +R$ 235 por mês | perto de 150 e 400 contas |
| **O seu tempo** | rua, implantar contas, suporte: cerca de **155 horas por mês** | **não sai do bolso**, mas é um emprego de tempo integral | sempre |

**Não estão na conta, de propósito:** INSS do pró-labore (é seu, veja §1.6), e-mail próprio, material mensal e qualquer anúncio pago. Se um deles virar necessidade, a planilha tem a célula para ligar.

## 2.3 De onde vem o dinheiro (o que entra)

Cada assinante paga **R$ 49** (1 profissional) ou **R$ 99** (até 5). Na média, considerando que 3 em cada 4 escolhem o mais barato, cada um traz **R$ 61,50 por mês**. Dali saem:
a taxa do Mercado Pago (cerca de 3,7%) e o imposto do Simples (6%). **Sobram R$ 55,54 líquidos por assinante por mês.**

**Por que o equilíbrio é 8:** o aluguel é R$ 433 por mês. R$ 433 ÷ R$ 55,54 = 7,8, então **8 pagantes cobrem o aluguel**. Abaixo disso você perde dinheiro todo mês; acima, sobra.

## 2.4 A história do dinheiro, mês a mês (cenário Base)

"Base" é o cenário do meio: **15 em cada 100 donos que criam conta acabam assinando.** Em cada linha, **sobra** é o que entrou menos o que saiu, e **saldo** é a soma de tudo desde outubro.

| Mês | O que acontece | Pagantes | Entra (líquido) | Sai | Sobra | **Saldo** |
|---|---|---|---|---|---|---|
| **Out/26** | alpha com 10 amigos; você paga a obra | 0 | R$ 0 | R$ 4.933 | −R$ 4.933 | **−R$ 4.933** |
| **Nov/26** | janela pública, 40 contas grátis | 0 | R$ 0 | R$ 933 | −R$ 933 | −R$ 5.866 |
| **Dez/26** | pico do salão; ninguém paga ainda | 0 | R$ 0 | R$ 783 | −R$ 783 | −R$ 6.650 |
| **Jan/27** | **lançamento oficial**: 6 assinam | 6 | R$ 167 | R$ 933 | −R$ 767 | −R$ 7.416 |
| Mar/27 | 6 novos assinantes por mês | 17 | R$ 807 | R$ 1.199 | −R$ 393 | −R$ 8.385 |
| **Abr/27** | **o fundo do poço** | 23 | R$ 1.108 | R$ 1.199 | −R$ 92 | **−R$ 8.477** |
| **Mai/27** | **primeiro mês no azul**: entra mais do que sai | 28 | R$ 1.396 | R$ 1.199 | **+R$ 197** | −R$ 8.280 |
| Jun/27 | a sobra cresce | 33 | R$ 1.674 | R$ 1.199 | +R$ 474 | −R$ 7.805 |
| Set/27 | | 46 | R$ 2.441 | R$ 1.199 | +R$ 1.242 | −R$ 4.827 |
| Dez/27 | | 58 | R$ 3.120 | R$ 1.284 | +R$ 1.836 | −R$ 281 |
| **Jan/28** | **o saldo volta ao positivo**: você recuperou tudo | 61 | R$ 3.313 | R$ 1.434 | +R$ 1.879 | **+R$ 1.599** |

**Como ler:** você começa **empatando o buraco** em outubro (a obra pesa), cava até **abril de 2027 (R$ 8.477 abaixo de zero)**, e a partir de **maio** cada mês dá lucro. **Só em janeiro de 2028**
o lucro acumulado paga todo o buraco. Ou seja, **o dinheiro que você põe em outubro só volta 15 meses depois.** Depois disso, tudo que entra é seu: em dez/28, cerca de **R$ 3.800 de sobra por mês**.

## 2.5 Os três cenários, em palavras

Os cenários mudam só o que **eu não sei**: quantos donos assinam, quantos cancelam, e quantos escolhem o plano mais caro. Imagine **100 donos** que criam conta:

| | **Pessimista** | **Base** | **Otimista** |
|---|---|---|---|
| Quantos dos 100 assinam no fim dos 60 dias | 8 | **15** | 25 |
| Quantos cancelam por mês, de cada 100 assinantes | 6 | 4 | 2,5 |
| Assinantes em dez/27 | 14 | **58** | 105 |
| Dinheiro que sobra por mês em dez/27 | −R$ 304 (perde) | **+R$ 1.836** | +R$ 4.782 |
| **O maior buraco** (o quanto você precisa aguentar) | **R$ 18.835** | **R$ 8.477** | R$ 7.458 |
| Quando o saldo volta ao positivo | **não volta** até dez/28 | jan/28 | ago/27 |

**Os números 8, 15 e 25 vêm de pesquisa** (testes sem cartão de crédito convertem em média 14%, com faixa de 8% a 22% em vários estudos de 2026) [P]. **Os outros são hipóteses minhas.** Só o alpha, com 10 contas reais, vai dizer onde o CICLO está.

## 2.6 As palavras que aparecem no plano, traduzidas

| Palavra | Quer dizer | No CICLO |
|---|---|---|
| **Ponto de equilíbrio** | quantos pagantes cobrem o custo fixo | **8** |
| **Exposição de caixa** | o **maior buraco** que a conta chega a ter | **R$ 8.477** (Base) |
| **Reserva de caixa** | o dinheiro que você separa para aguentar o buraco, com folga de 15% | **R$ 9,8 mil** |
| **Payback (retorno)** | quando você recupera tudo que pôs | **jan/28** (Base) |
| **Conversão** | de cada 100 que testam, quantos assinam | 15 |
| **Churn (cancelamento)** | de cada 100 assinantes, quantos saem por mês | 4 |
| **Funil** | a fila: abordar, conversar, criar conta, ativar, assinar | 12 por dia de rua → 10 contas por semana |
| **CAC** | quanto custa "comprar" um assinante | R$ 89 em dinheiro; **R$ 1.320 se contar o seu tempo** |
| **LTV** | quanto um assinante deixa até cancelar | R$ 763 (já descontando o seu suporte) |
| **ROI (retorno sobre o gasto)** | para cada R$ 1 gasto, quanto volta a mais | +88% em 27 meses (Base) |

**A leitura honesta do CAC:** R$ 89 em dinheiro é barato. Mas **contando o seu tempo, cada assinante custa R$ 1.320, e ele só deixa R$ 763.** Isso quer dizer que, no cenário Base, sair na rua sozinho **paga menos do que a sua hora vale**.
Só no Otimista o negócio remunera o seu tempo. O que resolve não é sair menos: é **converter mais** (de 15 para 20 em cada 100 adianta o retorno em 3 meses), **gastar menos tempo por conta** e, no futuro, **cobrar um pouco mais**.

## 2.7 O que pode dar errado, e quanto dá para perder

- **O pior caso (Pessimista):** o CICLO não se paga e você perde **cerca de R$ 19 mil** em 27 meses, mais o seu tempo. Por isso o plano tem **regras de parada** (`docs/88` §9): se em **junho de 2027 você tiver menos de 20 pagantes** (o Base prevê 33), você reduz a rua para 3 dias por semana e corta o que puder.
- **O caso normal:** você precisa de **R$ 9,8 mil separados** para atravessar o buraco sem apertar.
- **O que reduz o buraco:** (1) **plano anual** (R$ 490 por ano cobra 12 meses de uma vez: 10 assinantes anuais pagam o contador do ano inteiro no primeiro mês); (2) **contador mais barato**; (3) **preço de R$ 59 e R$ 119** para quem chegar depois dos 30 pagantes.
- **O que não reduz:** sair mais vezes. **Passar de 12 para 20 abordagens por dia não muda nada**, porque o teto de 40 contas por mês já enche com 12.

## 2.8 Como isto vira número de verdade

Hoje o funil é palpite educado. Depois do alpha (10 contas, 26/10), **troque na planilha** (aba Premissas, coluna Base, células azuis) por **quatro números medidos**:

1. de cada 100 donos que você aborda, **quantos aceitam conversar**;
2. de cada 100 conversas, **quantos criam conta**;
3. de cada 100 contas, **quantas ativam** (importam a base e chamam alguém em 14 dias);
4. de cada 100 contas, **quantas assinam** (só se sabe em janeiro).

O placar do piloto (`docs/runbooks/placar-do-piloto.sql`) já responde os três primeiros.

## 2.9 O que é fato, o que é estimativa, o que é palpite

| Tipo | O que |
|---|---|
| **Fato** (conferido em fonte oficial ou pública) | preços da Supabase, Vercel, Resend e Sentry; a lista do MEI; o imposto do MEI (R$ 86,05); as regras de desenquadramento; a faixa de preço da contabilidade; o câmbio (R$ 5,22) |
| **Medido no seu banco** | o peso de cada agendamento (0,8 KB) e de cada cliente (1,2 KB) |
| **Estimativa minha** | quantas chamadas cada conta faz no servidor; quando a Supabase precisa de banco maior; a taxa do cartão no Mercado Pago (4%; a tabela oficial não abre) |
| **Palpite (hipótese de funil)** | quantos aceitam conversar, quantos criam conta, quantos ativam, quantos escolhem o plano caro |
| **Pesquisa de mercado** | conversão de teste sem cartão (mediana 14%) e cancelamento de SaaS para pequena empresa (3% a 5% por mês) |

---

# Glossário rápido

- **MEI**: microempreendedor individual. CNPJ com imposto fixo (R$ 86,05 para serviços), limite de R$ 81 mil por ano, **só para as atividades da lista oficial**.
- **ME**: microempresa. Imposto em percentual do faturamento, limite de R$ 360 mil por ano, exige contador.
- **Simples Nacional**: o regime que junta vários impostos numa guia só (o **DAS**).
- **DAS**: a guia mensal única de imposto. No MEI é fixa; na ME, é um percentual do faturamento.
- **Desenquadramento**: sair do MEI. Não tira do Simples, só muda a forma de pagar.
- **CNAE**: o código de cada atividade econômica no CNPJ.
- **Anexo III / Anexo V**: as duas tabelas de imposto do Simples para serviços (6% ou 15,5% de início).
- **Fator R**: a conta (folha ÷ faturamento) que decide se você paga 6% ou 15,5%.
- **Pró-labore**: a "retirada" registrada do dono, sobre a qual incide INSS de 11%.
- **NFS-e**: a nota fiscal de serviço eletrônica, da prefeitura.
- **DEFIS / PGDAS-D**: as declarações anual e mensal do Simples.
- **CAC, LTV, ROI, payback, churn, funil, conversão, exposição de caixa**: ver a tabela do §2.6.

## Fontes (conferidas em 28 a 30/09/2026)

Lista do MEI: [Anexo XI da Resolução CGSN 140/2018](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=64455) (li o PDF inteiro). Regras de desenquadramento, prazos, multa de R$ 50 e limites:
[Manual do Desenquadramento do SIMEI](https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_DESENQUADRAMENTO_SIMEI.pdf) e
[Perguntas e Respostas MEI e Simei](https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/perguntaomei.pdf), ambos da Receita Federal. Impedimentos do MEI: Lei Complementar 123/2006, art. 18-A
([planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm)). Valor do DAS em 2026: [Receita Federal](https://www8.receita.fazenda.gov.br/simplesnacional/noticias/NoticiaCompleta.aspx?id=c3b2044c-ff97-432a-b33c-ecf2a3df6dc3).
Código de software e anexo do Simples: [CNAE 6311-9/00](https://www.contabeis.com.br/ferramentas/simples-nacional/6311900/), [CNAE 6203-1/00](https://agilize.com.br/artigos/cnae-6203100-o-que-e/), [CNAE para SaaS](https://www.meucontadoronline.com.br/blog/cnae-software-servico-saas-guia-completo/)
(fontes de mercado, **o contador confirma**). Preço de contabilidade: [Agilize](https://agilize.com.br/artigos/preco-contabilidade-sao-paulo-2026/), [Contabilizei](https://www.contabilizei.com.br/quanto-custa-contabilizei/).
Obrigações da ME: [Agilize](https://agilize.com.br/artigos/obrigacoes-contabeis-mensais-simples-nacional/). Reforma tributária no Simples: [Contabilizei](https://www.contabilizei.com.br/reforma-tributaria/artigo/simples-nacional-reforma-tributaria/).
Custos, funil e cenários: `docs/88` e `docs/modelo-financeiro-ciclo.xlsx`. Calendário e decisões: `docs/87`.
