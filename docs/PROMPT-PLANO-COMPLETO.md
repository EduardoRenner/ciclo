# Prompt para o modelo mais forte: plano completo do CICLO

Cole tudo abaixo do risco. O modelo precisa ter acesso à pasta do repositório CICLO (`C:\Users\Usuario\.claude\code\ciclo`).

---

## Quem sou eu e o que quero

Sou o Eduardo, fundador solo do CICLO, um SaaS de agenda que mostra ao dono de barbearia e salão pequeno **quais clientes pararam de voltar, pelo nome**, com a mensagem pronta para chamar pelo WhatsApp dele. Não sou da área financeira: **escreva simples, curto, sem jargão**. Quando usar um termo técnico, explique na mesma frase. **Nada de parede de texto.**

Quero **um único plano completo** (custos, previsão, metas, abordagem, oferta, conteúdo, escala, cobrança e impostos), o **mais barato e rápido possível para escalar**. Se tiver dúvida que muda o plano, **pergunte antes de escrever**, no máximo 5 perguntas, curtas.

## Decisões que já tomei (não reabra)

1. **Prospecto desde agora**, sem esperar data de lançamento.
2. **1 mês grátis, sem cartão. Depois cobra**: **R$ 49** (1 profissional) ou **R$ 99** (até 5 profissionais). Tudo incluído nos dois.
3. **Continuo MEI no começo.** Sei que software não está na lista do MEI (li o Anexo XI da Resolução CGSN 140/2018: nenhum código 6201, 6202, 6203, 6204, 6209, 6311, 6319). Aceito o risco: a Receita desenquadra (vira ME, paga em percentual) e a multa é R$ 50 se eu não avisar. **Não cancela o CNPJ.** Viro ME quando o contador mandar ou perto de 30 a 40 pagantes; o teto do MEI (R$ 81 mil por ano, ~100 pagantes) força a mudança de qualquer jeito.
4. **Investimento inicial: R$ 0.** Já tenho CNPJ. Sem advogado, sem marca no INPI, sem certificado digital, sem material impresso.
5. **Sem contador no começo** (o MEI não precisa). Depois de virar ME: contador de ~R$ 195 por mês.
6. **Vercel Pro (R$ 105 por mês) e Supabase Pro (R$ 130 por mês) a partir do primeiro cliente pagando.** Até lá, só demonstração.
7. **Não conto como custo do produto:** INSS do pró-labore, e-mail próprio, material mensal. Já os removi uma vez porque eram chute meu. **Não os recoloque.**
8. **App nas lojas fica para depois de ter pagantes.** Dá com MEI e sem Mac (Apple aceita conta de pessoa física sem D-U-N-S; Google exige 12 testadores por 14 dias; build na nuvem com Codemagic ou Expo EAS).
9. **Sem anúncio pago.** **Sem WhatsApp automático** (o "Chamar" abre o WhatsApp do próprio dono).

## O que já foi feito (leia como base, confira, corrija se estiver errado)

Leia nesta ordem, na pasta do repo:

- `docs/90-PLANO-SIMPLES.md` (a versão mais nova, uma página)
- `docs/modelo-financeiro-ciclo.xlsx` (3 cenários em 27 meses; células azuis são premissas; **já está com as regras acima**)
- `docs/88-CUSTOS-PREVISAO-E-METAS-PLANO.md` e `docs/89-GUIA-SIMPLES-MEI-CUSTOS-E-PREVISAO.md` (mais longos; **onde discordarem do 90, vale o 90**)
- `docs/56-ESTRATEGIA-PROSPECCAO-LOCAL.md`, `docs/82-MOTOR-DE-DISTRIBUICAO.md`, `docs/87-LANCAMENTO-2-MESES-GRATIS-PLANO.md` (o 87 pressupunha 60 dias grátis e lançamento em 11/01/2027; **superado**)
- `docs/runbooks/kit-de-visita.md`, `roteiros-de-conteudo.md`, `placar-de-distribuicao.md`, `placar-do-piloto.sql`, `suporte-e-onboarding-assistido.md`, `pauta-para-imprensa-local.md`
- `docs/marketing/roteiro-lancamento-instagram.md` e `bio-e-link-da-bio.md`

