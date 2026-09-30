# 88 · Custos, previsão de retorno e metas de rua — do alpha a 2028

> **Escrito em 2026-09-30.** Pedido do Eduardo: revisar o que foi feito nas últimas 24 h (inclusive o que
> a outra sessão deixou nos `docs/86` e `docs/87` quando os tokens acabaram), levantar quanto o CICLO custa
> por mês, quanto deve voltar, quantos clientes cabem sem pagar mais Supabase e Vercel, e fixar metas de
> rua, abordagem, oferta e conteúdo. Este documento **refina** o `docs/87` (calendário e decisões) e o
> `docs/56` (prospecção). Não os substitui.
>
> **Junto vai a planilha `docs/modelo-financeiro-ciclo.xlsx`** (3.674 fórmulas, 3 cenários, 27 meses). Todo
> número desta página sai dela. Mude as células azuis e tudo recalcula. Foi conferida contra uma réplica em
> Python escrita sem olhar a planilha: bateu nos 27 meses, no centavo.
>
> Legenda: **[M]** medido no banco ou no código · **[P]** preço ou dado público conferido em 28 a 30/09/2026 ·
> **[E]** estimativa minha · **[H]** hipótese de funil, que só o campo confirma.

---

## 0 · Se você só ler isto

1. **Custo em dinheiro: R$ 433 por mês, fixo** (R$ 235 de infraestrutura, R$ 195 de contabilidade, R$ 3 de domínio),
   **mais R$ 25 por dia de rua** e **R$ 4.300 uma vez só** (CNPJ, marca, revisão jurídica, material). **O ponto de equilíbrio é 8 pagantes**
   (5 se a contabilidade já for paga por um CNPJ seu). Tirei da conta o INSS do pró-labore (é seu, não do produto), o e-mail próprio e o material mensal (eram chutes meus).
   O `docs/18` (agosto) dizia 5 com Vercel grátis e Supabase a US$ 10; os dois planos Pro custam R$ 235, e isso já não vale.
2. **Previsão (cenário Base): 6 pagantes no lançamento, 33 em jun/27, 58 em dez/27, 93 em dez/28.** Receita bruta de R$ 3.455 por mês em dez/27.
   **No azul em mai/27. O caixa acumulado volta ao positivo em jan/28**, e a maior exposição é de **R$ 8,5 mil**: é o que você precisa
   poder bancar. Pessimista: nunca se paga no horizonte (−R$ 19 mil). Otimista: no azul em mar/27, caixa positivo em ago/27.
3. **O que decide o resultado não é falar com mais gente.** Com **12 abordagens por dia** você já enche o teto de 40 contas por mês. Passar de
   12 para 20 não muda nada. O que mexe é: **conversão da cortesia em assinatura** (15% → 20% adianta o retorno em 3 meses e soma R$ 24 mil em dez/28), **quantas contas
   você aguenta atender por mês** (20 em vez de 40 leva o retorno para out/28) e **preço** (+R$ 10 no Solo e +R$ 20 no Equipe adiantam 2 meses e
   somam R$ 15 mil em dez/28).
4. **Infraestrutura:** com **US$ 45 por mês** (Vercel Pro + Supabase Pro) cabem **cerca de 250 contas** sem nenhum acréscimo. O custo por conta cai de
   R$ 23,50 (10 contas) para R$ 2,35 (100) e R$ 0,53 (1.000). Os planos grátis só seguram **17 contas** (Supabase) ou **29** (Vercel, pela CPU),
   e nenhum dos dois pode ser usado com cliente pagando: a Vercel Hobby é não comercial e a Supabase grátis não tem backup.
5. **Achei promessa velha que contradiz o `docs/87`:** "grátis pra sempre" no roteiro do Instagram e nas imagens `post-02`/`post-05`, e "Essencial R$ 49
   travado para sempre" no kit de visita. **Não publique antes de corrigir.** Corrigi os textos (§1.3); as duas imagens ficam de fora.

---

## 1 · O que revisei

### 1.1 O que foi feito (28 a 30/09)

| Bloco | Estado | Onde |
|---|---|---|
| Onboarding e migração de outro sistema (docs/83, P0 a P6) | feito, verificado no navegador | commits `007bb25d` a `e62d6023` |
| Dados e inteligência (docs/84): demanda não atendida, mapa de vazamento, serviço canônico, memória do cliente, experimentos | feito; **pipeline agregado de fora, de propósito** (espera o advogado) | `94bf264e`, `ba4abe1d`, `4fefe4ad`, `b6676bb7`, `5ccbbe39` |
| Motor de Inteligência no lugar do Gemini (docs/85, MI-1 a MI-7 e o "resolve") | feito | `4e3b9f7c` a `49bc97f8` |
| Plano jurídico (docs/86) e lançamento com 2 meses grátis (docs/87), com as decisões D0 a D6 | escrito | `a4f4ceab`, `0560ab87` |
| **Cortesia no código** (docs/87 §3, item 4 do P0) | **não existe** [M]: nada no código lê ou concede o benefício | é o próximo ticket de código |
| **Publicação** (item 1 do P0) | **109 commits à frente da `main`** [M], 97 migrations no disco, nada enviado | depende de você (`db push` e fusão) |

