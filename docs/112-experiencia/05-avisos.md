# 05 · Avisos e notificações dos dois lados (Parte C2 do docs/111)

Escrito em 21/10/2026, na branch `marca/feminina-2026-10-20`. Só leitura de código, do banco local isolado (`supabase_db_ciclo-marca`, 127.0.0.1:57822, **não é produção**) e pesquisa pública. Nada foi implementado. Nada de produção foi tocado.

Rótulos: **FATO** (lido, com caminho:linha), **INFERÊNCIA** (com a conta), **HIPÓTESE** (a medir), **NÃO VERIFICADO**.

Limite desta frente: **nenhuma tela foi aberta no navegador**. Tudo que fala do que a pessoa vê é leitura de código. A sessão principal mede (A3: "dar como resolvido o que só foi lido" é proibido).

---

## 0 · Defeitos Onda 0 (ler primeiro)

São avisos que prometem canal que não existe, disparam errado, opt-out sem efeito real, ou tela que grava e nada obedece. Dado de saúde em aviso: **não achei** (ver D9).

| # | Defeito | Classe do defeito | Vivo hoje? | Evidência | Ticket |
| --- | --- | --- | --- | --- | --- |
| D1 | **O dial de Automações grava e nada lê.** "Pontos automáticos" nasce em "Só me avisa" ("você decide tudo"), e os pontos entram sozinhos mesmo assim. "Lembrete" e "Campanha" também não leem o nível: se as rotas forem ligadas, mandam com o dial em 1 | tela que grava e não obedece | **sim** (pontos) | FATO: o único leitor de `settings.automacoes` é a própria tela (`src/server/services/automacoes.ts:10-14`, chamado só por `src/app/admin/config/automacoes/page.tsx:31`). `grep` em `src/server` e `src/core`: nenhum outro. `lembretes.ts:83-92` e `api/cron/campaigns/route.ts:42-59` filtram por demo, pausa e opt-out, nunca pelo nível. Teste `tests/unit/*/fidelidade-automacao.test.ts:13-21` registra que a fidelidade "já nasce ligada" | EXP-A01 |
| D2 | **A tela de Automações dá o motivo errado.** Toda automação parada diz "falta ligar o envio no WhatsApp", inclusive "Aviso de reposição", que só grava log e não tem nada de WhatsApp | promessa/explicação falsa | sim | FATO: texto fixo em `src/app/admin/config/automacoes/automacoes.tsx:99-102` para todo `!roda`; `stock-alerts` só faz `console.log` (`src/app/api/cron/stock-alerts/route.ts:41-43`) | EXP-A02 |
| D3 | **A tela de Notificações promete "Lembretes e alertas no aparelho".** A profissional só recebe push de "Novo pedido de agendamento" e de orçamento aprovado/recusado. Nenhum lembrete | promessa de canal | sim | FATO: `notificacoes/ativar.tsx:159-160`; os únicos chamadores de `notificarEquipe` são `public-booking.ts:596-603` e `orcamentos.ts:197` | EXP-A02 |
| D4 | **A política de privacidade diz que a Meta "entrega lembrete e mensagem de recuperação".** Hoje não entrega nada: sem credencial e sem agendamento | promessa de canal em documento legal | sim | FATO: `src/app/(public)/privacidade/page.tsx:162-163`; `whatsapp.ts:19-27` lança sem credencial; `cron.yml:196-254` | EXP-A02 (texto é **Do Vitor**) |
| D5 | **Cliente que cancela pelo link não avisa ninguém.** Nem push para a profissional, nem a lista de espera. O cancelamento pelo painel avisa a lista; o da cliente, não | aviso que não dispara | latente (o link só sai no lembrete automático, que está desligado) | FATO: `api/v1/public/appointments/cancel/[token]/route.ts:46-50` só chama `cancelarAgendamento`; o do painel chama `notificarProximoDaLista` (`api/v1/appointments/[id]/route.ts:83-101`); o token só é gerado em `lembretes.ts:142-143` | EXP-A03 (pré-requisito do EXP-A10) |
| D6 | **A lista de espera "avisa" sem canal e marca como avisada.** Grava `notified_at` antes de tentar mandar; sem WhatsApp, sem conta da cliente e sem e-mail, o envio termina `failed`. A cliente nunca sabe, e a profissional também não | aviso que diz que foi e não foi | latente (não há tela para pôr alguém na lista; só API) | FATO: `lista-espera.ts:247-251` grava antes; `:257-270` manda por `enviarComFallback`; `mensageria.ts:179-186` grava `failed`; `push.ts:53-56` exige `clients.user_id`, que nada escreve (`docs/110` §1). Local: 45 linhas em `waitlist` (seed) | EXP-A04 |
| D7 | **O lembrete automático pede "Responda para confirmar", e a resposta não confirma.** No e-mail, a resposta vai para lugar nenhum. No WhatsApp, só a palavra exata ("confirmar", "confirmo"…) vale; "sim" não | aviso que pede ação impossível | latente (reminders fora do agendador) | FATO: `lembretes.ts:114-117`; `palavra-de-acao.ts:19-20,39-43` | EXP-A05 |
| D8 | **Push da equipe vai para todos os aparelhos do negócio.** Profissional com visão restrita recebe o nome da cliente de outra pessoa na tela bloqueada | vaza dado entre membros | sim, em salão com equipe e push ligado | FATO: `push.ts:82-86` lê todas as inscrições do tenant; `public-booking.ts:599` põe o nome no corpo | EXP-A06 |
| D9 | Dado de saúde em aviso | — | **não achado** | FATO (limitado ao que li): os corpos de aviso montados hoje levam nome, horário, serviço e produto de interesse (`public-booking.ts:599`, `lembretes.ts:114-117`, `lista-espera.ts:266`, `recuperar-receita.ts:290`). Nenhum lê `health_records` nem anamnese. NÃO VERIFICADO: nome de serviço digitado pela profissional com termo de saúde | guarda prevista no EXP-A14 |
| D10 | **Opt-out só existe do lado da profissional, e é uma chave para duas coisas.** A cliente não tem como sair sozinha: não há página, nem palavra "SAIR" no WhatsApp. E `whatsapp_opt_out` corta lembrete (`lembretes.ts:84`) apesar do comentário dizer que transacional "passa por cima" (`lembretes.ts:90-91`, `mensageria.ts:120-121`) | opt-out sem efeito para quem pediu | sim (ninguém consegue pedir) | FATO: único escritor é `clientes.ts:72` (painel); `palavra-de-acao.ts` só conhece confirmar e cancelar; nenhuma rota pública de opt-out em `src/app/(public)` | EXP-A08 |
| D11 | **Campanha automática ignora `marketing_opt_in`.** A tela de campanha manual filtra por ele; o envio automático, não | marketing sem consentimento | latente (campaigns fora do agendador) | FATO: manual em `crm.ts:499-500`; automático só checa `whatsapp_opt_out` (`recuperar-receita.ts:274`) | EXP-A08 |
| D12 | **"Lembrete e campanha saem sozinhos" é decidido só por `reminders`.** Se `reminders` for agendada e `campaigns` não, a tela afirma que a campanha sai sozinha. E nenhuma das frases confere a credencial da Meta | promessa de canal | latente | FATO: `src/core/messaging/promessa.ts:55-72` só recebe `rodaSozinha('reminders')` | EXP-A02 |
| D13 | **O agendador não serve para lembrete.** Lembrete precisa rodar a cada 15 min. O GitHub atrasa de 5 a 6,5 h; o cron-job.org está configurado a cada 3 h. O lembrete de 3 h antes chegaria depois do horário ou nunca (`lembretesDevidos` devolve vazio depois do início) | aviso que não chega | latente | FATO: `cron.yml:32-36`; `docs/runbooks/cron-externo.md` ("a cada 3 horas"); `src/core/reminders/schedule.ts:66` | EXP-A09 (Bloqueado) |

