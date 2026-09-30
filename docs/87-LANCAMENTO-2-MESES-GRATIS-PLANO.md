# 87 · Lançamento — 2 meses grátis antes do oficial, plano único, e o que falta de verdade

> **Escrito em 2026-09-29. As seis decisões abertas foram tomadas no mesmo dia (§2), por delegação do
> Eduardo.** Pedido dele: deixar o CICLO **de graça por 2 meses antes do
> lançamento oficial**, oferecer **o ecossistema inteiro** e vender **só o plano** por enquanto.
> Este documento (1) diz como a cortesia funciona no produto, (2) refaz a lista do que falta para
> rodar, medida contra o código de hoje, e (3) põe tudo num calendário com portões de saída.
>
> **O que eu não consigo ver daqui e marco `[verificar]`:** o estado de produção (Vercel, Supabase,
> Mercado Pago, WhatsApp), CNPJ, contador e domínio. Onde a resposta muda o plano, está escrito.

---

## 1 · A tese em uma frase

**Os 60 dias grátis não são um desconto: são o tempo de abrir CNPJ, contador, conta de pagamento e
testar a cobrança de verdade, enquanto 30 a 40 salões usam o produto inteiro e provam que voltam a
chamar cliente.** Sem cartão, sem cobrança automática, sem pegadinha. No dia do lançamento a pessoa
decide assinar, e o CICLO já tem prova de que funciona para quem chegou primeiro.

---

## 2 · Decisões tomadas (2026-09-29, por delegação do Eduardo: "pensa a fundo e decide por mim")

### 2.0 Cinco princípios que decidiram tudo

1. **Só cobro quando três coisas existem juntas:** CNPJ, cobrança testada com dinheiro real, e prova de
   valor com número do próprio salão. Cobrar antes de qualquer uma delas é vender contrato que não
   se pode emitir, com um botão que ninguém viu funcionar.
2. **60 dias cobrem dois ciclos de retorno** (cabelo e barba voltam em 21 a 30 dias, unha em 15 a 21).
   É o que permite mostrar a **previsão auditada** do Motor com dado real: "dos 40 que previmos, 31
   voltaram". Com 30 dias não dá; com 90 é dinheiro queimado. É o único argumento que nenhum concorrente
   pode copiar rápido (`docs/48` C5), e ele só existe depois de tempo de uso.
3. **O calendário do salão manda.** Dezembro é o pico (o dono não tem cabeça para ferramenta nova nem
   para decidir assinatura). Janeiro é a baixa, e é quando "quem sumiu e quanto vale" mais pesa. Por isso
   o lançamento oficial cai em janeiro, e **nenhuma cobrança automática acontece em dezembro**.
4. **Estreitar o público para aprender rápido e caber no suporte.** 40 contas do mesmo tipo ensinam mais
   que 40 contas de tipos diferentes, e o suporte é uma pessoa só. Primeira turma: barbearia e salão
   pequeno, 1 a 3 profissionais, perto do Eduardo.
5. **Reduzir risco jurídico antes de crescer, não depois.** Sem clínica com anamnese pesada na primeira
   turma, pipeline agregado desligado, CNPJ antes da abertura pública, hospedagem e backup de plano pago
   antes do primeiro cliente real.

### 2.1 As decisões