### 1.2 O que o `docs/87` deixou para verificar, e o que consegui

| Ponto | Resultado |
|---|---|
| Plano da Vercel em produção | **Não confirmado, mas tudo indica Hobby.** O time STARK tem 21 projetos e a API de cobrança não devolve nenhum gasto em ago e set/26. Confirme no painel |
| Plano da Supabase em produção | **Não consegui ver.** O conector da Supabase desta sessão está ligado a outra conta (projetos da Bruna), não à do CICLO |
| Preço de Vercel Pro (US$ 20 por usuário) e Supabase Pro (US$ 25) | **Confirmado** nas páginas oficiais em 30/09 |
| Vercel Hobby é só uso não comercial | **Confirmado** na página de preços |
| Supabase grátis não tem backup e pausa após 1 semana sem uso | **Confirmado** |
| Upstash (Redis) | **Não está em produção** [M]: o limite de requisições roda no próprio Postgres (`rate-limit.ts`). Sai da conta de custo |
| Taxa do Mercado Pago na assinatura | **Não confirmado.** A tabela oficial bloqueia leitura automática. O código usa `preapproval`, que é **cartão** recorrente, e o `docs/18` calculou com a taxa do **Pix** (0,99%). Fontes de terceiros dizem 2% a 5% para cartão. O modelo usa 4%. O efeito é pequeno (cerca de R$ 1,70 por assinatura), mas confira no painel quando a conta CNPJ existir |

### 1.3 O que encontrei e mexi

- **Ponto de equilíbrio do `docs/18` (5 assinantes) está desatualizado: é 8** (4 se o Vercel e o Supabase Pro já forem pagos por outros projetos da Stark; 5 se só a contabilidade já for paga por outro CNPJ seu).
- **"Grátis pra sempre" contradiz o `docs/87` D1** (o plano grátis deixa de ser vendido em D0). Estava em `docs/marketing/roteiro-lancamento-instagram.md` (2 CTAs) e `docs/runbooks/kit-de-visita.md` (oferta antiga). **Corrigidos neste commit.** As imagens `post-02-gratis-para-sempre.png` e
  `post-05-comece-de-graca.png` continuam na pasta e **não devem ir ao ar**. As séries v5 a v8 dos carrosséis e o `BRIEF-carrossel-diferencial.md` já evitam a frase.
- **A tela `/precos`, `src/lib/planos-cartoes.ts` e a landing ainda dizem "para sempre"** [M]. Isso só some com o ticket da cortesia (docs/87 §3.2). **Nenhuma peça pública pode sair antes dele.**
- **O teto de 40 contas (docs/87 D4) e o ponto de equilíbrio (8) não conversam sozinhos.** 40 contas a 15% dão 6 pagantes em 11/01, abaixo do que cobre o custo. O que salva é o fluxo depois do lançamento (21 dias de teste por conta nova). Está modelado; o efeito é o "só no azul em mai/27".
- **Hobby não aguenta a janela pública mesmo se fosse permitido.** Pelas 4 horas de CPU do plano, cabem uns **29 contas** [E]. A janela pública vai a 25 em 09/11 e 40 em 23/11. Some ao veto de uso comercial: **Vercel Pro antes de 09/11**, como o docs/87 E2 já pedia (antes do alpha).

---

## 2 · O que o CICLO custa por mês

### 2.1 Fixo, em dinheiro (estável a partir do alpha)

| Item | R$/mês | Base | Fonte |
|---|---|---|---|
| Supabase Pro (US$ 25, já inclui US$ 10 de computação) | 130,50 | [P] | supabase.com/pricing |
| Vercel Pro (US$ 20, 1 usuário, inclui US$ 20 de uso) | 104,40 | [P] | vercel.com/pricing |
| Contabilidade **extra** (ME no Simples; o MEI não pode ter software, ver `docs/89`) | 195,00 | [P] online para ME de serviços: R$ 189 a R$ 329 (Contabilizei a partir de R$ 195, Agilize a partir de R$ 259) | **R$ 0 se o CICLO rodar num CNPJ que você já tem, com contador** |
| Domínio `seuciclo.com.br` (R$ 40 por ano) | 3,33 | [E] | registro.br |
| **Total fixo** | **433,23** | | câmbio R$ 5,22 por US$ (28/09) |