**Leitura (INFERÊNCIA):** D1 a D4 e D8 a D10 estão no ar hoje. D5, D6, D7, D11, D12 e D13 são minas: explodem no dia em que alguém ligar `reminders` ou `campaigns`, ou quando o EXP-A10 puser o link de confirmar na mensagem. Por isso entram antes de qualquer aviso novo.

---

## 1 · O que existe hoje (diagnóstico)

### 1.1 Estado dos canais

| Canal | Liga hoje? | Evidência |
| --- | --- | --- |
| Tela do app (Hoje, Recuperar, ficha) | **sim** | FATO: `resumo_proativo` e `motor_de_ciclo` sempre ligados (`src/core/automacoes/catalogo.ts:59-76`) |
| `wa.me` pelo WhatsApp da própria profissional | **sim**, é o canal real | FATO: `src/lib/mensagens.ts:59-78`; "Chamar" do Recuperar usa `textoDeVolta` (`admin/recuperar/recuperar.tsx:370-371`); ficha e campanhas usam os modelos editáveis (`ficha.tsx:55,824`; `campanhas/nova/nova.tsx:190`) |
| Push web para a profissional | **sim, se o VAPID estiver configurado** no ar | FATO: `providers/messaging/push.ts:11-26`. NÃO VERIFICADO em produção (não li env de produção, por regra). Não chega no app nativo (`notificacoes/page.tsx:32-36`) nem em iPhone sem o PWA instalado (`ativar.tsx:20-25`) |
| Push para a cliente | **não** | FATO: exige `clients.user_id` (`push.ts:53-56`), que nada escreve (`docs/110` §1). Local: 0 de 40.245 clientes com `user_id`; 0 linhas em `push_subscriptions` |
| E-mail | **não** (Bloqueado) | FATO pelo doc: `RESEND_API_KEY` vazio (`docs/110-um-app-dois-publicos/00-plano.md` §1). NÃO VERIFICADO na Vercel |
| WhatsApp oficial (Meta) | **não** (Bloqueado) | FATO: `whatsapp.ts:19-27` lança sem credencial; rampa de aquecimento escrita e **não ligada** (`src/core/messaging/rampa-whatsapp.ts:14-17`, `docs/74`) |
| SMS | não existe | FATO: enum tem `sms` (banco local), nenhum provider |
| Agendador | só `recompute-cycles` e `segments` | FATO: `src/core/cron/agendadas.ts:53`; `reminders` e `campaigns` fora de propósito (`cron.yml:196-254`) |

### 1.2 Cada aviso existente

"Dispara de verdade" = agendado **e** com canal que chega. Toda linha é FATO de código; o que ela significa em produção é INFERÊNCIA a partir do 1.1.

| Aviso | Quem recebe | Gatilho | Canal | Dispara de verdade hoje? | Configurável | Motor de Ciclo |
| --- | --- | --- | --- | --- | --- | --- |
| Novo pedido de agendamento (`public-booking.ts:596-603`) | toda a equipe com push ligado (D8) | cliente marca pelo link | push web | **sim**, com VAPID e push ativado no navegador | só ativar/desativar o aparelho | não |
| Orçamento aprovado/recusado (`orcamentos.ts:197,210,222`) | toda a equipe | cliente decide pelo link | push web | sim, mesmas condições | idem | não |
| "Vale a pena hoje" / quem sumiu (`catalogo.ts:68-76`) | profissional | abrir a tela Hoje | tela | **sim** | não (sempre ligado) | **sim**: estado `due/late/at_risk/lost` de `estadoPorAtraso` (`src/core/cycle/compute.ts:98-104`) |
| Recuperar + "Chamar" | cliente (enviada pela profissional) | a profissional toca | `wa.me` | **sim**, manual, 1 toque por cliente | texto fixo `textoDeVolta` (`lib/mensagens.ts:119-140`), **não** o modelo editável | **sim**: quem e quanto vale; link de volta mede clique e agendamento (`link-de-volta.ts:9-22,97-112`) |
| Mensagens prontas (10 modelos) | cliente (pela profissional) | toque na ficha ou na campanha | `wa.me` | sim, manual | texto editável com variáveis (`mensagens-prontas.ts:38-49`; editor com prévia) | não, exceto que tocar "Sumiu, chamar de volta" anota a chamada (`ficha.tsx:824`) |
| Campanha manual (`admin/campanhas/nova`) | segmento de clientes | a profissional escolhe segmento e modelo | `wa.me`, uma por uma | sim, manual | modelo; segmento; filtra opt-out e opt-in (`crm.ts:499-500`) | segmentos vêm do Motor |
| Confirmação D-1 18h e lembrete T-3h (`lembretes.ts`, `reminders/schedule.ts:21-30`) | cliente | horário marcado | WhatsApp → push → e-mail | **não**: rota fora do agendador; sem credencial | nenhuma (horários fixos; texto fixo; dial não lido, D1) | não |
| Campanha automática diária (`campanhas.ts`, `api/cron/campaigns`) | quem o Motor marca como due/late/at_risk/lost | 10h local | idem | **não**: fora do agendador | dial não lido (D1); pausa geral (`config/mensagens/pausar-envios.tsx`) | **sim**: lista de `v_recover_revenue` |
| Encaixe da lista de espera (`lista-espera.ts:175-273`) | 1ª da fila | cancelamento pelo painel | WhatsApp → push → e-mail | **dispara, mas não chega** (D6) | nenhuma | usa valor em risco para ordenar (`lista-espera.ts:202-219`) |
| Aviso de reposição (`stock-alerts`) | — (só log) | 7h local | log | não agendado; na tela Hoje aparece ao vivo | dial sem efeito | não |
| Pontos automáticos | — (escreve na ficha) | atendimento concluído | — | **sim**, mesmo no nível 1 (D1) | dial sem efeito; config de fidelidade | não |