**Números do plano atual** (confira e refine):

- Custo fixo **R$ 324 por mês** (Vercel Pro 105 + Supabase Pro 130 + DAS do MEI 86 + domínio 3), mais **R$ 25 por dia de rua**.
- **Equilíbrio: 6 pagantes.**
- Meta de rua: **12 abordagens por dia, 5 dias por semana** → ~60 abordagens, ~10 contas criadas, ~1,5 pagante novo por semana.
- Cenário do meio: **16 pagantes em jan/27, 41 em jun/27, 65 em dez/27, 97 em dez/28**; receita bruta R$ 3.900 por mês em dez/27.
- **Maior buraco: R$ 2.012 (jan/27).** Primeiro mês no azul: fev/27. Recupera tudo em jun/27. Reserva sugerida R$ 2,5 mil. Pior caso: perde ~R$ 10 mil em 2 anos.
- Cada assinante rende **~R$ 59 líquidos por mês** depois de taxa do Mercado Pago (~4%, **não verificada**) e do DAS.
- Infra: ~250 contas cabem com R$ 235 fixos; Supabase sobe perto de 150 contas (+R$ 26) e 400 (+R$ 261). Peso medido no banco: 0,8 KB por agendamento e 1,2 KB por cliente.
- **Palpites de funil** (a validar): 55% aceitam conversar, 30% criam conta, 55% ativam (importam a base e chamam alguém em 14 dias), 15% assinam (pesquisa de mercado: teste sem cartão converte em média 14%). Cancelamento 4% por mês (pesquisa: SMB SaaS 3% a 5%).
- **Alavancas medidas:** conversão da cortesia em assinatura, quantas contas novas consigo atender por mês (teto ~40) e preço. **Mais abordagens por dia não muda nada com o teto cheio.**
- **CAC contando o meu tempo:** ~R$ 1.300 por pagante contra LTV de ~R$ 860. A rua sozinha remunera menos que a minha hora; o plano precisa dizer como baixar isso (conversão, menos horas por conta, indicação, canais que trabalham sem mim).

## O que NÃO está resolvido (quero que você resolva ou pergunte)

- **A previsão precisa ser refeita para 1 mês grátis** e cobrança rolante, e conferida contra a planilha. Diga se 1 mês basta para o dono ver resultado (o ciclo de retorno de barba e corte é de 21 a 30 dias) e qual a queda provável de conversão. Proponha como medir isso nas 3 primeiras semanas.
- **Qual é o menor caminho para o primeiro pagante** (dias, não meses).
- **Cobrança:** hoje o código usa o Mercado Pago **preapproval** (cartão recorrente). Cartão recorrente em barbearia pequena vai converter? Compare com **Pix Automático** e **Pix combinado manual nos primeiros 10**. Diga o que muda na taxa (Pix 0,99%, cartão 2% a 5%, **não verificada**).
- **Escala barata:** como chegar a 100 pagantes sem contratar ninguém; o que automatizar primeiro (importação de base, suporte, cobrança); quando faz sentido o **plano anual** (R$ 490 e R$ 990) e o teste de preço **R$ 59 e R$ 119** para quem chega depois dos 30 pagantes.
- **Lacunas de produto que travam promessas:** não existe a página `/convite` (o "me manda que eu faço" exige o dono ao lado); "Excluir minha conta" apaga só o login; o código da cortesia ainda diz "60 dias" e "grátis para sempre" em `/precos`, `src/lib/planos-cartoes.ts` e na landing. Diga o que é obrigatório consertar **antes** do primeiro pagante e o que pode esperar.
- **Imposto real quando virar ME:** a fonte de mercado diverge se o código de SaaS cai no Anexo III (6%) ou V (15,5%). Diga o que perguntar ao contador e o efeito de cada resposta.