**Ficaram de fora de propósito:** o INSS do pró-labore (R$ 178: é a sua contribuição, não custo do produto; a planilha tem a célula para ligar), o e-mail próprio (R$ 30, dá para usar gratuito) e o material mensal (R$ 100, era chute; o material único já está nos R$ 4.300). Com os três de volta, o fixo vai a R$ 742, o equilíbrio a 14 pagantes e o retorno do caixa a mar/28.

**Se a Stark já paga Vercel Pro e Supabase Pro por outros projetos**, o custo do CICLO cai para cerca de R$ 250 (só a computação de US$ 10 do projeto e a contabilidade), e o equilíbrio para **5 pagantes**. Vale conferir quantos dos 21 projetos da Vercel são seus e quais têm cobrança.

### 2.2 Variável e por degrau

| Item | Quando começa | R$/mês |
|---|---|---|
| Rua: transporte, estacionamento, café | por dia de prospecção (20 dias por mês) | 25 por dia, cerca de 500 |
| Resend Pro (US$ 20; grátis até 3.000 e-mails e 100 por dia) | acima de ~120 contas [E] | 104 |
| Sentry Team (US$ 26; grátis até 5.000 erros) | acima de ~100 contas [E] | 136 |
| Supabase Small (+US$ 5) / Medium (+US$ 50) / Large (+US$ 100) | ~150 / ~400 / ~1.000 contas [E] | 26 / 261 / 522 |
| Taxa do cartão (4%, estimada) e do Pix (0,99%) | sobre cada assinatura | ~R$ 2,27 por assinatura de R$ 61,50 |
| Simples Nacional (Anexo III, 6%) | sobre cada assinatura | R$ 3,69 por assinatura de R$ 61,50 |
| hCaptcha, GitHub Actions (repositório público), Upstash | não pagos | 0 |

**Dois degraus evitáveis:** o Sentry grátis segura se você filtrar ruído e o Resend grátis segura enquanto e-mail for só cadastro e senha. Juntos custam R$ 240 por mês e entram no primeiro trimestre de 2027 (o custo total sobe de R$ 933 em jan/27 para R$ 1.199 em mar/27, com o Sentry em fev e o Resend e o Supabase Small em mar).

### 2.3 Uma vez só (R$ 4.300) [E]

CNPJ, certificado digital e taxas R$ 500 · busca e depósito de marca no INPI R$ 400 · revisão jurídica do dossiê R$ 3.000 (orçar) · material de visita e brindes R$ 400.

### 2.4 O seu tempo (não sai do caixa, mas é o maior custo)

No cenário Base, **cerca de 155 horas por mês em jun/27** (rua, implantação de conta, suporte). É um emprego de tempo integral. Contando a R$ 50 por hora (o valor do `docs/18`), o CAC de cada pagante é **R$ 1.320, contra R$ 89 em dinheiro**. Por isso o LTV/CAC dá 0,58: **a prospecção de rua, sozinha, paga menos que o valor da sua hora.** A saída não é parar de ir à rua. É gastar menos horas por pagante: mais conversão, menos implantação por conta (o `docs/83` já mexeu nisso) e canais que trabalham sem você (parceiro, indicação).

---

## 3 · Quantos clientes cabem sem pagar mais

Medi o banco: **um agendamento pesa 0,8 KB e um cliente 1,2 KB** com índices novos [M] (copiei as tabelas para um schema descartável; as tabelas de teste
mostravam 11 KB por agendamento, inchadas por linhas apagadas). Somando previsão, auditoria e comanda, uso **5 KB por agendamento** como teto seguro [E].
Uma conta com 400 agendamentos por mês cresce **2 MB por mês**; aos 12 meses pesa **24,5 MB** no banco.

| Contas | Banco | Vercel | Supabase | Total | Por conta |
|---|---|---|---|---|---|
| 10 | 0,3 GB | US$ 20 | US$ 25 | R$ 235 | **R$ 23,50** |
| 40 | 1,0 GB | US$ 20 | US$ 25 | R$ 235 | R$ 5,87 |
| 100 | 2,5 GB | US$ 20 | US$ 25 | R$ 235 | **R$ 2,35** |
| 250 | 6,1 GB | US$ 20 | US$ 30 | R$ 261 | R$ 1,04 |
| 500 | 12,0 GB | US$ 20 | US$ 76 | R$ 499 | R$ 1,00 |
| 1.000 | 24,0 GB | US$ 24 | US$ 77 | R$ 526 | **R$ 0,53** |
| 2.000 | 47,9 GB | US$ 48 | US$ 130 | R$ 927 | R$ 0,46 |