### 1.3 Freios que já existem e o plano reaproveita

- Janela 8h às 21h no lembrete (`reminders/schedule.ts:11-12,25-30`) e na campanha (`recuperar-receita.ts:213-214`). FATO.
- 7 dias entre campanhas por cliente e **serviço** (`recuperar-receita.ts:188,259-265`) e uma mensagem por pessoa por lote (`:231-234`). FATO. INFERÊNCIA: cliente com 3 serviços atrasados pode receber 3 chamadas em 3 lotes seguidos, uma por serviço; não há limite **por pessoa por semana**.
- Teto diário por negócio, 100 campanha / 300 transacional, contado no Postgres (`mensageria.ts:84-97`, `rate-limit.ts`). FATO.
- Pausa geral por negócio (`pausar-envios.tsx`, lida em `lembretes.ts:89` e `campaigns/route.ts:46`). FATO.
- Demo nunca chama provider (`mensageria.ts:33-77,116-118`). FATO.
- Dedupe de lembrete por agendamento (índice `messages_dedupe`, banco local). FATO.
- Atribuição por clique: `messages.clicked_at` e `booked_appointment_id` (`link-de-volta.ts:63,109-112`). FATO. É a base da métrica honesta (§6).

### 1.4 Onde o Motor de Ciclo entra hoje

- Calcula o dia previsto de cada cliente pelo ritmo dela, com mediana ponderada e corte entre 0,5× e 2,5× do padrão (`compute.ts:111-158`). FATO.
- Estado: `on_track` até 3 dias antes; `due` de −3 a 0; `late` até 10; `at_risk` até 30; `lost` depois (`compute.ts:98-104`). FATO.
- Quem já tem horário marcado não é incomodada (`compute.ts:153`). FATO.
- Prestação de contas que não se elogia: previsão em aberto há 30 dias conta como erro (`prestacao-de-contas.ts:17-24,52`). FATO.
- **O que falta (INFERÊNCIA):** o Motor sabe o dia, mas nenhum aviso usa esse dia para avisar **antes** (no `due`). Tudo hoje age depois que a pessoa já passou. E o `SERVICO_DE_VOLTA` não tem cabelo, depilação nem estética (`docs/111` C1.1, `servico-padrao-da-base.ts:35-40`), então o aviso de volta erraria o serviço nessas profissões.

---

## 2 · O que a concorrência oferece (pesquisa pública, 21/10)

Sem criar conta. Fonte de marketing ou ajuda oficial; nada medido.