## Como trabalhar (obrigatório, antes de escrever qualquer coisa)

**Pense a fundo e pesquise de verdade.** Não escreva de primeira. Siga estas etapas e mostre o resultado de cada uma no fim, em poucas linhas:

1. **Estruture o problema.** Quebre o plano em blocos (oferta, cobrança e impostos, custos, funil, escala, produto, riscos). Para cada bloco, escreva a pergunta que ele precisa responder e o que decide a resposta.
2. **Leia o repositório** (arquivos acima). Confira no código o que o produto faz hoje: cobrança (`src/server/billing/mercado-pago.ts`), planos (`src/core/billing/planos.ts`, `src/lib/planos-cartoes.ts`), onboarding, exportação, exclusão de conta. **Não confie nos meus documentos: confirme no código.**
3. **Pesquise na web, em fonte primária primeiro** (Receita Federal e gov.br para MEI e imposto; páginas oficiais de preço para Supabase, Vercel, Mercado Pago, Apple e Google). Cada afirmação importante precisa de **link e data**. Pesquise pelo menos:
   - taxa **oficial** do Mercado Pago para assinatura recorrente no cartão e para Pix Automático (eu não consegui abrir a tabela oficial);
   - se o CNAE de SaaS cai no **Anexo III ou V** do Simples (fonte oficial, não blog);
   - conversão de teste gratuito de **1 mês sem cartão** em SaaS para pequena empresa no Brasil, e churn de ferramenta de gestão para salão e barbearia;
   - como concorrentes brasileiros de agenda para barbearia cobram e testam (só para calibrar preço, **sem nomear no texto público**);
   - taxa de resposta e conversão de **prospecção presencial e por WhatsApp** para pequeno comércio;
   - custo e regras de Apple Developer e Google Play em 2026.
4. **Ache o que está errado.** Liste onde os meus números, documentos ou hipóteses se contradizem, estão desatualizados ou não têm fonte. Corrija ou marque "não verificado".
5. **Compare alternativas** nas decisões que importam (cartão recorrente versus Pix; 1 mês versus 14 dias grátis; cobrar já no primeiro mês; ficar MEI versus virar ME agora) com **prós, contras e um número** para cada, e escolha uma com o motivo.
6. **Simule.** Recalcule a previsão para 1 mês grátis com cobrança rolante e mostre a conta. Rode **cenário pessimista, do meio e otimista** e a **sensibilidade** (o que mais mexe no resultado). Use a planilha ou um cálculo independente e diga se os dois batem.
7. **Ataque o plano.** Antes de entregar, escreva as **5 maiores razões pelas quais ele falha** e o que muda no plano por causa delas.
8. **Só então escreva o HTML.**

Se faltar informação que muda a decisão, **pergunte antes** (máximo 5 perguntas curtas). Se não muda, decida, diga que decidiu e por quê.

## Formato da resposta (importante)

Entregue **um único arquivo HTML autocontido**, no **mesmo formato do artifact de referência**: https://claude.ai/artifact/QmsuEH7TnXugfrMXa1wCLo ("Plano de distribuição"). Reproduza o **estilo e a estrutura**:

- Página única, largura máxima 700 px, mobile-first, tema claro com modo escuro automático (`prefers-color-scheme`), cores em variáveis CSS no `:root`.
- Fontes: **Fraunces** (títulos), **Work Sans** (texto), **IBM Plex Mono** (rótulos e códigos).
- Topo: linha `eyebrow` (ponto + "CICLO · plano"), `h1`, parágrafo `lede`, e uma caixa **north star** com a **métrica norte** (`cliente_voltou`: uma cliente que o Motor apontou e voltou).
- Navegação de âncoras em pílulas (`nav.jump`), rolagem horizontal.
- Seções separadas por um **divisor perfurado** (`.perf`), cada uma com `kicker` (rótulo pequeno), `h2` e `sectionlede`.
- Componentes: linhas com nota (`icprow`), passos numerados com fala em destaque (`steps` e `.say`), **cartões de chat** com bolhas (`chatcard`, `bubble`) para as mensagens de WhatsApp, cartões compactos de conteúdo (`ccard`), grade de métricas (`metricgrid`), plano por semana (`weekcard`), critérios de sucesso e de parada (`crit go` e `crit stop`), caixa de regras (`rulebox`), caixa de aviso (`warnbar`), atalhos (`linkgrid`), rodapé mono com as fontes.
- **Sem dependência externa além das fontes do Google.** Sem JavaScript obrigatório.

**Seções, nesta ordem** (cada uma curta):

1. **Em 5 linhas** (o resumo que um leigo entende; o que gasto, quando começo a ganhar, quanto preciso guardar)
2. **Quem e onde** (o alvo: barbearia e salão pequeno, 1 a 3 profissionais, onde já estão)
3. **A oferta** (1 mês grátis, R$ 49 e R$ 99, o que **não** oferecer)
4. **Cobrança e impostos** (MEI agora, quando virar ME, cartão versus Pix, o que perguntar ao contador)
5. **Custos** (por mês, em dinheiro; investimento R$ 0; quando o Vercel Pro e o Supabase Pro entram; quantas contas cabem)
6. **Previsão** (três cenários em palavras e em números; o buraco, o mês no azul, quando recupera; a reserva)
7. **Metas** (por dia, por semana, por mês; os degraus 6, 30, 60 e 100 pagantes)
8. **Abordagem** (visita, WhatsApp frio, indicação, parceiros; roteiro curto e mensagens prontas em bolhas de chat)
9. **Conteúdo** (2 mensagens só: "quem sumiu tem nome e valor" e "1 mês grátis, sem cartão"; cadência; nada que prometa o que não existe)
10. **Placar semanal** (5 números, com a regra de parada: ativação abaixo de 45% por 2 semanas)
11. **Plano dos primeiros 30 dias** (semana a semana, com critério de sucesso e de mudar de rumo)
12. **Escala** (do primeiro pagante a 100 sem contratar; o que automatizar primeiro; quando app nas lojas; quando virar ME)
13. **O que consertar no produto antes do primeiro pagante** (lista curta, em ordem)
14. **Riscos e regras de parada** (cada um com número)
15. **Nunca faça** (caixa de aviso)

## Regras de honestidade (valem para tudo que você escrever)

- **Marque de onde vem cada número:** *fato* (preço público ou fonte oficial, com link), *medido* (no banco ou no código), *estimativa* (sua) ou *palpite* (funil). **Não misture.**
- **Não invente número.** Se não achar fonte, escreva "não verificado".
- **Nunca prometa** WhatsApp que manda sozinho, cobrança automática, data de nada, "grátis para sempre", nem desconto. A frase verdadeira é "hoje você manda com um toque".
- **Nunca cite nome ou telefone de cliente final.**
- **Sem travessão (—)** no texto do produto, **sem emoji**, sem supor gênero ("obrigado" na voz de profissional), sem chamar o Motor de Ciclo de "IA" ou dizer que ele "aprende" (é conta determinística).
- **Nunca nomeie concorrente** em texto público.
- **Recalcule os números** (com a planilha ou com um cálculo independente) e **diga se algum número do `docs/90` estiver errado.**

## O que devolver junto

0. O **resumo das 8 etapas** acima (uma linha por etapa, com os links das fontes principais).
1. O HTML.
2. Uma **lista de até 10 linhas** com as mudanças que você fez em relação ao `docs/90`, e por quê.
3. As **perguntas que ainda sobraram para mim**, se houver.