**Resposta direta:** com os dois planos Pro (US$ 45), **cabem cerca de 250 contas antes de qualquer acréscimo**. O banco de 8 GB incluído segura ~330 contas de 12 meses de idade,
e depois cobra centavos (US$ 0,125 por GB). O que sobe de verdade é a **computação da Supabase** (Micro incluso, Small +US$ 5, Medium +US$ 50), e ela não foi medida com carga: **[E]**.
Regra de vigia: subir de degrau quando a CPU passar de 70% ou o cache de leitura cair de 99%.

**Nos planos grátis** (a conta que você pediu): Supabase Free segura **17 contas** (500 MB), a Vercel Hobby **29** pela CPU (4 h) ou **100** pelas chamadas (1 milhão), mas
o primeiro **não tem backup e pausa** sem uso e o segundo **veda uso comercial**. Serve só para demonstração. **Cliente pagando, ou testando com dado real, é Pro.**

**Premissas que valem medir depois do alpha** (troque na aba Infra): 10 mil chamadas por conta por mês e 50 ms de CPU por chamada. Se o real for o dobro, o custo de uso ainda é centavos por conta.

---

## 4 · Quanto deve voltar

### 4.1 O funil, com a origem de cada número

| Etapa | Pessimista | Base | Otimista | Origem |
|---|---|---|---|---|
| Dono aceita conversar de verdade (5 min ou mais) | 40% | 55% | 70% | [H] |
| Cria a conta na hora ou em 48 h | 20% | 30% | 40% | [H]; 2 meses grátis, sem cartão, cadastro assistido |
| Ativa (importa a base e chama alguém em 14 dias) | 45% | 55% | 65% | [H] docs/87 §5 |
| **Vira pagante no lançamento, das contas criadas** | 8% | **15%** | 25% | **[P]** teste sem cartão: mediana 14%, faixa 8% a 22% (Userpilot, ShNo, First Page Sage; um estudo de 2026 chega a 25%) |
| Cancelamento mensal de quem paga | 6% | 4% | 2,5% | **[P]** SaaS de pequena empresa: 3% a 5% ao mês, média 4,5% (RetentionCheck, 2026) |
| Pagantes no plano Solo | 80% | 75% | 65% | [H] |

Só **duas linhas são dado de fora** (conversão e cancelamento). O resto é hipótese e vai sendo trocado pelo medido: o alpha de 10 contas já dá a primeira leitura das três primeiras etapas.

### 4.2 O resultado

| | Pessimista | **Base** | Otimista |
|---|---|---|---|
| Pagantes em 11/01/27 (lançamento) | 3 | **6** | 10 |
| Pagantes em jun/27 | 9 | **33** | 56 |
| Pagantes em dez/27 | 14 | **58** | 105 |
| Pagantes em dez/28 | 20 | **93** | 182 |
| Receita bruta mensal em dez/27 | R$ 826 | **R$ 3.455** | R$ 6.718 |
| Receita bruta mensal em dez/28 | R$ 1.184 | **R$ 5.668** | R$ 11.927 |
| Resultado operacional em dez/27 | −R$ 304 | **+R$ 1.836** | +R$ 4.782 |
| Primeiro mês no azul | depois de dez/28 | **mai/27** | mar/27 |
| Caixa acumulado volta ao positivo | depois de dez/28 | **jan/28** | ago/27 |
| **Maior exposição de caixa** | −R$ 18.835 | **−R$ 8.477** | −R$ 7.458 |
| Caixa acumulado em dez/28 | −R$ 18.835 | **+R$ 33.865** | +R$ 106.128 |
| Retorno sobre o total gasto (27 meses) | −53% | **+88%** | +277% |
| Receita líquida por pagante (depois de taxa e imposto) | R$ 53,28 | R$ 55,54 | R$ 60,05 |
| LTV (com o seu tempo de suporte descontado) | R$ 471 | R$ 763 | R$ 1.402 |
| CAC em dinheiro / com o seu tempo | R$ 331 / R$ 3.943 | R$ 89 / R$ 1.320 | R$ 53 / R$ 791 |
| LTV ÷ CAC (com tempo) | 0,12 | 0,58 | 1,77 |

**Leitura honesta:** no Base o CICLO se paga e dá lucro, mas **só depois de 16 meses de caixa negativo** e com o seu tempo de graça. Só no Otimista o negócio remunera a sua hora.
No Pessimista **não se paga**: esse é o cenário que define quanto você pode perder antes de mudar de plano (§8).

### 4.3 O que mais mexe no resultado (cada linha muda uma coisa e mantém o resto do Base)