| Id | Decisão | Por quê |
|---|---|---|
| **D0** | **Três datas, todas segundas-feiras.** **Alpha: 26/10/2026** (até 10 contas convidadas por você). **Janela pública: 09/11/2026.** **Lançamento oficial: 11/01/2027** (63 dias depois da abertura pública). Quem quiser assinar antes, pode a partir de 21/12, se o Portão 1 estiver verde | Dá 4 semanas de folga para o P0 (publicar 107 commits, jurídico, infra, cortesia no código), 6 semanas para o CNPJ, e nenhuma cobrança em dezembro. O alpha acha os bugs de onboarding com 10 pessoas, e não com 40 |
| **D1** | **A cortesia acaba em D0. Depois, 7 dias de graça** (tudo funciona, faixa vermelha, é o mesmo prazo da graça de pagamento que o código já tem), **depois conta pausada**: lê e exporta tudo, não cria nada novo, a página pública de agendamento mostra "indisponível". Pausada dura 90 dias, com aviso 30 e 7 dias antes do fim; **passar a assinar reativa tudo na hora**. Depois disso, eliminação | É "só plano" de verdade e não deixa o dado refém (exportação sempre livre, o que os termos já prometem). A graça de 7 dias evita derrubar o salão no meio de uma semana cheia |
| **D2** | **Duas faixas, tudo incluído nas duas: Solo R$ 49 (1 profissional) e Equipe R$ 99 (até 5).** O Avançado deixa de ser vendido (acima de 5, "fale com a gente"). Anamnese e o resto entram nas duas faixas, ligados só pelo dono. **Preço público não muda antes de 30 pagantes ou 3 meses de dado de cancelamento** | Vender "o ecossistema todo" e variar só pela equipe é o que o mercado inteiro faz e o que se explica em uma frase. Os números do `docs/18` fecham (equilíbrio em 5 assinantes). Subir preço depois é fácil para quem chega; baixar é impossível. Mudança no código: mover os módulos do Equipe e do Avançado para o Essencial em `planos.ts` |
| **D3** | **Cortesia até D0 para quem se cadastrar até 12/12/2026 (D0 menos 30 dias). Quem chegar depois tem 21 dias de teste a partir do cadastro.** A mesma regra vale depois do lançamento: 21 dias sem cartão | Ninguém ganha menos de 30 dias na janela. E o produto precisa de teste depois de D0 (sem plano grátis, sem teste ele não vende); 21 dias cobre um ciclo de retorno |
| **D4** | **Teto de 40 contas de cortesia longa** (alpha incluído), em ondas: 10 no alpha, 25 em 09/11, 40 em 23/11, cada onda só abre se a anterior passou do portão. Fila de espera para o resto. **Primeira turma: barbearia e salão pequeno, 1 a 3 profissionais. Fora dela: clínica de estética e qualquer negócio que dependa de anamnese pesada, até o RIPD e o parecer** | Suporte é o gargalo; ver princípio 4 e 5 |
| **D5** | **Nenhum desconto. Preço travado por 12 meses** para quem entrou na janela e assina até 30 dias depois de D0. Substitui o "1 mês de Essencial" de 28/09 (não somam: esse nunca teve mecanismo, e 63 dias grátis já é o benefício) | Recompensa quem chegou primeiro sem tocar na tabela pública e sem escassez falsa (a data é real e fica dita uma vez, sem contador). O mecanismo só importa no dia em que o preço subir: por ora basta gravar a marca `fundador` na cortesia |
| **D6** | **Alpha (até 10 convidados) pode ser você, pessoa física, com aviso escrito. CNPJ ME no Simples precisa existir antes de 09/11** *(nota de 30/09: o Eduardo já tem CNPJ de MEI; ele vira ME sem trocar de número quando o código do software entra no cadastro, e o efeito vem no 1º dia do mês seguinte. Para valer em 01/11 o pedido sai até 31/10. Ver `docs/89`)*. Conta do Mercado Pago no CNPJ antes de 21/12** | **Mudei a minha recomendação anterior.** Antes eu aceitava a janela toda como pessoa física. Com 40 contas e dado de terceiros, a responsabilidade pessoal ilimitada e a falta de fornecedor identificado (Decreto 7.962/2013 [confirmar]) deixam de ser tolerável. 6 semanas bastam para abrir o CNPJ. Contrate o contador esta semana: MEI é vedado para software, e só ele diz Anexo III ou V |

### 2.2 Decisões extras que eu tomei porque decidem o resto

| Id | Decisão |
|---|---|
| **E1** | **WhatsApp automático fica fora da janela e do lançamento.** Liga só depois de 20 assinantes e da verificação da Meta com aquecimento (`docs/74`). Até lá, "Chamar" abre o WhatsApp do próprio dono, e nenhuma tela promete lembrete automático |
| **E2** | **Vercel Pro e Supabase Pro (backup diário) antes do alpha.** Cerca de US$ 45 por mês somando os dois, sujeito ao preço vigente (a Vercel cobra US$ 20 por usuário, conferido na documentação). Recuperação por ponto no tempo só depois de 20 contas |
| **E3** | **A cláusula de dados agregados entra na v2 dos termos antes do alpha, com o pipeline desligado.** Se o parecer disser que precisa mudar, o custo é pedir reaceite de no máximo 40 contas; o custo de deixar para depois é toda conta nascer fora do ativo. **Contratar a revisão do dossiê até 21/12.** Busca de marca no INPI esta semana, depósito antes de 09/11 |
| **E4** | **Se o Portão 2 falhar, prorrogo a cortesia de quem está ativo por 30 dias, e não baixo o preço.** "Ativo" = fez pelo menos um "Chamar" nas últimas 3 semanas. É uma data nova na constante, sem código novo. Conta que não está ativa entra na graça e na pausa normalmente |
| **E5** | **Nunca converto cortesia em cobrança sem um toque de assinar.** Nem com o cartão à mão, nem com aviso. É o que sustenta a promessa de `/precos` e o CDC |

