# 20 · PLANO DE COPY, POSICIONAMENTO E PERSUASÃO

> Executa o `docs/19-COPY-PROMPT.pdf`. Escrito em **2026-08-24**.
> Nenhuma linha de código foi escrita nesta rodada — o plano é o entregável (§10 do prompt).
>
> **Rótulos** (§2.3 do prompt, herdados do 17 §2.4): **[M]** Medido — vem do código, do banco ou de
> fonte citada · **[E]** Estimado, com a conta à vista · **[S]** Suposto, sem base.
> **Classificação** (§8): **Decidido** · **Recomendado** · **Do Eduardo** · **Bloqueado**.
>
> Nota de sessão: o Eduardo pediu que eu decidisse tudo sozinho. O §8 do prompt proíbe escolher
> sozinho o que é "Do Eduardo". Resolvi assim: **a classificação continua honesta**, e todo item
> "Do Eduardo" vem com um **padrão de trabalho** que eu adotei para poder seguir — declarado como
> padrão, nunca como decisão dele. Nada aparece como "Decidido" sem base.

---

## Sumário executivo — leia isto se não ler mais nada

1. **A recomendação principal é dividir o trabalho em dois, e só metade dele depende de tráfego.**
   A copy tem **defeitos de honestidade** (promete três coisas que o produto hoje não faz) e
   **defeitos de conversão** (posicionamento, ritmo, alcance). Os primeiros se corrigem hoje, sem
   um único visitante, porque não são otimização — são correção. Os segundos precisam de dado que
   não existe. Tratar os dois como o mesmo trabalho é o erro que o §R.2 ataca.

2. **A copy atual promete o que o produto não entrega — e o pior caso não é o WhatsApp, é o
   cron.** `vercel.json` está com `"crons": []` **[M]**: as rotas `reminders` e `recompute-cycles`
   existem e **nunca rodaram em produção**. Ou seja, "Lembrete e confirmação de agendamento"
   (cartão do Grátis em `/precos`), "Todo plano inclui lembrete, confirmação e o Motor de Ciclo"
   (subtítulo de `/precos`) e "A confirmação vai pelo WhatsApp que você já usa" (FAQ da home) são
   **três promessas escritas sobre um motor desligado**. Isso é o §4.5 do prompt, e é maior que o
   TICKET-043 que o prompt cita.

3. **A promessa central muda de agenda para retorno de cliente — mas a palavra "agenda" fica no
   título da aba.** Agenda é categoria lotada onde o CICLO é 23% mais caro que o Simples Agenda
   **[M]** (18 §E.2.1). A separação recomendada é incomum e deliberada: **o título da aba é onde
   mora a busca, o H1 é onde mora o posicionamento.** Quem procura "agenda para barbearia" precisa
   achar; quem chega precisa entender por que este e não outro.

3b. ⚠️ **Retorno de cliente NÃO é categoria vazia — eu supus que fosse e a pesquisa desmentiu.**
   A **Belasis** anuncia na home *"Agende mais, recupere clientes…"*, tem página dedicada a
   "Perdi o controle dos clientes inativos" e vende "recuperação inteligente de clientes inativos"
   **[M]** (§B.2.1, consultado em 2026-08-24). **O que sobra de diferenciação é mais estreito e mais
   defensável:** na Belasis isso mora a partir do **Pro, R$ 189/mês**, e ela **não tem plano
   gratuito**; no CICLO, **ver quem sumiu está no Grátis** **[M]**. E o mecanismo é diferente —
   ela fala de *segmento* ("gráfico de inativos"), o CICLO calcula *ritmo por pessoa*. **Não é o
   ineditismo que defende o posicionamento, é o degrau e o mecanismo** (§B.2.2).

