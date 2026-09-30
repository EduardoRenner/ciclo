# 84 · Dados e inteligência — o CICLO que encontra dinheiro, e o que ninguém tem

> 2026-09-28, Opus 5.5. Pedido do Eduardo, em duas partes: (1) "quanto mais dados melhor, os dados
> são nossos também — ter posse disso nos termos e em capacidade real, e armazenar"; (2) uma lista
> de ideias (Autopilot, Revenue Engine, memória do cliente, clientes em risco, Ciclo Score,
> recuperação automática, marketplace, interface por conversa, simulador "e se", Shadow/gêmeo
> digital, mapa de vazamento de receita, experimentos, "Ciclo OS") com o pedido de **pesquisa de
> verdade sobre o que ninguém tem**. Plano, não execução.
>
> **[FATO]** código/banco · **[EVIDÊNCIA]** fonte pública com data · **[HIPÓTESE]** a validar ·
> **[NÃO VERIFICADO]** tentado sem sucesso · **[JURÍDICO]** precisa de advogado — este documento
> não decide nada jurídico (regra da casa).

---

## Sumário executivo

1. **"Os dados são nossos" tem uma versão que funciona e uma que quebra o negócio.** A que quebra:
   dizer nos termos que o CICLO é dono do nome, telefone e histórico dos clientes do salão. Pela
   LGPD o dado pessoal é do titular (a cliente); o salão é o controlador e o CICLO o operador — é
   exatamente o que a `/privacidade` diz hoje. Além do risco legal, isso destrói a confiança que o
   `docs/83` §7.4 mostrou ser a maior objeção de quem troca de sistema ("vou perder meus dados").
   **A versão que funciona, e que é o padrão de quem faz isso bem (Zenoti, 30 mil negócios):** o
   dado de cada negócio continua dele — e o CICLO ganha nos termos o direito de gerar e usar
   **inteligência agregada e anonimizada** de todos os negócios. Esse é o ativo valioso de
   verdade, e ele é defensável.
2. **O ativo precisa começar a ser construído AGORA, mesmo sem uso imediato**, por três motivos que
   não voltam atrás: não se pede autorização retroativa (quem entrou sem a cláusula fica fora da
   base agregada até aceitar uma versão nova); não se captura retroativamente um sinal que não foi
   gravado (ex.: quem procurou horário e não achou); e a série de previsões do Motor, o fosso que o
   `docs/52` identificou, só cresce com tempo.
3. **A pesquisa confirma o que o próprio Eduardo desconfiou: "IA que opera o negócio" já é
   commodity.** GlossGenius virou **Genius AI** em 21/07/2026, avaliada em US$ 1,15 bi, 125 mil
   negócios, com agentes que reagendam, recuperam cliente e preenchem cancelamento sozinhos
   **[EVIDÊNCIA]**. No Brasil, Barberia.io, BarberAI, BarberFlow AI, RobotiZap, Simples Agenda,
   Belasis e Trinks já vendem "IA no WhatsApp que traz cliente de volta" **[EVIDÊNCIA]**. Autopilot,
   recuperação automática e interface por conversa **não diferenciam** — são o mínimo de 2026.
4. **O que a pesquisa NÃO encontrou em nenhum software de agenda, aqui ou fora:**
   (a) um **simulador "e se"** que usa os dados do próprio negócio; (b) **experimentos** que o dono
   liga e o sistema mede; (c) um **mapa de vazamento de receita** como tela de produto — o conceito
   existe só como artigo e relatório (Salon Today, Zenoti), nunca como tela com botão; (d) no
   Brasil, **comparativo com negócios parecidos** a partir de dado agregado. E um detalhe que vale
   ouro: até o Genius AI decide quem sumiu por **janela fixa de seis semanas** — o ritmo pessoal do
   Motor continua sendo diferença real mesmo dentro do mundo dos agentes.
5. **Metade da visão "observa → entende → prevê → simula → experimenta → aprende → age" já está
   construída** [FATO]: Motor de Ciclo, previsão auditada, valor em risco, lucro por cliente,
   concentração, margem do clube, cadeira vazia, assistente com 13 ferramentas. O que falta é
   **simular, experimentar, e juntar tudo numa tela que diz "aqui está o dinheiro, resolve"**.