### 2.3 O que me faria mudar de ideia (regras de parada)

- **Menos de 7 dos 10 do alpha com a base importada e "quem sumiu" na tela em 48 h** → a janela pública não abre; eu conserto o onboarding primeiro.
- **Suporte passando de 1 hora por semana por conta** → o teto de 40 cai para 25.
- **CNPJ não sai até 06/11** → adio a janela pública e o lançamento **juntos** (mesmo intervalo de 63 dias); o alpha segue.
- **Parecer humano derruba a cláusula agregada** → reaceite dos ≤ 40 e nada mais muda.
- **Parecer humano derruba a limitação de responsabilidade do §9 dos termos** → reescrevo com o teto de 12 meses pagos e sem a frase do plano gratuito, que já deixa de existir.

---

## 3 · Como a cortesia funciona no produto

**Hoje não existe teste grátis no código** (`grep` por trial/cortesia não acha nada). O plano vigente
é lido em **um lugar só**, `contextoDePlano` (`server/services/planos.ts`), e decidido em `core/billing/planos.ts`.
A cortesia entra ali, sem espalhar regra.

### 3.1 Desenho

- **Onde mora:** `tenants.settings.cortesia = { plano, ate, origem: 'pre_lancamento', concedida_em }`.
  Sem coluna nova (é o mesmo padrão de `assinatura`, `custo_fixo`, `dor_principal`), com leitor Zod
  próprio e valor inválido lido como "sem cortesia".
- **Plano vigente = o maior entre o plano pago e a cortesia ainda válida.** A cortesia **nunca**
  rebaixa quem já paga mais, e quem paga o degrau mais alto não perde nada.
- **Expiração preguiçosa, sem cron.** Compara `ate` com "agora" a cada leitura de plano. Não escrevo
  nada quando a cortesia acaba. Motivo: o cron do GitHub já atrasou horas e a lição registrada é que
  a rota não pode depender do relógio (`cron-github-atrasa-horas`).
- **Quem concede:** `executarOnboarding`, no cadastro. **Até 12/12/2026 a cortesia vai até D0 (11/01/2027); a partir de 12/12, e para sempre depois de D0, são 21 dias a partir do cadastro** (D3). A marca `fundador` só vale para quem entrou entre 09/11 e 12/12 (D5). As datas moram numa
  constante única (`core/billing/prelancamento.ts`), com guarda que impede a mesma data em dois
  lugares. Registra em `audit_log` e em `product_events` (`cortesia_concedida`).
- **Sem cartão, sem cobrança automática.** Ao acabar, **nada é cobrado**. Assinar é um toque no
  botão que já existe (`/api/v1/billing/assinar`, preapproval do Mercado Pago). Isso é o que mantém o
  programa dentro do que a `/precos` já promete e do CDC.
- **O fim (D1):** em D0 começam 7 dias de graça (tudo funciona, faixa vermelha; `graca_ate` no mesmo formato
  da graça de pagamento) e depois a **conta pausada**: `podeCriar` falso para tudo, leitura e exportação
  livres, página pública de agendamento mostrando "indisponível", faixa "sua cortesia acabou; escolha um
  plano para voltar a criar". Assinar reativa na hora. O degrau `gratis` deixa de ser vendido e vira o
  estado `pausado`. Eliminação só depois de 90 dias, com aviso 30 e 7 dias antes.
- **Aviso, nunca surpresa:** faixa no painel com a data de fim desde o primeiro dia, contagem
  regressiva só nos últimos 14 dias, e três e-mails (D-14, D-7, D-1) por uma fila que já existe
  (`job-queue`). E-mail depende do agendador; a faixa não depende de nada.
- **Métricas que saem de graça:** `cortesia_concedida`, `cortesia_acabou_sem_assinar`,
  `assinou_depois_da_cortesia`, mais os eventos de funil que já existem (`cliente_voltou`).

### 3.2 O que muda nos textos e telas

`/precos` (troca "grátis para sempre" por "60 dias de tudo liberado, sem cartão"), Meu plano, `/termos` §5 e §6,
landing, e o cadastro (mostra a data de fim antes de criar a conta). O `/termos` v2 do `docs/86` já
nasce com a cláusula do programa. **Nenhuma frase de urgência falsa:** a data é real e fixa.