| Se... | Pagantes dez/27 | Caixa dez/28 | Exposição | No azul | Caixa positivo |
|---|---|---|---|---|---|
| **Base** | 58 | R$ 33.865 | −R$ 8.477 | mai/27 | jan/28 |
| Conversão da cortesia 20% (era 15%) | 78 | R$ 58.017 | −R$ 7.896 | abr/27 | **out/27** |
| Conversão da cortesia 10% | 39 | R$ 9.760 | −R$ 9.687 | jul/27 | **jul/28** |
| **Aguenta 60 contas novas por mês** (era 40) | 68 | R$ 44.558 | −R$ 8.396 | abr/27 | dez/27 |
| **Só aguenta 20 contas novas por mês** | 31 | R$ 3.205 | −R$ 9.328 | ago/27 | **out/28** |
| **Preço Solo R$ 59 e Equipe R$ 119** | 58 | R$ 48.535 | −R$ 8.087 | abr/27 | nov/27 |
| Cancelamento de 6% (era 4%) | 52 | R$ 25.259 | −R$ 8.521 | mai/27 | fev/28 |
| Cancelamento de 2,5% | 63 | R$ 41.555 | −R$ 8.443 | mai/27 | dez/27 |
| Teto de cortesia de 60 (era 40) | 60 | R$ 35.829 | −R$ 8.086 | abr/27 | dez/27 |
| Abordagens: 6 por dia (era 12) | 40 | R$ 13.297 | −R$ 8.893 | jul/27 | mai/28 |
| Abordagens: 20 por dia | 58 | R$ 34.141 | −R$ 8.477 | mai/27 | jan/28 (**igual**) |
| Parceiros e conteúdo: 20 por mês (era 6) | 58 | R$ 34.141 | −R$ 8.477 | mai/27 | jan/28 (**igual**) |
| Simples no Anexo V (15,5%) | 58 | R$ 26.272 | −R$ 8.748 | mai/27 | fev/28 |
| Contabilidade a R$ 259 (Agilize) | 58 | R$ 32.137 | −R$ 8.925 | mai/27 | jan/28 |
| **Sem contabilidade extra** (já tem CNPJ e contador) | 58 | R$ 39.130 | −R$ 7.215 | abr/27 | nov/27 |
| Com o INSS do pró-labore (R$ 178) | 58 | R$ 29.051 | −R$ 9.725 | mai/27 | fev/28 |
| Com INSS, e-mail e material (a conta antiga) | 58 | R$ 25.541 | −R$ 10.746 | jun/27 | mar/28 |

**As três alavancas, em ordem:** (1) **conversão**, (2) **capacidade de atender conta nova** e **preço**, (3) cancelamento. **Mais abordagens, mais parceiros e mais indicação não movem nada
enquanto o teto de 40 contas por mês estiver cheio**, porque a demanda já passa dele (o modelo joga o excesso na fila de espera). O que essas frentes fazem é **encher o funil de graça quando você
subir a capacidade**, então valem como preparo, não como meta de hoje.

---

## 5 · Metas de rua

### 5.1 A regra que sai da conta

Com os números do Base, **12 abordagens por dia** (dono presente, 1 a 3 profissionais) geram 132 conversas por mês, cerca de 40 contas, e enchem o teto. **A meta diária é 12, cinco dias por semana, uns 4 horas de rua.** Abaixo de 6 por dia o retorno atrasa
4 meses. Acima de 12 é esforço perdido, a menos que a sua capacidade de implantação suba.

| Por semana (Base) | Meta |
|---|---|
| Abordagens qualificadas | **60** (12 por dia) |
| Conversas de verdade | 33 |
| Contas criadas | **10** |
| Contas ativas (base importada e 1 chamada em 14 dias) | 5 a 6 |
| Pagantes no lançamento | 1,5 por semana |

### 5.2 Por fase

| Fase | Datas | Meta | Como |
|---|---|---|---|
| **Alpha** | 26/10 a 06/11 | **10 contas convidadas** por você | rede pessoal, sem prospecção fria. Cada uma com a base importada em 48 h |
| **Fila da onda 1** | fim de outubro | mais 15 (total 25 em 09/11) | **12 por dia, uns 8 dias de rua**, marcando as visitas para a abertura pública |
| **Janela pública, ondas 1 e 2** | 09/11 a 22/11 | mais 15 (total 40, o teto) | **12 por dia, uns 7 dias de rua**; o teto de 40 enche e a rua fria para |
| **Fila de espera** | 23/11 a 12/12 | quem chegar depois entra **na lista de janeiro** (21 dias de teste) | só anotar nome e contato |
| **Dezembro** | até 21/12 | **parar a rua fria** | visita de retorno às contas ativas (o "quantos voltaram?"), conteúdo, parceiros. Cobrança real de teste (Portão 1) |
| **Lançamento** | 11/01/27 | **6 pagantes** (Base) e o toque de assinar em cada conta | mensagem pessoal na semana de 04/01 com o número do próprio salão |
| **Jan a jun/27** | | **40 contas novas por mês**, 33 pagantes em jun | 12 por dia; o alvo é ativação, não volume |
| **Jul a dez/27** | | 58 pagantes, no azul | sobe capacidade (canais, autoatendimento) antes de subir esforço |