6. **A aposta recomendada:** não vender "Ciclo OS" nem "IA" (todo mundo vende). Vender o que é
   verificável: **"O CICLO mostra onde seu dinheiro está vazando, qual torneira fechar primeiro — e
   te deixa testar antes de decidir."** O mapa de vazamento é o produto; o simulador e os
   experimentos são o que ninguém tem; os dados agregados são o que torna o simulador possível.

---

## 1 · O aviso honesto sobre "os dados são nossos"

**O que a lei diz, em termos de negócio [JURÍDICO — validar com advogado]:**
- O dado pessoal pertence à pessoa (titular). A cliente do salão pode pedir acesso, correção,
  portabilidade e eliminação — e o CICLO já atende isso (`data-export`, `erase`) [FATO].
- Sobre os clientes do salão, o salão é o **controlador** (decide o que guardar) e o CICLO é o
  **operador** (processa em nome dele). É o que a `/privacidade` §1 diz hoje, palavra por palavra.
- **Dado anonimizado deixa de ser dado pessoal** (LGPD art. 12), desde que a anonimização não
  possa ser revertida com meios razoáveis. É essa porta que permite ao CICLO ter um ativo de dados
  próprio sem tomar para si o que é da cliente.
- **Dado de saúde** (anamnese) é sensível (art. 11). Fica fora de qualquer uso secundário, mesmo
  agregado — e isso já é a regra 9 do `CLAUDE.md`.

**Por que a versão "a base é nossa" seria um erro comercial, além de jurídico:**
- O `docs/83` §7.4 mostrou que o medo nº 1 de quem troca é o dado ficar preso. Um termo dizendo "os
  dados também são do CICLO" é o argumento que o concorrente usaria contra o CICLO na primeira
  conversa.
- Hoje os termos dizem o contrário ("o que você cadastra continua seu", `/termos` §8) e a
  privacidade diz "a gente não vende sua base" (§3). Reverter isso é quebrar uma promessa escrita.
- A multa da LGPD vai até 2% do faturamento por infração (teto de R$ 50 milhões) — para um
  fundador sozinho, o risco relevante é reputação e processo, não o teto.

**A versão que funciona — "o seu é seu, o agregado é nosso, e volta pra você":**
> O que você cadastra é seu, e você leva quando quiser. Números agregados e sem nome — como "em
> barbearias de cidades do seu porte, o corte custa entre R$ X e R$ Y" — o CICLO usa para melhorar o
> produto e para mostrar comparativos para você e para todo mundo. Nunca vendemos sua base, nunca
> mostramos seu cliente a outro negócio, nunca usamos dado de saúde.

É o modelo da Zenoti, que publica benchmark de 30 mil negócios "a partir de dados agregados e
anonimizados" e oferece a comparação dentro do produto **[EVIDÊNCIA, help.zenoti.com, 28/09]** —
só nos EUA. No Brasil, não encontrei ninguém fazendo.

---

## 2 · A estratégia de dados — posse nos termos e capacidade real

### 2.1 Nos termos [JURÍDICO — redação final por advogado]

| O quê | Onde | Por quê |
|---|---|---|
| Licença do CICLO para **gerar e usar dados agregados e anonimizados** para melhorar o serviço, calibrar o Motor e publicar comparativos | `/termos` (novo item) | É o que dá "posse" legítima do ativo |
| Autorização do salão (controlador) para o CICLO (operador) **anonimizar** os dados que processa, para essas finalidades | `/termos` + `/privacidade` §1 e §3 | Sem isso o operador estaria usando dado para finalidade própria |
| Exclusão explícita: dado de saúde, nome, telefone, e-mail, qualquer identificador — nunca entram no agregado | `/privacidade` §3 e §4 | Regra 9 + art. 11 |
| Promessa de simetria: "exporte sua base inteira quando quiser" | `/termos` + botão real (`docs/83` P3) | Transforma a cláusula de dados em sinal de confiança, não de ameaça |
| **Aceite versionado** dos termos, por conta | banco + cadastro | **Pré-requisito.** O `BL-50` já registrou que o aceite de hoje não guarda a versão. Sem isso, não há como provar quem aceitou a cláusula de dados |