### 3.3 Testes que eu escrevo (e vejo reprovar)

Plano vigente com cortesia válida, vencida, no dia exato, com pagamento maior, com pagamento menor;
fuso (máquina em `Pacific/Kiritimati`, que é onde a data em UTC vira o dia seguinte); JSON de
cortesia corrompido; conta criada depois de D0 não ganha cortesia; guarda de que nenhum caminho da
cortesia chama o Mercado Pago. **Esforço:** 1,5 a 2 dias de código e 1 dia de verificação no navegador.

---

## 4 · O que falta de verdade, medido

Legenda de bloqueio: **[J]** trava abrir a janela grátis · **[D0]** trava cobrar no lançamento ·
**[—]** não trava nenhum dos dois.

### 4.1 P0 — antes de abrir o alpha (26/10)

Todos os itens abaixo, **menos o CNPJ** (item 11), que só é exigido para a janela pública (09/11).

| # | O que | Estado | Quem | Bloqueia |
|---|---|---|---|---|
| 1 | **Publicar o código.** A `main` está **107 commits atrás** da branch de trabalho, e a migration `0092` mora em outra branch (`melhoria/orcamento-e-motor-2026-09-27`). Faltam em produção as `0093` a `0098`. Ordem obrigatória: migrations **antes** do código | só existe local; **nada foi enviado** | eu preparo (fatiar em PRs pequenos, rebasear `DECISOES.md`, checar `0092` × `0093+`, atualizar o runbook); **o Eduardo** roda `db push` e funde (o classificador do harness barra os dois) | **[J]** |
| 2 | **Jurídico v2 no ar** (`docs/86`, J3 a J8) e aceite versionado no cadastro | minuta a escrever | eu escrevo; Eduardo aprova | **[J]** |
| 3 | **Canal de contato**: `NEXT_PUBLIC_CONTATO_WHATSAPP` e `_EMAIL` + e-mail próprio do produto | ausentes na Vercel na auditoria de 27/09 `[verificar]` | Eduardo (2 variáveis + redeploy) | **[J]** (LGPD art. 18) |
| 4 | **Cortesia no código** (§3) | não existe | eu | **[J]** |
| 5 | **Hospedagem que pode ser usada comercialmente.** A documentação da Vercel diz que o plano Hobby é só para **uso pessoal e não comercial**. Pro custa US$ 20 por usuário/mês e sobe o log de 1 hora para 1 dia | produção está no Hobby `[verificar]` (`docs/18` escolheu Hobby por custo) | Eduardo | **[J]** se a janela já conta como uso comercial (recomendo tratar assim); **[D0]** com certeza |
| 6 | **Backup do banco.** A Supabase **não faz backup no plano Free**; o Pro guarda 7 dias, e recuperação por ponto no tempo é um adicional pago | plano do projeto de produção `[verificar]` (`DECISOES:30` cita US$ 10/mês, o que sugere plano pago) | Eduardo confere; se for Free, sobe **antes** de receber o primeiro cliente real | **[J]** (ficha de saúde sem backup é risco inaceitável) |
| 7 | **E-mail de cadastro em volume.** O SMTP embutido da Supabase tem limite baixo por hora, e a auditoria B1 nunca testou volume. Configurar SMTP próprio (Resend, que já existe) no Auth | não visível `[verificar]` | Eduardo (painel) + eu (teste com 20 cadastros seguidos no banco local) | **[J]** — cadastro que não recebe e-mail é o primeiro abandono |
| 8 | **Erro que alguém veja.** `SENTRY_DSN` vazio significa que erro de usuário real não chega a ninguém | desligado por decisão de desempenho (`docs/28`) | Eduardo (DSN) | **[J]** |
| 9 | **Suporte e onboarding assistido**: canal único, horário, FAQ, texto de boas-vindas, roteiro de importação da base (o WhatsApp do Eduardo já é o canal decidido em 28/09) | roteiros existem em `docs/runbooks/` | eu escrevo o FAQ e o passo a passo; Eduardo atende | **[J]** |
| 10 | Segredos da Vercel como "Sensitive" (B2) e Leaked Password Protection (B6, recurso de plano pago da Supabase `[verificar]`) | pendentes | Eduardo | **[J]** (barato, 15 min) |

### 4.2 P1 — durante a janela, antes de D0

