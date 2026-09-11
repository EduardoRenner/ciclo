# 60 · Plano de implementação — CICLO

Documento único de execução. Editado, nunca recriado. Substitui os artifacts HTML anteriores.

---

## 0. AÇÃO PENDENTE — PRs esperando merge

**#111, #112, #113 e #114 estão abertos e MERGEABLE, mas ainda não entraram na `main`.** Só #108,
#109 e #110 estão na `main` hoje. É por isso que nada do RLS completo nem da tela "quem você já
atende" aparece se você olhar o produto agora — o código existe, está verde, está revisado, mas não
foi publicado.

| PR | O que faz | Depende de |
|---|---|---|
| [#111](https://github.com/EduardoRenner/ciclo/pull/111) | RLS: ficha de saúde e consentimento não se apagam pelo PostgREST | nada — mergear primeiro |
| [#112](https://github.com/EduardoRenner/ciclo/pull/112) | RLS: dez tabelas param de aceitar DELETE | #111 |
| [#113](https://github.com/EduardoRenner/ciclo/pull/113) | RLS: DELETE exige o papel que a rota já exige | #112 |
| [#114](https://github.com/EduardoRenner/ciclo/pull/114) | Cadastro de clientela por memória (sem planilha) | nenhum dos RLS — pode entrar em qualquer ordem |

**Ordem de merge: #111 → #112 → #113 (empilhados). #114 é independente.**

Depois do merge, rodar `npx supabase migration up --local` (ou aplicar em produção pelo SQL Editor,
como nas rodadas anteriores) para as migrations 0084–0086 baterem com o código.

---

## 1. A meta

> **Um salão real pagando, e evidência de o que fez ele ficar.**

Não "terminar o backlog". Não "deixar o produto bom". Um salão, pagando, e saber por quê.

**Como sabemos que chegou:** existe uma assinatura ativa no Mercado Pago, e existe um número que
diz quanto tempo passou entre aquele salão criar a conta e ver dinheiro na tela do Motor.

Tudo que não serve a essa frase sai da fila. Item que não responde *"isso aproxima do primeiro
pagante?"* não entra, por melhor que seja.

---

## 1b. Os 9 itens originais — cada um, verificado agora

Lista que o Eduardo trouxe de uma auditoria anterior. Reconferida contra o código em 2026-09-11,
item a item, para nenhum sumir na reestruturação.

| # | Item original | Status real | Onde |
|---|---|---|---|
| 1 | Cron externo do Motor pode cair sem avisar (já caiu 54h) | **Aberto** | Fase 2 reserva — `T-02`. Heartbeat já existe (`cron_heartbeats`); falta o alerta sair dele |
| 2 | RLS cega em ~22 tabelas | **Resolvido, aguardando merge** | PRs #111+#112+#113. Medido no fim: eram 20 tabelas, não 22 — uma (`waitlist`) fica cega de propósito (controle positivo de teste) |
| 3 | `.env.local` pode apontar pra produção sem guarda | **Já resolvido antes desta sessão** | `tests/setup/so-banco-local.ts` — recusa rodar fora de `127.0.0.1`/`localhost` |
| 5 | CI não pega banco atrás do código | **Resolvido e mergeado** | PR #110 — `tests/setup/banco-em-dia.ts` compara `schema_migrations` com o disco antes de qualquer suíte de banco rodar |
| 6 | Idempotency-Key sem teste de replay | **Já estava resolvido, verificado agora** | `tests/unit/server/idempotency.test.ts:118` — "o mesmo POST duas vezes executa uma vez só", com Postgres falso respeitando a mesma regra de chave primária do banco real. Não é varredura, é comportamento |
| 7 | Assistente de IA proativo (sugere, não envia) | **Aberto, de propósito** | Fase 2 reserva — `T-07`. Entra quando alguém reclamar de escrever mensagem na mão |
| 8 | Guardas que só varrem código-fonte | **Parcialmente resolvido** | O caso crítico (idempotência) já tem par de comportamento (item 6 acima). `escrita-passa-por-idempotencia.test.ts` continua varredura pura — barata, mantida como primeira linha, não removida. Os outros casos (veto do assistente) ficam em `T-06/T-08`, Fase 2 reserva |
| 9 | Fila offline sem teste de drenagem | **Já estava resolvido, verificado agora** | `tests/unit/core/offline-queue.test.ts` — 12 casos: ordem de criação, 409 vira conflito sem travar a fila, 5xx trava e mantém ordem, reenvio automático no evento `online` |

**Item 4 do original era "Melhoria real (depois)" sem numeração própria** — ficou implícito que era
o mesmo grupo do 5. Não há item 4 separado nesta lista.

**O que isso muda na prática:** dos 9, **3 já eram falso alarme** (itens 3, 6, 9 — a auditoria que
gerou a lista original não tinha visto código que já existia), **2 estão resolvidos e só faltam
review/merge** (itens 2 e 5), e **3 continuam genuinamente abertos** (itens 1, 7, 8-parcial) — todos
deliberadamente em Fase 2 porque nenhum bloqueia o primeiro cliente pagante.

---

## 2. Por que esta meta, e não outra

Quatro fatos medidos, não opinados:

1. **O produto está completo e agora ativa de verdade.** Os PRs #109 e #114 fecharam a cadeia que
   fazia a base importada não chegar no Motor. As duas portas (planilha e memória) funcionam.
2. **A segurança parou de ser risco.** De 20 tabelas com RLS cega para 1 (e a que sobra é
   proposital). Isso deixou de ser motivo para adiar clientes reais.
3. **Não existe um único número de comportamento.** Zero instrumentação de funil. Sentry mede erro,
   não pessoa.
4. **Não dá para cobrar.** Código de assinatura pronto, credencial faltando.

Conclusão: o gargalo saiu da engenharia. O que falta é **ver** e **cobrar** — e as duas coisas
precisam existir *antes* do primeiro cliente, ou o primeiro cliente passa sem deixar rastro.

---

## 3. As três travas (e de quem é cada uma)

| Trava | Quem destrava | Sem isso |
|---|---|---|
| **Não dá para cobrar** | Eduardo — credencial Mercado Pago | Não existe "pagante". A meta é inalcançável por definição |
| **Não dá para ver** | Claude — instrumentação mínima | O primeiro cliente ativa ou não ativa e ninguém fica sabendo |
| **Não tem cliente** | Eduardo — conversa com salões que ele conhece | Nada para medir |

As três são paralelas. Nenhuma depende da outra para começar.

**Critério de escolha do primeiro salão:** *tem clientela registrada em algum lugar* — caderno,
planilha, contatos do celular. Esse perfil ativa em minutos depois do #114; sem base, leva meses.
Esse é o único critério que importa na primeira dezena.

---

## 4. Fases, com critério de saída

Fase não acaba porque os itens acabaram. Acaba quando o critério é satisfeito.

### Fase 0 — Confiar na própria oficina
**Sai quando:** `pnpm verify` passa limpo num banco semeado.

Hoje ele falha sempre (slug fixo colidindo com o seed). Verify que sempre falha é verify que
ninguém lê — e toda mudança daqui pra frente depende dele para significar alguma coisa. É a coisa
mais barata da lista e destrava a confiança em todo o resto.

### Fase 1 — Ver e cobrar
**Sai quando:** uma conta nova de teste produz os eventos do funil de ponta a ponta, e uma compra
de teste no Mercado Pago fecha o ciclo (cobrou, webhook respondeu, plano mudou).

É o que transforma o primeiro cliente real em aprendizado em vez de anedota.

### Fase 2 — Os primeiros salões
**Sai quando:** 3 salões reais usando, com o número de ativação medido para cada um.

Aqui eu não construo por antecipação. **Construo o que os três primeiros mostrarem que falta** — e
o que eles mostrarem provavelmente não está nesta lista.

### Fase 3 — O que os dados justificarem
Não planejada de propósito. Planejar a Fase 3 agora é inventar o que os clientes vão querer.

---

## 5. A fila

Ordenada por fase. Cada item tem **definição de pronto** — o que precisa ser verdade para eu parar
de mexer nele. Isso existe para a execução não precisar de deliberação nova.

### Fase 0

| ID | Item | Pronto quando |
|---|---|---|
| **T-09** | Slug fixo em `mensageria.test.ts` colide com o seed de demonstração | `pnpm verify` verde com o banco semeado, e nenhum outro teste de integração usa identificador fixo (varrer `tests/integration/` atrás do mesmo padrão) |

### Fase 1

| ID | Item | Pronto quando |
|---|---|---|
| **G-05a** | Instrumentação **mínima**: 2 eventos | Tabela `product_events` + `conta_criada` e `motor_viu_valor` gravando. Uma conta nova de teste produz os dois, e dá para calcular o intervalo entre eles por SQL |
| **G-13** | Webhook de status do Mercado Pago | Pagamento recusado rebaixa o plano; teste de integração prova a transição. Não depende de credencial para ser escrito |
| **G-05b** | Os outros 4 eventos | Só depois do G-05a estar gravando em produção. `base_importada`, `recuperacao_enviada`, `cliente_voltou`, `onboarding_ok` |

### Fase 2 — só entra o que os primeiros salões pedirem

Nada pré-planejado. A lista abaixo é **banco de reserva**, não fila: itens que já estudei e sei
implementar, esperando evidência de que alguém precisa deles.

| ID | Item | Entra quando |
|---|---|---|
| T-01 | Webhook de entrada do WhatsApp (CONFIRMAR/CANCELAR grátis na janela de 24h) | Houver conta Meta **e** um salão mandando lembrete de verdade |
| G-06 | Convite B2B sai de `config/meu-plano` e vira momento pós-recuperação | Houver um dono satisfeito para convidar alguém |
| T-02 | Dead-man switch do Motor | Houver salão dependendo do cron. Primeiro passo é URL monitorada, não código |
| T-07 | Assistente escreve a mensagem de recuperação para o dono aprovar | Alguém reclamar de escrever mensagem na mão |
| T-06/T-08 | Guardas de comportamento no lugar das que só varrem fonte | Uma guarda cega deixar passar um defeito real |

### Congelado

| ID | Item | Por quê |
|---|---|---|
| G-10 | Cunha do repasse (Lei 13.352) | Maior vantagem competitiva não explorada, e trava em revisão jurídica. Não se implementa modelo fiscal por conta própria |
| G-11 | `billing_credits` + indicação com prêmio | Programa de indicação com zero pagantes é máquina sem combustível |
| — | Apps nas lojas (Capacitor) | Depende de CNPJ e domínio resolvidos |

---

## 6. Decisões congeladas

Tomadas, com base medida. **Não reabrir sem fato novo** — reabrir decisão fechada é o que mais
gastou tempo até aqui.

1. **Régua de RLS deriva do `exigirPermissao` da rota.** Nunca escolhida à mão. Se a rota autoriza
   `owner+manager`, a política autoriza `owner+manager`.
2. **"Capacidade morta" só se corta depois de rodar a suíte inteira**, não só o alvo. "Nenhum
   chamador hoje" responde uso; permissão responde autoridade. A intenção mora no docstring do
   teste. (Custou um vermelho no #113.)
3. **Uma fórmula, duas portas.** Planilha e memória usam `ciclo-de-quem-ja-atende.ts`. Nunca
   duplicar o cálculo de ciclo.
4. **Instrumentação é first-party.** Sem Posthog/GA: CSP `strict-dynamic` bloqueia script de
   terceiro, o produto processa dado de saúde, e fornecedor externo traz banner de cookie para
   medir seis eventos que o próprio banco registra.
5. **Instrumentação começa com 2 eventos, não 6.** A pergunta que importa é uma só: *o salão novo
   chega a ver dinheiro na tela?* Os outros quatro entram quando houver tráfego que justifique.
6. **O assistente de IA nunca envia sozinho.** Escreve, o dono aprova. O custo de LLM fica travado
   atrás da aprovação humana.
7. **Migration restritiva vai depois do deploy.** `delete` barrado por RLS devolve "sucesso, zero
   linhas" — erro de régua não grita, silencia.
8. **A porta padrão da base é a memória**, com planilha no rodapé. Segue a proporção do público.

---

## 7. O que não vamos fazer agora

Escrito para eu não voltar a propor:

- **Otimizar conversão / testes A/B.** Com tráfego perto de zero, nenhum teste alcança
  significância. É teatro de método.
- **Tráfego pago.** Comprar visita para um funil que ninguém mede é comprar churn.
- **Automação de marketing / régua de nutrição.** Com menos de 20 contas, o dono fala com cada uma.
- **Competir com o agente conversacional da Meta.** É revender a Meta. O valor do CICLO é saber
  *quem* chamar, não ser o canal.
- **Redesign de telas por gosto.** Só mexe em interface o que uma medição ou um usuário apontar.

---

## 8. Regras de execução

Para a execução ser execução, e não deliberação disfarçada.

**Escopo de PR.** Um item da fila, um PR. Se durante a implementação aparecer um segundo problema,
ele vira linha nova nesta tabela — não entra no PR em curso.

**Verificação proporcional.** Typecheck + os testes do escopo tocado durante o trabalho.
`pnpm verify` completo só antes de abrir o PR. Navegador apenas quando a mudança é visível.

**Guarda vista reprovando.** Continua obrigatório — é o que separou defeito real de falso positivo
várias vezes aqui. Mas uma mutação bem escolhida basta; duas só quando a primeira não prova que as
asserções de banco enxergam.

**Comentário de código.** O porquê em duas ou três linhas. O histórico da investigação vai para a
mensagem de commit ou para o PR, não para dentro do arquivo.

**Relato.** Bullets curtos: o que mudou, o que a medição mostrou, o que está na sua mão. Sem
seções, sem artifact, salvo pedido explícito.

**Quando parar e perguntar.** Só quando a resposta mudar materialmente o que eu faço — e isso é
raro, porque a seção 6 já decidiu quase tudo. Decisão de negócio, dinheiro ou risco jurídico é
sempre sua.

---

## 10. Clube (receita recorrente) — mapeado contra o que já existe

Documento fonte: `CICLO_Plano_Clube_Prioridade.md` (C-01 a C-12). Reconferido item a item contra o
código em 2026-09-11 antes de escrever qualquer linha nova — **metade do plano já existia**.

**Bloqueio real, não contornável por mim:** a seção 1 do documento fonte exige validar com
Mercado Pago/Asaas se dá pra fazer split com taxa de plataforma, e quais os requisitos de CNPJ.
É conversa de negócio com o PSP — nenhuma API resolve isso. **Todo item de cobrança (C-04, C-05,
C-09, C-10, C-11, C-12) fica parado até essa validação vir do Eduardo.**

| ID | Item | Status real |
|---|---|---|
| C-01 | Modelo `plano_assinatura`/`assinatura_cliente` | **Já existia**, desde a migration `0019`: `subscription_plans` + `client_subscriptions`, com CRUD (`fidelidade.ts`), rota (`/api/v1/subscription-plans`) e análise de margem por assinante (`clube.ts`) |
| C-02 | Motor de precificação | **Feito** — PR #115. Sugere só as cadências que a base já tem, precificadas pela mediana do ticket observado |
| C-03 | Tela "Raio-X de Recorrência" | **Feito** — PR #116, verificado no navegador com o seed (14 elegíveis, R$ 69,64 ticket médio) |
| C-04 | Cobrança recorrente (criar assinatura, webhook) | **Bloqueado** na validação de PSP. Achado: `server/billing/mercado-pago.ts` já tem `criarPreapproval`/`consultarPagamento`/`verificarAssinaturaWebhook` prontos e sem nenhuma rota consumindo — é billing do CICLO→tenant (SaaS), reaproveitável na parte de baixo nível, mas a lógica de split é nova |
| C-05 | Split/taxa de plataforma | Bloqueado (mesma validação) |
| C-06 | Tela "Receita contratada do mês" | **Feito** — PR #117 (empilhado sobre #116), verificado no navegador |
| C-07 | Checkin de uso do assinante | Aberto, não bloqueado |
| C-08 | Cancelamento de assinatura | Aberto, não bloqueado — `client_subscriptions.status` já suporta `canceled` |
| C-09–C-12 | Inadimplência, idempotência de webhook, edge cases de cobrança | Bloqueados (dependem de C-04/C-05 existirem primeiro) |

**Próximo passo não bloqueado:** C-03, depois C-06 e C-07, que dão valor ao dono (visibilidade e
operação do clube) sem depender de nenhuma cobrança automática ainda — hoje o Clube já funciona com
cobrança manual (o dono lança o pagamento na comanda, como já faz).

---

## 9. Manutenção deste documento

Editar a tabela da fila a cada PR que entra ou sai. Mover item entre fases quando o critério de
entrada for satisfeito. Não recriar, não duplicar em HTML.