**Perguntas para o advogado** (registradas em `docs/DECISOES.md`): (1) o operador pode anonimizar
para finalidade própria com autorização contratual do controlador, ou precisa de outra base
legal? (2) negócio MEI é pessoa física — os números do negócio dele (faturamento, ocupação) também
são dado pessoal dele, e vale a mesma regra de agregação? (3) qual limiar de anonimização é
defensável (quantos negócios, no mínimo, por célula publicada)? (4) quem já tem conta precisa
aceitar a versão nova — e até lá fica fora do agregado?

### 2.2 Capacidade real — o que capturar que hoje se perde

A regra "quanto mais dados melhor" vale para **sinais**, não para acumular por acumular — cada
sinal abaixo alimenta uma tela concreta deste plano.

| Sinal | Hoje | Alimenta | Custo |
|---|---|---|---|
| **Demanda não atendida** — alguém abriu a página pública, escolheu um serviço e um dia, e não havia horário | **não gravado** [FATO: `disponibilidadePublica` não registra nada] | simulador "e se eu abrir sábado?" e o vazamento "horário vazio" com demanda comprovada | baixo — um evento por busca sem vaga, sem dado pessoal |
| Lista de espera pública | gravada [FATO] | mesma coisa — é demanda reprimida com nome | já existe |
| Resultado de cada contato de recuperação (chamou → voltou?) | parcial: `recuperacao_enviada`, `cliente_voltou`, atribuição [FATO] | experimentos de mensagem; eficácia por tipo de cliente | baixo — ligar os eventos por cliente |
| **Histórico de preço de cada serviço** | existe na trilha: `audit_log` grava `service.update` com antes/depois [FATO] | simulador de preço; experimentos | zero — só ler |
| Ocupação por dia e faixa de horário | calculável dos agendamentos (`ociosidade.ts`) [FATO] | mapa de vazamento; comparativo | já existe |
| Previsão × realidade do Motor | `cycle_predictions`, append-only [FATO] | o fosso (`docs/52` Q1); calibração | já existe |
| Motivo do cancelamento | [NÃO VERIFICADO] se existe campo | vazamento "cancelamento não recuperado" | a confirmar |

### 2.3 A camada agregada — como guardar o ativo sem guardar ninguém

- **Esquema separado** (ex.: `insights`), sem `tenant_id` e sem `client_id` — só agregados:
  profissão, porte (faixa de nº de profissionais), região (UF ou faixa de tamanho de cidade),
  serviço **canônico**, semana. Números: ticket médio, ritmo mediano de retorno, taxa de falta,
  ocupação, preço (faixa), eficácia de recuperação.
- **Célula só existe com N negócios ou mais** (k-anonimato; N definido com o advogado, §2.1 p.3).
  Com a base de hoje (1 conta real [FATO, `docs/82`]), **nenhuma célula passa** — o pipeline pode
  rodar desde já sem mostrar nada, e começa a aparecer sozinho quando houver volume.
- **Serviço canônico é o que torna o agregado possível.** Cada salão escreve "Corte masc.",
  "Corte degradê", "Social"... O catálogo de profissões (`profession_services`) já é uma taxonomia
  — os serviços nascem dele no onboarding [FATO]. Falta guardar, em cada serviço do salão, de qual
  item canônico ele veio, e manter esse vínculo quando o dono renomeia.
- **Regra 11 do `CLAUDE.md` já joga a favor:** agendamento, movimento de estoque e auditoria nunca
  são apagados — o histórico bruto que alimenta o agregado já é preservado por construção.

### 2.4 O que o ativo vira de produto — e por que isso responde ao `docs/52`

O `docs/52` Q6 concluiu que efeito de rede por volume é o campo em que a InfinitePay (6 milhões
de comerciantes) vence. Continua certo. **O ativo agregado não é defendido pelo volume — é
defendido pelo que ele permite construir e que nenhum concorrente brasileiro montou:**

1. **Arranque do Motor para conta nova:** hoje uma conta sem histórico usa o ritmo padrão do
   catálogo (um número escrito à mão). Com o agregado, usa o ritmo real de negócios parecidos —
   o Motor acerta desde o primeiro dia.
2. **Comparativo que dá vontade de contribuir** ("give-to-get"): *"seu cliente volta a cada 24
   dias; em barbearias parecidas, 28"*. O dono vê porque todos contribuem.
3. **O simulador de preço só é possível com o agregado.** Um salão sozinho quase nunca muda preço
   — não há como estimar quantos clientes deixam de vir com +R$ 10. Juntando os negócios que
   mudaram preço (a trilha já grava), dá para estimar uma faixa. **Os dados agregados são o que
   transforma o "e se" de chute em cenário.**