*(O modelo põe as 25 primeiras contas em outubro; na prática elas entram entre o alpha e a onda 1. Como todas decidem em 11/01, o resultado quase não muda.)*

**Custo em tempo do teto:** a 40 contas novas por mês você gasta **60 horas só implantando** (1,5 h por conta), mais 15 a 30 de suporte a pagantes e 80 de rua. Se a implantação cair para 0,5 h por conta (importador melhor, roteiro de WhatsApp), sobram 40 horas por mês e o teto pode subir para 60, que adianta o retorno em 1 mês e soma R$ 11 mil em dez/28.

### 5.3 Placar semanal (segunda-feira, 10 minutos)

`docs/runbooks/placar-de-distribuicao.md` já tem as consultas. Cinco números, sempre comparados com a coluna Base:

1. abordagens · 2. contas criadas · 3. **contas ativas** · 4. chamadas feitas · 5. **clientes que voltaram**.

Regra: **se a ativação (nº 3 ÷ nº 2) ficar abaixo de 45% por 2 semanas, pare de prospectar e conserte a implantação.** Conta que não ativa também não paga.

---

## 6 · Estratégia de abordagem

**Quem:** barbearia e salão pequeno, 1 a 3 profissionais, num raio que dá para fazer a pé (`docs/56` §1, `docs/87` D4). **Quem não:** clínica de estética e qualquer um com anamnese pesada, até o RIPD e o parecer.
**Quando:** fim de tarde de segunda e início de tarde de terça. Nunca sábado.

### 6.1 Os 10 minutos (atualizados para os 2 meses grátis)

1. **Abertura, uma conta de um minuto na calculadora**, no celular dele: "Posso te fazer uma conta? Quantos clientes que vinham sempre pararam de vir, só os que você lembra?" (`kit-de-visita.md`)
2. **A virada:** "E essa conta é só de quem você lembrou." Silêncio. "E quem você não lembra?"
3. **A oferta, em uma frase:** *"Você usa o CICLO inteiro por 2 meses, sem cartão. Eu passo seus clientes pra dentro pelo WhatsApp. No fim, você decide se assina. Se não quiser, exporta tudo e some."*
4. **Cadastro assistido:** 10 a 20 clientes com a data aproximada da última visita ("Colar uma lista"). A lista de quem já passou da hora aparece na hora.
5. **Uma mensagem, na frente dele**, pelo WhatsApp dele, com o texto pronto.
6. **Saída:** "Volto daqui a 10 dias pra gente ver quem voltou." Marque a data.

### 6.2 Depois da visita

| Quando | O quê |
|---|---|
| D+2 | WhatsApp: "Mandou a mensagem pra alguém da lista?" (esquecer é a causa nº 1) |
| D+7 | "Sua lista tem N pessoas que passaram da hora. Quer que eu olhe com você 10 minutos?" |
| **D+10 a 14** | **Visita de retorno. Pergunta única: "Quantos dos que você chamou voltaram?"** Voltou alguém: peça o depoimento (autorização por escrito) e a indicação |
| D-14, D-7, D-1 do lançamento | aviso (faixa e e-mail) e **mensagem pessoal com o número do salão**: "dos N que o CICLO previu, M voltaram" |
| D0 | convite de assinar, um toque. **Nunca converter sem o toque** (docs/87 E5) |

### 6.3 Objeções, na ordem em que aparecem

| Ele diz | Você responde |
|---|---|
| "Já uso AppBarber, Trinks…" | "Não precisa trocar. Use junto: o CICLO só mostra quem sumiu." (docs/83 §5.4) |
| "Vai me cobrar depois?" | "Só se você tocar em assinar. Sem cartão. Se não tocar, a conta só lê e exporta." |
| "Quanto custa depois?" | "R$ 49 com 1 profissional, R$ 99 até 5. Quem assina até 30 dias depois do lançamento trava esse preço por 12 meses." |
| "Não tenho tempo" | "São 5 minutos e você já sai com a lista. Eu importo o resto." |
| "Meus clientes não respondem WhatsApp" | "A mensagem sai do seu WhatsApp, do seu número. É o mesmo canal que você já usa." |
| "Isso manda sozinho?" | "Hoje você manda com um toque. Automático vem depois." **Sem data.** |

---

## 7 · O que oferecer

