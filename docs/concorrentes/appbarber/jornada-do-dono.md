# A jornada do dono que vem do AppBarber, do download ao uso semanal

Escrita em 16/10/2026, junto com a versão 2 do `plano-estrategico.md`. Conferida no código das branches:
- `loja/lacunas-2026-10-15` (a mais nova com o app, PR #151);
- `conversor/esteira-universal` (o importador novo, ainda sem PR).

É só plano: nada foi construído nem publicado.

Rótulos: **FATO** (com o arquivo onde conferi), **INFERÊNCIA** (de quais fatos), **HIPÓTESE** (com o teste que decide).

## Resumo

O dono passa por 8 etapas: descobre, baixa, cria a conta, responde 3 perguntas, traz os clientes, vê a fila, usa toda semana e, um dia, decide se troca.

| Etapa | Situação hoje | Por quê |
| --- | --- | --- |
| 1. Descobre e baixa | **Quebra** | O app ainda não está nas lojas e o site não tem página para quem usa o AppBarber |
| 2. Cria a conta | **Quebra** | Sem SMTP o e-mail de confirmação não chega a quem é de fora |
| 3. Primeiras perguntas | Funciona | O sistema escolhido se perde no caminho |
| 4. Traz os clientes | **Quebra** | O importador da `main` só aceita CSV, e no celular ninguém converte Excel em CSV |
| 5. Primeira fila | Funciona | O cartão "N já passaram da hora" leva à fila |
| 6. Uso semanal | **Quebra** | Os três defeitos abaixo |
| 7. O ritmo aprende | **Quebra** | Cada "voltou" substitui a data anterior em vez de somar |
| 8. Troca | Fica para depois | Depende de pagamento e clube |

**Os três defeitos da semana:**
- o "Chamar" manda o cliente para a agenda do CICLO, criando uma segunda agenda;
- o CICLO não sabe quem voltou pelo AppBarber;
- no app não há notificação nenhuma.

**A boa notícia:** o importador novo (`conversor/esteira-universal`, 94 commits, provado no navegador em 13/10) já lê planilha do Excel, contatos do celular, conversa do WhatsApp, PDF e **print de tela**. O caminho mais curto para a etapa 4 é colocá-lo na `main`, não escrever outro.

---

## O desenho em uma tela

```
                       ┌────────────── AppBarber (continua) ───────────────┐
                       │  agenda, app do cliente, clube, pagamento         │
                       └──────┬───────────────────────────────▲───────────┘
             exporta, print   │                               │ cliente agenda
             ou memória       ▼                               │ pelo link do AppBarber
 ┌─────────────── CICLO ────────────────────────────────────────────────────┐
 │  1. Importa a base ──► 2. Motor calcula quem passou da hora ──► 3. Fila  │
 │         ▲                                                    │           │
 │         │ 5. "Já voltou" (fila, print da agenda               ▼           │
 │         │    do dia ou planilha do mês)            4. Chamar pelo         │
 │         └───────────────────────────────────────── WhatsApp do dono       │
 └──────────────────────────────────────────────────────────────────────────┘
```

**A regra do desenho:** na convivência, o CICLO **nunca** agenda. Quem agenda é o AppBarber. O CICLO decide quem chamar e fica sabendo quem voltou. Se as duas coisas agendarem, o dono passa a ter duas agendas que não se enxergam.

---

## Etapa 1 · Descobre e baixa

| O que acontece | Situação |
| --- | --- |
| Acha o CICLO numa busca, num vídeo, por um barbeiro colega ou pessoalmente (canais no plano, seção 9) | A página "Use junto com o AppBarber" não existe (ticket MKT-01) |
| Baixa o app "CICLO" na Play Store ou na App Store | **Não publicado.** Código pronto no PR #151; faltam as contas de desenvolvedor, o arquivo assinado e a revisão das lojas (FATO, `docs/98-aprimoramento/14-passo-a-passo-do-eduardo.md`) |
| Ou abre `seuciclo.com.br` no navegador do celular | Funciona hoje. O site é o mesmo produto: o app é o site embrulhado (FATO, `capacitor.config.ts`, `server.url`) |
| Abre o app | Vai direto para `/entrar`: a vitrine e os preços ficam fora do app (FATO, `src/middleware.ts`, `destinoNoAppNativo`; exigência da Apple, LOJA-20) |

**INFERÊNCIA:** enquanto as lojas não aprovarem, o site no navegador é a porta do piloto. Nada no plano depende do app estar publicado; o app melhora a etapa 6 (abrir toda semana), não a 1.

## Etapa 2 · Cria a conta

| O que acontece | Situação |
| --- | --- |
| Toca em "Criar conta" e preenche nome, e-mail, telefone e senha | Funciona (FATO, `api/v1/auth/signup`) |
| Entrar com o Google | Escondido dentro do app (FATO, LOJA-21: a Apple exigiria "Entrar com a Apple" junto). No site aparece só se o Eduardo ligar no Supabase |
| Recebe o e-mail de confirmação | **QUEBRADO para quem é de fora.** Sem SMTP próprio, o Supabase só entrega para o time da organização. O cadastro agora avisa isso em vez de fingir que mandou (FATO, LOJA-02, `EMAIL_UNAVAILABLE`) |
| Toca no link do e-mail | Na `main`, a confirmação troca um código PKCE (`auth/callback`), que só fecha no navegador onde o cadastro começou: aberto de outro lugar, dá "link inválido". **Já consertado na `onda-1` (APR-026)**, ver abaixo |

**Correção de 16/10 (mesmo dia):** o conserto do link já existe na branch `aprimoramento/onda-1` (APR-026).
- A rota `/auth/confirmar` troca o `token_hash` do e-mail por sessão com `verifyOtp`, que funciona em qualquer navegador.
- Os modelos novos de e-mail estão em `supabase/templates/`.
- **Falta, em produção:** a `onda-1` chegar à `main` e o Eduardo colar os dois modelos no painel do Supabase (Authentication, Email Templates). Até lá, os e-mails seguem caindo no `/auth/callback` antigo.
- **Dentro do app:** a confirmação acontece no navegador do celular, e a pessoa volta ao app e entra com a senha. Funciona, com um passo a mais.

**JORN-01** (código de 6 dígitos digitado na tela) **só entra se** o teste de campo mostrar gente se perdendo nesse passo a mais.

**Dependência que trava tudo:** o SMTP (decisão do Eduardo, LOJA-01). Sem ele nenhum dono de fora cria conta. É o primeiro item da lista dele.

## Etapa 3 · Primeiras perguntas

| Tela | Pergunta | O que faz com a resposta (FATO, código) |
| --- | --- | --- |
| `/onboarding` | Nome do negócio, profissão ("barbeiro"), endereço da página | Profissão escolhe o pacote de serviços com o ritmo padrão de cada um |
| `/onboarding/perfil` · Pergunta 1 | "Onde estão seus clientes hoje?" | "Outro sistema" abre "Qual sistema você usa?" (AppBarber, Trinks, Belasis, BarbUp, Booksy, outro) e depois leva a `/admin/clientes/vindo-de-outro-sistema` (`rotaAposResponderPerfil`) |
| Pergunta 2 | "Quem atende no seu negócio?" | "Só eu" desliga equipe e comissão |
| Pergunta 3 | "O que mais te incomoda hoje?" | Grava a dor principal |

**O furo:** o sistema escolhido só vai para o evento `perfil_respondido` (FATO, `perfil-onboarding.ts`). A tela seguinte não sabe que é o AppBarber e fala de "seu sistema atual".

**Conserto (CONV-02):** levar a escolha na rota (`?de=appbarber`) e montar a tela própria do AppBarber (etapa 4).

## Etapa 4 · Trazer os clientes do AppBarber

Hoje a tela "Vindo de outro sistema" tem uma mensagem pronta para pedir a exportação e três saídas: planilha, memória e "me manda que eu faço" (FATO, `vindo-de-outro-sistema/page.tsx`).

A versão para o AppBarber deve oferecer **quatro portas, na ordem do que é mais rápido para quem está com o celular na mão:**

### Porta A · Print da lista de clientes do AppBarber (2 a 5 minutos, sem esperar ninguém)

1. No app do AppBarber, o dono abre a lista de clientes e tira prints rolando a tela.
2. No CICLO, toca "Importar" e escolhe os prints da galeria.
3. O CICLO lê os nomes e telefones no próprio aparelho, mostra tudo para conferir e grava.

| Peça | Situação |
| --- | --- |
| Leitura de print por OCR no aparelho, em português, tela escura incluída | FATO: existe na branch do conversor (CNV-018, tesseract.js servido de `/ocr`); medido em 13/10: print escuro lido em 1,9 s |
| Tudo que vem de imagem vai para conferência, nunca entra direto | FATO: nível ≤ N1 (CNV-018) |
| A lista do AppBarber mostra última visita? | **NÃO VERIFICADO.** Se mostrar, o print traz a data e o Motor já calcula. Se não, entram nome e telefone, e o Motor fica sem saber de quando prever (ver porta C) |
| Print de várias telas da mesma lista | HIPÓTESE: a esteira junta quem se repete entre prints pelo telefone (E7, `juntar.ts`); testar com prints que se sobrepõem |

**Por que é a primeira porta:** é a única que não depende do chat do AppBarber responder, nem de o dono saber o que é CSV.

### Porta B · Arquivo exportado pelo AppBarber (minutos, mais a espera do chat)

1. O dono copia a mensagem pronta e manda no chat do AppBarber (FATO: "exportar a base só pedindo no chat", FAQ deles).
2. O arquivo chega por e-mail ou WhatsApp (**NÃO VERIFICADO**: formato, colunas e se traz a última visita).
3. Ele põe o arquivo dentro do CICLO, conforme o aparelho:

| Aparelho | Como o arquivo entra no CICLO hoje |
| --- | --- |
| Android, app | No CICLO, "Escolher arquivo" abre o seletor do sistema; o arquivo está em Downloads (baixado do e-mail) ou na pasta do WhatsApp |
| iPhone, app | O arquivo precisa estar no app Arquivos: no e-mail ou no WhatsApp, "Compartilhar", "Salvar em Arquivos". No CICLO, "Escolher arquivo" oferece Fototeca, Câmera ou Arquivos |
| Computador | Arrastar ou escolher o arquivo |

| Peça | Situação |
| --- | --- |
| Importador da `main` | **Só CSV.** O campo aceita `.csv,text/csv`; planilha do Excel volta com a instrução "Arquivo, Salvar como, CSV UTF-8" (FATO, `importador.tsx:175`, `decodificar-texto.ts`). **No celular essa instrução é impossível de seguir** |
| Seletor do Android com `accept="text/csv"` | **HIPÓTESE de risco:** CSV salvo pelo WhatsApp costuma vir com outro tipo (`text/comma-separated-values`, `application/octet-stream`) e pode aparecer apagado no seletor. Testar num Android real |
| Importador novo (conversor) | FATO: lê `.xlsx` com leitor próprio, CSV com `;` ou `,`, Windows-1252, zip, PDF com texto e PDF escaneado; o campo não restringe o tipo (`esteira.tsx`); mostra **quanto dinheiro está parado antes de gravar** (CNV-021); dá para **desfazer** em 7 dias (CNV-022) |
| Mapear colunas | O conversor classifica pelo conteúdo, com confiança, e só pergunta o que não tem certeza (CNV-004) |
| "Que serviço essas pessoas fazem?" | Uma pergunta para a base toda: o serviço principal vem marcado (FATO, `importador.tsx:79`). Na barbearia, "Corte" serve para quase todos |

**Os três cenários do arquivo do AppBarber, e o que o CICLO faz em cada um:**

| O arquivo traz | O Motor no dia 1 | O que a tela deve dizer |
| --- | --- | --- |
| Nome, telefone e última visita | Calcula na hora e mostra a fila com valor | "N passaram da hora de voltar, R$ X" |
| Nome e telefone, sem data | Nada para prever: as fichas entram e a fila fica vazia | "Seus N clientes entraram. Agora diga de quando é a última vez dos que você lembra" e abrir a porta C já com a lista |
| Histórico de atendimentos (relatório "Agendamentos realizados") | Daria o ritmo pessoal de cada um | **Não existe:** o conversor importa fichas; histórico como atendimentos é a Onda F, não começada (FATO, `_progresso.md`). Plano mínimo: tirar desse relatório só a **última data e as datas anteriores** de cada cliente para o histórico (CONV-08) |

### Porta C · De memória (10 a 15 minutos para 20 a 50 pessoas)

Existe e funciona (FATO, `ja-atendo`): nome, telefone opcional e "faz quanto tempo" para cada um. É a porta para quem não quer esperar o chat nem tirar print.

Com as fichas já importadas sem data (cenário 2 acima), a parte "retornos" deixa buscar quem já existe e dizer a data. Hoje é **uma busca por nome de cada vez** (FATO, `BuscaDeRetorno` em `ja-atendo/formulario.tsx`).

**Melhoria:** uma lista com caixa de seleção agrupada por "faz 1 semana / 2 semanas / 1 mês / 2 meses / mais" (CONV-09).

### Porta D · "Me manda que eu faço"

O Eduardo importa pelo WhatsApp, sem custo (decisão do `docs/83`).
- O botão **só aparece com o canal de contato configurado** (FATO, `canalDeContato`), e hoje não está.
- Usar o importador novo com o **runbook de importação assistida**, já reescrito para a tela nova (D7 do conversor).
- O arquivo do cliente é dado pessoal: apagar depois de importar e não guardar fora do CICLO.

### O que NÃO fazer na etapa 4

- **Pedir a senha do AppBarber do dono** para puxar os dados por ele. Viola a regra de não usar credencial de terceiro e, provavelmente, os termos do AppBarber.
- **Raspar o painel do AppBarber** ou usar a API paga deles sem contrato.
- **Importar dado de saúde ou ficha de anamnese** vindo do AppBarber. O conversor já barra CPF e alergia na ficha (FATO, corpus CNV-008).

## Etapa 5 · O primeiro "uau"

| O que acontece | Situação |
| --- | --- |
| Logo depois de importar: "N clientes já passaram da hora de voltar", com link "Ver quem são" | FATO: nas duas portas antigas (`importador.tsx:380`, `ja-atendo/formulario.tsx:163`) e na esteira nova, com o valor em R$ |
| Recuperar mostra a fila: um cliente por vez, "Chamar pelo WhatsApp" abre o WhatsApp do próprio dono com o texto escrito | FATO (`recuperar/fila.tsx`, `textoDeVolta`) |
| **O texto leva o link de agendamento do CICLO**: "É só escolher o horário aqui: {link}" | FATO (`src/lib/mensagens.ts:127`). **Na convivência isso é um defeito grave:** o cliente marca no CICLO, o dono olha a agenda no AppBarber e os dois horários batem |

**Conserto (CONV-10), antes do piloto:**
- Configuração "Onde seus clientes marcam horário" com duas opções: **"No CICLO"** e **"Em outro sistema, por este link"**.
- Com outro sistema:
  - a mensagem leva o link do AppBarber do dono (ou nenhum link);
  - a página pública do CICLO não aceita agendamento;
  - o "Já voltou" passa a ser a forma de saber que o chamado deu certo.

## Etapa 6 · A semana (o ciclo de verdade)

O que precisa acontecer toda semana, com o tempo de cada passo (HIPÓTESE, medir no piloto):

| Dia | Passo | Tempo | Situação |
| --- | --- | --- | --- |
| Segunda | Recebe "5 clientes passaram da hora esta semana, R$ 230" | 0 | **Não existe.** No app nativo **não há notificação nenhuma**: o Web Push foi escondido no app (FATO, LOJA-24) e o push nativo não foi feito. Sobra o e-mail, que depende do SMTP |
| Segunda | Abre a fila e toca "Chamar" em quem quer | 3 min | FATO: existe |
| Durante a semana | Os clientes marcam no AppBarber | 0 | Fora do CICLO |
| Sexta, ou quando quiser | Conta ao CICLO quem voltou | 2 min | **Só a busca nome por nome existe**, ver abaixo |

**Três jeitos de contar quem voltou, do mais leve ao mais completo:**

1. **"Já voltou" na própria fila (CONV-01, P).** A fila já mostra quem o Motor acha que sumiu. Quem voltou pelo AppBarber, o dono tira com um toque, e isso vale como visita.
   - Se a pessoa tinha sido chamada nos últimos 30 dias, conta em "O Motor de Ciclo trouxe".
   - Hoje esse número só conta quem volta pelo link do CICLO (FATO, `fila.tsx:165`), que na convivência quase ninguém usa. Sem isso, o dono nunca vê o resultado.
2. **Print da agenda do dia no AppBarber (CONV-11, M).** No fim do dia, um print da agenda do AppBarber.
   - O CICLO lê os nomes (o mesmo OCR da porta A) e casa com as fichas por nome parecido.
   - Ele **pergunta** quando há dúvida: o conversor nunca junta só por nome (FATO, `juntar.ts`).
   - Mostra "estes 8 vieram hoje?" para confirmar.
   - É o jeito de o Motor saber de **todo mundo** que veio, não só de quem estava na fila.
   - HIPÓTESE: a agenda do AppBarber mostra o nome do cliente legível no print. Testar com um print real do piloto.
3. **Planilha do mês (CONV-12, M).** Uma vez por mês, o dono exporta de novo do AppBarber (ou manda o relatório de atendimentos) e o CICLO atualiza a última visita de quem já tem ficha.
   - **Hoje a segunda importação pula quem já tem ficha:** "Já existe uma ficha com esse telefone" (FATO: na `main`, `importacao-clientes.ts:283`; e no conversor, `lote-de-importacao.ts:198`).
   - O conserto: se a data nova for mais recente que a da ficha, grava a visita em vez de pular.

## Etapa 7 · Mês 1 a 2: o ritmo aprende (ou não)

**O defeito mais sério para a promessa do CICLO:**
- O cálculo da ficha que entrou por importação ou memória recebe **uma data só**: `history: [{ date: c.ultimaVisita }]` (FATO, `ciclo-de-quem-ja-atende.ts:40`).
- Todo "voltou" (porta de retornos e, depois, o "Já voltou") **substitui** essa data, não soma.
- O recálculo da madrugada lê os atendimentos do CICLO mais essa última data. Quem só é atendido no AppBarber nunca tem atendimento no CICLO.

**Consequência:** para o dono que convive, o Motor fica para sempre no ritmo padrão do serviço. O pilar "o CICLO aprende o ritmo de cada cliente" **nunca acontece na convivência**, por mais que ele marque quem voltou.

**Conserto (CONV-08, M, com migration):**
- Uma tabela de "visitas de fora", com RLS forçada, política e teste de isolamento, como manda a regra 1.
- Ela guarda cliente, data e origem (`memoria`, `fila`, `print`, `planilha`).
- O cálculo e o recálculo leem dela junto com os atendimentos.
- Teste que prova: três "Já voltou" com 20 dias de intervalo fazem o ritmo daquele cliente sair do padrão do serviço (30) para perto de 20. Avançar o relógio e rodar o recálculo duas vezes dá o mesmo resultado (a armadilha registrada em `recalculo-congela-o-que-entrou-por-outra-porta`).

**O que o dono vê no fim do mês 1, quando os consertos existirem:**
- "R$ X voltaram depois que você chamou" (CONV-01);
- "o ritmo de N clientes já é o deles, não o padrão" (CONV-08).

São as duas frases que fazem a troca parecer óbvia (plano, seção 5).

## Etapa 8 · Se trocar

Está no plano, seção 4.3. O que muda na jornada:
- a configuração da etapa 5 vira "No CICLO";
- a página pública volta a agendar;
- o histórico de fora acumulado na CONV-08 continua valendo: **o dono não perde o que o Motor aprendeu**.

A troca só faz sentido de verdade para quem tem clube depois da cobrança recorrente.

---

## Onde a jornada quebra hoje, em ordem de gravidade

| # | Quebra | Etapa | Conserto | Quem |
| --- | --- | --- | --- | --- |
| 1 | E-mail de confirmação não chega a quem é de fora | 2 | SMTP | Eduardo |
| 2 | Importador da `main` só aceita CSV | 4 | Colocar o conversor na `main` (CONV-00) | Eduardo revisa, código pronto |
| 3 | "Chamar" leva à agenda do CICLO e duplica a agenda | 5 | CONV-10 | Código |
| 4 | A fila não sabe quem voltou pelo AppBarber | 6 | CONV-01 | Código |
| 5 | O Motor nunca aprende o ritmo de quem convive | 7 | CONV-08 | Código, com migration |
| 6 | Link de confirmação aberto fora do app | 2 | APR-026, já na `onda-1`; modelos de e-mail no painel | Eduardo (mesclar e colar os modelos) |
| 7 | Nenhum lembrete semanal; no app, nenhuma notificação | 6 | CONV-03 por e-mail agora; push nativo depois | Código + SMTP |
| 8 | Segunda importação não atualiza quem já tem ficha | 6 | CONV-12 | Código |
| 9 | "Me manda que eu faço" invisível sem canal | 4 | Canal de contato | Eduardo |
| 10 | Tela "Vindo de outro sistema" não sabe que é o AppBarber | 3 e 4 | CONV-02 | Código |
| 11 | App fora das lojas | 1 | Contas e revisão | Eduardo |

## Para depois (não entra nos 90 dias)

- **"Compartilhar com o CICLO".** O dono toca "Compartilhar" no arquivo ou no print, dentro do WhatsApp ou do e-mail, e o CICLO abre já importando.
  - No Android pede um filtro de intenção e um plugin.
  - No iPhone, uma extensão de compartilhamento.
  - Tira a etapa "salvar em Arquivos". Fazer depois do piloto, se a porta B for a mais usada.
- **Ler os contatos do celular direto pelo app**, com permissão. O `.vcf` já é lido pelo conversor (CNV-014). Ler direto pede justificativa nas lojas e cuidado de privacidade.
- **Push nativo** (Firebase e APNs): credenciais e decisão do Eduardo.

## Testes que decidem esta jornada (todos baratos)

| Dúvida | Teste |
| --- | --- |
| Formato do arquivo que o AppBarber manda | Um dono do piloto pede no chat e encaminha, com consentimento |
| A lista de clientes e a agenda do AppBarber saem legíveis num print | Dois prints de um dono do piloto, passados na esteira do conversor, local |
| O link de confirmação quebra dentro do app | Cadastro de teste no Android com o Gmail, em ambiente de teste |
| O seletor do Android esconde o CSV do WhatsApp | Um CSV recebido pelo WhatsApp, num Android real, na tela de importar da `main` |
| O dono aguenta 5 minutos por semana | Piloto, semana 4 |