### 2.5 O que NÃO fazer

- Não escrever nos termos que a base de clientes é do CICLO.
- Não vender nem ceder dado, agregado ou não, a terceiros.
- Não mostrar cliente de um salão a outro — veto permanente (`docs/43` D, com guarda).
- Não usar dado de saúde em nenhum agregado.
- Não mudar termos de quem já tem conta sem aviso e aceite versionado (`BL-50` primeiro).
- **Importação pelo WhatsApp do Eduardo** (decisão de 28/09): a planilha de clientes que chegar no
  celular dele é dado pessoal de terceiros em trânsito — importar e **apagar do WhatsApp em seguida**
  [JURÍDICO — boa prática, confirmar].

---

## 3 · O que o mercado já tem — pesquisa de 28/09/2026

| Ideia da lista | Quem já tem | Evidência |
|---|---|---|
| **Autopilot / agentes que agem sozinhos** | Genius AI (ex-GlossGenius): Growth, Marketing e Reception agents, "de ponta a ponta" | Techstars; Startup Fortune (21/07/2026) |
| **Recuperação automática** | Genius AI ("pega o cliente que não voltou em **seis semanas**" — janela fixa); BarberFlow AI, RobotiZap, Belasis (30/60/90 dias fixos) | idem; barberconec.com; robotizap.com; UAI 25/09/2026 |
| **IA no WhatsApp que agenda** | Trinks IA, Barberia.io, BarberAI, Simples Agenda | `competitors/trinks.md`; barberia.io; barberai.com.br; simplesagenda.com.br |
| **Revenue Engine / "scans data for revenue opportunities"** | Genius AI (Growth Analyst) — sem detalhe público de como | glossgenius.com (via busca) |
| **Benchmark com dados de outros negócios** | Zenoti — dentro do produto, só EUA, liberado pelo gerente de conta; 30 mil negócios anonimizados | help.zenoti.com "Industry Benchmark Report" |
| **Interface por conversa** | vários (Trinks IA etc.) — e o próprio CICLO já tem | — |
| **Mapa de vazamento de receita** | **como conteúdo, não como produto**: "Five Revenue Leaks Hiding in Your Salon" (Salon Today), "leaks invisible from the front desk" (Zenoti 2026 Benchmark) | salontoday.com; zenoti.com/blog |
| **Simulador "e se" com dados do próprio negócio** | **não encontrado em software de agenda**; só ferramentas genéricas de planejamento financeiro (LivePlan, Fathom, Drivetrain) sem dado de agenda | busca 28/09 |
| **Experimentos que o sistema mede** | **não encontrado em software de agenda**; existe em e-commerce/SaaS (Intelligems, Kameleoon) | busca 28/09 |
| **Marketplace de integrações** | Trinks (integrações vendidas à parte), GlossGenius | `competitors/trinks.md` |

**Ressalva obrigatória:** "não encontrado" numa busca de uma tarde não prova que não existe em
nenhum lugar do mundo. Prova que **nenhum concorrente dominante** vende isso como produto — o
mesmo nível de evidência que o próprio Eduardo registrou na pesquisa dele.

---

## 4 · Cada ideia × o que já existe no CICLO × o que falta [FATO: `src/core`, `server/assistente`]