| Oferta | Regra |
|---|---|
| **60 dias de tudo liberado, sem cartão** (cadastro até 12/12; depois 21 dias) | docs/87 D1 e D3 |
| **Você importa a base dele pelo WhatsApp e apaga a planilha do celular depois** | docs/83, docs/84 §2.5 |
| **Preço travado por 12 meses** para quem assina até 30 dias depois do lançamento | docs/87 D5. **Sem desconto, sem "para sempre"** |
| **Exporta tudo quando quiser** | promessa dos termos; já existe o botão (docs/83 P3) |
| **Não oferecer:** desconto, WhatsApp automático, data de nada, "grátis pra sempre", comparação nomeando concorrente | `docs/56` §6 |

**Preço.** Mantenha R$ 49 e R$ 99 no lançamento (docs/87 D2: não mexer antes de 30 pagantes ou 3 meses de cancelamento). **Depois disso, teste R$ 59 e R$ 119 só para quem chega**: no modelo isso adianta o retorno em 2 meses e soma R$ 15 mil em dez/28,
e o `docs/18` F.7 já mostrava que R$ 59 tem margem 45% maior e continua abaixo do Trinks.

**Plano anual no lançamento** (R$ 490 e R$ 990 por ano; `docs/18` §E.5 e `docs/27` P3): é o que cobre o caixa. Dez assinantes anuais pagam a contabilidade do ano no primeiro mês. Não está no modelo (é ganho de caixa, não de resultado); **é a melhor forma de reduzir os R$ 8,5 mil de exposição.**

**Parceiros** (contador, representante de cosmético, escola de barbeiro; `kit-de-visita.md`): R$ 50 por conta que virar pagante. Com LTV de R$ 763, é 6,5% dele. **Meta: 5 contatos de parceiro por semana**, medidos por `?origem=parceiro&ref=<código>`. Só entra no resultado quando a capacidade subir (§4.3).

---

## 8 · Conteúdo e lançamento

**Foco em duas mensagens só:** (1) **"quem sumiu tem nome e tem valor"** e (2) **"60 dias de tudo liberado, sem cartão"**. O resto é apoio.

| Pilar | Peso | Peças prontas (`docs/runbooks/roteiros-de-conteudo.md`) |
|---|---|---|
| Dor com número (a conta ao vivo) | 40% | `reel-conta-do-barbeiro`, `reel-quem-voce-nao-lembra` |
| Produto em uso (tela da conta de demonstração, nunca de cliente real) | 30% | `reel-lista-pelo-nome`, `reel-caderno-vs-lista` |
| Pesquisa e bastidor | 20% | `story-enquete-agenda`, `story-caixinha-ritmo` |
| Prova local, **só com autorização e só depois do primeiro retorno** | 10%, sobe depois | `reel-primeiro-depoimento`; `carrossel-ritmo-da-cidade` só com 5 contas reais |

**Cadência: 3 posts por semana e stories nos dias de rua** (`docs/56` §7.2). Tempo: 6 a 8 horas por semana. **Instagram não fecha venda; aquece a porta em que você vai bater.** Trate como apoio: nenhum cenário do modelo conta post como fonte de conta.

**Toda peça leva `?origem=conteudo&ref=<código>`.** Peça que não traz ninguém em 2 semanas não volta.

**Antes de qualquer post: trocar o CTA.** "Grátis pra sempre em um profissional" vira **"60 dias de tudo liberado, sem cartão"**. As imagens `post-02` e `post-05` e a `/precos` ficam fora até a cortesia entrar no código.

### Calendário

| Semana | Foco | Conteúdo |
|---|---|---|
| **30/09 a 25/10** | fechar P0, alpha | **nenhum post público.** Bastidor só nos stories, sem oferta |
| **26/10 a 08/11** | alpha rodando | 1 reel de produto em uso; enquete no story sobre como marcam horário |
| **09/11 a 22/11** | janela pública, onda 1 | série dos 5 vídeos do `roteiro-lancamento-instagram.md` (com CTA corrigido) + a conta ao vivo |
| **23/11 a 12/12** | onda 2 | primeiro depoimento (se alguém voltou); **Black Friday é só para observar** |
| **13/12 a 03/01** | pico do salão, sem cobrança | menos volume; conteúdo de "quem sumiu em janeiro"; mensagens pessoais |
| **04/01 a 11/01** | lançamento | prestação de contas: "dos N previstos, M voltaram", com o número de cada salão |

**Imprensa local** (`docs/runbooks/pauta-para-imprensa-local.md`): uma pauta só, depois de 5 contas reais e um dado da cidade.

---

## 9 · Riscos e regras de parada