| # | O que | Quem | Bloqueia |
|---|---|---|---|
| 11 | **[Decidido em D6: precisa existir antes de 09/11.]** **CNPJ ME no Simples + contador + NFS-e da prefeitura.** MEI é vedado para software (CNAE 6201 a 6209, `docs/18`, auditado em 24/08). Contabilidade entra como custo fixo (R$ 139 a 195/mês, mesma fonte). É o item de **prazo mais longo e fora do código**: por isso a janela de 60 dias existe | Eduardo | **[J pública]** e **[D0]** |
| 12 | **Conta do Mercado Pago no CNPJ** e **teste de cobrança real ponta a ponta**: assinar → webhook → plano vira → falha de pagamento → graça de 7 dias → queda → cancelar → estorno em 7 dias. Feito com cartão e Pix do próprio Eduardo e estornado | Eduardo cria a conta e paga; eu escrevo o roteiro e confiro cada efeito no banco | **[D0]** |
| 13 | **`/precos`, Meu plano e termos dizendo a mesma coisa** sobre cobrança (B5 da auditoria) | eu | **[D0]** |
| 14 | **Aviso de fim** (faixa + 3 e-mails) e a tela da conta pausada | eu | **[D0]** |
| 15 | **Placar do piloto**: consultas SQL salvas que respondem "quantos importaram a base, quantos viram quem sumiu, quantos chamaram alguém, quantos clientes voltaram" | eu | **[—]**, mas sem ele D0 é decisão às cegas |
| 16 | **Parecer humano** (dossiê do `docs/86` §6) e **busca de marca no INPI** | Eduardo contrata | **[D0]** para a cláusula agregada; **[—]** para o resto |

### 4.3 P2 — depois do lançamento (não bloqueiam nada acima)

WhatsApp automático (`F0`: verificação da Meta e aquecimento do número, `docs/74`), pipeline agregado
e comparativo (só depois do parecer), login com Google/Apple (só falta ligar no painel da Supabase),
apps de loja (`docs/64`), expansão LATAM (`docs/65`). **Na janela, "Chamar" abre o WhatsApp do próprio
dono, de graça.** Nenhuma tela promete lembrete automático por WhatsApp enquanto ele não existir (regra
já registrada em `CLAUDE.md`).

### 4.4 Decidi que NÃO é problema (e por quê)

- **Falta de features.** A auditoria de 27/09 deu GO com ressalvas: o funil público → cadastro →
  onboarding → "quem sumiu" → chamar funciona de ponta a ponta. O que faltava era ecossistema.
- **Preço perfeito.** Vem de conversa de venda, não de planilha. Com 40 contas dá para perguntar
  "você pagaria R$ X?" a quem já usou.
- **Concorrente mais barato (Simples Agenda a R$ 39,90).** O CICLO não compete em agenda; compete em
  "quem sumiu e quanto vale". A janela existe para provar isso com número do próprio salão.

---

## 5 · Calendário e portões

Datas fixas (todas segundas-feiras, menos as marcadas). **D0 = 11/01/2027.**

| Quando | O que acontece | Portão de saída |
|---|---|---|
| **29/09 a 23/10** | P0 1 a 10. Eu: fatiar e publicar (com você), cortesia no código, jurídico v2 (aprovação sua até 16/10), FAQ e placar. **Você, nesta semana: contador, CNPJ, busca no INPI, Vercel Pro, Supabase Pro, as duas variáveis de contato** | **Portão 0 (sex 23/10): P0 verde, menos o CNPJ.** Sem isso o alpha não abre, porque a primeira conta real já vira passivo (LGPD, backup, canal) |
| **26/10 (alpha)** | Até 10 contas convidadas por você, pessoa física, com aviso escrito. Você importa a base de cada uma pelo WhatsApp e apaga a planilha do celular depois | — |
| **26/10 a 06/11** | Alpha rodando; ajustes; CNPJ saindo | **Portão A (sex 06/11):** ≥ 7 de 10 com base importada e "quem sumiu" em até 48 h; **CNPJ existe**; termos v2.1 com razão social e CNPJ no ar, e as contas do alpha avisadas |
| **09/11 (pública, onda 1)** | Abre até 25 contas. Kit de visita e roteiro do Instagram já existem (`docs/marketing`, `docs/runbooks`) | suporte cabe no horário; nenhum bug de dado ou dinheiro aberto |
| **23/11 (onda 2)** | Até 40. **Black Friday (27/11) é só para observar**: nenhuma ação | — |
| **12/12** | **Encerra a cortesia longa para novos cadastros.** Quem chega depois tem 21 dias | — |
| **21/12 (Portão 1)** | Cobrança real ponta a ponta com o CNPJ (item 12); parecer humano recebido; `/precos`, Meu plano e termos coerentes; conta do Mercado Pago no CNPJ | **Portão 1: item 12 verde.** Assinatura voluntária antecipada abre. Nenhuma cobrança automática em dezembro |
| **28/12 · 04/01 · 10/01** | Avisos D-14, D-7 e D-1 (faixa + e-mail) e mensagem pessoal aos ativos na semana de 04/01 | — |
| **11/01/2027 (D0)** | **Lançamento oficial.** Cobrança liga; cortesia acaba; começam os 7 dias de graça | — |
| **18/01** | Fim da graça: quem não assinou vai para a pausa | **Portão 2: ≥ 1 assinatura real paga e conciliada.** Se falhar, regra E4 |