| Ideia | Já existe | Falta | Veredito |
|---|---|---|---|
| 1 · Autopilot | Motor, recuperar, campanha diária (`cron/campaigns`), assistente que **prepara** ações para o dono confirmar | agir sem confirmação | **Com aprovação, sim, já** ("Resolver tudo" abre as mensagens prontas no WhatsApp do dono). **Sozinho, não agora:** depende do número de WhatsApp aquecido e de credencial (F0, `docs/74`) — erro em massa queima o número de **todos** os tenants (`docs/53` §3.4) |
| 2 · Revenue Engine | valor em risco, lucro por cliente, margem por serviço, sobra explicada, concentração, margem do clube, cadeira vazia (`core/*`) | juntar numa pergunta "como aumento este mês?" | **Vira o Mapa de Vazamento (item 11)** — mesma ideia, com os números que já existem |
| 3 · Memória do cliente | ritmo do cliente, lucro do cliente, histórico, score de falta, notas | dia da semana preferido, profissional preferido, faixa de retorno | **Sim, barato** — tudo deriva dos agendamentos; entra na ficha e no assistente |
| 4 · Clientes em risco 🟢🟡🔴 | `client_cycles.state` (em dia / chegando / atrasado) + `/admin/recuperar` [FATO] | só apresentação | **Já existe** — no máximo polir a tela |
| 5 · Ciclo Score | — | tudo | **Não como manchete** (§7.4). R$ explica mais que "78/100". Talvez depois, como termômetro secundário |
| 6 · Recuperação automática com follow-up e IA que entende "só semana que vem" | Motor + "Chamar" pelo WhatsApp do dono + desenho G-00..G-04 (`docs/53`) | agente no WhatsApp | **Atrás do F0**, como o `docs/53` já decidiu; quando existir, o critério de aceite é ter o ritmo do cliente na conversa — sem isso é só mais um do pelotão |
| 7 · Marketplace | — | tudo | **Não agora.** Com zero pagantes, ecossistema de integrações é esforço sem comprador |
| 8 · Interface por conversa | assistente com 13 ferramentas (`resumo_de_hoje`, `faturamento_do_periodo`, `ocupacao_do_dia`, `clientes_para_recuperar`, `preparar_*`...) [FATO] | "por que caiu?" e "resolve" (propor campanha) | **Estender, não construir.** Atenção: segundo o registro de setembro (memória `ciclo-assistente-ia`), faltava a `GEMINI_API_KEY` na Vercel — se ainda faltar, o assistente não responde em produção. [NÃO VERIFICADO hoje: exige acesso à Vercel] |
| 9 · Simulador "e se" | calculadora pública de preço `/quanto-custa`, `ociosidade.ts`, capacidade da agenda | o simulador | **Aposta A (§5)** |
| 10 · Shadow / gêmeo digital / DNA operacional | o banco já é o "gêmeo"; Motor aprende ritmo | a linguagem e a entrega (resumo da manhã) | **É a forma de apresentar 2+9+11**, não um produto separado |
| 11 · Mapa de vazamento de receita | a maior parte dos cálculos (item 2) | a tela única, em R$, com "Resolver" em cada linha | **Aposta B (§5) — o produto principal** |
| 12 · Experimentos | previsão auditada (a mesma mecânica: registrar antes, medir depois) | o experimento ligado pelo dono | **Aposta C (§5)** |
| "Ciclo OS" | — | — | **Não como marca.** Em 2026 muita startup se vende como "AI OS" — é genérico. A promessa verificável vence (§6) |

---

## 5 · As três apostas — o que ninguém tem

### Aposta A — Simulador "e se", com premissa à mostra

O dono pergunta; o CICLO mostra um **intervalo**, e **as premissas na cara** — nunca um número
fingindo certeza.

- **"E se eu abrir sábado?"** → usa demanda não atendida (§2.2, sinal novo), lista de espera e
  ocupação dos outros dias. Sem sinal de demanda, diz isso: *"ainda não tenho como saber — em 3
  semanas, com a página registrando quem procurou horário, eu te digo."*
- **"E se eu contratar mais uma pessoa?"** → capacidade ociosa atual × ticket × ritmo da base:
  quantos atendimentos a mais por mês a contratação precisa para se pagar (conta que a pessoa
  consegue conferir).