| Gatilho | Ação |
|---|---|
| Ativação abaixo de 45% por 2 semanas | parar a rua fria, consertar a implantação |
| **Menos de 7 dos 10 do alpha** com base importada em 48 h | a janela pública não abre (docs/87 §2.3) |
| Suporte acima de 1 h por semana por conta | o teto de 40 cai para 25 (docs/87 D4) |
| **Conversão da cortesia abaixo de 8% em 25/01** (14 dias depois do lançamento) | **não subir capacidade**; entrevistar os que não assinaram; revisar oferta |
| **Menos de 20 pagantes em jun/27** (Base: 33; Pessimista: 9) | plano B: rua 3 dias por semana, foco em retenção e canais, cortar Sentry e Resend |
| Exposição de caixa passar de **R$ 9,8 mil** | congelar gasto; só o fixo |
| CNPJ não sai até 06/11 | adiar a janela pública e o lançamento juntos (docs/87 §2.3) |
| Cancelamento acima de 6% por 2 meses | pesquisa de saída antes de mexer em preço |

**Reserva de caixa recomendada: R$ 9,8 mil** (a exposição do Base mais 15%). O Pessimista pede R$ 19 mil, e a sua regra de parada acima existe para você não chegar lá.

---

## 10 · O que eu preciso de você

1. **Quanto de caixa você pode bancar?** R$ 9,8 mil cobre o Base; o Pessimista pede R$ 19 mil.
2. **Você já tem CNPJ com contador?** Você tem MEI, e o MEI não tem contador (`docs/89`). Se você já tiver um contador de confiança que aceite o CICLO, a contabilidade extra pode cair, e o equilíbrio de 8 para 5 pagantes.
3. **Vercel e Supabase da Stark:** quais dos 21 projetos são seus e quais já têm plano Pro? Isso leva o equilíbrio de 8 para 4.
4. **Plano anual no lançamento** (R$ 490 e R$ 990)? Recomendo que sim: é o que reduz a exposição.
5. **Teste de preço R$ 59 e R$ 119** para quem chega depois dos 30 pagantes? Recomendo que sim, respeitando o docs/87 D2.
6. **Parceiros com R$ 50 por conta paga:** aprova o valor?
7. **Confirmar no painel:** plano da Vercel e da Supabase de produção, taxa do cartão recorrente do Mercado Pago (quando existir a conta CNPJ), e a alíquota do Simples com o contador.

**Próximo passo de código que o `docs/87` deixou e eu posso fazer agora:** a cortesia (docs/87 §3, 1,5 a 2 dias). Sem ela nenhuma peça pública pode sair, a `/precos` continua dizendo "para sempre" e o cadastro não mostra a data de fim.

---

## 11 · Como usar a planilha

Abra `docs/modelo-financeiro-ciclo.xlsx`. **Azul é o que você muda; preto é fórmula; verde vem de outra aba.** Ela recalcula ao abrir (o Excel faz isso sozinho; visualizadores que não calculam mostram vazio).

| Aba | Para quê |
|---|---|
| Resumo | os três cenários lado a lado |
| Premissas | preços, câmbio, custos, funil por cenário |
| Calendario | dias de rua por mês, fases |
| Pessimista, Base, Otimista | a projeção mês a mês, 27 meses |
| Metas | "quantas abordagens por dia para chegar em R$ X por mês" |
| Infra | quantas contas cabem antes de pagar mais |

**Depois do alpha,** troque na coluna Base os quatro primeiros azuis do funil pelo que você mediu. É a primeira vez que o modelo deixa de ser hipótese.

## 12 · Fontes (conferidas em 28 a 30/09/2026)

Preços: [Supabase](https://supabase.com/pricing) e [computação](https://supabase.com/docs/guides/platform/compute-and-disk) · [Vercel](https://vercel.com/pricing) ·
[Resend](https://resend.com/pricing) · [Sentry](https://sentry.io/pricing/) · [hCaptcha](https://www.hcaptcha.com/pricing) · [Upstash](https://upstash.com/pricing/redis) ·
câmbio: [Bloomberg Línea](https://www.bloomberglinea.com.br/quote/USDBRL:CUR/) (28/09: R$ 5,2225). Conversão de teste sem cartão: [Userpilot](https://userpilot.com/blog/saas-average-conversion-rate/),
[ShNo](https://www.shno.co/marketing-statistics/free-trial-conversion-statistics), [B2B SaaS Trial Benchmarks](https://www.poweredbysearch.com/learn/b2b-saas-trial-conversion-rate-benchmarks/). Cancelamento de SaaS para
pequena empresa: [RetentionCheck](https://retentioncheck.com/churn-benchmarks/smb-saas). Taxa do Mercado Pago (Pix 0,99%): [Mercado Pago](https://www.mercadopago.com.br/blog/quanto-custa-receber-pagamentos-via-pix-e-codigo-qr);
a tabela de cartão recorrente **não pôde ser lida** e é estimativa. Internas: `docs/18`, `docs/27`, `docs/56`, `docs/82` a `docs/87`, `docs/runbooks/`.