| App | Lembrete do horário | Aviso de retorno (rebook) | Personalização | Fonte |
| --- | --- | --- | --- | --- |
| **Fresha** | padrão 24 h antes; ajustável de 2 a 72 h; até 3 lembretes; segundo opcional 1 h antes | sim, "rebook reminder", com prazo **por serviço** | horário, quantos, canal; e-mail grátis, SMS consome saldo | [ajuda: mensagens automáticas](https://www.fresha.com/help-center/knowledge-base/marketing/125-automated-messages-overview), [blog de notificações](https://www.fresha.com/blog/making-the-most-of-freshas-notifications), [HJI](https://hji.co.uk/fresha-launch-six-new-automated-text-notifications) |
| **Booksy** | SMS e/ou e-mail; antecedência escolhida (ex.: 48 h e 24 h) | NÃO VERIFICADO (nenhuma fonte oficial); app da cliente "remarca em poucos toques" | modelos por serviço (blog de marketing) | [blog: confirmações e lembretes](https://biz.booksy.com/blog/appointment-confirmations-reminders), [blog: lembretes](https://biz.booksy.com/blog/appointment-reminders-help-you-cut-no-shows), [App Store](https://apps.apple.com/app/723961236) |
| **GlossGenius** | lembretes e confirmações automáticos, sem custo extra | "rebooking reminders" citados por terceiros; oficialmente, empurrão para remarcar **no checkout** | "modelos personalizáveis" (comparador); detalhe NÃO VERIFICADO | [visão geral](https://glossgenius.com/overview), [Contrary Research](https://research.contrary.com/company/glossgenius), [GetApp](https://www.getapp.com/salon-software/a/glossgenius) |
| **Trinks** | NÃO VERIFICADO; vagas públicas de 2026 pedem integração por webhook para mandar WhatsApp pela API oficial, o que sugere que não é nativo | NÃO VERIFICADO | — | [Workana](https://www.workana.com/pt/job/integracao-trinks-kommo-crm-via-webhook-com-automacoes-de-whatsapp) |
| **Gendo** | lembrete automático por SMS ou WhatsApp (imprensa) | NÃO VERIFICADO | NÃO VERIFICADO | [Startupi](https://startupi.com.br/?p=245098) |
| **Agendiva** | WhatsApp 24 h antes, incluso no plano de R$ 39,90 | NÃO VERIFICADO | NÃO VERIFICADO | [B2B Stack](https://www.b2bstack.com.br/product/agendiva), [GetApp](https://www.getapp.com/all-software/a/agendiva/) |

**O que isso ensina (INFERÊNCIA):**
1. Lembrete 24 h antes por WhatsApp é **o mínimo do mercado brasileiro** (Agendiva cobra R$ 39,90 com ele dentro). O CICLO hoje não tem nenhum automático. Sem a Meta, o caminho que fecha a distância é o lembrete **de um toque pela profissional, com link de confirmar** (EXP-A10) e o **"pôr na minha agenda"** (EXP-A11).
2. O "rebook" da Fresha usa prazo **fixo por serviço**. O do CICLO pode usar o **ritmo de cada cliente** (Motor). É a vantagem que nenhum dos seis mostra. Mas só vale se chegar antes do dia, não depois (§1.4).
3. Nenhuma fonte mostrou a cliente escolhendo antecedência ou canal. Ou não existe, ou não é vendido. HIPÓTESE: não é o que decide a escolha dela; opt-out fácil é o que evita denúncia.

---

## 3 · Catálogo de eventos proposto

Regra do catálogo (Recomendado, a partir do `docs/39` §4): **lista fechada de eventos**, cada um com parafusos (ligar, texto, antecedência). Sem construtor livre. O `docs/39` descartou "a pessoa cria a automação do zero" porque um construtor sem executor é promessa vazia, e o motivo continua de pé (WhatsApp oficial ainda Bloqueado).

Colunas de canal: **Hoje** = liga sem nada de fora. **Depois** = depende de algo, dito na célula.

### 3.1 Lado da profissional

| # | Evento | Quando | Canal hoje | Canal depois | O que o Motor põe |
| --- | --- | --- | --- | --- | --- |
| P-A1 | Novo pedido de agendamento | na hora | push web + selo na agenda | push no app nativo (Bloqueado: push nativo) | se é cliente de volta: "voltou 4 dias depois do dia dela" |
| P-A2 | Cliente cancelou pelo link | na hora | push web + cartão no Hoje | idem | **quem chamar para a vaga**: as 3 mais perto do dia, com o mesmo serviço e duração, e quanto vale |
| P-A3 | Cliente confirmou pelo link | na hora | selo "confirmou" na agenda (sem push: pouco valor, muito barulho) | — | — |
| P-A4 | Lembrar as clientes de amanhã | 1 cartão no Hoje a partir das 16h | cartão com "Lembrar" um toque por cliente (`wa.me` com link de confirmar) | some quando o lembrete automático ligar | — |
| P-A5 | Quem chega no dia da manutenção esta semana | 1 cartão por dia no Hoje | cartão + "Chamar" (`wa.me`) | o aviso vai sozinho para a cliente (C-A4) | **o dia de cada uma**, pelo ritmo dela; valor em risco |
| P-A6 | Horário vago amanhã que dá para preencher | 1 cartão às 16h, se houver vaga ≥ duração de algum serviço | cartão + "Chamar" | push opcional 1×/dia | quem está em `due`/`late` com serviço que cabe na vaga |
| P-A7 | Resumo da semana | segunda de manhã | cartão no Hoje | push opcional | "voltaram X pelo seu Chamar, R$ Y" (métrica do §6) |
| P-A8 | Orçamento aprovado ou recusado | na hora | push web | — | — |
| P-A9 | Aniversário, estoque | já existem no Hoje | tela | — | — |

### 3.2 Lado da cliente

| # | Evento | Quando | Canal hoje | Canal depois | O que o Motor põe |
| --- | --- | --- | --- | --- | --- |
| C-A1 | Pedido recebido | na hora | tela de sucesso (já existe) + **"Pôr na minha agenda"** (arquivo de calendário com alarme) | push (L5) | — |
| C-A2 | Horário confirmado pela profissional | quando ela confirma | `wa.me` da profissional | WhatsApp oficial (Bloqueado) | — |
| C-A3 | Lembrete do dia anterior, com **Confirmar / Não vou poder** em 1 toque | D-1 (padrão 18h) | `wa.me` da profissional com link (EXP-A10) + alarme do calendário (EXP-A11) | WhatsApp oficial com botão (Bloqueado); push (L5) | — |
| C-A4 | "Está chegando a hora da sua manutenção" | **2 dias antes** do dia previsto dela, não depois | `wa.me` da profissional pelo cartão P-A5 | WhatsApp oficial modelo de marketing (Bloqueado: Meta + aquecimento + opt-in); push (L5) | **o dia certo do ritmo dela**, o serviço, e 2 horários livres da profissional dela no link |
| C-A5 | Horário remarcado pela profissional | na hora | `wa.me` (modelo "Preciso remarcar") | push / WhatsApp oficial | — |
| C-A6 | Vaga liberada da lista de espera | na hora | **cartão para a profissional chamar** (P-A2), não envio fingido (D6) | WhatsApp oficial (Bloqueado) | ordem pela fila e valor |

**Do Vitor:** o texto que sai em nome do salão em C-A3 e C-A4 (A8: "o que cada aviso diz em nome do salão"). **Padrão de trabalho provisório**, não decisão: começar pelos modelos que já existem em `mensagens-prontas.ts:39-41`, com o link acrescentado, e trocar o exemplo da prévia por um de salão.

---

## 4 · Canais em ordem de custo e risco

| Ordem | Canal | Custo | Risco | Estado |
| --- | --- | --- | --- | --- |
| 1 | Cartão ou selo dentro do app | zero | baixo; só vê quem abre ("mais um lugar para olhar", `docs/111` A5) | **liga hoje** |
| 2 | Pop-up dentro do app | zero | cobrir o botão (`aviso-de-cookies-cobre-o-clique`) | **liga hoje**, com as regras do §5.3 |
| 3 | Arquivo de calendário para a cliente | zero | baixo; o alarme é do celular dela | **liga hoje** |
| 4 | `wa.me` pelo WhatsApp da profissional | zero; 1 toque dela por cliente | baixo; é o número dela, a voz dela | **liga hoje** (já é o canal real) |
| 5 | Push web para a profissional | zero | só navegador; iPhone exige PWA instalado; nada no app nativo | **liga hoje** se o VAPID estiver no ar (NÃO VERIFICADO) |
| 6 | Push para a cliente | zero | exige conta da cliente | **depois**: L3 a L5 do `docs/110` |
| 7 | Push no app nativo | zero | conta nas lojas, FCM/APNs | **Bloqueado**: loja e credenciais |
| 8 | E-mail | baixo | público quase não lê; Resend sem chave | **Bloqueado**: `RESEND_API_KEY` |
| 9 | WhatsApp oficial | utilidade e marketing pagos por mensagem; autenticação ~R$ 0,035 (`docs/110` §2.3, fonte de terceiros) | banimento do número afeta **todos** os negócios (`docs/74` §1) | **Bloqueado**: credencial Meta, modelos aprovados, rampa ligada, agendador de 15 min |

**Regra (Decidido, `CLAUDE.md` e `docs/111` A2):** nenhum texto diz "vai receber" por um canal das linhas 6 a 9 enquanto ele não estiver de pé. A frase sai de **uma função só** (`promessa.ts`), que passa a conferir agendamento **e** credencial (EXP-A02).

---

## 5 · Personalização

### 5.1 Profissional

Uma tela só, **Avisos**, no lugar das três de hoje (Automações, Mensagens prontas, Notificações). Recomendado; alternativa descartada: manter três telas, porque a pessoa não sabe em qual procurar e a de Automações hoje fala de coisas que não acontecem (D1, D2).

Para cada evento do §3:

| Parafuso | Como | Limite |
| --- | --- | --- |
| Ligar e desligar | um interruptor, e o estado **real** ao lado ("aparece no Hoje", "vai pelo seu WhatsApp quando você toca", "espera a Meta") | o interruptor tem de ter leitor no servidor (guarda do EXP-A01) |
| Antecedência | opções fechadas: lembrete "na véspera às 18h" ou "no dia, de manhã"; volta "2 dias antes" ou "no dia" | lista fechada, não campo livre |
| Texto | escolher um modelo de Mensagens prontas e editar ali mesmo, com as variáveis em botão (já existe, `editor.tsx`) | **prévia que grava**: a prévia usa a mesma função do envio (`aplicarVariaveis`, `lib/mensagens.ts:46-52`) e os dados da **próxima cliente real** dela; o que a prévia mostra é o que fica salvo e o que sai |
| Horário de silêncio | hoje é fixo 8h às 21h no servidor; vira escolha entre "8h às 21h" e "9h às 20h" | nunca mais largo que 8h às 21h (FAQ H109) |
| Limite por cliente | no máximo **1 chamada de volta por pessoa a cada 7 dias**, somando todos os serviços | transacional (lembrete do horário dela) não conta |
| Assinatura | `{{negocio}}` no fim, ou o nome dela | **Do Vitor** |

O que **não** entra (Recomendado, `docs/39` §4 P4): gatilho inventado por ela, filtro livre de quem recebe. Se um dia entrar, a porta é o assistente, em proposta e aprovação.

### 5.2 Cliente

Hoje a cliente não tem onde configurar nada, e não consegue sair (D10).

**Já, sem área da cliente (serve ao piloto):**
- Na página do link de confirmar (`/confirmar/[token]`): uma linha "Não quero mais lembretes deste lugar", 1 toque, com efeito imediato.
- Palavras "SAIR" e "PARAR" no webhook do WhatsApp, valendo assim que a Meta ligar (EXP-A08).

**Na área da cliente (L5 do `docs/110`, depois do piloto):**
- Uma tela "Avisos", por lugar onde ela é atendida: lembrete do horário (ligado/desligado, véspera ou no dia), aviso da manutenção (ligado/desligado), canal (push, e quando existir, WhatsApp).
- "Sair de tudo" em 1 toque no topo.
- Consentimento do aviso de manutenção gravado em `consents` com a versão do texto. É marketing pela regra da Meta (INFERÊNCIA: o aviso convida a comprar de novo).

**Duas chaves em vez de uma (Recomendado):** "lembrete do meu horário" e "aviso de volta". Hoje `whatsapp_opt_out` faz as duas coisas, e o código discorda de si mesmo sobre isso (D10). Quem desliga a chamada de volta quase sempre ainda quer o lembrete do horário que marcou (HIPÓTESE, a medir no piloto).

### 5.3 Pop-up e aviso dentro do app

| Regra | Valor | Como medir |
| --- | --- | --- |
| Tipo padrão | **cartão no fluxo da tela** (Hoje), não sobreposição | — |
| Pop-up sobreposto | só para P-A2 (cancelou agora) e P-A1 (pedido novo), e só se a pessoa estiver no app | — |
| Quantos | no máximo **1 pop-up por sessão**; o resto vira selo | contador por sessão |
| Quando não aparece | durante formulário aberto, comanda aberta, agenda em edição, nos primeiros 10 s depois de abrir o app | lista de rotas e estados bloqueados |
| Onde | faixa no topo, abaixo do cabeçalho; nunca embaixo, onde ficam a barra de ação e o polegar | `elementFromPoint` no centro de cada botão principal da tela com o aviso visível: tem que devolver o próprio botão |
| Some | sozinho em 8 s, ou com 1 toque; "não mostrar de novo hoje" | — |
| Lado da cliente | nenhum pop-up na página pública além do aviso de cookies que já existe | guarda que varre `(public)` |

---

## 6 · Medida de sucesso que não engana

**Proibido como meta:** avisos enviados, taxa de abertura, cliques. Os três sobem quando o produto manda mais e pior (`metrica-que-melhora-com-o-fracasso`).

**Medida principal: volta atribuída ao aviso.**
- Numerador: agendamentos criados pelo link de volta em até 14 dias (`messages.booked_appointment_id`, `link-de-volta.ts:24,97-112`). FATO: a coluna e o escritor existem.
- Denominador: **todas** as chamadas feitas, inclusive as que nunca foram abertas. Nunca só as abertas.
- Comparação: taxa de volta das clientes `due/late` chamadas contra as do mesmo estado **não** chamadas no mesmo período. Sem isso, a métrica conta como mérito a cliente que voltaria de qualquer jeito. INFERÊNCIA: o Motor já marca `due` 3 dias antes do dia previsto, e parte dessas volta sozinha.
- Grupo de controle sorteado (segurar o aviso de 1 em cada 10 clientes) é o jeito limpo de medir. É **Do Vitor**: significa deixar de chamar gente de propósito.

**Medidas de custo, sempre ao lado da principal:**
- pedidos de "não quero mais" por 100 avisos (opt-out);
- push desativado pela profissional (aparelhos que saíram de `push_subscriptions`);
- para o lembrete: faltas a cada 100 horários **com** link de confirmar contra **sem** link.

**Onde aparece:** cartão P-A7 e a tela Campanhas, que já mostra "quem voltou depois de receber mensagem" por tempo (`admin/campanhas/page.tsx:111`). A atribuição por clique soma a ela, sem trocar.

---

## 7 · Tickets

Prefixo `EXP-A`. Frente: avisos. Ordem: Onda 0 primeiro (A01 a A09), depois Onda 2 (A10 a A15). "Hoje (FATO)" é leitura de código; a medida no navegador é parte do aceite.

```
EXP-A01 · O dial de Automações passa a ter efeito, ou sai da tela
Frente: avisos
Lado: profissional
Jornada: — (confiança no produto)
Classe: Recomendado (a escolha de comportamento da fidelidade é Do Vitor; padrão provisório abaixo)
Quando: serve ao piloto
Hoje (FATO): `settings.automacoes` só é lido pela própria tela (`services/automacoes.ts:10-14`). "Pontos automáticos" em "Só me avisa" lança pontos mesmo assim. Lembrete e campanha ignoram o nível (`lembretes.ts:83-92`, `campaigns/route.ts:42-59`).
Depois (meta): 0 interruptores sem leitor. O que a tela diz é o que acontece.
O que muda: padrão provisório — "Pontos automáticos" deixa de ter dial e mostra o estado real da fidelidade (ligada se `pointsPerReal > 0`); lembrete e campanha passam a ler `nivelEfetivo` antes de mandar (nível 1 = não manda, só aparece no Hoje; nível 2 = prepara para ela tocar). Arquivos: `core/automacoes/catalogo.ts`, `server/services/lembretes.ts`, `server/services/campanhas.ts`, `app/admin/config/automacoes/*`.
Aceite medido: no navegador, pôr cada automação em cada nível e conferir no banco local o efeito (pontos lançados ou não; `messages` com ou sem linha depois de chamar a rota à mão no banco local). Tabela nível × efeito anexada em `medidas/`.
Guarda: teste que, para cada `AUTOMACOES` com `nivelMaximo > 1`, exige uma chamada a `nivelEfetivo(` fora de `core/automacoes` e da tela; mutação: apagar a leitura em `lembretes.ts` reprova. Mais um teste de comportamento: `identificarLembretesPendentes` com nível 1 devolve lista vazia, com cenário montado provado (lista não vazia no nível 3).
Risco: ligar a leitura muda o que sai quando `reminders` for ligada; medir com o teste nível 1 × 3.
Tamanho: M
```

```
EXP-A02 · Promessa de canal residual: quatro textos
Frente: avisos
Lado: os dois
Jornada: C2, P2
Classe: Recomendado (o texto da política de privacidade é Do Vitor)
Quando: serve ao piloto
Hoje (FATO): "falta ligar o envio no WhatsApp" para tudo que está parado (`automacoes.tsx:99-102`); "Lembretes e alertas no aparelho" (`ativar.tsx:159`); Meta "pra entregar lembrete" (`privacidade/page.tsx:162-163`); `textoDoEnvioAutomatico` decide campanha por `reminders` e não olha credencial (`promessa.ts:55-72`).
Depois (meta): 0 frases que afirmam canal ou motivo inexistente.
O que muda: motivo por automação no catálogo (`motivoDeParada`); "Avisos de novos pedidos no aparelho"; política diz "quando estiver ligado"; `promessa.ts` recebe `rodaSozinha` de cada rota e um `credencialWhatsApp: boolean` lido no servidor.
Aceite medido: ler as 3 telas no navegador a 375 px e colar o texto em `medidas/`; nenhuma frase cita WhatsApp para o estoque.
Guarda: estender `promessa-de-canal.test.ts` com o caso "reminders agendada e campaigns não" (mutação: voltar a ler só `reminders` reprova) e "agendada sem credencial" (mutação: tirar o parâmetro de credencial reprova).
Risco: texto mais longo quebrar o cartão a 375 px; medir sem rolagem lateral com `innerWidth` igual à largura.
Tamanho: P
```

```
EXP-A03 · Cancelar ou confirmar pelo link avisa a profissional e a lista de espera
Frente: avisos
Lado: os dois
Jornada: C2, C3, P2
Classe: Recomendado
Quando: serve ao piloto (antes do EXP-A10)
Hoje (FATO): `public/appointments/cancel/[token]/route.ts:46-50` cancela e não avisa ninguém; a confirmação pública também não chama `notificarEquipe` (0 ocorrências em `confirm/[token]/route.ts`).
Depois (meta): cancelou → push para a profissional dona do horário (e dona do salão) em ≤ 1 min + cartão P-A2 no Hoje com quem chamar; confirmou → selo na agenda.
O que muda: as duas rotas públicas chamam um `avisarProfissional(evento)` com `agendarDepois`; P-A2 lê o Motor para sugerir 3 clientes.
Aceite medido: no banco local, cancelar por um token gerado à mão; ver o cartão no Hoje e o registro do push em ≤ 60 s (log do servidor).
Guarda: teste de rota que conta a chamada `await avisarProfissional(` / `agendarDepois(`; mutação: remover a chamada reprova; controle positivo com o cancelamento do painel.
Risco: push em excesso; limitado a cancelou (confirmou não faz push).
Tamanho: M
```

```
EXP-A04 · Lista de espera não finge que avisou
Frente: avisos
Lado: os dois
Jornada: C3
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): `notified_at` gravado antes do envio (`lista-espera.ts:247-251`); envio termina `failed` sem canal (`mensageria.ts:179-186`).
Depois (meta): enquanto não houver canal que chegue, a vaga vira cartão para a profissional chamar a 1ª da fila pelo `wa.me`; `notified_at` só depois de envio `sent`.
O que muda: `lista-espera.ts` grava depois e só em `sent`; caminho "sem canal" devolve a oferta para o cartão P-A2.
Aceite medido: no banco local, cancelar com 1 pessoa na fila e sem credencial: `notified_at` continua nulo, cartão aparece.
Guarda: teste com provider que lança e sem e-mail: `notified_at` nulo; mutação: voltar a gravar antes reprova.
Risco: duas pessoas da fila chamadas para a mesma vaga; a exclusividade continua no token.
Tamanho: P
```

```
EXP-A05 · O texto do lembrete pede a ação que funciona
Frente: avisos
Lado: cliente
Jornada: C2
Classe: Recomendado
Quando: antes do lançamento (antes de ligar reminders)
Hoje (FATO): "Responda para confirmar" (`lembretes.ts:116`); webhook só aceita a palavra exata (`palavra-de-acao.ts:19-20`).
Depois (meta): "Toque no link para confirmar ou avisar que não vai"; no WhatsApp oficial, botões de resposta rápida (`whatsapp.ts:42-46` já suporta `buttons`).
O que muda: corpo do fallback e parâmetros do modelo.
Aceite medido: ler o corpo gerado para 3 agendamentos do banco local.
Guarda: teste que proíbe "Responda para" no corpo de qualquer `EnvioPendente`; mutação: devolver a frase reprova.
Risco: nenhum relevante.
Tamanho: P
```

```
EXP-A06 · Push vai só para quem precisa saber
Frente: avisos
Lado: profissional
Jornada: P7
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): `inscricoesPushDoTenant` devolve todos os aparelhos do negócio (`push.ts:82-86`).
Depois (meta): pedido novo e cancelamento vão para a profissional do horário + dona/gerente/recepção; profissional com visão restrita não recebe nome de cliente de outra.
O que muda: `push_subscriptions` lida junto de `memberships`; `notificarEquipe` recebe `professionalId`.
Aceite medido: banco local com 2 profissionais e visão restrita: só a dona e a do horário recebem (log).
Guarda: teste de isolamento no `test:rls`/integração; mutação: voltar a ler o tenant inteiro reprova.
Risco: dona sem push deixar de saber; medir que dona sempre recebe.
Tamanho: M
```

```
EXP-A07 · Prévia das mensagens com cara de salão e com a cliente de verdade
Frente: avisos
Lado: profissional
Jornada: P3
Classe: Recomendado (sobrepõe o item 4 do C1.1; fazer junto do 04-salao)
Quando: serve ao piloto
Hoje (FATO): exemplo fixo "Bruno Almeida", "Corte + barba" (`config/mensagens/editor.tsx:17-23`); modelo "Promoção" com "o {{servico}}" (`mensagens-prontas.ts:45`).
Depois (meta): a prévia usa a próxima cliente real dela (ou um exemplo de salão se a agenda estiver vazia) e o mesmo `aplicarVariaveis` do envio; "Essa semana {{servico}} está por {{valor}}" sem artigo.
O que muda: `editor.tsx`, `mensagens-prontas.ts` (só o padrão; quem já tem a linha não muda: decidir migração é Do Vitor).
Aceite medido: abrir o editor a 375 px numa conta de cílios e ver a prévia com nome e serviço da agenda.
Guarda: `copy-nao-supoe-genero` já cobre; nova guarda proíbe artigo antes de `{{servico}}` em `MODELOS_PADRAO`; mutação: devolver "o {{servico}}" reprova.
Risco: mostrar dado de cliente na prévia; é a própria profissional vendo a própria cliente.
Tamanho: P
```

```
EXP-A08 · A cliente consegue sair, e as duas chaves se separam
Frente: avisos
Lado: cliente
Jornada: C2, C6
Classe: Recomendado (separar as chaves); o texto do consentimento é Do Vitor
Quando: serve ao piloto (página de confirmar); antes do lançamento (webhook e campanha)
Hoje (FATO): só a profissional marca `whatsapp_opt_out` (`clientes.ts:72`); nenhuma palavra de saída (`palavra-de-acao.ts`); campanha automática não confere `marketing_opt_in` (`recuperar-receita.ts:274`) e a manual confere (`crm.ts:499-500`).
Depois (meta): sair em 1 toque na página de confirmar; "SAIR"/"PARAR" no WhatsApp; chamada de volta automática só com `marketing_opt_in`; lembrete do horário e chamada de volta com chaves separadas.
O que muda: migration aditiva com a coluna nova (antes do deploy, `migration-que-tira-privilegio-inverte-a-ordem`); `confirmar/[token]`; `palavra-de-acao.ts`; `recuperar-receita.ts`; `lembretes.ts`.
Aceite medido: no banco local, tocar "não quero mais lembretes" e ver a coluna mudar; rodar `identificarLembretesPendentes` e ver a cliente fora; 1 toque contado no navegador.
Guarda: teste de que `enviarParaRecuperar` sem `marketing_opt_in` pula com motivo `sem_consentimento` (mutação: tirar o filtro reprova); teste de palavra ("sair", "Parar!", "SAIR." viram saída; "sair às 15h?" não).
Risco: cliente sai por engano e perde o lembrete; a página confirma o que foi desligado e oferece desfazer.
Tamanho: M
```

```
EXP-A09 · Agendador de 15 minutos antes de ligar o lembrete
Frente: avisos
Lado: cliente
Jornada: C2
Classe: Bloqueado (credencial Meta, modelos aprovados, rampa) + Do Vitor (ligar)
Quando: antes do lançamento, se o lembrete automático for prometido no lançamento
Hoje (FATO): GitHub atrasa 5 a 6,5 h (`cron.yml:32-36`); cron-job.org a cada 3 h (`docs/runbooks/cron-externo.md`); o lembrete T-3h morre depois do início (`reminders/schedule.ts:66`).
Depois (meta): `reminders` chamada a cada 15 min por agendador externo; atraso medido ≤ 15 min em 7 dias.
O que muda: só configuração do agendador e `ROTAS_AGENDADAS`; ligar a rampa (`rampa-whatsapp.ts`) junto, na fase 1 do `docs/74`.
Aceite medido: 7 dias de `cron_heartbeats.send_reminders` com intervalo máximo ≤ 20 min.
Guarda: `saude-vigia-so-o-que-roda` já reprova se a lista e o agendador divergirem; vigia nova com limiar de 30 min para `send_reminders`.
Risco: falar com cliente real antes do aquecimento; seguir a ordem do `cron.yml:213-222`.
Tamanho: P (código) + espera externa
```

```
EXP-A10 · "Lembrar amanhã": lembrete com confirmar em 1 toque, sem esperar a Meta
Frente: avisos
Lado: os dois
Jornada: C2, P2
Classe: Recomendado
Quando: serve ao piloto (depende de EXP-A03 e EXP-A08)
Hoje (FATO): nenhum lembrete chega à cliente; o link de confirmar só é gerado no lembrete automático desligado (`lembretes.ts:142-143`); o modelo "Lembrete de amanhã" não tem link (`mensagens-prontas.ts:40`) e só é usado de ficha em ficha.
Depois (meta): cartão P-A4 no Hoje a partir das 16h com as clientes de amanhã; "Lembrar" abre o WhatsApp dela com o texto e o link de confirmar/cancelar; cliente confirma com 1 toque (C2). Profissional: ≤ 1 toque por cliente, ≤ 30 s para 5 clientes (HIPÓTESE, medir).
O que muda: variável nova `{{link_confirmar}}` em `lib/mensagens.ts` (token de `confirmacao-token.ts`, 72 h); cartão no Hoje; registro em `messages` (kind `reminder`, canal `whatsapp`, provider `manual`), que respeita o dedupe e faz o cartão sumir para quem já foi lembrada.
Aceite medido: no navegador a 375 px, conta de cílios com 5 horários amanhã: contar toques e tempo até a 5ª mensagem aberta; do lado da cliente, abrir o link e confirmar em 1 toque; status `confirmed` no banco local.
Guarda: teste de que o link na mensagem valida em `verificarTokenConfirmacao` para o agendamento certo (mutação: trocar o id reprova); teste de que o cartão não lista quem já foi lembrada (mutação: tirar o filtro de `messages` reprova).
Risco: virar "mais um lugar para olhar"; o cartão fica no Hoje, que ela já abre (P2). Medir quantas lembradas por dia no piloto.
Tamanho: M
```

```
EXP-A11 · "Pôr na minha agenda" na tela de sucesso da cliente
Frente: avisos
Lado: cliente
Jornada: C1, C2
Classe: Recomendado
Quando: serve ao piloto
Hoje (FATO): a tela de sucesso diz que a confirmação vem de quem atende (`[slug]/agendar/agendar.tsx:659-676`); não há lembrete nenhum do lado dela.
Depois (meta): 1 toque baixa um evento de calendário (`.ics`) com alarme na véspera e 2 h antes; o próprio celular dela lembra. Zero custo, zero Meta.
O que muda: rota pública que gera `.ics` por token assinado; botão na tela de sucesso.
Aceite medido: no Android e no iPhone (emulado), o evento abre no app de calendário com 2 alarmes; 1 toque.
Guarda: teste do `.ics` gerado (fuso do negócio, `VALARM` presentes, sem dado além de serviço, lugar e hora); mutação: remover o fuso reprova.
Risco: o evento não muda se o horário for remarcado; o texto do evento diz "confira no link" com o link de confirmar.
Tamanho: P
```

```
EXP-A12 · Aviso de volta ANTES do dia, puxado pelo ritmo de cada cliente
Frente: avisos
Lado: os dois
Jornada: C4, P3
Classe: Recomendado
Quando: serve ao piloto (versão `wa.me`); depois do piloto (versão automática, Bloqueada pela Meta)
Hoje (FATO): o Hoje e o Recuperar mostram quem já está `due/late/at_risk/lost`; nada avisa 2 dias antes; o "Chamar" usa texto fixo, não o modelo dela (`recuperar.tsx:370-371`).
Depois (meta): cartão P-A5 com quem chega no dia nos próximos 2 dias; "Chamar" usa o modelo escolhido por ela, com o link de volta já no serviço e 2 horários livres dela. Cliente marca em ≤ 3 toques (C4).
O que muda: consulta de `client_cycles` por `predictedDate` entre hoje e hoje+2; `textoDeVolta` aceita modelo (P1 do `docs/39`); horários do `/disponibilidade`; `SERVICO_DE_VOLTA` completo para cabelo, depilação e estética (com o 04-salao).
Aceite medido: no navegador, conta semeada com 10 clientes perto do dia: 2 toques até o WhatsApp aberto (P3); do lado da cliente, link → horário marcado em ≤ 3 toques.
Guarda: teste de que o cartão inclui `due` futuro e exclui quem tem horário marcado (mutação: tirar `hasFutureAppointment` reprova); controle positivo provando cenário montado.
Risco: chamar quem voltaria sozinha (mede-se no EXP-A15); limite de 1 por pessoa a cada 7 dias somando serviços.
Tamanho: M
```

```
EXP-A13 · Uma tela "Avisos" no lugar de três
Frente: avisos
Lado: profissional
Jornada: P1, P2
Classe: Recomendado
Quando: depois do piloto
Hoje (FATO): três telas (`config/automacoes`, `config/mensagens`, `config/notificacoes`) e nenhuma diz, por evento, o que acontece.
Depois (meta): uma lista com os eventos do §3.1 e §3.2; por evento: ligar, texto (modelo), antecedência, e o estado real; horário de silêncio e limite por cliente no topo. Toda escolha relida do servidor depois de salvar.
O que muda: `app/admin/config/avisos`; `tenants.settings.avisos` lido pelos mesmos serviços dos eventos; redirecionar as três rotas antigas.
Aceite medido: mudar cada parafuso, recarregar, ver o valor; e ver o efeito no banco local (prévia que grava).
Guarda: teste "todo parafuso tem leitor" (generaliza o do EXP-A01); mutação: um parafuso sem leitor reprova.
Risco: perder o histórico de quem já editou modelos; os modelos continuam em `message_templates`.
Tamanho: G
```

```
EXP-A14 · Regras do aviso dentro do app (pop-up e cartão)
Frente: avisos
Lado: profissional
Jornada: P2
Classe: Recomendado
Quando: serve ao piloto (junto do primeiro pop-up, EXP-A03)
Hoje (FATO): não há componente de aviso sobreposto nem central de avisos (`src/components/ui`: só `alert-banner`, `toast`, `sheet`).
Depois (meta): 1 pop-up por sessão, faixa no topo, nunca durante formulário, some em 8 s; nenhum botão principal coberto.
O que muda: componente `AvisoNaTela` com contador por sessão e lista de estados bloqueados; corpo do aviso montado por uma função que só aceita campos permitidos (nome, horário, serviço), nunca anamnese.
Aceite medido: com o aviso visível, `elementFromPoint` no centro de cada botão de ação da tela devolve o próprio botão, a 375 e a 1280 px.
Guarda: teste do contador (2º aviso na sessão vira selo; mutação: tirar o contador reprova); teste de que o montador de corpo rejeita campo de saúde (mutação: aceitar `anamnese` reprova).
Risco: aviso escondido demais; medir no piloto se P-A2 foi visto (toque no cartão).
Tamanho: M
```

```
EXP-A15 · Cartão "voltaram pelo seu Chamar" com a conta honesta
Frente: avisos
Lado: profissional
Jornada: P2
Classe: Recomendado (grupo de controle sorteado é Do Vitor)
Quando: serve ao piloto
Hoje (FATO): `messages.clicked_at` e `booked_appointment_id` gravados (`link-de-volta.ts:63,109-112`); a tela Campanhas mostra volta por tempo (`admin/campanhas/page.tsx:111`).
Depois (meta): cartão semanal: "chamou 12, voltaram 4 pelo link em 14 dias, R$ 480; das 9 no mesmo estado que você não chamou, voltaram 1". Nunca "enviadas" ou "abertas".
O que muda: consulta em `messages` + `client_cycles`; cartão no Hoje às segundas.
Aceite medido: banco local semeado com chamadas, cliques e agendamentos conhecidos; o cartão mostra exatamente os números semeados.
Guarda: teste de que o denominador inclui chamadas não abertas (mutação: filtrar por `clicked_at not null` reprova: a taxa sobe e o teste pega).
Risco: número pequeno no começo; abaixo de 8 chamadas o cartão diz "ainda pouco para afirmar" (`MINIMO_PARA_AFIRMAR`, `prestacao-de-contas.ts:56`).
Tamanho: P
```

### Ordem sugerida (INFERÊNCIA)

1. Onda 0: A01, A02, A03, A08 (parte da página), A07. Todos servem ao piloto e nenhum depende de terceiro.
2. Onda 2, os que mais rendem sem Meta: A10, A11, A12, A15, A14.
3. Antes do lançamento: A04, A05, A06, A08 (webhook e campanha).
4. Depois do piloto: A13. Bloqueado: A09 e todas as versões automáticas.

---

## 8 · Os 5 que mais rendem

| # | Ticket | Ganho previsto | Base |
| --- | --- | --- | --- |
| 1 | EXP-A10 Lembrar amanhã com link | C2 sai de "impossível" para 1 toque da cliente | FATO: hoje nenhum link de confirmar chega a ninguém |
| 2 | EXP-A12 Aviso antes do dia, pelo ritmo | C4 de "chamar depois que passou" para "chamar 2 dias antes" | INFERÊNCIA: a faixa `due` começa 3 dias antes (`compute.ts:100`); hoje ninguém age nela |
| 3 | EXP-A01 Dial com efeito | tela deixa de mentir; pré-requisito para ligar qualquer automático | FATO D1 |
| 4 | EXP-A11 Pôr na minha agenda | lembrete do lado da cliente com custo zero | HIPÓTESE: a medir pela taxa de falta com e sem |
| 5 | EXP-A03 Cancelou avisa e sugere quem chamar | vaga que abre vira vaga preenchida | FATO D5 |

---

## 9 · O que ficou NÃO VERIFICADO

- Nenhuma tela foi aberta no navegador nesta frente. Toques, tempos e textos na tela ficam para a sessão principal.
- Se o VAPID, o Resend e o WhatsApp estão configurados **em produção** (não li env de produção, por regra). Usei `docs/110` §1 para o Resend.
- Se alguma linha de `waitlist` existe em produção (D6 só morde com fila).
- Booksy: aviso de retorno. Trinks, Gendo e GlossGenius: personalização de antecedência e texto. Nenhuma fonte oficial achada.
- Se nome de serviço digitado pela profissional pode conter termo de saúde que acabaria num aviso (D9).
- Se a cliente quer escolher antecedência e canal (HIPÓTESE do §2 e §5.2).
