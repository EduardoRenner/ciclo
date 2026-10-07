# 98 · Revisão do ecossistema, do método e do Motor: como ser o melhor

Escrito em 2026-10-07. Pergunta do Eduardo: o que falta para o CICLO ter o melhor ecossistema, método,
sistema e motor do mercado? Este documento **revisa o que existe** (lendo o código), **pesquisa o
estado da arte** e transforma o resultado em hipóteses testáveis, não em promessas.

O plano-mestre que junta esta trilha com cobrança, agentes, confiança e operação está em
`docs/99-PLANO-MESTRE-DO-ECOSSISTEMA.md`.

Companheiro do `docs/97` (a esteira de dados). O que a revisão mudou no 97 está na seção 8.

## 0. Como ler (e o que NÃO foi verificado)

- **Verificado no código** hoje: o Motor (`core/cycle/compute.ts`, `valor-em-risco.ts`,
  `calibrar-probabilidade.ts`), o importador e a exportação.
- **Pesquisado na web** (busca limitada, resumos e páginas de fornecedor): literatura de previsão de
  retorno, de junção de registros, de tipagem de colunas e de detecção de tabelas em planilha; o que
  os sistemas de salão anunciam.
- **Não verificado:** nenhum concorrente foi testado; **número de página comercial não vale como
  prova** (um comparativo citou "22% mais retenção" para quem adiciona automação de retorno: é de
  blog de fornecedor, **não usar**). Nenhuma técnica abaixo foi medida nos dados do CICLO. Tudo vira
  hipótese até passar pelo teste da seção 4.

## 1. O mapa do ecossistema: a volta inteira

Um motor de retenção só é o melhor se a **volta inteira** fecha: entra o dado, o motor prevê, alguém
age, mede-se o resultado, o motor aprende, e o dono pode sair levando tudo.