- **"E se eu subir o corte de R$ 45 para R$ 55?"** → **o dono escolhe a premissa** ("se 1 em cada
  10 clientes deixar de vir..."), o CICLO faz a conta com os números dele. Quando o agregado (§2.4)
  tiver negócios suficientes que mudaram preço, a premissa passa a vir dos dados, com a fonte
  dita.
- **Compatível com o veto de preço:** o simulador nunca aplica preço, nunca sugere preço como
  padrão. Mostra consequência de uma decisão que o dono está considerando.

### Aposta B — Mapa de vazamento de receita, em R$, com "Resolver"

A tela que responde "onde estou perdendo dinheiro?". Cada linha é um vazamento, com o valor e um
botão que leva à ação que já existe:

| Vazamento | Cálculo [FATO: onde já existe] | Resolver leva a |
|---|---|---|
| Clientes que passaram da hora de voltar | valor em risco (`v_recover_revenue`) | lista de recuperação, mensagens prontas |
| Clube de assinatura dando prejuízo | `margem-do-clube` | ajuste do plano |
| Serviço com margem baixa | `margem-do-servico`, `sobra-explicada` | ficha do serviço |
| Dependência de um profissional | `concentracao` | (informativo) |
| **Capacidade parada** | `ociosidade` × ticket | só quando houver demanda comprovada (§7.1) |
| Cancelamento não reagendado | agendamentos cancelados sem reagendamento | lista para chamar |

O "Bom dia, encontrei 4 situações" do Eduardo é **este mapa resumido no topo do "Hoje"** — não um
produto separado. É a tese do `docs/48` ("mostra onde está o seu lucro e o protege") virando uma
tela só.

### Aposta C — Experimentos que o dono liga e o CICLO mede

*"Teste abrir 3 horários extras na quinta por 14 dias."* O CICLO registra o antes, mede o depois e
mostra o resultado com a honestidade do tamanho da amostra ("indicativo: 14 dias, 110
atendimentos"). É a mesma mecânica da previsão auditada — registrar antes, comparar depois — já
existente no Motor. O que é novo é o dono ligar o teste. Cada experimento concluído alimenta o
agregado (§2.4) — é assim que o simulador aprende.

---

## 6 · A visão, mapeada ao que existe

```
OBSERVAR     agenda, comanda, página pública ............ existe  (+ demanda não atendida: novo)
ENTENDER     Motor de Ciclo, lucro, concentração ........ existe
PREVER       quando cada cliente volta, valor em risco .. existe  (previsão auditada: existe)
SIMULAR      "e se" .................................... Aposta A
EXPERIMENTAR teste ligado pelo dono .................... Aposta C
APRENDER     calibração do Motor + agregado ............ calibração existe; agregado: §2
AGIR         mapa de vazamento + "Resolver" ............ Aposta B (com aprovação; sozinho após F0)
```

**A frase de posicionamento recomendada** (evolução da `docs/48`, não substituição):
> **"O CICLO mostra onde seu dinheiro está vazando, qual torneira fechar primeiro — e te deixa
> testar antes de decidir."**

---

## 7 · Auto-crítica — o Diego (4 cadeiras, AppBarber) lendo isto

**7.1 Mapa de vazamento — "horário vazio não é dinheiro perdido, ninguém ia vir."** Ele está certo,
e o exemplo da lista ("você perdeu R$ 1.240 em horários vagos") **exagera**: cadeira vazia só vira
dinheiro perdido se havia alguém querendo aquele horário. **Consequência:** a linha "capacidade
parada" só mostra R$ quando houver demanda comprovada (lista de espera, busca sem vaga); sem isso,
mostra o fato ("terça 14h vazia há 6 semanas"), exatamente como a `ociosidade.ts` já faz. Esse é o
tipo de número inflado que faz o dono desconfiar de todos os outros.

**7.2 Simulador — "vocês estão chutando."** Com um salão só, a elasticidade de preço é chute —
o exemplo "6,9–7,5 clientes/dia" da lista supõe um dado que não existe. **Consequência:** a premissa
é do dono até o agregado existir, e está escrita na tela. **Sobrevive** assim, e fica mais forte com
o tempo.

**7.3 Experimentos — "14 dias não prova nada, semana de pagamento muda tudo."** Verdade: sazonalidade
engole um efeito de 9%. **Consequência:** apresentar como "teste prático", comparar com o mesmo
período anterior quando houver, e nunca dizer "comprovado". **Sobrevive como hábito de decidir
testando**, não como ciência.

**7.4 Ciclo Score — "por que 78?"** Um número composto convida a pergunta que ninguém responde em
uma linha, e dá para "subir o score" sem ganhar dinheiro. **R$ explica sozinho. Cai como manchete.**

**7.5 Autopilot — "não quero robô falando com meu cliente sem eu ver."** Muitos donos querem
controle — e o risco de banir o número é de todos os tenants. **Sobrevive com aprovação** (um toque),
que é também o seguro.

**7.6 Dados — "vocês vão vender meus clientes?"** Só se o termo for ambíguo. **Sobrevive se a
cláusula for escrita como promessa** ("nunca vendemos, nunca mostramos seu cliente a ninguém, só
números sem nome") **e vier junto com o botão de exportar a base inteira.**

**7.7 A pergunta que mata tudo — "e daí, com um cliente real?"** Hoje há 1 conta real e zero
pagantes (`docs/82`). Simulador, experimentos e agregado são apostas de médio prazo; **o que vende
amanhã numa visita é o mapa de vazamento com os números do próprio salão** — e ele depende da base
importada com data (`docs/83` P0, BL-51). A ordem abaixo respeita isso.

---

## 8 · Priorização

| # | O quê | Por quê | Depende de |
|---|---|---|---|
| **P0** | Termos + privacidade: cláusula de dados agregados/anonimizados + promessa de simetria; **aceite versionado (BL-50)** | Sem isso, cada conta nova entra fora do ativo — e não dá para pedir retroativo | advogado (Eduardo) para a redação; o versionamento é engenharia e pode começar |
| **P0** | BL-51 (importador: data e acento) — do `docs/83` | Sem base com data, nenhum número do mapa existe | nada |
| **P1** | Capturar **demanda não atendida** na página pública (evento sem dado pessoal) | Sinal que não volta; alimenta mapa (7.1) e simulador | nada |
| **P1** | **Mapa de vazamento v1** com os cálculos que já existem + resumo no topo do "Hoje" | O que vende numa visita (7.7) | P0 BL-51 para ter número real |
| **P2** | Serviço canônico em cada serviço do salão + pipeline agregado (grava, não mostra até o limiar) | Fundação do arranque do Motor, do comparativo e do simulador de preço | P0 termos |
| **P2** | Assistente: "por que caiu?" e "resolve" (propor campanha) | Estende o que existe; muito vendável | `GEMINI_API_KEY` na Vercel (Eduardo) |
| **P3** | Simulador "e se" v1 (contratar, abrir dia extra; preço com premissa do dono) | O que ninguém tem | P1 demanda não atendida |
| **P3** | Experimentos v1 | O que ninguém tem; alimenta o agregado | P1 mapa |
| **P4** | Memória do cliente (dia/profissional preferido, faixa de retorno) na ficha e no assistente | Barato, deixa a IA "conhecer" a cliente | nada |
| **P5** | Comparativo com negócios parecidos (give-to-get) | Aparece sozinho quando as células passarem do limiar | P2 + volume de contas |
| **atrás do F0** | Autopilot sem aprovação; agente de recuperação no WhatsApp com follow-up | Risco de banir o número de todos | número aquecido, credencial, `docs/74` |
| **não agora** | Marketplace; Ciclo Score como manchete; rebatizar para "Ciclo OS" | §4, §7.4 | — |

**Métrica que diz se funcionou:** a norte do produto continua `cliente_voltou` (`docs/82`). Para
esta frente: % de contas ativas que abrem o mapa de vazamento e tocam em "Resolver" pelo menos uma
vez por semana.

---

## 9 · Perguntas em aberto

**Para o advogado (via Eduardo):** as quatro do §2.1.

**Para o Eduardo:** (1) aprovar a frase de posicionamento do §6, ou manter a da `docs/48`?
(2) Quando o comparativo existir, ele é grátis para todos (incentiva contribuir) ou recurso de
plano pago? É preço.

---

## 10 · Fontes (acesso 28/09/2026)

- Genius AI / GlossGenius: techstars.com/blog/startup-spotlight/glossgenius-becomes-genius-ai...;
  startupfortune.com/glossgenius-rebrands-as-genius-ai...; glossgenius.com
- Zenoti: help.zenoti.com/en/analytics/industry-benchmark-report.html;
  zenoti.com/thecheckin/free-benchmark-scorecard-salons-spas-medspas;
  zenoti.com/blog/2026-beauty-wellness-benchmark-report
- Salon Today, "Five Revenue Leaks Hiding in Your Salon" (salontoday.com/whitepapers)
- Brasil, IA em barbearia: barberia.io; barberai.com.br; barberconec.com (BarberFlow AI);
  robotizap.com; simplesagenda.com.br
- Belasis: UAI, 25/09/2026, "Cliente sumiu do salão? Sistema avisa quem não aparece há 30, 60 ou
  90 dias"; belasis.com.br
- Experimentos de preço fora do setor: intelligems.io; kameleoon.com
- Internas: `docs/43`, `docs/47`, `docs/48`, `docs/52`, `docs/53`, `docs/73`, `docs/82`, `docs/83`;
  `/termos`, `/privacidade`; `src/core/*`; `src/server/assistente/ferramentas.ts`