**Hipóteses de sucesso `[H]`, a medir e não a prometer:** ≥ 60% importam a base em 7 dias; ≥ 50% chamam
alguém pelo "Chamar" em 14 dias; ≥ 1 em cada 5 dos ativos diz que pagaria o preço proposto (perguntar
na semana de 04/01, não no dia do lançamento). A métrica norte continua sendo `cliente_voltou`
(`docs/82`). A **prestação de contas do Motor** ("dos N que previmos, M voltaram") vira o argumento da
mensagem pessoal de D-7, com o número de cada salão.

---

---

## 6 · Riscos que eu vejo

1. **Publicar 107 commits de uma vez** (7 migrations, 3 meses de mudança). Mitigação: fatiar por tema,
   migrations antes, smoke test escrito. Lidas em 29/09: as `0093` a `0098` são aditivas no schema
   (nenhuma tira coluna nem privilégio de tabela), então podem ir antes do código. Duas atenções: a
   `0096` e a `0097` também **corrigem linhas existentes** (data da última visita; `canonical_key`
   dos serviços), e a `0094` e a `0097` **revogam execução de função** para os papéis de usuário. O
   smoke test roda o **código antigo** contra o banco já migrado (cadastro e criação de serviço têm
   que continuar funcionando), porque é exatamente essa a janela em que produção fica entre as duas
   versões.
2. **Conversão baixa no D0.** Beta grátis costuma converter pouco `[H]`. Por isso o placar do item 15
   e a conversa de preço na S5, e não no dia do lançamento.
3. **Suporte come tudo.** Por isso o teto de 40 (D4) e o FAQ antes de abrir.
4. **Expectativa de WhatsApp automático.** Mitigação: nenhuma frase promete; o "Chamar" é o caminho.
5. **Vercel Hobby em uso comercial.** Risco de suspensão sem aviso com cliente dentro. Mitigação: item 5.
6. **Cortesia vira grátis eterno por atrito.** D1 decidiu a pausa, e o cadastro mostra a data de fim antes de criar a conta.
7. **Dado de terceiros em trânsito:** a planilha de clientes chega no WhatsApp do Eduardo. Importar e
   **apagar em seguida** (registrado no `docs/84` §2.5; confirmar no parecer).

---

## 7 · Quem faz o quê, na ordem

**Eu, sem depender de ninguém:** (1) `docs/86` J1 a J3, a parte factual dos textos; (2) cortesia no
código com testes, já com as regras D1 e D3, e os módulos das duas faixas (D2); (3) minuta v2 dos termos
e da política, DPA, aviso da página pública, aceite e reaceite; (4) roteiro de publicação em fatias e
runbook de migrations; (5) FAQ, onboarding assistido e placar do piloto; (6) roteiro do teste de
cobrança real.

**Eduardo, por ordem do que trava mais e do prazo mais longo:**
1. **Esta semana:** contratar o contador e abrir o CNPJ; busca de marca no INPI; Vercel Pro e Supabase Pro; as duas variáveis de contato na Vercel; confirmar o plano atual do Supabase e se Sentry, PostHog e hCaptcha estão ligados.
2. **Até 16/10:** aprovar a minuta v2 dos termos e da política.
3. **Até 23/10:** `db push` das migrations e fundir as PRs quando eu entregar a fila; escolher os 10 convidados do alpha.
4. **Até 06/11:** CNPJ existindo; aceitar os DPAs dos operadores.
5. **Até 21/12:** conta do Mercado Pago no CNPJ, cobrança real de teste, revisão do dossiê contratada.

**Fonte das afirmações sobre plataformas:**
[Vercel Hobby (uso não comercial)](https://vercel.com/docs/plans/hobby) ·
[Supabase, backups por plano](https://supabase.com/docs/guides/platform/backups).