| Elo | Hoje | Avaliação |
|---|---|---|
| **Entrada** | importador de CSV com mapeamento manual de 5 campos; só última visita | o elo mais fraco: sem histórico o Motor trabalha no escuro. Plano: `docs/97` |
| **Motor** | `computeCycle` determinístico, v1, calibrado por salão | bom como base explicável; tem fraquezas medíveis (seção 3) |
| **Ação** | fila de chamadas (um cliente por vez), WhatsApp do próprio dono, link de agendamento com clique medido (`docs/95`, #135 a #141) | decisão certa e rara: manual, sem risco de banimento, sem custo por mensagem |
| **Medição** | `cycle_predictions`, calibração por estado, prestação de contas, atribuição por clique | existe e é um diferencial; falta o **placar de acerto que o dono entende** |
| **Aprendizado** | calibra a probabilidade por estado quando há 8 desfechos ou mais | só dentro de cada salão; sem backtest formal |
| **Saída** | CSV de clientes, 4 colunas | pobre para quem promete "a base é sua" |

**O que o mercado oferece nessa volta** (resumos da pesquisa): Fresha, Booksy, Vagaro e Mangomint são
fortes em **agenda e reserva**; os comparativos dizem que a **retenção automatizada fica fraca ou
exige uma camada de fora**; **Phorest** aparece como o salão-software voltado a retenção, com
campanhas de retorno, fidelidade e reputação. Leitura: **o espaço "motor de retorno de verdade" está
pouco ocupado, e é o que o CICLO já é.** O risco não é concorrente, é a nossa entrada ser tão ruim que
o motor nunca recebe dado bom.

## 2. A tese de vitória (em cinco linhas)

1. **Entrada sem atrito:** qualquer arquivo vira dado limpo (`docs/97`).
2. **Motor que explica e que prova:** cada chamada vem com o porquê, e o motor **prova que acerta**
   com dados do próprio salão **antes** de ele pagar (retroteste, seção 5).
3. **Ação que o dono executa em 15 segundos** (fila de chamadas) e que **mede o resultado**.
4. **Método:** nada entra no Motor sem backtest, e toda versão nova roda em **modo sombra** antes de
   decidir (seção 6).
5. **Saída aberta:** exporta tudo em formato padrão. Quem confia em poder sair é quem fica.

## 3. Revisão do Motor atual (lida no código)

**O que ele faz hoje (verificado):**
- `computeCycle`: calcula os intervalos entre visitas; **descarta os maiores que 3× o padrão do
  serviço**; com 0 intervalos usa o padrão, com 1 a 2 mistura (60% mediana, 40% padrão), com 3 ou
  mais usa a **mediana dos 5 últimos**; limita entre 0,5× e 2,5× o padrão; prevê a próxima data;
  **agendamento futuro já marcado força "em dia"**.
- O estado vem de faixas **fixas em dias de atraso**: até −3 em dia, até 0 "na hora", até 10
  "atrasada", até 30 "em risco", acima disso "perdida" (`estadoPorAtraso`).
- A probabilidade de voltar vem de uma tabela por estado (0,85 / 0,65 / 0,35 / 0,12), **calibrada por
  salão** quando há pelo menos 8 desfechos naquele estado (`calibrar-probabilidade.ts`). O dinheiro
  em risco é `preço × probabilidade`, arredondado para baixo.
- Versão do algoritmo gravada em cada previsão (`VERSAO_DO_MOTOR = 1`): permite separar "o salão
  mudou" de "nós mudamos". Isso é prática de primeira linha e **já existe**.

**Pontos fortes a preservar:** é explicável, determinístico, versionado e já se calibra com o
resultado real. Qualquer mudança tem que **manter a explicabilidade** ("ela vem a cada 28 dias, já
faz 41"): é o que o dono aceita seguir e o que um modelo opaco perderia.

**Fraquezas (cada uma é uma hipótese a testar, seção 4):**

| # | Observação no código | Por que pode estar errado | Hipótese |
|---|---|---|---|
| O1 | As faixas de atraso são **absolutas** (10 e 30 dias) para todo mundo | 10 dias de atraso são nada para quem volta a cada 60 dias e muito para quem volta a cada 14. A mesma faixa mistura os dois | **H1:** estado por atraso **relativo** ao ciclo da pessoa (atraso ÷ ciclo pessoal) |
| O2 | Usa só a mediana: **não mede dispersão** | quem tem intervalos 20, 21, 22 e quem tem 10, 40, 25 recebem o mesmo ciclo, mas o segundo é bem menos previsível | **H2:** usar a dispersão (desvio absoluto mediano) para alargar a janela e baixar a confiança de quem é irregular |
| O3 | O **número de visitas** não entra como evidência de a pessoa ainda estar ativa | é o achado central dos modelos "compra até morrer" (BG/NBD, Pareto/NBD): silêncio longo de quem tinha ritmo firme e muitas visitas diz mais do que o mesmo silêncio de quem veio uma vez | **H3:** a probabilidade depende do estado **e** do histórico (poucas, algumas, muitas visitas) |
| O4 | A calibração é só **por estado** | dois clientes no mesmo estado, um com 1 visita e outro com 12, não têm a mesma chance | **H4:** calibrar por estado × faixa de visitas, quando a amostra permitir |
| O5 | O "padrão do serviço" é fixo e decide o descarte (3×) e o piso e o teto | em serviço novo ou profissão nova o padrão é palpite, e ele governa os limites | **H5:** o padrão do serviço passa a ser a mediana do próprio salão quando houver amostra |
| O6 | Sem sazonalidade nem dia da semana | noiva, festa de fim de ano, volta às aulas movem o ritmo | **H6:** adiar, depois de H1 a H5 |
| O7 | Calibração mede **taxa**, não **qualidade de ordenação** | o que importa ao dono é "dos 20 que eu chamar hoje, quantos voltam": precisão no topo da lista | **H7:** passar a medir precisão@k, Brier e curva de calibração |

**O que a literatura sugere (e o que NÃO adotar cegamente):**
- **BG/NBD e Pareto/NBD** (Fader, Hardie e Lee, 2005; Schmittlein et al., 1987) estimam, para cada
  cliente, a **probabilidade de ainda estar ativo** e as compras futuras esperadas, só com
  frequência, recência e tempo de observação. Há implementações abertas conhecidas (`lifetimes`,
  `CLVTools`). **Limitações para o nosso caso:** foram pensados para compra com taxa constante; salão
  tem ciclo **regular** (barba a cada 21 dias), que o processo de Poisson descreve mal. Em outras
  palavras, o nosso ciclo regular é uma **vantagem de informação** que esses modelos desperdiçam.
  Uso razoável: como **segunda opinião** para quem tem 3 visitas ou mais, comparada por backtest, não
  como substituto.
- **Alternativa mais aderente:** um modelo de **sobrevivência empírico**: a probabilidade de voltar
  em função da razão `dias desde a última visita ÷ ciclo pessoal`, estimada por faixas, **com
  encolhimento para a média do salão** quando a pessoa tem pouco histórico. É exatamente H1 + H3 + H4
  juntas, continua explicável ("já passou 1,6 vezes o seu ritmo") e é implementável com o que o banco
  já guarda.
- **Probabilidades agregadas entre salões** (aprender um prior comum) são tentadoras, mas dependem da
  trilha de dados agregados, **desligada à espera de parecer jurídico** (`docs/86`, P1 a P5). **O
  Motor v2 tem que funcionar só com dado do próprio salão e com priors públicos.**

## 4. O método: nada entra no Motor sem prova

**Protocolo de avaliação (backtest com corte no tempo).** Para cada salão com histórico: escolhe uma
data de corte T, **usa só o que existia até T**, prevê quem volta entre T e T + janela, e compara
com o que de fato aconteceu. Nunca embaralhar o tempo (vazamento do futuro).

**Métricas (da mais importante para a menos):**
1. **Precisão no topo da lista (precisão@k):** dos k clientes que o Motor mandaria chamar, quantos
   voltaram. É a métrica do dono.
2. **Dinheiro recuperável:** soma do valor dos que voltaram entre os k primeiros.
3. **Escore de Brier** e **curva de calibração:** a probabilidade dita ("65%") bate com a
   frequência real? (Hoje anunciamos dinheiro com base nisso: calibrar não é enfeite.)
4. **Erro da data prevista:** quantos dias a data prevista errou, em mediana.

**Regra de adoção:** uma variante (H1 a H5, BG/NBD como segunda opinião) só vira o Motor v2 se
**melhorar precisão@k e Brier em pelo menos N salões** (N a definir quando houver base real; com a
base do alpha, usar validação cruzada por salão), **sem piorar a explicabilidade**. Empate: fica o mais
simples.

**Dados para o teste:** (a) gerador sintético com ritmos conhecidos (para provar que o código mede
certo, inclusive casos em que o modelo novo **deve** perder); (b) o histórico que a esteira
(`docs/97`, N2) traz do alpha; (c) os desfechos já guardados em `cycle_predictions`. **Sem N2 não há
backtest real**: por isso a Onda 2 da esteira é pré-requisito do Motor v2.

## 5. Inovação: o retroteste, a prova antes da venda

Quando a esteira trouxer o histórico (N2), o CICLO pode fazer sobre o passado **do próprio salão** o
que faria no futuro, e mostrar:

> "Se o CICLO existisse em março, teria mandado você chamar 38 pessoas. 14 voltaram. Eram R$ 2.100."

É uma prova **medida nos dados do dono**, no momento em que ele decide pagar. Nenhum importador
genérico pode fazer isso (não conhece o destino), e nenhum sistema de salão que listamos mostra isso.
Regras de honestidade: mostra a janela, o corte e o tamanho da amostra; **se a amostra é pequena,
diz que é pequena** em vez de aparecer um número bonito; nunca usa dado posterior ao corte.

## 6. Método de engenharia (como se mantém o melhor)

1. **Modo sombra:** versão nova do Motor roda **em paralelo** e só **registra** o que preveria
   (`cycle_predictions` já guarda a versão). Decide-se depois de semanas de resultado real, sem mudar
   a tela do dono.
2. **Portão de regressão no CI:** o corpus da esteira e o conjunto sintético do Motor têm métricas
   mínimas; mudança que as piora **reprova o PR**.
3. **Corpus versionado e crescente:** todo erro achado em produção (arquivo mal lido, previsão
   errada) vira um caso permanente de teste.
4. **Telemetria de correção:** a taxa em que o dono corrige a coluna que a esteira classificou é a
   métrica de qualidade real da esteira (sem dado pessoal).
5. **Registro de experimentos:** cada hipótese (H1 a H7) ganha entrada em `docs/DECISOES.md` com o
   resultado, inclusive os negativos.
6. **Mutação e controle positivo** (regra do CLAUDE.md) valem para o código de avaliação também:
   um backtest que dá o mesmo resultado com o modelo quebrado é um backtest cego.

## 7. O que a pesquisa ensinou à esteira (`docs/97`)

| Fonte | Lição | Aplicação |
|---|---|---|
| **Sato / Sherlock** (tipagem semântica de colunas): aprendizado profundo chega a F1 ponderado de 0,925, mas **0,735 na média por tipo** (tipos raros vão mal); o ganho do Sato vem de usar o **contexto das outras colunas** | classificar coluna isolada é fraco; o contexto da tabela resolve ambiguidade | E5: classificar **a tabela inteira de uma vez** com restrições (um telefone principal, um nome, datas coerentes entre si), em vez de coluna por coluna |
| **TableSense** (detecção de tabelas em planilha): mesmo uma rede convolucional dedicada tem **precisão de 86,5% e recall de 91,3%** | achar a tabela em planilha bagunçada é difícil até para o estado da arte; heurística nossa **vai** errar | E3/E9: a prévia tem **"ajustar o intervalo da tabela"** (arrastar o retângulo), e o erro de detecção nunca vira dado errado calado |
| **Fellegi-Sunter / Splink** (junção probabilística de registros): bloqueio + pesos por campo + três faixas (igual, talvez, diferente), com ajuste para **nomes comuns** | regra "telefone igual funde" é grosseira (família, recepção) | E7: pontuação por campo (telefone, nome com distância de edição, aniversário), **ajuste de frequência** (um "Maria Silva" vale menos que um "Eduarda Wanderlei"), três destinos: funde, **pergunta**, não funde |
| **Frictionless Table Schema** e **Great Expectations** (esquema declarativo e "expectativas" nomeadas) | validação declarativa e relatório padronizado são o jeito maduro de contrato de dados | o registro canônico vira um **esquema declarativo**; as validações da E8 são uma lista de expectativas nomeadas; o relatório da importação sai no mesmo formato todas as vezes |
| **Frictionless Data Package** (`datapackage.json`) | formato aberto, legível por qualquer ferramenta | a exportação completa (Onda 6) inclui o descritor, e "a base é sua" passa a ser verificável |

## 8. O que mudou no `docs/97` por causa desta revisão

1. **E3/E9:** ajuste manual do intervalo da tabela.
2. **E5:** classificação conjunta da tabela, com restrições entre colunas.
3. **E7:** pontuação probabilística por campo, bloqueio, ajuste de frequência de nomes, três destinos.
4. **E8:** validações como lista declarativa de expectativas; relatório padronizado.
5. **Saída:** exportação com `datapackage.json`.
6. **Método:** modo sombra, portão de regressão no CI, telemetria de correção, corpus crescente.
7. **Inovação nova:** **retroteste** (seção 5), que depende do histórico (N2).

## 9. Roteiro (em ordem de dependência)

1. **Esteira, Onda 1** (`docs/97`): sem ela não há dado novo.
2. **Esteira, Onda 2** (histórico N2): habilita o backtest real.
3. **Harness de backtest** (esta revisão): métricas da seção 4 sobre o Motor v1 e sobre dados
   sintéticos. *Pronto quando:* mede o v1 e o **teste de controle** prova que ele detecta um modelo
   pior de propósito.
4. **Experimentos H1 a H5** no harness, um por vez, cada um com resultado registrado. Candidatos
   vencedores entram em **modo sombra** (versão 2 do Motor).
5. **Retroteste na tela de importação** (seção 5), só com amostra suficiente e janela dita.
6. **Explicação por chamada** no cartão da fila ("ela vem a cada 28 dias, faz 41"), verificando antes
   o que a ficha e a fila já mostram (`docs/95`, perfil e nota do cliente).
7. **Placar de acerto para o dono** ("das 20 que você chamou, 11 voltaram"), usando a atribuição por
   clique que já existe.

## 10. O que depende de decisão fora do código

- **Priors agregados entre salões:** dependem do parecer jurídico sobre dados agregados (`docs/86`).
  Sem ele, o Motor v2 usa só o salão e priors públicos.
- **Quantos salões bastam para adotar uma versão** (N da regra de adoção): definir quando houver base
  real do alpha.
- **Mostrar o retroteste ao dono** é promessa implícita de acerto: o texto da tela passa pela mesma
  régua de honestidade das promessas dos Termos (nada que o produto não prove).