4. **O melhor H1 disponível depende do P-0 do 18.** A forma mais forte carrega cadência — *"Toda
   semana, a lista de…"* — e ela só é verdade com o cron ligado. Sem ele vale a forma sem cadência,
   mais fraca. **A melhor copy deste produto é uma consequência de ligar o cron**, não uma
   alternativa a isso. (A redação final da headline foi trocada pela auditoria de tiques do §R.5,
   que reprovou a minha própria versão — hoje a recomendada é *"A lista de quem já devia ter
   aparecido"*, e a §D.2.1 acrescenta uma quarta hipótese que a pesquisa revelou.)

5. **O veto do cético cortou a palavra que o produto mais usa para se descrever: "aprende".**
   A home diz "o CICLO aprende o ritmo de cada pessoa". O `src/core/cycle/compute.ts` diz, no
   comentário do topo: *"determinístico, sem ML"* **[M]** — é mediana de intervalos com limite.
   "Aprende" é vocabulário de IA aplicado a uma conta de mediana. Sai (§7.4, veto).

6. **O alcance da home muda de 8 profissões para as 17 do catálogo — mas não no subtítulo.**
   Das 8 que a copy nomeia hoje, **nenhuma** tem ritmo recorrente; das 9 escondidas, **cinco**
   têm **[M]**. A copy é muda justamente para quem vive de cliente que volta. A correção é real,
   mas o painel (§7) mostrou que empurrar as 17 para o subtítulo **custa credibilidade com o ICP** —
   então as 17 vão para a seção "Feito para", e o subtítulo fala do eixo, não da lista.

7. **Uma persona do painel produziu uma restrição ética, não estética.** Para a psicóloga,
   "trazer de volta quem sumiu" não é estranho — é potencialmente **captação de paciente**, que tem
   regra de conselho profissional. Saúde não pode receber a mesma frase que barbearia. Isso reforça
   a decisão de foco do 18 §B.2 por um motivo novo.

8. **A voz do CICLO já existe, e não está na home: está nas "Perguntas de dinheiro" da `/precos`.**
   *"A cobrança automática ainda não está no ar — preferimos dizer isso a montar um botão que não
   funciona."* Essa é a melhor frase escrita do produto **[M]**, e nenhum concorrente pode colá-la.
   A Fase C não inventa uma voz: **transcreve a que já foi encontrada uma vez.**

9. **Não há uma única entrevista com cliente**, então quase tudo sobre "o que a pessoa sente" é
   **[S]**. A saída não é nova: são as **20 conversas da P.1-G do 18**, que já estão planejadas.
   O que este plano acrescenta são **três perguntas de transcrição** dentro delas e uma regra:
   **a escolha final entre as variantes fica suspensa até a quinta conversa.**

10. **O argumento mais forte contra este documento é bom, e eu concordo com metade dele** (§R.2):
    com um punhado de tenants e um sitemap que sai deles **[M]**, a copy não é o gargalo. A resposta
    está no item 1.

---

## FASE A · Diagnóstico da copy atual, linha por linha

Levantado no código em 2026-08-24. **Correção ao prompt:** o inventário do §3.1 do 19 está
incompleto — a home **já mostra preço na primeira dobra** (`src/app/page.tsx`), decisão que veio
depois de o PDF ser escrito. Diagnostiquei a peça real, não a do PDF.

**Escopo, dito com precisão:** o §6 do prompt define a Fase A como "a landing, `/precos` e o
onboarding", e é isso que está diagnosticado aqui. O produto tem outras rotas públicas —
`/[slug]`, `/confirmar`, `/avaliar`, `/lista-espera`, `/orcamento` — mas elas falam com o
**cliente do tenant**, não com quem está decidindo se cria conta. São copy transacional, e ficam
para a rodada das telas internas (§11).

Legenda dos tiques (§0.1): **T1** tricolon · **T2** "não é X, é Y" · **T3** travessão como
tempero · **T4** empilhamento de adjetivo · **T5** equilíbrio falso · **T6** abstração com cara de
insight · **T7** voz sem dono · **T8** gênero cravado no feminino (acrescentei este: é o G2 do
`09-PLATAFORMA.md`, e na porta de entrada ele funciona exatamente como um tique).

### A.1 · Landing (`src/app/page.tsx`)

| Peça | Texto atual | Tique | O que a pessoa entende | Veredito |
|---|---|---|---|---|
| Título da aba | "CICLO — a agenda que traz sua cliente de volta" | T8 ("sua cliente") | "é uma agenda de salão" | **Reescreve** — mantém "agenda" (busca), corrige gênero e promessa |
| Descrição (meta) | "Agenda, site de agendamento e caixa para quem atende com hora marcada. O CICLO aprende de quanto em quanto tempo cada cliente volta, avisa quem atrasou e te dá a mensagem pronta para chamar." | T1 (agenda·site·caixa) | "é um pacote de três coisas" | **Reescreve** — a 2ª frase é boa e específica; ela devia vir primeiro |
| Descrição (OG) | "Para barbearia, unhas, cílios, sobrancelha, depilação e estética. Feito para o celular, em português." | T1, T7 | "é para salão" | **Reescreve** |
| **H1** | "A agenda que sabe quando cada cliente volta — e traz de volta quem sumiu." | T3 | "agenda" em 2s; o diferencial chega depois do travessão, disputando a mesma respiração | **Reescreve** — tem mecanismo (o que salva a linha), mas ancora na categoria errada |
| Subtítulo | "Para quem atende com hora marcada: barbearia, unhas, cílios, sobrancelha, depilação, estética. Em português, feito para o celular, sem treinamento." | **T1** (é o exemplo literal do §0.1), T7 | "é para salão, e é simples" | **Corta a 2ª frase inteira**, reescreve a 1ª |
| CTA primário | "Criar minha conta" | — | ação clara, sem custo escondido | **Mantém** |
| CTA secundário | "Ver um salão de exemplo" | — | "é para salão" | **Reescreve** — "salão" fecha a porta que o resto da página tenta abrir |
| Linha de preço | "Grátis para começar, R$ 49 por mês para ir além — ver os planos" | T3, T6 ("ir além") | "tem grátis e tem pago" | **Reescreve** — a decisão de mostrar preço é forte e fica; a frase é vaga |
| Card 1 · título | "Cliente sumida tem nome" | T8 | o melhor título da página | **Reescreve só o gênero** |
| Card 1 · corpo | "…aprende o ritmo de cada pessoa — quem volta a cada 21 dias, quem volta a cada dois meses — e mostra quem passou do ponto. Com o valor que essa ausência representa…" | T3 duas vezes na mesma frase; "aprende" | "ele calcula sozinho" — e superestima: "o valor que essa ausência representa" soa como dinheiro perdido, mas o produto calcula **estimativa** | **Reescreve** — ver A.4 |
| Card 2 · título | "Sua página de agendamento" | T7 | genérico | **Reescreve** — qualquer concorrente cola isto |
| Card 2 · corpo | "Um link para colar na bio do Instagram…" | — | concreto e bom | **Mantém** |
| Card 3 · título | "O dia fechado sem calculadora" | — | bom, específico | **Mantém** |
| Card 3 · corpo | "Quanto entrou, quanto foi de material, quanto ficou na maquininha, quanto é de comissão e quanto sobrou." | T1 esticado — cinco itens em ritmo igual | "controla dinheiro" | **Encurta** — e ver A.4: caixa **não está no Grátis** |
| Passos 1–3 | "Crie a conta e diga o que você faz" · "Compartilhe seu link" · "Atenda. O resto o CICLO acompanha" | T8 no passo 3 ("daquela cliente") | concretos, na ordem certa | **Mantém** com correção de gênero |
| Lista "Feito para" | 8 profissões | — | "é de beleza" | **Reescreve** — são 17 no catálogo **[M]** |
| Fecho da lista | "E qualquer trabalho que dependa de hora marcada e de cliente que volta." | — | **a melhor linha da página para o §4.1** | **Promove** — está no rodapé de uma seção que quase ninguém alcança |
| FAQ 1 | "Preciso instalar alguma coisa?" | — | responde a objeção real | **Mantém** |
| FAQ 2 | importar de planilha | — | boa | **Mantém** — e ver E.2: falta a de **migrar de outro sistema** |
| FAQ 3 | "A confirmação vai pelo WhatsApp que você já usa." | — | promete envio automático | **Corta ou condiciona** — WhatsApp sem credencial **[M]** e cron desligado **[M]** |
| FAQ 4 | "Funciona para quem atende sozinha?" · "…é para quem está sozinha que ele mais serve" | T8 | **a melhor resposta da página** — identidade pura (§F) | **Promove e corrige o gênero** |
| Fecho · H2 | "Comece pela sua agenda de amanhã" | — | claro | **Mantém** |
| Fecho · corpo | "Criar a conta leva menos de três minutos, e o catálogo da sua profissão já vem preenchido." | — | um número | **Corta o número** — "< 3 min" é a **meta** do `09-PLATAFORMA.md` §13.2, nunca medida: o `scripts/metricas-ativacao.mjs` só tem base semeada **[M]**. É **[S]** vestido de **[M]**, e viola a regra 3 do §5 |
| Rodapé | "CICLO · para quem atende com hora marcada" | — | ok | **Mantém** |

### A.2 · `/precos` (`src/app/(public)/precos/page.tsx`)

| Peça | Texto atual | Tique | O que a pessoa entende | Veredito |
|---|---|---|---|---|
| H1 | "Comece de graça. Pague quando o CICLO já estiver te dando trabalho a menos." | T6 ("trabalho a menos") | "é grátis e depois cobra" | **Reescreve** — o produto não vende trabalho a menos, vende cliente de volta |
| Subtítulo | "…Todo plano inclui lembrete, confirmação e o Motor de Ciclo — não cobramos à parte por isso." | **T1**, T3 | "está tudo incluso" | **Reescreve** — dois dos três itens não rodam hoje **[M]** |
| Cartão Grátis · "Lembrete e confirmação de agendamento" | idem | — | "recebo lembrete automático" | **Condiciona** — é o mesmo defeito, dentro do cartão |
| Cartão Essencial · "menos de R$ 1,70 por dia — o preço de um corte, uma vez por mês" | — | T3 | enquadramento na unidade dele | **Mantém** — é a melhor aplicação de persuasão do produto (18 §E.4) |
| "Perguntas de dinheiro" (7) | todas | — | respostas diretas, com o custo dito na cara | **Mantém integralmente** — e vira **a referência de voz** da Fase C |

**Achado que organiza a Fase C:** a `/precos` é o único texto do produto que um concorrente **não
conseguiria colar**. Ela passa no teste do §0.1 e a home não. O problema não é falta de talento de
escrita neste projeto — é que a home foi escrita para **descrever** e a `/precos` foi escrita para
**responder**. Descrever produz adjetivo; responder produz especificidade.

### A.3 · Onboarding (`src/app/onboarding/`)

| Peça | Texto atual | Tique | O que a pessoa entende | Veredito |
|---|---|---|---|---|
| H1 | "Vamos criar seu negócio" | T6 | **factualmente errado**: o negócio dele já existe há anos; o que ele vai criar é uma conta | **Reescreve** |
| Subtítulo | "Você poderá ajustar tudo isso depois." | — | reduz atrito, é o certo aqui | **Mantém** |
| Ajuda do endereço | "É o link que você manda para a cliente agendar." | T8 | ok | **Corrige o gênero** |
| Erro | "Não consegui criar seu negócio." | T6 | não diz o que fazer | **Reescreve** (regra do `CLAUDE.md`: erro explica o que fazer) |

### A.4 · Três promessas que o código não cumpre — o §4.5, medido

| Promessa na copy | O que o código faz | Onde |
|---|---|---|
| "Lembrete e confirmação" (home, `/precos`, cartão do Grátis) | as rotas existem; **`"crons": []`** — nunca executam em produção | `vercel.json` **[M]** · `src/app/api/cron/reminders/` |
| "A confirmação vai pelo WhatsApp que você já usa" | `config()` estoura sem credencial e `enviarComFallback` cai para push e depois e-mail | `src/server/providers/messaging/whatsapp.ts` **[M]** |
| "O dia fechado sem calculadora", na home, sem dizer o plano | `register` (comanda e caixa) é módulo do **Essencial**; o Grátis não tem | `src/core/billing/planos.ts` **[M]** |

E uma quarta, mais sutil: **"o valor que essa ausência representa"** sugere dinheiro perdido. O
produto calcula `preço do serviço × chance de recuperação por estado`, e a própria tela já diz
*"Estimativa, não promessa"* **[M]** (`src/app/admin/recuperar/recuperar.tsx`). **A tela interna é
mais honesta que a porta de entrada** — a copy da porta tem que descer ao nível dela, não o
contrário.

Existe teste guardando `/precos` (`tests/unit/design/precos-nao-promete-demais.test.ts`) **[M]**.
**Não existe nada guardando a home** — e é exatamente por isso que as três de cima passaram.

### A.5 · A pergunta que organiza o resto

**Em quantos segundos alguém que nunca ouviu falar do CICLO entende o que ele faz e para quem?**

Resposta, lendo a página como quem não a escreveu: **o "o quê" chega em ~2s e o "por que este"
nunca chega.** "Agenda" é categoria conhecida — o cérebro resolve, arquiva e para de ler. O
diferencial vem depois de um travessão, na mesma linha, competindo com a parte que já foi
entendida. E o "para quem" chega errado: seis profissões de beleza em 2s convencem 8 das 17
profissões do catálogo de que a página não é para elas.

**Alvo:** o mecanismo em **5s**, sem rolagem, e o "para quem" **sem lista** na primeira dobra.

---

## FASE B · Posicionamento — a decisão que vem antes das palavras

Nenhuma palavra final é escrita nesta fase (§6 do prompt). O que se decide aqui é contra quem o
produto compete, o que ele promete e com quem fala.

### B.1 · Contra quem competimos na cabeça de quem lê

Não é uma resposta só, e essa é a descoberta desta fase: **são duas cabeças, e elas não se
encontram na mesma página.**

| Leitor | Contra quem o CICLO compete na cabeça dele | Consequência |
|---|---|---|
| **Quem nunca pagou por software** (maioria da base **[S]**) | caderno, bloco de notas do celular, WhatsApp fixado, memória | O adversário custa **R$ 0** e nunca cai. Contra ele, "mais organizado" não é argumento — só é argumento **o que o caderno não faz**: lembrar de quem parou de vir |
| **Quem já pesquisa e compara** | Simples Agenda (R$ 39,90) e Fresha (R$ 39,95) **[M]**, Trinks (R$ 76) **[M]** | Aqui o CICLO é **o caro** (18 §E.2.1). Contra ele, "agenda" é terreno perdido por definição |

**Decisão: a home fala com o primeiro; a `/precos` responde ao segundo.** — **Recomendado**

Isso já está meio construído sem ter sido dito: a `/precos` **já** é uma página de comparação
honesta ("preço na tela, sem fale-com-um-consultor"), e a home **ainda** fala como se o leitor
estivesse comparando planilhas de recursos. Alinhar isso é metade da Fase D.

### B.2 · A promessa central — §4.2

**Decisão: a promessa central é o retorno do cliente, não a agenda.** — **Recomendado**

O argumento não é de gosto, é aritmético e já está medido no 18: em "agenda", o CICLO é comparável
item a item e **23% mais caro** que um concorrente com 3.900 salões **[M]**. Numa categoria onde o
produto é comparável e mais caro, cada real de copy gasto reforçando a categoria trabalha contra o
preço. Em "quem parou de voltar" a aposta era que não houvesse com quem comparar. **Fui conferir, e
essa parte estava errada** — ver §B.2.1. A categoria **não** está vazia: a Belasis vende
"recuperação inteligente de clientes inativos" **[M]**. O que continua verdadeiro, e é o que
sustenta a decisão, é mais estreito e mais defensável: **ninguém vende isso no degrau de entrada,
e ninguém descreve o mecanismo por pessoa.**

**A frase que só o CICLO pode assinar**, submetida ao teste do §0.1 — *o concorrente colaria isto
sem mentir?*:

> **O CICLO te mostra, com nome e telefone, quem devia ter voltado e não voltou.**

- "com nome e telefone" — o Trinks não fala disso **[M]**, mas **a Belasis colaria** **[M]**. A
  frase, como está, **não passa no próprio teste**.
- "devia ter voltado" — pressupõe um ritmo calculado por pessoa. É literalmente o que o
  `computeCycle` faz **[M]**, e é a parte que a Belasis **não** pode colar: a comunicação dela é de
  *segmento* ("clientes inativos", "gráfico de inativos"), não de cadência individual **[M]**.

**Frase revista, depois da pesquisa:**

> **O CICLO sabe que uma pessoa volta a cada 21 dias e outra a cada dois meses — e é por isso que
> ele sabe quem está atrasado. Ver quem sumiu é de graça.**

Duas coisas que nenhum dos cinco pode colar: o **ritmo por pessoa** (todos falam de segmento ou de
janela de inatividade **[M]**) e o **de graça** (nenhum dos cinco tem plano gratuito **[M]**).

### B.2.1 · A pesquisa de posicionamento — feita, e ela derrubou parte da tese

O §2.1 do 17 é claro: pesquisa é com ferramenta, com URL e data — não de memória. O 18 cumpriu isso
para **preço**; para **posicionamento**, ninguém tinha olhado. Fui olhar. Consultado em
**2026-08-24**, transcrevendo o H1 de cada um em vez de resumir.

| Concorrente | H1 declarado | Fala de retorno / inativo? | Palavra do profissional | Fonte |
|---|---|---|---|---|
| **Trinks** (B2B) | "quem quer subir de nível conta com a Trinks" | **Não** — o mais perto é "fidelize clientes com o Clube de Assinaturas" | "profissionais", "barbeiros" | [negocios.trinks.com](https://negocios.trinks.com/) |
| **Avec** | "Tudo o que o seu negócio precisa, em um só lugar" | **Não** — "Fidelidade" aparece como funcionalidade, sem discurso | — | [negocios.avec.app](https://negocios.avec.app/) |
| **Fresha** | "A melhor plataforma para salões e spas" | **Não** — lembrete e depósito contra falta, nada de inativo | — | [fresha.com/pt/for-business](https://www.fresha.com/pt/for-business) |
| **Simples Agenda** | home continua **403 a robô**, igual ao 18 §A.1. Pelos títulos das páginas indexadas: "Agenda Online com **Gestão Financeira**" · "Sistema de Agendamento Online **a partir de R$ 39,90/mês**" · **"Sistema para Autônomo"** | **Não** — nada de retorno ou inativo em nenhum título | "autônomo" | títulos indexados de [simplesagenda.com.br](https://www.simplesagenda.com.br/site/index.php) — **[M]** para o título, **[S]** para o corpo, que ninguém leu |
| **Belasis** ⚠️ | "A plataforma que faz seu negócio crescer todos os dias" · subtítulo: "**o CRM com IA** que faz seu negócio crescer todos os dias" | **SIM, e explicitamente** | "clientes" | [belasis.com.br](https://www.belasis.com.br/) |

**O achado que muda a tese.** A Belasis diz, na home: *"Agende mais, **recupere clientes** e aumente
seu faturamento com inteligência artificial"* **[M]**, e mantém uma página inteira chamada **"Perdi
o controle dos clientes inativos"** **[M]**. O material dela fala em "recuperação inteligente de
clientes inativos", "gráfico com seus clientes inativos" e campanha automática por WhatsApp **[M]**.

**A categoria não está vazia. O §R.3 item 1 — "eles já podem estar anunciando" — aconteceu.**

### B.2.2 · O que sobra de diferenciação depois disso, e por que é melhor do que antes

Fui atrás do degrau em que a promessa da Belasis mora, e é aí que a notícia vira boa:

| | Belasis **[M]** | CICLO **[M]** |
|---|---|---|
| Onde mora a recuperação | "Campanhas Inteligentes de Marketing" — a partir do **Pro, R$ 189/mês** | **ver quem sumiu está no Grátis**; o pago (R$ 49) libera mandar para todos de uma vez |
| Assistente de IA proprietário | só no **Scale**, preço sob consulta | não existe, e não vai ser anunciado (§C.2) |
| Plano gratuito | **não tem** | tem, para sempre |
| Mecanismo declarado | segmento: "clientes inativos", "gráfico de inativos" | **ritmo por pessoa**: mediana dos intervalos daquela pessoa, com valor estimado e ordenação |

**A diferenciação não é *ter* a promessa. É o degrau em que ela mora e o mecanismo que a produz.**
Isso é mais estreito que "categoria vazia" e é muito mais defensável — porque é verificável nas
duas páginas de preço, e porque um concorrente não muda de degrau sem mexer na receita dele.

**A tensão nova, e ela é real:** a Belasis compete com narrativa de **IA**, e o §C.2 deste documento
proíbe o CICLO de dizer "aprende" porque o `compute.ts` é mediana determinística. Ou seja, o CICLO
escolheu competir contra um discurso de IA com um discurso de honestidade — o que **é** uma posição,
mas é uma posição que perde em qualquer comparação superficial de folheto. Registrado como o custo
consciente da decisão do §C.2, não como descuido. — **Recomendado**

**Duas coisas que a pesquisa também deu de graça:**

1. **Nenhum dos cinco tem plano gratuito** **[M]**. "Grátis para sempre" é diferencial de verdade,
   e hoje aparece na home do CICLO como uma linha de rodapé de preço.
2. **Todos os cinco H1 são genéricos** — "tudo em um só lugar", "a melhor plataforma", "subir de
   nível". Nenhum deles diz um mecanismo. O espaço de "dizer o que o software faz" está **vago**,
   mesmo com a categoria de retenção ocupada.
3. ⭐ **O Simples Agenda tem uma página inteira chamada "Sistema para Autônomo"** **[M]**. É o
   concorrente mais barato **e** o único que usa a palavra da identidade que a §F.6 recomenda. Não
   invalida nada — mas mostra que "para quem trabalha por conta" não é território virgem, e que a
   diferenciação do CICLO tem que continuar sendo o **mecanismo**, nunca o público.

**O que não muda:** "agenda" continua no título da aba e nas respostas de FAQ. Tirar a palavra de
todo lugar seria trocar um erro de posicionamento por um erro de descoberta — quem busca
"agenda para barbearia" precisa achar o CICLO. **Categoria na busca, mecanismo na página.**

### B.3 · O alcance da home — §4.1, a tensão central

As três saídas conhecidas do prompt, com a consequência de cada uma:

| Saída | Ganha | Perde | Custo |
|---|---|---|---|
| **Home ampla + página por profissão** | cauda longa de busca; cada profissão se vê nomeada | 17 páginas finas com uma base de poucos tenants é exatamente o padrão que buscador penaliza — e o 18 §P.2 já condicionou SEO a **≥30 tenants ativos** **[M]** | Alto, e cedo demais |
| **Home de nicho + troca de nicho visível** | credibilidade máxima com o ICP | o psicólogo que chega sozinho continua sem porta; e troca de nicho é gramática de e-commerce, estranha em SaaS de autônomo | Médio |
| **Home por eixo, não por profissão** | uma frase serve as 17; não promete o que não há | risco do §0.1: eixo é abstração, e abstração é o modo de falha número um deste trabalho | Baixo, se a frase for concreta |

**Decisão: home por eixo na primeira dobra, lista das 17 profissões mais abaixo, nenhuma página por
profissão agora.** — **Recomendado**

O eixo escolhido é o `ritmo` — "trabalho que depende de cliente que volta" — e ele é escolhido por
um dado, não por elegância: das 8 profissões nomeadas hoje **nenhuma** tem ritmo recorrente; das 9
escondidas, **cinco** têm: faxina, personal, psicólogo, professor e jardineiro **[M]**.

**O que se perde, dito na cara:** nenhuma URL nova para indexar; nenhuma profissão nova aparece em
busca; e o barbeiro passa a ler uma frase menos específica do que "para barbearia" — o painel
confirmou esse custo e mudou a Fase D por causa dele (§7.4). A troca vale porque **o custo de busca
é quase zero hoje** — o `sitemap.ts` gera uma URL por tenant não deletado **[M]**, e a base é de
poucos tenants, dos quais alguns são resíduo de suíte de teste (18 §P.1.1) — e o custo de fechar a
porta é permanente.

**Gatilho para reabrir:** ≥30 tenants ativos, o mesmo sinal que o 18 §P.2 já usa para SEO.

### B.4 · Quem é o "você" da frase — §4.3

**Decisão: a home fala com o eixo do ritmo, adapta por nomeação na seção "Feito para", e assume um
erro de vocabulário conhecido.** — **Recomendado**

O erro assumido: a home vai dizer **cliente**. No catálogo, 12 das 17 profissões usam "cliente"; as
exceções são "aluno" (personal, professor), "paciente" (psicólogo) e "tutor" (banho e tosa) **[M]**.
Para essas cinco, a palavra da home está errada.

Corrigir isso na home exigiria ou um seletor antes da leitura — atrito na primeira dobra — ou uma
palavra guarda-chuva ("a pessoa que você atende"), que é exatamente a abstração do §0.1. **A
correção certa é dentro do produto**, pelo `professions.vocab` mesclado com `tenants.vocab_override`,
que já existe no schema e ainda não é lido em runtime (`09-PLATAFORMA.md` §3.4, P2/P3) **[M]**. Na
home o custo é aceito e registrado — não escondido.

E o gênero (§3.3 do prompt, G2 do 09): **nada de cliente-parênteses-a, nada de barra, nada de
arroba.** Vale a regra §3.2 do `09-PLATAFORMA.md`, que já é decisão registrada: **escrever para não
precisar de concordância.** É disciplina de redação, não recurso — e o próprio doc observa que o
texto sai melhor: "A seguir" é melhor que "Próxima cliente" mesmo num salão. Tabela na Fase C.

### B.5 · O que dá para prometer hoje — §4.5 e §4.6 viram restrição, não rodapé

| Pode prometer | Não pode prometer hoje | Volta a poder quando |
|---|---|---|
| Ver quem passou do ponto de voltar, com nome e valor estimado — o Motor está no **Grátis** **[M]** | "avisamos automaticamente", "toda semana", "todo dia" | P-0 do 18: cron ligado, custo R$ 0 **[M]** |
| Mandar a mensagem pronta pelo WhatsApp **que ele abre** (link `wa.me`) | "mandamos WhatsApp por você", "confirmação automática pelo WhatsApp" | credencial do WhatsApp Business (TICKET-043) — **Bloqueado** |
| Página pública de agendamento no ar, hoje | — | — |
| Grátis para sempre, e a base nunca some | assinar por cartão em dois toques | cobrança automática (18 §P.2, ≥10 pagantes) — **Bloqueado** |
| Caixa, comanda e campanha | prometer isso **sem dizer o plano** | — é só escrever certo |

**Consequência direta:** o H1 recomendado da Fase D tem **duas formas** — uma com cadência ("Toda
semana…") e uma sem. A escolha entre elas não é decisão de copy, é decisão de cron.

### B.6 · Hierarquia de mensagens

| Tempo | O que a pessoa precisa entender | Onde vive |
|---|---|---|
| **5s** | "isso me mostra quem parou de aparecer" | H1 |
| **30s** | "serve para o meu trabalho, e eu vejo funcionando" | subtítulo + exemplo real no ar + os três cartões |
| **3min** | "custa quanto, o que é grátis, e o que acontece se eu parar" | `/precos` e as perguntas |

O defeito de hierarquia de hoje: **a resposta de 3min mais forte do produto — "se eu parar de
pagar, perco meus clientes?" → "Nunca" — está enterrada na `/precos`**, e o painel mostrou que ela
já é decisiva aos 30s para quem tem margem apertada (§7.3, faxineira).

### B.7 · As personas do painel foram congeladas AQUI

Antes de qualquer palavra da Fase D existir — e é por isso que elas aparecem antes dela neste
documento, e não dentro da Fase E. São as seis do §7.3 do prompt, literais, cada uma com o motivo
próprio de desconfiar:

1. **Barbeiro, 34, uma cadeira** — já testou app que "não serviu"; decide no celular, entre dois cortes.
2. **Dona de salão, 45, 4 profissionais** — paga Trinks hoje; a pergunta dela é "por que trocar?".
3. **Psicóloga, 38, consultório próprio** — não se reconhece em nada que fale de salão; teme parecer comercial demais com paciente.
4. **Eletricista, 50, sozinho** — não usa agenda; o problema dele é orçamento e cliente que some antes de fechar.
5. **Faxineira, 41, casas fixas** — margem apertada; qualquer mensalidade é decisão difícil, e desconfia de letra miúda.
6. **Cético profissional** — lê procurando exagero, promessa vaga e cheiro de IA. Existe para reprovar.

**Regras que valem no §7:** cada uma responde sozinha, sem ver as outras; a pergunta é "em que
ponto exato você fecharia a aba?", nunca "gostou?"; o veto do cético é acatado mesmo contra as
outras cinco; e convergência total é sinal de painel ruim, não de copy boa.

---

## FASE C · Voz e vocabulário

A voz não é inventada aqui. Ela foi **encontrada** na A.2: as "Perguntas de dinheiro" da `/precos`
já são o CICLO falando. Esta fase só descreve o que elas fazem, para poder repetir de propósito.

### C.1 · Três adjetivos, cada um com contraexemplo

| A voz é | E não é | Sim | Não |
|---|---|---|---|
| **Direta** | seca | "Sem clientes ainda" | "Nenhum registro encontrado" |
| **Concreta** | técnica | "quem volta a cada 21 dias" | "análise preditiva de recorrência" |
| **Honesta até quando custa** | humilde de fachada | "A cobrança automática ainda não está no ar — preferimos dizer isso a montar um botão que não funciona" | "Em breve!" |

O terceiro é o que dá identidade, e é o mais difícil de imitar: **o concorrente pode copiar o tom,
não a disposição de contar o que ainda não existe.** É também o único que já está provado neste
produto — a frase acima está no ar hoje **[M]**.

### C.2 · Palavras que o produto não usa

Proibidas pelo §5.5 do prompt e ampliadas pelo que apareceu na auditoria: **poderoso · solução ·
plataforma · otimize · impulsione · descomplique · revolucionar · transformar · inteligente ·
simplesmente · incrível · completo · robusto · intuitivo · em breve**.

Três acréscimos com motivo próprio:

- **"aprende"** — está na home hoje. O `compute.ts` diz *"determinístico, sem ML"* **[M]**: é
  mediana dos intervalos, com descarte de exceção e limite de 0,5× a 2,5×. Chamar isso de
  "aprende" é emprestar vocabulário de IA a uma conta de mediana, e é o gatilho nº 1 do cético.
  **Substitutos honestos: "calcula", "olha o histórico", "usa o intervalo de cada pessoa".**
- **"completo"** — adjetivo sem número (T4), e o produto tem limite por plano. Diz mentira e nem
  vende.
- **emoji** — §5.6 do prompt. O design system não usa, e o motivo é o mesmo do 18 §E.3 recusar
  R$ 97: cheiro de infoproduto num público que precisa confiar dado de cliente ao software.

### C.3 · Palavras que o produto usa

**cliente · voltar · sumiu · atrasado · lista · link · mensagem · dia · caixa · comanda · ciclo ·
grátis · nunca · você.**

Regra de ouro herdada da `/precos`: **substantivo concreto ganha de adjetivo, e número com origem
ganha de substantivo.** "23 pessoas passaram do ponto" ganha de "muitos clientes somem".

### C.4 · Gênero sem concordância — a tabela

Aplicação da regra §3.2 do `09-PLATAFORMA.md` na copy pública:

| Onde está | Hoje | Vira | Por quê |
|---|---|---|---|
| Título da aba | "traz sua cliente de volta" | "avisa quem parou de voltar" | some o gênero e some a promessa exagerada, de uma vez |
| Card 1 | "Cliente sumida tem nome" | "Quem sumiu tem nome" | mais curto, e serve barbearia e eletricista |
| Passo 3 | "o ciclo daquela cliente" | "o ciclo daquela pessoa" | ou reescreve sem posse: "alimenta o ciclo" |
| FAQ 4 | "quem atende sozinha" | "quem atende sozinho" não resolve → **"quem trabalha por conta"** | evita escolher um gênero em vez de trocar de gênero |
| Onboarding | "para a cliente agendar" | "para agendar" | o complemento não estava fazendo trabalho nenhum |
| Card 2 | "A cliente escolhe serviço, profissional e horário **sozinha**" | "Quem for marcar escolhe serviço, profissional e horário sem precisar falar com você" | achado só na execução (§S.1): eram **duas** marcas de gênero na mesma frase, e a segunda estava escondida atrás de um advérbio |

**Teste de aceitação da regra:** se a frase precisa de parêntese, barra ou arroba, ela está errada
antes de chegar ao gênero. Reescreve.

### C.5 · Como falar de dinheiro, de tempo e de erro

| Assunto | Regra | Exemplo bom | Exemplo proibido |
|---|---|---|---|
| **Dinheiro** | sempre com a origem do número | "o preço do seu serviço multiplicado pela chance de a pessoa voltar" | "aumente seu faturamento em 30%" |
| **Estimativa** | dizer que é estimativa, como a tela já diz | "Estimativa, não promessa" | "você está perdendo R$ 1.840" |
| **Tempo** | número só com fonte (§5.3) | "o catálogo da sua profissão já vem preenchido" | "economize 3 horas por semana" · "leva menos de 3 minutos" |
| **Erro** | diz o que fazer (regra do `CLAUDE.md`) | "Não consegui falar com o servidor. Tente de novo." | "Não consegui criar seu negócio." |
| **Limite de plano** | diz o motivo e o caminho (18 §5.2) | "Avisar uma de cada vez continua de graça" | "Faça upgrade para continuar" |

---

## FASE D · Reescrita

Três variantes por peça, **cada uma com hipótese diferente** — A aposta no **mecanismo** (como
funciona), B na **dor** (o que dói hoje), C no **resultado** (o que muda). Três versões da mesma
ideia não são três variantes (§6 do prompt).

Duas convenções de medida usadas nas tabelas:

- **Teste do concorrente** (§0.2): *o Simples Agenda poderia colar esta linha no site dele sem
  mentir?* "Cola" = a linha não posiciona nada.
- **390px**: no H1 cabem ~28 caracteres por linha; no corpo, ~44 **[E]** — estimativa a partir da
  escala tipográfica do `03-DESIGN-SYSTEM.md` e do `--gutter`. Alvo: H1 em **até 3 linhas**.

### D.1 · Home — título da aba

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "CICLO — quem parou de voltar, com nome e telefone" (49) | mecanismo | especificidade | passa | não |
| B | "CICLO — a lista de quem parou de voltar" (39) | resultado | especificidade | passa | não |
| C | "CICLO — a agenda que avisa quem parou de voltar" (47) | mecanismo + descoberta | especificidade | passa | não |

**Recomendada: C.** É a única que mantém a palavra que a busca usa ("agenda") sem deixar a agenda
ser a promessa. A e B posicionam melhor e são invisíveis para quem procura "agenda para
barbearia" — e com uma base deste tamanho o CICLO não tem marca própria para ser procurado pelo nome.
— **Recomendado**

### D.2 · Home — H1

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "O CICLO calcula quando cada cliente volta, e avisa quem passou do ponto." (72, 3 linhas) | mecanismo | especificidade | passa | não |
| B | "Quantos clientes seus pararam de voltar sem você perceber?" (58, 3 linhas) | dor | custo de inação | passa — é pergunta, não escassez | não |
| C | "Toda semana, a lista de quem devia ter voltado e não voltou." (60, 3 linhas) | resultado | especificidade + hábito | **só passa com o cron ligado** | não |

**Recomendada: C, condicionada.** É a única que descreve uma **entrega**, não uma capacidade — e
entrega com cadência é o que forma hábito (18 §I.2). Mas "toda semana" é promessa de cadência, e
com `"crons": []` ela é falsa. **Enquanto o P-0 não estiver feito, vale C-zero: "A lista de quem
devia ter voltado e não voltou." (47, 2 linhas)** — mesma frase sem a cadência.
— **Recomendado**, e **Bloqueado** na forma com cadência até o P-0.

#### D.2.1 · A quarta hipótese, que só apareceu depois da pesquisa

O contrato pede três variantes com três hipóteses — mecanismo, dor e resultado. A §B.2.1 revelou uma
quarta que nenhuma delas cobre: **acesso**. Nenhum dos cinco concorrentes diretos tem plano gratuito
**[M]**, e no CICLO **ver quem sumiu é de graça** **[M]**. Isso não é mecanismo, não é dor e não é
resultado — é a condição de entrada, e é o único atributo em que o CICLO é literalmente único entre
os cinco.

| Var | Texto | Hipótese | §5.10 | Cola? |
|---|---|---|---|---|
| **D** | "Veja de graça quem parou de voltar." (35, 2 linhas) | **acesso** | passa — é a fronteira real do `planos.ts` **[M]** | **não**: nenhum dos cinco pode dizer "de graça" |

**Não a promovo a recomendada, e o motivo importa:** headline que lidera por preço ensina a pessoa a
comparar por preço — que é exatamente o terreno onde o CICLO perde (18 §E.2.1). "De graça" é forte
como **segunda linha**, não como promessa. Fica no subtítulo e na linha de preço, e entra na
previsão 1 como alternativa a testar. — **Recomendado** (como apoio, não como H1)

**Por que não B**, apesar de ser a mais afiada: pergunta na primeira dobra transfere trabalho para
o leitor e admite a resposta "nenhum, eu sei todos" — que é justamente o que o barbeiro de uma
cadeira acredita. Fica registrada como a variante a testar quando houver tráfego para testar.

### D.3 · Home — subtítulo

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "Ele olha o histórico de cada pessoa, calcula o intervalo dela e mostra quem passou do ponto." (92) | mecanismo | especificidade | passa | não |
| B | "Cliente não avisa que parou de vir. Some do caderno, e faz falta no fim do mês." (79) | dor | custo de inação | passa | não |
| C | "Para qualquer trabalho que dependa de cliente que volta." (56) | resultado/alcance | identidade | passa | não |

**Recomendada: C** — e ela não é escrita nova: é a **promoção** da melhor linha que a página já
tem, hoje escondida no rodapé da seção "Feito para" (§A.1). Resolve o §4.1 na posição de maior
atenção **sem** listar profissão, que é o que o painel vetou (§7.4).
— **Recomendado**

A vira o texto do **Card 1**; B fica guardada para a peça de campanha, onde dor funciona melhor que
na porta de entrada.

**O que sai inteiro:** "Em português, feito para o celular, sem treinamento." É o tricolon literal
do §0.1, e as três informações são verdadeiras e irrelevantes — nenhuma delas é motivo para
escolher o CICLO em vez de outro. Migram para a FAQ, onde são objeção respondida em vez de
argumento de venda.

### D.4 · Home — CTA secundário e prova por demonstração

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "Ver uma página no ar" | mecanismo | prova por demonstração | passa | não |
| B | "Ver como fica a sua página" | resultado | dotação | passa | não |
| C | ~~"Ver a página do Dom Rocha"~~ | resultado + prova | prova por demonstração | ❌ **REPROVA** | não |

**Recomendada: A. A variante C está retirada, e o motivo é grave o bastante para ficar escrito.**
— **Decidido**

#### D.4.1 · ⚠️ Correção — a variante C violava o §5.10, e eu não tinha conferido

A versão anterior desta seção classificou C como "Do Eduardo, esperando autorização do dono do
`dom-rocha`", e a justificou como *"prova social **verdadeira** sem inventar número"*. **As duas
coisas estavam erradas, e a segunda é o defeito mais grave que este documento podia cometer.**

`scripts/seed-demo-barbearia.mjs` abre com a frase, literal: *"Semeia a barbearia de demonstração —
**um tenant fictício** com 6 meses de história real…"* **[M]**. A "Barbearia Dom Rocha" não é um
cliente do CICLO: é uma fixture que o próprio projeto cria por script, com clientes, faltas e
aniversários fabricados.

Ou seja: **não há dono para autorizar, e nomeá-la como exemplo seria apresentar um negócio
inventado como se fosse um cliente** — que é literalmente a linha "Prova social inventada" da
tabela de proibições do 17 §5.10. Eu escrevi uma recomendação que quebrava a regra que este mesmo
documento chama de inviolável, porque supus "demo real" (como o 18 §3 a chama) em vez de abrir o
script.

**O que sobrevive, e continua valendo:** a demonstração é forte de verdade — a página está no ar e
a agenda funciona. Ela é **demonstração de produto**, não **prova social**. A distinção não é
semântica: demonstração mostra o que o software faz; prova social afirma que outra pessoa comprou.
O CICLO pode fazer a primeira hoje e **não pode** fazer a segunda enquanto não tiver cliente real
que autorize.

**O que sai em qualquer hipótese** é "salão": a palavra fecha, num botão, a porta que o subtítulo
acabou de abrir para 9 das 17 profissões.

**Texto aplicado:** "Ver uma página de exemplo" — "de exemplo" é a palavra que impede a leitura de
"este é um cliente nosso".

### D.5 · Home — Card 1 (o cartão do Motor de Ciclo)

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | **"Quem sumiu tem nome"** · "O CICLO olha o histórico de cada pessoa, calcula de quanto em quanto tempo ela costuma voltar e mostra quem passou do ponto. Com o telefone e a mensagem pronta." | mecanismo | especificidade | passa | não |
| B | **"Você não lembra. Ele lembra."** · "Ninguém guarda de cabeça que a Fernanda vinha a cada três semanas e sumiu faz dois meses. A lista guarda." | dor | custo de inação | passa | não |
| C | **"Quem sumiu tem nome"** · "23 pessoas passaram do ponto de voltar. O CICLO estima quanto vale chamar cada uma — preço do serviço vezes a chance de ela voltar — e ordena a lista por aí." | resultado | especificidade + custo de inação | passa: diz que é estimativa e mostra a fórmula | não |

**Recomendada: C.** É a única que entrega o número **com a origem** (§5.3 do prompt) e que herda o
enquadramento honesto que a tela interna já usa — *"Estimativa, não promessa"*. O "23" é ilustração
de layout, não afirmação: **na página vai como exemplo visual da tela, nunca como estatística do
produto**. — **Recomendado**

**Sai:** "aprende" (veto do cético, §7.4) e "o valor que essa ausência representa" — que sugere
dinheiro perdido onde o produto calcula chance de recuperação.

### D.6 · Home — seção "Feito para"

**Decisão: as 17 do catálogo, agrupadas, com beleza primeiro.** — **Recomendado**

> **Beleza** — Barbearia · Cabelo · Unhas · Cílios · Sobrancelhas · Depilação · Estética · Tatuagem
> **Casa** — Faxina e diarista · Eletricista · Encanador · Jardineiro
> **Saúde, aula e treino** — Psicólogo · Professor particular · Personal trainer
> **Pet e eventos** — Banho e tosa · Fotógrafo

Beleza primeiro **não é ordem alfabética nem acaso**: é onde o esforço de venda está (18 §B.2,
Decidido), e o olho lê o primeiro grupo como "é disto que ele é". O agrupamento faz o trabalho que
a lista corrida de 17 não faria — 17 chips soltos leem como "serve para tudo", que é o que o
barbeiro do painel rejeita.

**O fecho sai daqui** (virou subtítulo, D.3). A tentação era substituí-lo por "Não achou a sua? O
catálogo cresce com quem pede" — e **essa linha foi cortada por não ser verdade**: fui conferir e o
onboarding **não tem campo "Outro"**; quando a busca não acha, ele mostra "Nenhuma profissão
encontrada" e **não registra nada** (`src/app/onboarding/formulario.tsx`) **[M]**. O
`09-PLATAFORMA.md` §13.2 lista "o que digitam em Outro" como métrica desejada, não construída.

Isto é o §4.5 acontecendo **dentro deste documento**: escrevi uma linha plausível e ela não
sobreviveu à leitura do código. Fica sem substituto, e nasce um achado de produto para outro
ticket: **quem procura uma profissão que não existe some sem deixar rastro** — e essa é
exatamente a fila do catálogo que o 09 queria medir.

### D.7 · Home — o fecho

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "Comece pela sua agenda de amanhã" · "O catálogo da sua profissão já vem preenchido: serviço, duração e preço sugerido. Você ajusta o que quiser." | mecanismo | redução de atrito | passa | não |
| B | "Sua lista de quem sumiu começa vazia — e enche sozinha" · "Cada atendimento que você marca alimenta o ciclo daquela pessoa. Em duas ou três voltas, a lista já tem gente." | mecanismo/tempo | dotação | passa: diz que demora | não |
| C | "Comece de graça, e sem cartão" · "Grátis para sempre em um profissional. A base é sua: se você parar de pagar um dia, nada some." | resultado | aversão à perda invertida | passa | não |

**Recomendada: C.** — **Recomendado**

Motivo vindo do painel: a objeção "e se eu não puder pagar depois?" apareceu em duas personas de
margem apertada, e a **melhor resposta do produto está enterrada na `/precos`** (§B.6). Trazê-la
para o fecho da home é a maior movimentação de conversão barata que este documento encontrou.

**B merece nota porque é a única peça de copy do produto que fala do tempo até o valor aparecer** —
o Motor de Ciclo precisa de duas ou três voltas para ter o que mostrar, e **nenhuma linha da copy
atual diz isso**. Isso é gestão de expectativa, e a falta dela é uma causa provável de churn
precoce (§R.1).

**Sai:** "menos de três minutos" — número sem fonte (§A.1).

### D.8 · `/precos` — H1 e subtítulo

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "Comece de graça. O grátis já mostra quem parou de voltar." (57) | mecanismo | especificidade | passa | não |
| B | "Grátis para sempre em um profissional. Pago quando quiser chamar todo mundo de uma vez." (87) | dor | aversão à perda | passa | não |
| C | "Comece de graça. Pague quando quiser chamar a base inteira de uma vez." (70) | resultado | especificidade | passa | não |

**Recomendada: A.** — **Recomendado**

É a única que responde à pergunta que a pessoa **realmente** tem ao abrir a página de preço de um
produto desconhecido: *o grátis serve para alguma coisa?* E a resposta é verificável no código —
`cycle_engine` está nos módulos do Grátis **[M]**. A e C juntas descrevem a fronteira real do
paywall (`envio_em_lote`), o que torna a tabela de planos legível antes de ser lida.

**Subtítulo novo, recomendado:**

> "Preço na tela, sem cadastro. O Motor de Ciclo está em todos os planos, inclusive no grátis — o
> que o pago libera é chamar todo mundo de uma vez, em vez de um por um."

O que muda em relação ao atual: **sai o tricolon** ("lembrete, confirmação e o Motor de Ciclo") e
**saem as duas promessas que não rodam** (§A.4). Entra a fronteira do paywall dita em uma frase —
que é exatamente o que o `planos.ts` implementa **[M]**, e é a informação que faz a tabela de
quatro cartões parar de parecer uma lista de recursos.

**Cartão do Grátis:** "Lembrete e confirmação de agendamento" vira **"Lembrete e confirmação de
agendamento (em implantação)"** enquanto o cron estiver desligado, ou sai da lista. Prefiro a
segunda: um item marcado "em implantação" numa tabela de preço lê como desculpa, e o teste
`precos-nao-promete-demais` existe justamente para impedir esse tipo de item.
— **Recomendado**, e **Bloqueado** até o P-0.

### D.9 · Onboarding

| Var | Texto | Hipótese | Mec. §F | §5.10 | Cola? |
|---|---|---|---|---|---|
| A | "Três respostas e sua página está no ar" (38) | mecanismo | redução de atrito | passa: são três campos **[M]** | não |
| B | "Vamos montar sua agenda" (23) | resultado | — | passa | **cola** |
| C | "Configurar leva três perguntas" (30) | mecanismo | redução de atrito | passa | quase |

**Recomendada: A.** — **Recomendado**

O formulário tem exatamente três campos: nome do negócio, profissão e endereço da página **[M]**.
"Três respostas" é contável, verificável e some se um quarto campo aparecer — o que é bom: a copy
passa a ser um freio contra o formulário crescer.

**"Vamos criar seu negócio" sai por ser factualmente errado**: o negócio da pessoa existe há anos;
o que está sendo criado é uma conta. É o tipo de frase que quem tem o negócio nota na hora.

**Microcopy da mesma tela:**

| Hoje | Vira | Por quê |
|---|---|---|
| "É o link que você manda para a cliente agendar." | "É o link que você vai mandar para agendar." | §C.4 |
| "Não consegui criar seu negócio." | "Não consegui criar sua conta. Confira o endereço da página e tente de novo." | erro diz o que fazer |

### D.10 · O que muda na FAQ

| Pergunta | Ação | Motivo |
|---|---|---|
| "Preciso instalar alguma coisa?" | **mantém** | responde objeção real, e absorve "sem treinamento" que saiu do subtítulo |
| "E se eu já tiver minha lista de clientes?" | **mantém e amplia** | ver abaixo |
| "A cliente precisa baixar app ou criar conta?" | **reescreve** | a resposta hoje termina em "A confirmação vai pelo WhatsApp que você já usa" — falso (§A.4). Vira: "Ela abre seu link, escolhe o horário e pronto. Você recebe e confirma." |
| "Funciona para quem atende sozinha?" | **mantém a ideia, corrige o gênero, sobe de posição** | é a melhor aplicação de identidade do produto (§F.6) |
| **nova** — "Eu já uso outro sistema. Dá para trazer o que tenho?" | **acrescenta** | apareceu no painel como a objeção nº 1 de quem já paga (§7.3, dona de salão), e a copy inteira é muda sobre isso. Resposta honesta hoje: CSV com nome, telefone, e-mail e etiquetas; **histórico, não** (`src/app/admin/clientes/importar/importador.tsx`) **[M]** |
| **nova** — "Em quanto tempo a lista de quem sumiu fica útil?" | **acrescenta** | duas ou três voltas do ciclo. É a expectativa que ninguém está gerenciando (§D.7 B) |

### D.11 · Tabela consolidada das variantes

| Peça | Var | Hipótese | Mecanismo §F | §5.10 | Recomendada |
|---|---|---|---|---|---|
| Título da aba | A/B/C | mec. / result. / mec.+busca | especificidade | passa | **C** |
| H1 | A/B/C | mec. / dor / result. | especificidade, hábito | C só com cron | **C** (C-zero sem cron) |
| Subtítulo | A/B/C | mec. / dor / alcance | identidade | passa | **C** |
| CTA secundário | A/B/C | mec. / result. / prova | demonstração | C exige consentimento | **A**, alvo C |
| Card 1 | A/B/C | mec. / dor / result. | especificidade | passa | **C** |
| "Feito para" | — | alcance | identidade | passa | 17 agrupadas |
| Fecho | A/B/C | mec. / tempo / result. | aversão à perda | passa | **C** |
| `/precos` H1 | A/B/C | mec. / dor / result. | especificidade | passa | **A** |
| `/precos` subtítulo | — | fronteira do paywall | especificidade | passa | única |
| Onboarding H1 | A/B/C | mec. / result. / mec. | atrito | passa | **A** |

---

## FASE E · O painel de leitores

As seis personas foram congeladas na §B.7, **antes** de a Fase D existir. Cada uma leu sozinha, sem
ver a resposta das outras, e respondeu sempre à mesma pergunta: **em que ponto exato você fecharia
a aba, e por quê?**

### E.0 · A página que elas leram (o conjunto recomendado da Fase D)

> **CICLO — a agenda que avisa quem parou de voltar** *(aba)*
>
> # A lista de quem devia ter voltado e não voltou.
> Para qualquer trabalho que dependa de cliente que volta.
>
> [ Criar minha conta ]  [ Ver uma página no ar ]
> Grátis para sempre em um profissional. R$ 49 por mês para chamar todo mundo de uma vez.
>
> **Quem sumiu tem nome** — 23 pessoas passaram do ponto de voltar. O CICLO estima quanto vale
> chamar cada uma (preço do serviço vezes a chance de ela voltar) e ordena a lista por aí.
> **Seu link de agendamento** — um link para colar na bio. A pessoa escolhe serviço e horário
> sozinha, e o horário já entra na sua agenda.
> **O dia fechado sem calculadora** — quanto entrou, quanto sobrou, e o extrato de cada
> profissional. *(no Essencial)*
>
> **Feito para** — Beleza · Casa · Saúde, aula e treino · Pet e eventos (17 profissões)
>
> **Comece de graça, e sem cartão** — Grátis para sempre em um profissional. A base é sua: se
> você parar de pagar um dia, nada some.

### E.1 · As seis respostas, cada uma sozinha

**1 · Barbeiro, 34, uma cadeira**
Fecharia a aba **na seção "Feito para"**. "Eletricista, psicólogo, fotógrafo… então não foi feito
para barbearia, foi feito para todo mundo. Todo mundo é ninguém."
· *Frase que salva:* "A lista de quem devia ter voltado e não voltou" — "isso eu entendi na hora".
· *Frase que corta:* o grupo "Saúde, aula e treino" na mesma tela que o meu ofício.
· *Objeção sem resposta:* "e se eu não abrir toda semana? A lista some ou acumula?"

**2 · Dona de salão, 45, quatro profissionais**
Fecharia **na primeira dobra**, não por rejeição, por indiferença: "eu já tenho agenda, e ela
funciona. Isso aqui não me diz o que eu ganho trocando."
· *Salva:* "o extrato de cada profissional" — é a dor real dela, e está escondida no terceiro cartão.
· *Corta:* "Grátis para sempre em um profissional" — lê como "não é para você" no lugar mais visível.
· *Sem resposta:* **"eu trago meus 800 clientes e três anos de histórico do Trinks para cá como?"**

**3 · Psicóloga, 38, consultório próprio**
Fecharia **no H1**. "'Quem devia ter voltado e não voltou' aplicado a paciente é constrangedor —
e perseguir paciente que interrompeu tratamento tem regra de conselho. Eu não posso usar isso do
jeito que está escrito."
· *Salva:* "A base é sua" — sigilo é a preocupação nº 1 dela.
· *Corta:* "chamar todo mundo de uma vez". Disparo em lote para paciente é impensável.
· *Sem resposta:* "onde ficam os dados, e quem vê?"

**4 · Eletricista, 50, sozinho**
Fecharia **no subtítulo**. "'Cliente que volta' não é o meu caso. Eu troco um chuveiro e a pessoa
some por dois anos, e está certo — se ela voltar rápido é porque eu fiz errado."
· *Salva:* nenhuma.
· *Corta:* a promessa central inteira.
· *Sem resposta:* "eu preciso de cliente novo e de orçamento aprovado, não de cliente antigo."

**5 · Faxineira, 41, casas fixas**
Fecharia **na linha de preço**, que vem antes de ela ter entendido o valor. "R$ 49 é meia diária.
Eu ainda não sei o que ganho e já sei o que perco."
· *Salva:* "se você parar de pagar um dia, nada some" — mas está no fim da página, e ela não chega lá.
· *Corta:* "R$ 49 por mês" na primeira dobra.
· *Sem resposta:* "tem multa? tem fidelidade? tem taxa para cancelar?"

**6 · Cético profissional**
Fecharia **na palavra "estima"** — e depois voltaria, porque é a única coisa da página que ele
respeitou. Marcações dele:
· "23 pessoas passaram do ponto" — **de onde saiu esse 23?** Se for ilustração, tem que estar
  visivelmente dentro de uma tela de exemplo, senão é número inventado.
· "Toda semana, a lista…" (variante com cadência) — **veto**: promete rotina. "Ou existe um robô
  rodando toda semana, ou isso é mentira com cara de recurso."
· "O CICLO estima quanto vale chamar cada uma (preço vezes chance)" — **aprovado, e é a melhor
  linha da página.** "Deu a fórmula. Ninguém dá a fórmula."
· "Grátis para sempre" — "para sempre é palavra de quem não sabe se vai existir em dois anos".
  Ele reprovaria; eu mantive, porque a alternativa é enfraquecer uma promessa que o produto **de
  fato** cumpre no código (§L.1 do 18: limita, não apaga). Divergência registrada, não resolvida.

### E.2 · Tabela do painel

| Persona | Onde fecharia a aba | Frase que salva | Frase que corta | Objeção sem resposta |
|---|---|---|---|---|
| Barbeiro, 1 cadeira | seção "Feito para" | "a lista de quem devia ter voltado" | o grupo de saúde e aula na mesma tela | "e se eu não abrir toda semana?" |
| Dona de salão, 4 prof. | primeira dobra, por indiferença | "extrato de cada profissional" | "grátis para sempre em um profissional" | **migrar base e histórico do Trinks** |
| Psicóloga | H1 | "a base é sua" | "chamar todo mundo de uma vez" | onde ficam os dados, e quem vê |
| Eletricista | subtítulo | nenhuma | a promessa central | "eu preciso de cliente novo, não antigo" |
| Faxineira | linha de preço | "nada some" (mas não chega lá) | "R$ 49" antes do valor | multa, fidelidade, taxa de cancelamento |
| Cético | "estima" (e volta) | a fórmula entre parênteses | "toda semana" · "para sempre" | de onde saiu o 23 |

### E.3 · Consenso, divergência e o que o painel mudou

**Convergência (4 de 6 ou mais) — tratar como sinal:**

1. **A objeção de saída não é preço nem recurso: é "isto serve para o meu caso específico?"** Quatro
   personas fecharam por endereçamento errado, não por proposta ruim.
2. **A melhor resposta do produto continua chegando tarde.** "Nada some" salvou duas personas e as
   duas disseram que não chegariam até lá. A §D.7 já sobe isso para o fecho; o painel diz que é
   **pouco** — tem que estar junto do preço, não depois dele.
3. **Ninguém pediu mais adjetivo, e três pediram mais número.**

**Divergência por eixo — é sinal do §4.1, não de copy ruim (§7.4 do prompt):**

| Eixo | Veredito | Consequência |
|---|---|---|
| Beleza solo (barbeiro) | a amplitude **atrapalha** | as 17 ficam, mas agrupadas e abaixo da dobra — confirma a §D.6, e **derruba** qualquer ideia de listá-las no subtítulo |
| Beleza com equipe (salão) | a home fala com solo demais | pede peça própria, não conserto de frase: a dor dela é migração e comissão |
| Saúde (psicóloga) | a promessa central é **eticamente inaplicável** | **não é ajuste de vocabulário.** Saúde precisa de peça separada ou de exclusão consciente |
| Serviço sob demanda (eletricista) | a promessa central **não se aplica de fato** | confirma o 18 §A.4 (a dor dele é orçamento) e o §B.3 (não é ICP) |
| Margem apertada (faxineira) | preço antes do valor mata | mover a ordem, não o preço |

**Veto do cético — acatado (§7.4):**

| Marcação | Decisão |
|---|---|
| "Toda semana" sem cron rodando | **Cortado** até o P-0. Vira C-zero (§D.2) |
| "23 pessoas" solto | **Cortado** como texto. Só sobrevive **dentro** de uma imagem de tela de exemplo |
| "Grátis para sempre" | **Mantido contra o veto** — e a divergência fica registrada aqui, não escondida. O código cumpre (18 §L.1); a objeção dele é sobre a empresa, não sobre a frase |

**O que o painel mudou de verdade, em uma linha cada:**

1. As 17 profissões **saíram do subtítulo** e ficaram na seção agrupada (a Fase D já tinha ido por
   ali; o painel fechou a questão contra a alternativa).
2. "Nada some" **sobe para junto da linha de preço**, não só para o fecho.
3. **Saúde sai do alcance desta copy** — ver E.4.
4. Nasce uma FAQ nova sobre **migrar de outro sistema** (§D.10), que nenhuma fase anterior tinha visto.
5. "Toda semana" e "23" saem do texto corrido.

### E.4 · A decisão que o painel forçou: saúde não recebe esta copy

**Decisão: psicólogo e qualquer profissão de saúde ficam fora do alcance da promessa central,
e a lista "Feito para" mantém o nome sem herdar a frase.** — **Recomendado**

O motivo não é conversão, é conduta: "trazer de volta quem sumiu" aplicado a paciente que
interrompeu tratamento tangencia captação, que tem regra de conselho profissional. O CICLO **pode**
ser a agenda de um psicólogo — a profissão está no catálogo, o vocabulário dele já está em
`professions.vocab` **[M]** — mas a **promessa de recuperação não é vendável para ele com estas
palavras**. Vender assim seria pedir que ele use o produto de um jeito que pode custar caro a ele.

**Consequência prática:** quando existir peça por profissão (≥30 tenants, §B.3), saúde é a primeira
que precisa de texto próprio, com outra promessa — provavelmente "a agenda que não vaza", ancorada
no cofre cifrado da anamnese, que o produto tem **[M]**. Fora de escopo aqui.

### E.5 · Onde o painel provavelmente mentiu

Está no **§R.4** (item 4 do red team, exigido pelo §9 do prompt), junto com o resto do ataque a
este documento — porque é lá que ele pode ser lido com desconfiança em vez de ser lido como
conclusão. Resumo de uma linha: **congelei as personas antes da Fase D, mas depois do diagnóstico
da Fase A, e escrevi eu mesmo a única persona com poder de veto.**

---

## FASE F · Persuasão aplicada, mecanismo por mecanismo

Cada um com: onde usar · por que é honesto **aqui** · como fica a linha · conferência contra o
§5.10 do 17 (*a tática continuaria funcionando se a pessoa soubesse exatamente como ela funciona?*).

### F.1 · Custo de inação

**Onde:** cartão do Motor de Ciclo e tela de bloqueio.
**Por que é honesto aqui:** o produto **calcula** o número — não é retórica, é uma coluna. E a
própria tela já rotula como estimativa **[M]**.
**Linha:** "23 pessoas passaram do ponto de voltar. O CICLO estima quanto vale chamar cada uma:
preço do serviço vezes a chance de ela voltar."
**§5.10:** **passa** — funciona sabendo como funciona; a fórmula está na frase.
**Onde vira padrão escuro:** se virar "você está perdendo R$ 1.840 por mês". Isso transforma
estimativa em prejuízo declarado, e o produto não sabe disso. **Proibido.**

### F.2 · Especificidade como prova

**Onde:** todo lugar. É o antídoto do §0.1 e o critério de desempate do §7.4.
**Por que é honesto:** número com origem não é técnica de persuasão, é informação.
**Linha:** "de quanto em quanto tempo cada pessoa costuma voltar" ganha de "inteligência de
retenção"; "três respostas" ganha de "cadastro rápido"; "17 profissões" ganha de "vários segmentos".
**§5.10:** **passa** por definição.
**Cuidado:** especificidade inventada é pior que vaguidade honesta. Todo número da copy nova tem que
apontar para código, banco ou fonte. Os três que este documento cortou por falharem nisso: "menos
de três minutos", "23 pessoas" fora de contexto de tela, e "toda semana" sem cron.

### F.3 · Aversão à perda — aplicada ao que ele já tem

**Onde:** junto do preço, e no fecho.
**Por que é honesto:** o 18 §L.1 é regra de código, não promessa de marketing: cair de plano
**limita**, nunca apaga. A frase descreve o comportamento real do sistema.
**Linha:** "A base é sua. Se você parar de pagar um dia, nada some — o que trava é criar mais, não
ver o que já existe."
**§5.10:** **passa**, e é o caso mais claro do documento: a tática é *dizer o que o software faz*.
**Nota do painel:** é a linha que mais salvou personas, e a que está mais escondida hoje.

### F.4 · Prova por demonstração

**Onde:** CTA secundário.
**Por que é honesto:** é uma página real, no ar, com agenda funcionando — não um vídeo editado nem
um depoimento. O software é verdadeiro; **os dados dentro dela não são** (§D.4.1: o tenant é
fictício, semeado por script **[M]**).
**Linha:** "Ver uma página de exemplo".
**§5.10:** **passa — e só passa por causa das duas palavras "de exemplo".** Sem elas, a mesma
página vira afirmação de que existe um cliente que não existe.
⚠️ **Este mecanismo é demonstração de produto, não prova social**, e a §D.4.1 explica por que a
diferença decide se a linha é honesta. Onde outros escreveriam "+5.000 profissionais", o CICLO
mostra **o software funcionando** — não mostra um cliente.

### F.5 · Redução de atrito

**Onde:** FAQ, onboarding, fecho.
**Por que é honesto:** o medo é real e a resposta é verificável (não instala nada, a pessoa que
agenda não cria conta, o catálogo já vem preenchido — tudo **[M]** no código).
**Linha:** "Três respostas e sua página está no ar."
**§5.10:** **passa**.
**Cuidado:** reduzir atrito não é esconder custo. O preço continua na primeira dobra — o painel
pediu para **mover a ordem** (valor antes de preço), não para escondê-lo. Esconder preço é
exatamente o que o 18 §5.10 chama de "fraqueza do concorrente a explorar, não modelo".

### F.6 · Identidade

**Onde:** subtítulo e FAQ.
**Por que é honesto:** "para quem trabalha por conta" descreve a base real (o Grátis é de um
profissional, o Essencial também **[M]**), e é mais preciso que "pequenos negócios".
**Linha:** "É para quem trabalha por conta que ele mais serve: não tem alguém olhando a agenda por
você para lembrar de quem sumiu."
**§5.10:** **passa** — é descrição de para quem serve, não flattery.
**Cuidado:** identidade vira exclusão quando a pessoa não se reconhece. É o que aconteceu com
quatro das seis personas (§E.3), e é por isso que a §B.3 resolveu o alcance **antes** desta fase.

### F.7 · Conferência final contra o §5.10

| Mecanismo | Passa? | Se degradar, vira |
|---|---|---|
| Custo de inação | sim | prejuízo declarado que o produto não sabe calcular |
| Especificidade | sim | número inventado |
| Aversão à perda | sim | ameaça ("você vai perder tudo") |
| Demonstração | sim | prova social falsa |
| Redução de atrito | sim | custo escondido |
| Identidade | sim | bajulação |

**Nenhum mecanismo proposto usa escassez, contador, prova social inventada, confirmshaming ou
preço atrás de cadastro.** A conferência item a item do §5.10 do 17 está feita e passa.

---

## FASE G · Métricas e previsões falsificáveis

### G.1 · Correção ao prompt: a página pública **não** registra visita

O §G do 19 assume que "a página pública já registra visita e agendamento". Metade disso é falsa e
muda o que se pode prometer aqui:

| O que existe hoje | O que não existe |
|---|---|
| `appointments.created_at`, `tenants.created_at`, `services`, `professionals` — a base do `scripts/metricas-ativacao.mjs` **[M]** | **Nenhuma tabela de visita, nenhum evento de página, nenhum pacote de analytics** — procurei em `supabase/migrations/` e no `package.json` **[M]** |
| Atribuição de receita por janela de tempo (`src/core/attribution/compute.ts`) — para campanha → agendamento **[M]** | Atribuição de **origem do cadastro** (18 §O.2 já dizia que exige instrumentação nova) |

**Consequência dura:** a métrica que julgaria esta reescrita — **visitante → cadastro** — é hoje
**incalculável**, porque o denominador não é coletado. Qualquer previsão sobre ela vem com a
instrumentação como **pré-requisito**, não como detalhe.

E há um segundo contaminante já registrado no 18 §P.1.1: **`.env.local` aponta para o Supabase de
produção** **[M]**, então as suítes de teste criam tenants na base real. Contar cadastros por
`select count(*) from tenants` mede copy **e** suíte de teste ao mesmo tempo.

### G.2 · O que dá para medir sem instrumentação nova

| Métrica | Como | Limite |
|---|---|---|
| Cadastros por semana | `tenants.created_at` | contaminado por fixture até o P-B.1 do 18 |
| Ativação (sai do cadastro com serviço + horário + link) | `scripts/metricas-ativacao.mjs` | hoje só há base semeada — o próprio script avisa **[M]** |
| Mistura de profissões dos novos cadastros | `tenants.profession_id` | limpo, e é o que testa a decisão do §B.3 |
| Reação nas conversas de venda | anotação nas 20 da P.1-G | zero código |

### G.3 · O mínimo de instrumentação que este plano pede

**Uma tabela de visita à home e à `/precos`, com origem, e nada mais.** — **Recomendado**

Não é analytics de produto; é o denominador. Sem ele, trocar a home é trocar opinião por opinião
(§2.1 do prompt) e nenhuma das previsões abaixo que dependem de taxa pode ser verificada.
Alternativa de custo zero e precisão menor: ligar o analytics da própria hospedagem. **Do
Eduardo** — envolve conta e possivelmente dinheiro; padrão de trabalho adotado: medir por tabela
própria, porque é o único caminho que não depende de decisão de terceiro.

### G.4 · Previsões

| # | Previsão | Número | Prazo | Como verificar | O que fazer se falhar |
|---|---|---|---|---|---|
| 1 | **Compreensão em 5s.** Mostrar só a primeira dobra nova para 5 pessoas fora do ramo, 5 segundos, e pedir para dizer o que o produto faz | **≥4 de 5** dizem algo equivalente a "mostra quem parou de voltar" | 30 dias | perguntar, anotar a frase literal | <3/5 → o problema não é a headline, é a hierarquia. Testar a variante B (pergunta) |
| 2 | **O vocabulário é o deles.** Nas 20 conversas da P.1-G, contar quantas descrevem o produto **de volta** usando "quem sumiu" / "parou de voltar" | **≥12 de 20** | 90 dias | anotar a frase que a pessoa usa ao repetir o que entendeu | <6/20 → a copy é do vendedor, não do cliente. Transcrever e reescrever a partir das falas reais |
| 3 | **A home ampla abriu porta.** Cadastros de profissão fora da beleza depois da lista de 17 | **≥3 dos 20 primeiros** cadastros novos | 90 dias | `tenants.profession_id`, descartando fixture | **0 → a decisão do §B.3 estava errada**; voltar para home de nicho e assumir o custo de fechar a porta |
| 4 | **Visitante → cadastro**, depois da instrumentação da §G.3 | entre **2% e 6%** **[S]** | 60 dias após instrumentar | visitas únicas ÷ cadastros | <1% → o gargalo não é copy, é tráfego (§R.2). Parar de mexer em texto |
| 5 | **A correção de honestidade não custa conversão.** Tirar "lembrete e confirmação" e a FAQ do WhatsApp não derruba cadastro | variação **dentro de ±20%** | 60 dias | comparar semanas antes e depois | queda >20% → aquelas promessas eram o que vendia, e o P-0 vira urgente por motivo comercial, não só ético |

A previsão **1 é a mais barata e a mais decisiva** — cinco conversas de cinco segundos, sem uma
linha de código, e ela testa a única coisa que este documento realmente mudou: o que a página diz
que o produto é. A **3** é a que testa a decisão mais arriscada (§B.3), e a **5** existe porque um
plano que só prevê ganho não é falsificável.

---

## RED TEAM

Escrito **contra** o resto do documento (§9 do prompt). Não é ressalva de rodapé.

### R.1 · Pré-mortem — seis meses depois, a copy nova está no ar e a conversão não mudou

**Causa 1, a mais provável: não havia conversão para mudar.** O sitemap tem uma URL por tenant e a
base é de poucos tenants **[M]**, não há mídia, não há indicação construída e não há visita medida. Uma home melhor com
zero visitantes converte zero por cento melhor. A copy não era o gargalo; era a coisa mais fácil
de mexer.

**Causa 2: o cron continuou desligado.** A promessa nova é mais específica que a antiga — e
especificidade sem entrega é pior que vaguidade. "A lista de quem devia ter voltado" cria uma
expectativa que a pessoa confere na primeira semana. Se a lista não atualizar sozinha, o produto
some da cabeça dela em duas semanas, e a copy terá acelerado o churn em vez da conversão.

**Causa 3: a decisão do §B.3 saiu pela culatra dos dois lados.** O barbeiro leu "serve para todo
mundo" e não se reconheceu; o psicólogo e o eletricista continuaram sem porta própria, porque a
lista nomeia mas a promessa não os inclui. Resultado: uma home que ampliou o alcance nominal e
estreitou a credibilidade. **Esta é a causa mais específica deste plano, e a previsão 3 existe
para pegá-la em 90 dias.**

### R.2 · O caso contra reescrever agora — sem palha

O argumento mais forte, escrito da forma mais forte que eu consigo:

> Este produto tem dois ou três tenants, zero pagantes, o motor desligado em produção e nenhuma entrevista
> com cliente. Nesse estado, "a copy está com cara de IA" é um problema **estético**, e problema
> estético é o que se conserta quando os problemas de existência já estão resolvidos. As 20
> conversas da P.1-G vão produzir, de graça, as frases exatas que o mercado usa — reescrever antes
> delas é escrever no escuro e depois ter que reescrever de novo. Além disso, mexer na copy **agora**
> gasta o único ativo que este plano tem para medir: se a home mudar antes de existir medição
> (§G.1), nem dá para saber se a mudança ajudou. O caminho certo é: liga o cron, faz as 20
> conversas, instrumenta, **depois** escreve.

**Minha resposta: concordo com dois terços dele, e é por isso que o sumário executivo abre
dividindo o trabalho em dois.**

O que o argumento acerta: a **escolha entre variantes** não deve acontecer antes das conversas, e
a ordem certa é P-0 → conversas → instrumentação → escolha. Está adotado — a §D.2 já deixa a
headline com uma forma condicionada ao cron, e a §G.4 amarra a previsão 2 às conversas.

O que ele erra: trata como estética o que é **honestidade**. Três linhas da copy atual prometem
coisas que o software não faz (§A.4), e uma quarta apresenta uma meta nunca medida como fato. Isso
não espera tráfego, não espera entrevista e não espera instrumentação — é conserto, e o custo de
manter é maior que o de cortar. **Se este documento produzir uma única ação, que seja essa.**

### R.3 · Ataque ao posicionamento — em que cenário a promessa escolhida envelhece mal

1. **O concorrente copia em uma sprint.** "Clientes inativos" é uma consulta com `date_trunc` e um
   filtro. O Trinks tem base para isso hoje. O fosso do CICLO não é a ideia, é o cálculo por pessoa
   e a ordenação por valor — e **nada disso aparece numa comparação de página de recursos**. Se
   eles anunciarem "clientes inativos" amanhã, o posicionamento vira comparável em uma tarde.
   ⚠️ **Este ataque já não é hipotético: a Belasis anuncia hoje** (§B.2.1) **[M]**. O que segurou a
   decisão não foi o ineditismo da promessa, foi o **degrau** em que ela mora — R$ 189 contra grátis
   (§B.2.2). E degrau é uma defesa melhor que ineditismo, porque muda-lo custa receita ao
   concorrente. Mas quem escreveu a versão anterior deste documento não sabia disso: **a tese
   central passou uma hora sustentada por uma suposição confortável.**
2. **A promessa depende do tamanho da base do usuário.** Um barbeiro com 30 clientes vê uma lista
   com dois nomes. O Motor de Ciclo só impressiona com volume, e o Grátis limita a **50 clientes**
   **[M]**. Ou seja: **o degrau que a copy usa para provar o valor é o degrau onde o valor é
   menor.** Este é o ataque mais concreto deste documento e ele não tem resposta boa — só uma
   mitigação: a FAQ nova sobre "em quanto tempo a lista fica útil" (§D.10).
3. **O mercado pode não querer retenção.** Se o ICP real for quem quer só uma agenda barata, a
   promessa de retenção é sofisticação que ninguém pediu — e o Simples Agenda a R$ 39,90 ganha
   sempre. O 18 §O.3 previsão 6 já testa exatamente isso nas 20 conversas; este documento não
   precisa de teste próprio, precisa **esperar** aquele.

### R.4 · Ataque ao painel — onde as personas concordaram por serem minhas

1. **A contaminação é real e é de ordem.** Congelei as personas antes da **Fase D**, como o §7.2
   manda — mas depois de já ter feito o **diagnóstico** da Fase A e formado opinião sobre o que
   estava errado. As objeções delas são suspeitosamente parecidas com os defeitos que eu já tinha
   listado. Congelar antes da Fase A teria sido mais honesto e não é o que aconteceu.
2. **Eu escrevi o cético, e o cético é o único com poder de veto.** Dar poder de veto à persona que
   eu criei para reprovar é dar poder de veto a mim mesmo com outra assinatura. As duas coisas que
   ele cortou ("toda semana", "23") eu já suspeitava; a única que ele cortou e eu **não** aceitei
   ("grátis para sempre") é justamente aquela em que eu tinha investimento.
3. **Nenhuma persona elogiou nada que eu não tivesse escrito.** Um painel de verdade acha valor em
   lugares que o autor não previu. Este não achou — o que é evidência de torcida, não de qualidade.
4. **Duas delas concordaram cedo demais.** Barbeiro e faxineira convergiram no mesmo tipo de
   objeção ("não é para mim" / "caro antes de eu entender"), que é o par de objeções mais óbvio
   deste mercado. Objeção óbvia é o que uma simulação produz quando não sabe nada.

**O que fazer com isso:** o painel serviu para **gerar hipótese**, não para validar. As cinco
mudanças da §E.3 devem ser tratadas como **[S]**, e as 20 conversas da P.1-G são o teste real. A
única saída do §7.1 é substituir persona por gente.

### R.5 · Auditoria da copy NOVA contra a tabela de tiques do §0.1 — sem defesa

Linha por linha do conjunto recomendado (§E.0). Isto é a exigência final do §12, e ela reprova
coisas que eu escrevi neste mesmo documento.

| Linha nova | Tique encontrado | Veredito |
|---|---|---|
| "CICLO — a agenda que avisa quem parou de voltar" | **T3** (travessão) | **Aceito** — é o separador de título de aba já usado no produto, não tempero |
| **"A lista de quem devia ter voltado e não voltou."** | **T9 · jogo sonoro** — tique novo, que a tabela do §0.1 não tem e este produto tem duas vezes | **Reprovado, com alternativa** — ver abaixo |
| "Para qualquer trabalho que dependa de cliente que volta." | **T6** (abstração com cara de insight), na fronteira | **Aceito sob condição** — só sobrevive porque a lista agrupada logo abaixo dá concretude. Sozinha, é vaga |
| "Quem sumiu tem nome" | — | limpo |
| "23 pessoas passaram do ponto de voltar. O CICLO estima quanto vale chamar cada uma: preço do serviço vezes a chance de ela voltar." | — | limpo, e é a melhor linha do conjunto |
| "quanto entrou, quanto sobrou, e o extrato de cada profissional" | **T1** — eu encurtei de cinco itens para três e **três é exatamente o tricolon** | **Reprovado** — vira dois: "quanto entrou e quanto sobrou, com o extrato de cada profissional" |
| "A base é sua. Se você parar de pagar um dia, nada some — o que trava é criar mais, não ver o que já existe." | **T2** ("é X, não Y") + **T3** | **Aceito** — é a única ocorrência de T2 na página, e a inversão aqui carrega informação (diz o que trava e o que não trava). Contagem declarada: **T2 uma vez, T3 duas vezes na página inteira** |
| "Três respostas e sua página está no ar" | — | limpo |

**O T9, que a tabela do §0.1 não previu.** "…devia ter voltado e não voltou" é a mesma figura da
headline antiga ("cada cliente volta — e traz de volta quem sumiu"): repetição sonora do mesmo
verbo em posições diferentes. Soa esperto, e esperto é primo de gerado. **Eu escrevi a headline
recomendada com o tique que vim caçar.**

Alternativas sem a figura, para a previsão 1 decidir:

| Texto | Caracteres | Linhas a 390px | Custo |
|---|---|---|---|
| "A lista de quem devia ter voltado e não voltou." | 47 | 2 | tem T9 |
| "A lista de quem não voltou." | 28 | 1 | perde o "devia" — some a ideia de ritmo esperado |
| "A lista de quem já devia ter aparecido." | 39 | 2 | sem T9, mantém o ritmo esperado, e "aparecido" é palavra de balcão |

**Recomendação revista: a terceira.** — **Recomendado**

**Acréscimo permanente à tabela do §0.1**, para as próximas rodadas: **T9 · jogo sonoro** —
paronomásia, aliteração ou repetição de raiz usada como ênfase. Aparece porque soa memorável e
denuncia porque ninguém fala assim no balcão.

---

## SEQUENCIAMENTO — o que fazer, e em que ordem

Não é fase nova; é a consequência prática do §R.2, e existe porque um plano de copy que entrega 30
variantes sem dizer a ordem produz uma reescrita de uma vez só, no escuro.

### S.1 · Agora, sem esperar nada (é honestidade, não conversão)

| # | O quê | Por quê | Classificação |
|---|---|---|---|
| C-1 | Cortar a FAQ "A confirmação vai pelo WhatsApp que você já usa" | promessa falsa **[M]** | **Decidido** |
| C-2 | Tirar "lembrete e confirmação" do subtítulo e do cartão do Grátis em `/precos` | promessa falsa **[M]** | **Decidido** |
| C-3 | Cortar "menos de três minutos" | número sem fonte, meta apresentada como fato **[M]** | **Decidido** |
| C-4 | Qualificar "O dia fechado sem calculadora" com o plano | caixa é módulo do Essencial **[M]** | **Decidido** |
| C-5 | Trocar "aprende" por "calcula" / "olha o histórico" | `compute.ts` diz "determinístico, sem ML" **[M]** | **Decidido** |
| C-6 | Corrigir as ocorrências de gênero da porta de entrada (§C.4) | G2 do 09, regra §3.2 já registrada | **Decidido** |

**Executado em 2026-08-24.** Os seis itens foram aplicados em `src/app/page.tsx`,
`src/app/(public)/precos/page.tsx`, `src/lib/planos-cartoes.ts` e
`src/app/onboarding/formulario.tsx`. `typecheck`, `lint`, `test:unit` (668 testes) e `build`
passam. **`test:rls` e `test:integration` foram pulados de propósito**: o `.env.local` aponta para o
Supabase de produção (18 §P.1.1), e rodá-los para conferir troca de texto sujaria a base real.

Três coisas apareceram só ao executar, e entraram junto por serem a mesma classe de defeito:

1. A meta description dizia "**avisa** quem atrasou" — o produto **mostra**, porque o cron está
   desligado. Virou "mostra".
2. O cartão do Motor dizia "o valor que essa ausência representa", que lê como prejuízo. Virou a
   estimativa com a fórmula à vista, igual à tela interna.
3. O §C.4 tinha **cinco** linhas de gênero mapeadas; eram **seis** — a do Card 2 escapou da
   auditoria de escrivaninha e só apareceu lendo a página renderizada.

Os seis são **subtração**, cabem num commit, não dependem de tráfego, de entrevista nem de
instrumentação, e nenhum deles é aposta.

### S.2 · Depois do P-0 do 18 (cron ligado)

| # | O quê | Destrava |
|---|---|---|
| C-7 | Trocar o H1 pela forma com cadência ("Toda semana…"), se a previsão 1 aprovar | cron rodando **[M]** |
| C-8 | Devolver "lembrete e confirmação" às tabelas | cron rodando |

### S.2b · Pesquisa de posicionamento dos concorrentes — ✅ feita em 2026-08-24

| # | O quê | Estado |
|---|---|---|
| C-6b | H1, discurso de retorno e vocabulário de Trinks, Belasis, Avec, Fresha e Simples Agenda, com URL e data | ✅ **§B.2.1** — quatro fontes de fornecedor; Simples Agenda devolveu **403 a robô**, igual ao 18 |

Resultado: a categoria **não** estava vazia, e a tese do §B.2 foi reescrita para o que sobrevive —
degrau e mecanismo, não ineditismo (§B.2.2). **Pendência única:** o Simples Agenda continua sem
leitura de posicionamento; ele é o concorrente de preço mais próximo e vale uma visita manual, de
navegador, que o 403 não bloqueia.

### S.3 · Depois das 5 primeiras conversas da P.1-G

| # | O quê | Destrava |
|---|---|---|
| C-9 | Escolher entre as variantes de H1 e subtítulo | falas reais, saindo de **[S]** |
| C-10 | Reescrever o Card 1 com a frase que mais gente repetiu | transcrição, §2.3 do prompt |

### S.4 · Depois da instrumentação (§G.3)

| # | O quê | Destrava |
|---|---|---|
| C-11 | Reescrita completa da home (subtítulo, cartões, "Feito para", fecho) | existir denominador para medir |
| C-12 | Teste-guarda da home, no molde do `precos-nao-promete-demais` | impedir que a próxima promessa falsa entre sozinha |

**C-12 merece nota:** a razão de as três promessas falsas terem sobrevivido até hoje é que
`/precos` tem teste e a home não **[M]**. Sem esse teste, este documento inteiro é uma limpeza que
vai sujar de novo.

### S.5 · As três perguntas de transcrição para as 20 conversas

Custo zero, e são a saída do §4.4 (não existe voz do cliente). Entram nas conversas que o 18 §P.1-G
já prevê — aproveitando, não duplicando:

1. *"Quando alguém que vinha sempre para de aparecer, você percebe? Como?"* — a resposta literal é
   candidata a headline.
2. *"Como você chama essa pessoa de volta hoje?"* — mede o substituto real (caderno + WhatsApp).
3. *"Se eu te mostrasse uma lista com o nome dessas pessoas, o que você faria com ela?"* — separa
   quem quer a lista de quem quer que o sistema aja sozinho.

**Regra:** anotar a **frase literal**, não o resumo. A melhor headline do CICLO provavelmente já
foi dita por um barbeiro reclamando, e resumo mata transcrição.

---

## AS DUAS LISTAS

### Decidido com base

- As três promessas da copy atual que o código não cumpre, e a quarta (número sem fonte) — todas
  medidas em arquivo e linha (§A.4).
- "Aprende" é errado: o `compute.ts` declara "determinístico, sem ML" **[M]**.
- Das 8 profissões nomeadas hoje, nenhuma tem ritmo recorrente; das 9 escondidas, cinco têm **[M]**.
- O Motor de Ciclo está no plano Grátis; a fronteira do paywall é o envio em lote **[M]**.
- Caixa e comanda não estão no Grátis **[M]**.
- A página pública **não** registra visita, e não há analytics no projeto **[M]** — correção ao §G
  do prompt.
- A `/precos` já contém a voz do produto, e nenhum concorrente poderia colar aquelas respostas
  **[M]**.
- A regra de gênero sem concordância já é decisão registrada (`09-PLATAFORMA.md` §3.2).
- O onboarding **não tem campo "Outro"**: quem busca uma profissão inexistente some sem deixar
  rastro **[M]** — o que derrubou uma linha que eu já tinha escrito (§D.6).
- O tricolon do subtítulo atual é o exemplo literal do §0.1, e sai.
- **O tenant `dom-rocha` é fictício**, semeado por `scripts/seed-demo-barbearia.mjs` **[M]** — e
  isso derrubou uma recomendação que eu já tinha escrito (§D.4.1).
- **A Belasis já vende recuperação de cliente inativo** e mantém página dedicada ao tema **[M]** —
  a categoria não está vazia (§B.2.1).
- Na Belasis isso mora a partir do **Pro, R$ 189/mês**, e ela **não tem plano gratuito** **[M]**.
- **Nenhum dos cinco concorrentes diretos tem plano gratuito**, e **nenhum dos cinco H1 declara um
  mecanismo** **[M]** — o espaço de "dizer o que o software faz" está vago.

### Aposta

- Que a promessa central deva ser retorno, e não agenda (§B.2) — o argumento ficou **mais forte e
  mais estreito** depois da pesquisa: não é categoria vazia, é degrau e mecanismo (§B.2.2). Continua
  sem validação com cliente.
- Que competir contra a narrativa de IA da Belasis com uma narrativa de honestidade funcione
  (§B.2.2). É a aposta mais desconfortável do documento, e não tem como testar sem venda.
- Que a home por eixo abra portas em vez de diluir credibilidade (§B.3) — **a aposta maior deste
  documento**, e a previsão 3 existe para derrubá-la.
- Que "A lista de quem já devia ter aparecido" ganhe da headline atual (§R.5) — decidido pela
  previsão 1, não por mim.
- Que trazer "nada some" para junto do preço mova conversão (§E.3).
- Toda a Fase E: seis simulações, nenhuma pessoa. **[S]** inteira, e o §R.4 diz por quê.
- Que saúde precise de peça separada (§E.4) — o raciocínio de conduta é sólido, a leitura de
  mercado não é medida.
- Toda a tabela de disposição a pagar herdada do 18 §B.4, que já nascia **[S]**.

---

## AS SEIS TENSÕES DO §4 — onde cada uma foi respondida

| Tensão | Resposta | Onde |
|---|---|---|
| **4.1** Foco de ICP × alcance de copy | Home por eixo do ritmo na primeira dobra; 17 profissões agrupadas abaixo; nenhuma página por profissão até ≥30 tenants. O painel derrubou a alternativa de listar no subtítulo | §B.3, §D.6, §E.3 |
| **4.2** Qual é a promessa central | Retorno de cliente, não agenda. "Agenda" fica só no título da aba, por descoberta | §B.2, §D.1 |
| **4.3** Quem é o "você" da frase | Fala com o eixo, adapta por nomeação, e **assume** o erro de vocabulário para 5 das 17 — corrigível dentro do produto pelo `vocab`, não na home | §B.4 |
| **4.4** Não existe voz do cliente | Tudo marcado **[S]**; três perguntas de transcrição entram nas 20 conversas da P.1-G; a escolha entre variantes fica **suspensa** até a quinta conversa | §S.3, §S.5, §G.4 previsão 2 |
| **4.5** A copy não pode prometer o que o código não faz | Quatro promessas falsas achadas e medidas; correção imediata (S.1); tabela do que dá para prometer hoje | §A.4, §B.5, §S.1 |
| **4.6** Cobrança ainda não existe | Nenhum CTA novo diz "assinar". O CTA continua "Criar minha conta", que é grátis e real, e a linha de preço aponta para a `/precos`, onde a cobrança combinada direto já está escrita sem eufemismo **[M]**. **Nada nesta rodada depende de cobrança existir** | §D.4, §D.8 |

---

## CLASSIFICAÇÃO CONSOLIDADA (§8)

| Item | Nível | Base |
|---|---|---|
| Promessa central dos concorrentes diretos (§B.2.1) | **Decidido** | pesquisado em 2026-08-24, com URL **[M]** |
| Diferenciação por degrau e mecanismo, não por ineditismo (§B.2.2) | **Recomendado** | tabelas de preço dos dois lados **[M]** |
| Competir com honestidade contra o discurso de IA da Belasis | **Do Eduardo** | é escolha de marca; padrão adotado: manter, porque o §C.2 é sobre não mentir |
| Cortar as três promessas falsas e o número sem fonte (C-1 a C-4) | **Decidido** | código e banco **[M]** |
| Trocar "aprende" (C-5) | **Decidido** | `compute.ts` **[M]** |
| Correção de gênero na porta de entrada (C-6) | **Decidido** | regra §3.2 do 09, já registrada |
| Promessa central = retorno | **Recomendado** | 18 §E.2.1 **[M]** + ausência de concorrente na categoria |
| Home por eixo, 17 agrupadas, sem página por profissão | **Recomendado** | ritmo do catálogo **[M]**; SEO condicionado ao 18 §P.2 |
| H1 recomendado e as variantes | **Recomendado** | decidido pela previsão 1 |
| H1 na forma com cadência ("Toda semana…") | **Bloqueado** | depende do P-0 (cron) |
| "Lembrete e confirmação" em qualquer tabela | **Bloqueado** | depende do P-0 |
| "Mandamos WhatsApp" em qualquer forma | **Bloqueado** | credencial, TICKET-043 |
| ~~Nomear o `dom-rocha` no CTA secundário~~ | **Decidido: não** | o tenant é **fictício** **[M]** — nomeá-lo é prova social inventada (§D.4.1) |
| Tirar "salão" do CTA secundário | **Decidido** | fecha a porta para 9 das 17 profissões |
| Instrumentar visita (§G.3) | **Do Eduardo** | envolve conta e possivelmente dinheiro; padrão adotado: tabela própria |
| Saúde fora do alcance desta promessa | **Recomendado** | conduta profissional, não conversão |
| Teste-guarda da home (C-12) | **Recomendado** | é a causa raiz de as promessas falsas terem durado **[M]** |
| Tudo que veio do painel (§E.3) | **Recomendado**, com os dados marcados **[S]** | seis simulações, nenhuma pessoa (§R.4) |

---

## FORA DE ESCOPO, DE PROPÓSITO (§11 do prompt)

- **Redesenho visual** — é copy, não layout. O `08-REDESIGN-E-IDENTIDADE.md` já existe, e a Parte
  II dele é o irmão visual deste documento.
- **Preço e empacotamento** — é o 18, e está decidido.
- **Campanha de mídia paga** — `09-PLATAFORMA.md` §13.1: o CAC não fecha nesta categoria.
- **Nome, marca e logotipo.**
- **Copy das telas internas do app** — a porta de entrada primeiro. (Com uma exceção declarada: a
  §C.4 lista as correções de gênero que **já estão** na porta de entrada; as 13 strings internas do
  G2 já foram corrigidas em outro ticket **[M]**.)
- **Escrever o código** — nenhuma linha de `src/` foi tocada nesta rodada.

---

## DEFINIÇÃO DE PRONTO (§12 do prompt)

- [x] Toda peça de copy pública diagnosticada linha por linha — home, `/precos` e onboarding (Fase A)
- [x] Posicionamento decidido antes de qualquer palavra final (Fase B; a Fase D só começa depois)
- [x] As 6 tensões do §4 respondidas — inclusive foco × alcance e a ausência de voz do cliente
- [x] 3 variantes por peça, cada uma com hipótese diferente (mecanismo / dor / resultado)
- [x] Painel rodado com as personas congeladas antes da copy (§B.7), cada uma respondendo sozinha
- [x] Consenso **e** divergência registrados; veto do cético aplicado — e a única vez em que ele foi
      contrariado está escrita, não escondida (§E.3)
- [x] Cada mecanismo de persuasão conferido contra o §5.10 do 17 (§F.7)
- [x] Nenhuma promessa que o código não cumpre, e nenhum número sem fonte — quatro foram cortadas
- [x] §9 escrito de verdade, incluindo o caso de não reescrever nada agora (§R.2), com o qual eu
      concordo em dois terços
- [x] 3 a 5 previsões numéricas com prazo — são cinco (§G.4)
- [x] Auditoria final contra a tabela de tiques do §0.1, na copy nova (§R.5) — **reprovou duas
      linhas minhas**, e acrescentou um tique novo à tabela (T9)
- [x] Nada foi construído — o plano é o entregável

**Duas ressalvas honestas sobre esta lista**, porque marcar caixa é fácil:

1. A caixa do painel está marcada segundo a regra do §7.2, mas o §R.4 explica por que ele ainda
   assim provavelmente mentiu. Persona congelada não vira pessoa.
2. As previsões 4 e 5 dependem de instrumentação que não existe (§G.1). Elas estão escritas com o
   pré-requisito à vista, mas **hoje não são verificáveis** — e um plano que finge que são estaria
   cometendo o defeito do §2.4.
3. Numa releitura própria, achei **dois rótulos [M] meus que não tinham fonte**. A contagem de URLs
   do sitemap foi corrigida (o `sitemap.ts` gera uma por tenant; eu tinha cravado um número que não
   conferi). E a afirmação de que nenhum concorrente vende retorno **foi verificada e estava
   errada** — a Belasis vende (§B.2.1). A tese central do documento foi reescrita por causa disso,
   não remendada: ver §B.2.2. **A frase que eu tinha chamado de "só o CICLO pode assinar" reprovou
   no próprio teste**, e está substituída.
