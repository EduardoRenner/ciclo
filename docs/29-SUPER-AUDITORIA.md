# 29 · SUPER AUDITORIA — 2026-08-28

Auditoria autônoma, pedida com autonomia total de decisão. Este arquivo cresce por rodada.
Cada achado só entra aqui depois de **visto acontecendo** — mutação aplicada e teste reprovando,
ou aritmética fechada com os dois lados do código na frente.

---

## Rodada 1 — a rede de segurança, o dinheiro e a corrida

### Sumário

| # | Achado | Severidade | Estado |
|---|---|---|---|
| A1 | `pnpm verify` e `pnpm test:rls` escreviam no Supabase de **produção** | **ALTO** | corrigido + guarda |
| A2 | "Sobrou" podia ser maior que "Entrou": o desconto da comanda não saía do lucro | **ALTO** | corrigido + guarda |
| A3 | Quadro "Taxa" mostrava R$ 0,00 para sempre — ninguém escreve `fee_cents` | MÉDIO | corrigido + guarda |
| A4 | Quatro transições de estado eram ler-decidir-escrever sem trava | **ALTO** | corrigido + guarda |
| A5 | `tickets.appointment_id` sem índice único, com select-then-insert em cima | MÉDIO | corrigido (0045) |
| M1 | Método: três "guardas cegas" que eram defeito do *meu* detector | — | registrado |

Verificado e **correto** (não virou achado, e isso vale tanto quanto): 52 tabelas, todas com
`enable` + `force row level security`; as 4 views com `security_invoker = true`; as 15 funções
`security definer` todas com `search_path` fixado; **20 guardas de varredura submetidas a 30
mutações, e as 30 foram pegas** — nenhuma guarda cega nesta base hoje.

---

### A1 · `pnpm verify` escrevia no banco de produção — **ALTO**

`CLAUDE.md` manda, em duas linhas diferentes, rodar `pnpm verify` antes de todo commit e **nunca**
pular `pnpm test:rls`. Os dois chamam as 44 suítes de `tests/integration` e `tests/rls`. Todas
fazem a mesma coisa nas primeiras linhas:

```ts
dotenv.config({ path: '.env.local' })
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
```

E o `.env.local` desta máquina aponta para o projeto que está no ar. Nenhuma das 44 confere para
onde está apontando.

**Medido, não deduzido:** com a trava recém-escrita ligada, `pnpm test:rls` reprovou dizendo o nome
do host de produção. Antes da trava, aquele mesmo comando teria criado tenant, usuário em
`auth.users`, profissional, serviço, agendamento e comanda — com `service_role`, que passa por cima
da RLS.

A CI escapava por acidente feliz, não por desenho: ela exporta
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` antes de rodar, e `dotenv` não sobrescreve
variável que já existe. Quem roda na própria máquina, seguindo a instrução escrita, não tinha essa
proteção.

As suítes limpam atrás de si no `afterAll` — mas só quando terminam. Suíte que estoura no meio,
`Ctrl+C`, queda de rede: o lixo fica.

**Conserto.** `tests/setup/so-banco-local.ts` recusa qualquer URL que não seja `127.0.0.1`,
`localhost` ou `[::1]`, com escape explícito `PERMITIR_BANCO_REMOTO=1`. Entra pelas suítes via
`vitest.banco.config.ts` (`setupFiles`) — e **não** por 44 cópias, porque proteção que depende de
alguém lembrar de repetir em cada arquivo novo é a que já falhou 44 vezes. `tests/unit` não passa
por ela: não abre banco e não deve carregar `.env.local`.

Vista reprovando com três mutações: script sem `--config`, config sem `setupFiles`, e a regra de
"é local" trocada por uma permissiva.

---

### A2 · "Sobrou" podia ser maior que "Entrou" — **ALTO**

A tela do caixa (`src/app/admin/caixa/caixa.tsx`) dizia, com estas palavras:

> **Sobrou** — O que entrou menos material, taxa da maquininha e comissão.

E as duas pontas discordavam:

| Na tela | De onde vem |
|---|---|
| "Entrou no dia" | `Σ tickets.total_cents` = subtotal − **desconto** + **gorjeta** |
| "Sobrou" | `Σ tickets.profit_cents` = subtotal − material − comissão |

O desconto e a gorjeta do nível da comanda entravam num lado e não no outro. A tela de comanda
coleta os dois (`Desconto e gorjeta`, `comanda.tsx:196`), então não é caminho hipotético.

**A aritmética, fechada:** comanda de R$ 100, desconto de R$ 20, sem material, comissão zero.
`total_cents` = 8.000. `profit_cents` = 10.000. O caixa mostrava **Entrou R$ 80 · Sobrou R$ 100**.
O desconto — dinheiro que o salão abriu mão de receber — saía do relatório de graça, todo dia, na
conta que o dono usa para decidir se paga o mês seguinte.

**Por que nenhum teste pegou:** `tests/integration/caixa.test.ts` insere `profit_cents` na mão
(`{ total: 10_000, material: 1_000, fee: 300, commission: 2_000, profit: 6_700 }`) e confere a
soma. Ele testava o somador, nunca a origem. E `tests/integration/comanda.test.ts` testava desconto
e gorjeta no `total_cents` — sem nunca olhar `profit_cents` na mesma comanda. Duas suítes verdes,
cada uma cobrindo metade da costura, e o defeito exatamente no meio.

**Conserto.** `calcularSobraDaComanda` em `src/core/comanda/totals.ts` (função pura, regra 5):
receita do salão (`subtotal − desconto`) menos material, taxa e comissão. A gorjeta é 100% do
profissional (F84): entra no `total` porque a cliente paga, e sai da sobra porque o salão não fica
com ela. A comissão continua sobre o total do item, sem o desconto da comanda — o desconto é
concessão do dono, não do profissional, e por isso aparece inteiro na linha do salão.

Guardas: 6 casos unitários incluindo a invariante "em toda combinação de desconto e gorjeta, a
sobra nunca passa do que entrou", e dois testes de integração que fecham uma comanda de verdade com
desconto e com gorjeta.

---

### A3 · O quadro "Taxa" era R$ 0,00 para sempre — MÉDIO

Ao lado de Material e Comissão havia um terceiro quadro, "Taxa". **Nada no projeto escreve
`tickets.fee_cents`** — nem `fecharComanda`, nem pagamento, nem job. A única ocorrência fora dos
tipos gerados é `caixa.ts`, que o *soma*.

Zero ao lado de dois números de verdade não se lê como "não implementado"; lê-se como "hoje não
teve taxa". O dono que passa metade do faturamento no cartão fecha o mês achando que a maquininha
já foi descontada.

**Conserto.** O quadro sai e a frase de apoio passa a dizer o que de fato acontece ("O que entrou,
menos a gorjeta do profissional, o material e a comissão"). A coluna, o campo do resumo da API e o
desconto dentro de `calcularSobraDaComanda` ficam. A guarda
`tests/unit/design/caixa-nao-promete-taxa.test.ts` é de **mão dupla**: enquanto ninguém escrever
`fee_cents`, ela proíbe a palavra na tela; no dia em que alguém escrever, ela passa a **exigir** o
quadro de volta. Guarda que só sabe proibir vira dívida — é a lição da guarda do `vercel.json`.

---

### A4 · Quatro transições de estado sem trava — **ALTO**

`fecharComanda`, `cancelarComandaFechada`, `transicaoSimples` (confirmar / chegou / faltou /
concluir) e `cancelarAgendamento` seguiam todas o mesmo desenho: ler o estado, validar em memória,
escrever. Entre a leitura e a escrita rodavam **N consultas** — em `fecharComanda`, uma por item
para resolver a comissão. Duas requisições simultâneas passavam as duas pela validação.

O que cada uma custava:

- **`fecharComanda`** → `baixarEstoqueDaComanda` roda duas vezes e **não é idempotente**: insere um
  `out` por produto, sem olhar se já existe. O estoque desce em dobro e nada reprova.
- **`cancelarComandaFechada`** → `estornarBaixaDaComanda` lê os `out` do ticket e gera um `return`
  para cada. Chamada duas vezes, devolve o dobro ao estoque.
- **`concluirAgendamento`** → cria a comanda depois da transição. Os dois criavam a sua, e o
  agendamento podia acabar `no_show` com faturamento lançado.

A `Idempotency-Key` não cobre isto: ela deduplica a **mesma** chave, e dois toques de verdade (dois
aparelhos no balcão, duas abas) geram chaves diferentes.

Todas viraram compare-and-swap: o filtro de estado entra no **próprio UPDATE**
(`.eq('status', atual.status)`), `.single()` vira `.maybeSingle()`, e nenhuma linha afetada vira
`INVALID_TRANSITION` com texto que diz o que fazer. É literalmente a correção que o achado S11 fez
no débito de carteira — a mesma classe sobrevivia em mais quatro lugares.

---

### A5 · `tickets.appointment_id` sem índice único — MÉDIO

O comentário de `concluirAgendamento` chamava o select-then-insert de "idempotente por
`appointment_id`" e, na linha seguinte, já dizia a verdade: *"que não tem índice único ainda"*. Sem
o índice não é idempotência, é corrida.

O sintoma é atrasado e silencioso: `buscarTicketIdPorAgendamento` faz `.maybeSingle()` — com duas
linhas, o PostgREST devolve erro, e o link "Ver comanda" da agenda quebra **para sempre** naquele
atendimento.

Migration `0045_uma_comanda_por_atendimento.sql`: índice único parcial (`where appointment_id is
not null`, porque comanda de balcão nasce sem agendamento). Ela **recusa aplicar com mensagem
explícita** se já existir duplicata — apagar comanda é proibido pela regra 11, então qual linha fica
com o atendimento é decisão de gente, não de migration. O insert passou a tratar `23505` devolvendo
a comanda que existe, em vez de 500.

> ⚠️ **A conferir antes do deploy:** não consegui rodar a contagem em produção nesta sessão. Se
> houver duplicata, a migration para o deploy com a instrução na própria mensagem de erro.
> `select appointment_id, count(*) from tickets where appointment_id is not null group by 1 having count(*) > 1;`

---

### M1 · O achado de método: três guardas cegas que eram defeito do detector

Das 30 mutações, três voltaram "GUARDA-CEGA" e **as três eram erro meu**, não da guarda:

| O que eu vi | O que era |
|---|---|
| `actions-fixadas` não pegou tag móvel | mutei o `cron.yml`, que não tem nenhuma linha `uses:` — o alvo era o `ci.yml`. O `md5` do arquivo mudou mesmo assim, porque o `sed -i` normalizou CRLF→LF. **`md5` diferente não prova que a mutação foi aplicada.** |
| `runbook` e `actions` "não reprovaram" | meu detector procurava `Tests +[0-9]+ failed` na saída do Vitest, que vem com escape ANSI no meio. O regex nunca casava, e **toda** guarda parecia cega. |
| `agendamento-anuncia-mudanca` não pegou `setSlots([])` | a "prova" de que mutei era um `grep` por `setSlots([])` — que já existia no arquivo, dentro do comentário que explica por que aquilo não pode voltar. A prova casou com a documentação do defeito. |

É a tabela do `CLAUDE.md` de novo, aplicada à ferramenta em vez de ao código: *case com o que muda
quando o defeito volta*. A versão final do harness confere a mutação por um `grep` que só existe
**depois** dela, e mede o resultado com a saída sem ANSI.

Isso muda a leitura de qualquer varredura futura: **"a guarda não pegou" é hipótese, não achado,
até o detector ter sido conferido nas duas direções.**

---

### As 20 guardas submetidas a mutação (30 mutações, 30 pegas)

`runbook-aponta-pro-agendador-certo` (2) · `actions-fixadas` (3) · `rpc-existe` (1) ·
`landing-e-estatica` (2) · `motor-de-ciclo-observavel` (1) · `saude-vigia-so-o-que-roda` (3) ·
`sharp-so-onde-precisa` (1) · `demonstracao-fora-do-indice` (1) · `lgpd-cobertura` (2) ·
`sair-da-conta` (2) · `titulos-de-tela` (2) · `telas-do-admin-tem-loading` (1) ·
`preco-em-um-lugar-so` (1) · `foco-visivel-nao-e-apagado` (1) · `modulos-catalogo` (1) ·
`home-nao-promete-demais` (5) · `agendamento-publico-nao-promete-demais` (2) ·
`erro-nao-manda-cliente-pro-admin` (1) · `agendamento-anuncia-mudanca` (3) ·
`dia-no-fuso-do-salao` (1) · `precos-tem-trava-no-servidor` (1) · `rede-nao-derruba-tela` (1) ·
`cron-cobre-os-fusos` (1) · `cron-sobrevive-a-atraso` (2) · `service-worker` (2) · `contraste` (2) ·
`precos-nao-promete-demais` (1).

Mais as três guardas novas desta rodada, cada uma vista reprovando: `teste-nao-toca-producao` (3) e
`caixa-nao-promete-taxa` (3).

---

### Cobertura desta rodada

**Varrido e limpo:** RLS por tabela (52/52 com `enable`+`force`; nenhuma criada depois da 0001 sem
política própria); `security_invoker` nas 4 views; `search_path` nas 15 funções `security definer`;
fonte única do caixa (soma só `tickets`, não `tickets` + `payments` — o erro de contar o mesmo
dinheiro duas vezes não existe aqui).

**Não coberto nesta rodada, e fica dito:** ciclo de vida LGPD (eliminação/exportação de verdade,
retenção, cofre); fila offline e PWA; dependências e supply chain; andaime morto além do
`fee_cents`; concorrência em pacotes, fidelidade e carteira; o que a migration 0045 encontra em
produção.


---

## Rodada 2 — o ponto cego do `jsonb`, e o que o produto não consegue fazer

### Sumário

| # | Achado | Severidade | Estado |
|---|---|---|---|
| B1 | A eliminação da titular não alcançava `audit_log` nem `idempotency_keys` — CPF, endereço e o contato de emergência de um TERCEIRO sobreviviam | **ALTO** | corrigido + guarda |
| B2 | `clients.preferences` carrega `alergia` e ia inteiro para a trilha — dado de saúde em log, contra a regra 9 | **ALTO** | corrigido + guarda |
| C1 | `tenants.plan` é lido por toda a trava de plano e **escrito por ninguém** | **ALTO** | reportado (decisão de produto) |
| C2 | O portfólio de fotos não existe em duas camadas — e a tela já pede o consentimento que ele gastaria | MÉDIO | guarda de mão dupla |
| C3 | `appointments.hold_expires_at`: coluna + índice parcial para uma reserva por sinal que ninguém escreve | BAIXO | registrado |
| M2 | Método: mais duas cegueiras do meu próprio detector | — | registrado |

Verificado e **correto**: `pacotes.ts` já fazia compare-and-swap em `used_sessions` (`.eq('used_sessions', atual)`) — o que confirma que o A4 da rodada 1 era uma **classe** mal aplicada, não um descuido isolado; as 4 views seguem com `security_invoker`; a nova função da 0046 fixa `search_path` como as outras 15.

---

### B1 · O que a eliminação não alcançava — **ALTO**

`writeAudit` recebe `after: cliente` em `POST /api/v1/clients` e `before` + `after` no `PATCH`. O
que vai para `audit_log` é a **linha inteira**, e `COLUNAS` de `clientes.ts` diz exatamente qual:

> `name, phone_e164, email, birth_date, notes, tags, source, referred_by, preferences, document,
> gender, address, emergency_contact, ...`

`document` é o CPF. `emergency_contact` é o nome e o telefone de um **terceiro**, que nunca foi
cliente de ninguém e nunca consentiu nada. E a mesma linha vai para
`idempotency_keys.response_body`, porque o corpo da resposta *é* a cliente.

`eliminarCliente` nunca tocou nenhuma das duas. O sistema respondia `anonymized: true`, a tela
dizia "Cliente eliminada", e o cadastro completo seguia legível para `owner`, `manager` e
`finance` — que é exatamente quem a política `audit_read` deixa ler.

**Por que a guarda de LGPD não pegava.** `lgpd-cobertura` varre as migrations procurando tabela com
`references clients(id)` e coluna de tipo textual. `audit_log` não referencia `clients` — o vínculo
é `entity_id`, um `uuid` solto — e `idempotency_keys` não referencia nem `tenants`. Nas duas, o dado
mora em `jsonb`. **O ponto cego é o jsonb**, e ele é estrutural: um detector que segue chave
estrangeira nunca vai enxergar um dado que viaja como documento.

**Conserto.** Migration `0046`, `redigir_trilha_do_cliente`: zera `before`/`after` da trilha e troca
o `response_body` da chave por um marcador. A **linha sobrevive nas duas** — na trilha por causa da
regra 11, e na chave porque apagá-la faria uma repetição da fila offline **reexecutar** a mutação,
recriando a cliente que acabou de ser eliminada.

O `execute` é concedido **só a `service_role`**, e `eliminarCliente` chega lá pelo `withTenant()`.
Uma `security definer` que redige trilha, concedida a `authenticated`, é a ferramenta perfeita para
quem quer sumir com o próprio rastro — e nenhuma checagem dentro dela compensa ter aberto a porta.
Dentro sobra a trava que não depende de quem chamou: **a cliente já tem que estar eliminada**
(`anonymized_at is not null`). Não existe caminho para redigir a trilha de uma cliente ativa.

---

### B2 · Alergia na trilha — **ALTO**

`clients.preferences` tem um campo `alergia` em **seis das sete** verticais de
`src/lib/preferencias.ts` — as dicas do próprio formulário são "acetona, resina", "amônia, PPD",
"cola, cianoacrilato". Alergia é dado de saúde, e a regra 9 do `CLAUDE.md` não abre exceção para
trilha: *"dado de saúde nunca em log, Sentry ou analytics. Redija antes."*

A lista de redação de `writeAudit` protegia o cofre (`answers`, `ciphertext`, `iv`, `auth_tag`) e
não protegia o caminho de fora do cofre. `preferences` e `alert_label` entraram.

A guarda é de **comportamento**, não de lista: ela monta uma linha de `clients` como ela chega em
`after` e confere que `preferences` sai redigido **e que `name` continua lá** — uma redação que
apaga tudo deixaria a trilha sem valor nenhum, e passaria numa guarda que só olhasse a lista.

---

### C1 · A trava de plano está inteira sobre uma coluna que ninguém escreve — **ALTO**

Medido: `tenants.plan` é **lido** em `contextoDePlano` (`planos.ts`) e em `public-booking.ts`, e
alimenta `exigirModulo`/`exigirLimite` em **11 rotas de escrita**. E é **escrito em zero lugares** —
nenhuma linha de TypeScript, nenhuma migration, nenhum seed, nenhum script.

A coluna nasce `plan_tier not null default 'start'`, renomeado para `gratis` pela migration 0030.
Logo: **todo tenant é `gratis`, para sempre.** A trava de plano funciona perfeitamente contra um
valor que não tem como mudar.

O `docs/09 §P11` registrou, em 2026-08-20, que *"grep confirmou que nenhuma linha de código lê
`tenants.plan` hoje"* — e essa frase envelheceu no melhor sentido possível: o lado da **leitura**
foi construído desde então (planos, módulos, capacidades, paywall, `precos-tem-trava-no-servidor`).
O lado da **escrita** não. Hoje o produto sabe cobrar e não sabe promover.

O que isso significa na prática, e é concreto: **se alguém pagar hoje, por Pix, na mão, não existe
caminho no repositório para entregar o que a pessoa comprou** — nem rota, nem tela, nem script.
Só um `UPDATE` datilografado no painel do Supabase.

**Não corrigido, de propósito.** Quem pode promover um tenant (existe super-admin? é o dono do
CICLO? é o webhook do PSP?) é decisão de produto, e o `CLAUDE.md` é explícito: *"nunca crie arquivo
que o ticket não pediu"*. O caminho mais barato, quando a decisão existir, é um script em
`scripts/` no molde de `rotacionar-kek.mjs` — chave de serviço, tier validado contra
`ORDEM_DOS_PLANOS`, e uma linha em `audit_log`.

---

### C2 · O portfólio não existe em duas camadas — MÉDIO

`mediaParaPortfolio` filtra por `consent_id` não-nulo e cruza com `consents.revoked_at`, cumprindo
o critério do TICKET-051: *"revogar imagem esconde a foto do portfólio imediatamente"*. Medido:

1. **nada no projeto grava `media.consent_id`** — `fazerUploadMedia` insere `tenant_id`,
   `client_id`, `storage_key`, `kind` e `phase`, e nunca a coluna do consentimento;
2. **nenhuma rota, página ou serviço chama `mediaParaPortfolio`.**

A segunda é o que salva: como ninguém chama, ninguém vê galeria vazia. Mas o critério do TICKET-051
está cumprido **por vacuidade** — "revogar esconde a foto" é verdade porque não existe foto para
esconder, não porque a revogação funcione. E a tela de saúde da cliente **coleta** o consentimento
`image_use`: o salão já pede à cliente uma autorização cujo efeito não existe.

Guarda de mão dupla, como a do `fee_cents`: enquanto ninguém gravar `consent_id`, ela proíbe ligar o
portfólio numa tela; no dia em que o upload gravar a coluna, ela para de proibir e passa a **exigir**
que o cruzamento com `revoked_at` continue de pé.

---

### C3 · `hold_expires_at` — BAIXO, registrado

`appointments.hold_expires_at` existe desde a 0001, com um índice parcial dedicado
(`... where status = 'pending'`) e o comentário *"reserva aguardando o sinal"*. Ninguém escreve a
coluna e não há job que expire reserva. É andaime coerente com o bloqueio de pagamento (o sinal
depende de PSP), e fica registrado para não ser confundido com funcionalidade no dia em que alguém
for ligar depósito.

---

### M2 · Mais duas cegueiras do meu próprio detector

O M1 da rodada 1 disse que *"a guarda não pegou" é hipótese, não achado, até o detector ter sido
conferido nas duas direções*. A rodada 2 pagou para ver, duas vezes — e as duas foram em guardas
**que eu tinha acabado de escrever**:

| O que a mutação mostrou | O que era |
|---|---|
| trocar `to service_role` por `to authenticated, service_role` não reprovava | a asserção estava escrita como `not.toMatch(/\bauthenticated\b/)`. O `\b`, escrito no heredoc, virou o caractere **backspace** (`0x08`) dentro da string — a regex procurava `<BS>authenticated<BS>` e nunca casava. Uma asserção que parecia rigorosa e não testava nada. |
| ligar o portfólio numa tela não reprovava | o leitor de "quem grava `consent_id`" varria `src/` inteiro, e `types.gen.ts` declara `consent_id` para **toda** tabela. A lista de escritores nunca era vazia, então a guarda caía sempre no ramo *"já tem escritor"* e desistia. |

As duas passam pelo mesmo lugar: **o ramo que a guarda toma é ele próprio um detector**, e um
`if (x.length > 0) return` cego é indistinguível de um teste que passou. Por isso a guarda do
portfólio ganhou uma asserção de sanidade sobre a própria lista, e a varredura passou a excluir
arquivo gerado.

Depois de conferir a saída do Vitest (rodada 1), agora também: **conferir o texto do arquivo
escrito.** `\b`, `\s` e `\.` sobrevivem mal a heredoc — `grep` com `cat -v` mostra o que de fato
ficou lá, e vale sempre que o teste contiver regex.

---

### Cobertura acumulada

**Varrido e limpo (rodadas 1 e 2):** RLS por tabela (52/52); `security_invoker` nas 4 views;
`search_path` nas 16 funções `security definer`; fonte única do caixa; compare-and-swap em pacotes;
20 guardas × 30 mutações + 6 guardas novas × 12 mutações.

**Não coberto ainda:** fila offline e PWA além do que o `service-worker.test.ts` já cobre;
dependências e supply chain; retenção (`idempotency_keys`, `webhook_events` e `job_queue` crescem
para sempre); concorrência em fidelidade (`loyalty_entries` não tem unicidade por atendimento —
hoje fechado pelo CAS da rodada 1, mas sem trava própria); o que a migration 0045 encontra em
produção.

> **Correção feita na rodada 3:** a frase acima chegou a incluir `rate_limits` na lista de tabelas
> sem limpeza. Estava errada, e a rodada 3 mediu: `consumir_rate_limit` já faz uma limpeza
> oportunista, limitada a 50 linhas, quando uma janela nova começa. Foi uma afirmação por analogia
> ("as quatro tabelas de infra são iguais") em vez de leitura — o oposto do que este documento pede.


---

## Rodada 3 — o que a fila offline jogava fora

### Sumário

| # | Achado | Severidade | Estado |
|---|---|---|---|
| D1 | Sessão vencida durante a noite **apagava** o agendamento que estava na fila | **ALTO** | corrigido + guarda |
| D2 | Qualquer recusa definitiva sumia da fila sem uma palavra — a metade não entregue do §4.2.5 | **ALTO** | corrigido + guarda |
| D3 | Reserva de idempotência órfã devolvia `429` para a mesma chave **para sempre** | MÉDIO | corrigido + guarda |
| D4 | `idempotency_keys` guardava a cliente inteira sem prazo nenhum | MÉDIO | corrigido + guarda |
| M3 | Método: uma afirmação da rodada 2 caiu quando foi medida | — | corrigido no texto |

Verificado e **correto**: `pnpm audit` → **0 vulnerabilidades** em 931 dependências;
`drenarFila` (`core/offline/queue.ts`) trata ordem, conflito e parada por rede exatamente como o
§4.2.4 pede, e já tinha teste; a chave de idempotência da fila é o `id` da mutação, **estável entre
reenvios** — a repetição não reexecuta nada, que é a metade difícil e estava certa;
`consumir_rate_limit` já limpava a própria tabela; a página pública de agendamento **não** usa
`apiFetch` (e o comentário no arquivo explica por quê), então nada disto alcançava a cliente final.

---

### D1 · A noite sem rede apagava o agendamento — **ALTO**

`enviarMutacao` classificava o status da resposta assim:

```ts
if (resposta.ok) return { kind: 'ok' }
if (resposta.status === 409) return { kind: 'conflict' }
if (resposta.status === 429 || resposta.status >= 500) return { kind: 'retry' }
return { kind: 'discard' }          // ← 401 e 403 caem aqui
```

`discard` faz `drenarFilaPendente` chamar `removerMutacao(id)`. Ou seja: **`401` apagava a mutação
do IndexedDB.**

O cenário não é exótico, é o mais provável de todos. Tablet do balcão, agendamento criado sem rede
no fim do expediente, aparelho passa a noite offline, a sessão vence, de manhã a rede volta, o
`online` dispara a drenagem, o servidor responde `401` — e o trabalho some. A pessoa tinha visto
*"Agendamento entrou na fila e será enviado quando a conexão voltar"* e nunca mais ouve falar do
assunto.

Sessão vencida e permissão revogada são estados **do cliente**, não veredito sobre a mutação:
entrar de novo (ou o gerente devolver a permissão) faz a mesma mutação passar. Viraram `retry`.

---

### D2 · A metade não entregue do §4.2.5 — **ALTO**

A especificação diz, com estas palavras: *"409 marca o item como precisa da sua atenção. **Nunca
descarta em silêncio.**"* A metade do `409` estava entregue desde o TICKET-055: vira card, com
"tentar de novo" e "descartar".

A outra metade não. Qualquer recusa definitiva (`400`, `402`, `404`, `422`) removia a mutação do
IndexedDB e emitia um evento `descartada` que o **único assinante do projeto** —
`ResolucaoDeFila` — usava apenas para *sumir com o card de conflito*. O evento nem carregava a
mutação: só o `id`. Não havia o que mostrar mesmo que alguém quisesse.

Reachability, medida: `apiFetch` tem **um** chamador de verdade, `admin/agenda/novo/formulario.tsx`
— e `ResolucaoDeFila` é montado no `admin/layout.tsx`, então a tela certa está no ar. A página
pública de agendamento **não** usa `apiFetch`, de propósito e com o motivo escrito no arquivo
(precisa distinguir `SLOT_TAKEN`, e o `apiFetch` devolve só `{queued}`). Então o estrago era do
profissional, não da cliente final — o que não o torna menor: o profissional é quem marca a agenda.

**Conserto.** O descarte vira card próprio, com a diferença que importa: **não há "tentar de
novo"**, porque o servidor recusou em definitivo. Só resta contar o que se perdeu, e por isso o
evento passou a levar a mutação junto — lida **antes** do `removerMutacao`, senão não há mais o que
ler. O card diz o quê ("Um agendamento criado sem conexão não foi enviado") em vez de "alguma coisa
falhou".

**E a regra virou `core`.** A classificação do status morava dentro do adaptador de browser, que o
próprio arquivo declara intestável neste projeto (sem jsdom). Era a única parte da fila offline sem
teste — e era justamente a que apagava trabalho. Virou `classificarResposta`, função pura, com teste
de comportamento nos seis grupos de status, incluindo uma asserção contra ela mesma: uma
implementação que devolvesse sempre `retry` passaria em dois dos testes e faria a fila nunca
esvaziar.

---

### D3 · A reserva órfã prendia a chave para sempre — MÉDIO

`comIdempotencia` faz três coisas em sequência: reserva a chave (`insert`), executa a mutação,
grava a resposta (`update`). O `catch` solta a reserva quando a mutação **lança** — mas não há
`catch` para o processo simplesmente morrer entre a reserva e a gravação (função derrubada, timeout
duro da plataforma). A linha fica com `response_status` nulo.

E o caminho de repetição trata `response_status === null` como *"a primeira tentativa ainda está
rodando"* e devolve `429` com "tente de novo em instantes". Para sempre — nada limpa aquela linha.

A fila offline reenvia com a **mesma** chave (`mutacao.id`, e isso está certo, é o que faz o reenvio
ser seguro). Então uma mutação que caiu nessa janela **nunca mais entra**: todo reenvio recebe
`429`, que a fila classifica como `retry`, que reenfileira, que recebe `429`… A mutação fica
circulando na fila até alguém desistir.

Reserva parada há mais de uma hora não é "ainda rodando": nenhuma função serverless dura isso.

---

### D4 · A chave guardava a cliente inteira, sem prazo — MÉDIO

`idempotency_keys.response_body` guarda o corpo da resposta, e o corpo de `POST /api/v1/clients`
**é a cliente**: nome, telefone, e-mail, CPF, endereço. Era a única tabela do projeto com dado
pessoal e **nenhuma limpeza por idade**.

Guardar isso indefinidamente para deduplicar um reenvio que não virá contraria a necessidade
(LGPD art. 6). A rodada 2 fez a eliminação da titular alcançar a tabela (migration 0046); esta
alcança quem **continua** cliente.

**Onde a faxina mora, e por quê.** Em `recompute-cycles` — que não tem nada a ver com o assunto.
O motivo é único: é a **única rota deste projeto que roda sozinha de verdade** em produção (ela e
`segments` são as duas do `on.schedule`, e esta dispara seis vezes por dia). Limpeza pendurada numa
rota que ninguém agenda é limpeza que não existe, e criar uma sétima rota de cron só para varrer uma
tabela obrigaria a mexer no `cron.yml`, no `ROTAS_DE_CRON` e nas duas guardas de agendamento.

Fica **fora** do `if (processados > 0)` de propósito: chave órfã prende reenvio a qualquer hora, não
só na madrugada dos tenants. Teto de 500 linhas por passada, no mesmo espírito da limpeza que
`consumir_rate_limit` já fazia. E o resultado vai na resposta (`chavesOrfas`, `chavesVencidas`) —
número que ninguém vê é número que ninguém confere, que é a lição inteira dos
`tenantsProcessados: 0`.

---

### M3 · Uma afirmação da rodada 2 caiu quando foi medida

A rodada 2 fechou dizendo que `idempotency_keys`, **`rate_limits`**, `webhook_events` e `job_queue`
"crescem para sempre — nenhuma limpeza por idade existe no projeto". A rodada 3 foi ler
`consumir_rate_limit` e encontrou, dentro dela, uma limpeza oportunista limitada a 50 linhas, que
roda quando uma janela nova começa.

Foi uma afirmação **por analogia** — "as quatro tabelas de infraestrutura são iguais, logo nenhuma
tem limpeza" — num documento cuja regra de abertura é que achado só entra depois de visto
acontecendo. O texto da rodada 2 foi corrigido no lugar, com a correção marcada.

Vale registrar o padrão, porque ele é diferente do M1 e do M2: aqueles eram **ferramenta** cega;
este é **preguiça de leitura** disfarçada de conclusão. As quatro tabelas nascem no mesmo bloco da
0001, com o mesmo comentário ("sem política, de propósito") — e uma delas ganhou tratamento próprio
três migrations depois. Semelhança de origem não é semelhança de estado.

---

### Cobertura acumulada (rodadas 1 a 3)

**Varrido e limpo:** RLS por tabela (52/52); `security_invoker` nas 4 views; `search_path` nas 16
funções `security definer`; fonte única do caixa; compare-and-swap em pacotes; **0 vulnerabilidades
em 931 dependências**; ordem/conflito/parada da fila offline; estabilidade da chave de idempotência
entre reenvios; limpeza própria de `rate_limits`.

**Guardas submetidas a mutação:** 20 existentes × 30 mutações + 9 novas × 23 mutações. Todas as
existentes pegaram; **quatro das novas nasceram cegas e foram corrigidas antes de entrar** (duas na
rodada 2, duas na rodada 3).

**Não coberto ainda:** `webhook_events` e `job_queue` continuam sem limpeza (o primeiro está vazio —
nenhum PSP integrado; o segundo acumula linhas `done`); unicidade em `loyalty_entries`; o que a
migration 0045 encontra em produção; e-2-e no navegador de verdade.


---

## Rodada 4 — o dia do salão virava dia em UTC

### Sumário

| # | Achado | Severidade | Estado |
|---|---|---|---|
| E1 | Comissão de comanda fechada depois das 21h saía do mês trabalhado | **ALTO** | corrigido + guarda |
| E2 | `<= 23:59:59` deixava uma fresta de menos de um segundo sem período nenhum | MÉDIO | corrigido + guarda |
| E3 | O extrato de comissão vinha truncado no teto do PostgREST, e o total vinha menor | **ALTO** | corrigido + guarda |
| E4 | "O CICLO trouxe R$ X este mês" contava um mês em UTC ao lado de um caixa que conta o mês do salão | MÉDIO | corrigido + guarda |
| E5 | `job_queue` é andaime completo: zero produtores, `HANDLERS` vazio, rota fora do schedule | BAIXO | registrado |

Verificado e **correto**: `verificarTokenAssinado` confere **todas** as chaves mesmo depois de uma
bater (o tempo de resposta não revela qual chave assinou), compara com `timingSafeEqual` guardado
por igualdade de tamanho, e o escopo entra na assinatura; `alertas-estoque.ts` usa janela corrida de
30 dias e a diferença de fuso não muda a decisão — registrado como dívida consciente, não como
esquecimento.

---

### E1–E3 · O extrato de comissão — **ALTO**

Trinta linhas, três defeitos, e os dois primeiros tiram dinheiro de quem trabalhou:

```ts
.gte('tickets.closed_at', `${desde}T00:00:00Z`)
.lte('tickets.closed_at', `${ate}T23:59:59Z`)
```

**E1 — o dia era UTC.** É exatamente o bug que o `caixa.ts` documenta e evita desde o TICKET-047,
com o comentário escrito no arquivo: *"um fechamento às 23h de Brasília (02h UTC do dia seguinte)
cairia no dia errado"*. Em São Paulo (UTC−3), toda comanda fechada depois das 21h cai no dia
seguinte em UTC. No fechamento do mês ela **some do mês trabalhado e reaparece no seguinte**. Salão
que fecha às 20h perde a última hora de todo dia; barbearia aberta até 22h perde mais.

E o agravante: o extrato aparece na **mesma tela** que o caixa (`admin/caixa/page.tsx`, seção
"Comissão do mês por profissional"). Dois números do mesmo mês, um ao lado do outro, contando dias
diferentes.

**E2 — `23:59:59` não é o fim do dia.** Comanda fechada em `23:59:59.4` não entrava em período
nenhum: nem neste, que acaba em `23:59:59`, nem no seguinte, que começa em `00:00:00`. O intervalo
agora é semiaberto `[início, fim)`, com `fim` na meia-noite do dia **seguinte** — a mesma forma do
`caixa.ts`.

**E3 — sem paginação.** O PostgREST corta a resposta no teto de linhas do projeto e **não avisa**.
O extrato de um mês movimentado vinha truncado, e `totalCents` — somado das linhas devolvidas —
vinha **menor**, sem nada na tela dizendo que faltou. O `caixa.ts` já paginava em blocos de 1000, e
o comentário lá explica por quê. Aqui não paginava.

---

### E4 · A mesma classe, no número que vende o produto — MÉDIO

`receitaAtribuidaAoCiclo` alimenta *"o CICLO trouxe R$ X este mês"* na tela inicial do painel e em
`/admin/recuperar`. Os **três** chamadores já montam `desde`/`ate` com
`Temporal.Now.zonedDateTimeISO(timezone)` — eles falam o calendário do salão. Era a função que
reinterpretava aquelas datas como UTC, duas vezes: no filtro (`T00:00:00Z` / `T23:59:59Z`) e na
janela (`timeZone: 'UTC'`).

Diferente do extrato, aqui não havia contradição interna — estava errado de forma consistente. O
que não sobrevive é a comparação: o mesmo painel mostra "este mês" do Motor num calendário e "este
mês" do caixa em outro.

Blast radius hoje é pequeno (a rota `campaigns` está fora do `on.schedule`, então quase não há
`messages.kind = 'campaign'`). É justamente por isso que o conserto sai barato agora, antes de o
número virar argumento de venda.

---

### O padrão que liga a rodada 1 à rodada 4

Quatro rodadas, e o achado mais caro de cada uma tem a mesma forma: **um conserto certo, aplicado
num lugar só.**

| Rodada | Onde estava certo | Onde a mesma classe sobrevivia |
|---|---|---|
| 1 | `debitar_carteira` virou compare-and-swap no achado S11 | `fecharComanda`, `cancelarComandaFechada`, `transicaoSimples`, `cancelarAgendamento` |
| 2 | `TRATAMENTO_NA_ELIMINACAO` cobre toda coluna textual com FK para `clients` | `audit_log` e `idempotency_keys`, que guardam a cliente em `jsonb` |
| 3 | `409` virava card desde o TICKET-055 | todo o resto do 4xx, e o `401` que apagava o trabalho |
| 4 | `caixa.ts` conta o dia no fuso do tenant desde o TICKET-047 | `comissao.ts` e `atribuicao.ts` |

Nenhum deles é descuido de quem escreveu: em todos os quatro, o autor do conserto original
**documentou a razão no arquivo que consertou** — e a documentação não viaja. A pergunta que
faltava, todas as vezes, era *"onde mais este mesmo raciocínio se aplica?"*.

Por isso as guardas desta auditoria são, quando dá, **de classe e não de caso**:
`dia-do-salao-nao-e-utc` varre `src/server` e `src/app` inteiros com lista de dívida que só encolhe,
em vez de travar as três funções que eu conheço hoje.

---

### E5 · `job_queue` é andaime completo — BAIXO, registrado

Medido: `enfileirar()` tem **zero** chamadores; `HANDLERS` na rota `api/cron/jobs` é
`{}` (o comentário diz "por ora o registro fica vazio"); e a rota está fora do `on.schedule` do
`cron.yml`. A tabela não recebe linha nenhuma, nunca.

Isso encerra o item que a rodada 3 deixou aberto: `job_queue` não é um problema de retenção, porque
não cresce. É andaime, como `hold_expires_at` e `webhook_events` — coerente com o bloqueio de
pagamento e de mensageria. `finish_job` marca estado e nunca apaga, então **quando** a fila for
ligada, a retenção passa a ser uma pergunta de verdade. Fica dito aqui para não ser redescoberto.

---

### Cobertura acumulada (rodadas 1 a 4)

**Varrido e limpo:** RLS por tabela (52/52); `security_invoker` nas 4 views; `search_path` nas 16
funções `security definer`; 0 vulnerabilidades em 931 dependências; ordem/conflito/parada da fila
offline; estabilidade da chave de idempotência entre reenvios; limpeza própria de `rate_limits`;
compare-and-swap em pacotes; HMAC dos links públicos (todas as chaves conferidas, `timingSafeEqual`,
escopo assinado).

**Guardas submetidas a mutação:** 20 existentes × 30 mutações + 11 novas × 32 mutações. Todas as
existentes pegaram; **quatro das novas nasceram cegas e foram corrigidas antes de entrar.**

**Não coberto ainda:** unicidade em `loyalty_entries` (hoje fechada pelo CAS da rodada 1, sem trava
própria); estados de vazio e de erro por tela, que a "definição de pronto" do `CLAUDE.md` exige e
nenhuma guarda confere; e-2-e no navegador de verdade; o que a migration 0045 encontra em produção.


---

## Rodada 5 — o botão que trava e não diz por quê

### Sumário

| # | Achado | Severidade | Estado |
|---|---|---|---|
| F1 | Sem serviço cadastrado, "Confirmar agendamento" nasce morto e nada indica o caminho | **ALTO** | corrigido + guarda |
| F2 | Mais oito controles travados sem explicação, um deles na página pública | MÉDIO | corrigido + guarda |
| F3 | `loyalty_entries` continua sem unicidade por atendimento | BAIXO | registrado, com motivo para não consertar agora |

Verificado e **correto**: das 33 telas do `/admin` que renderizam lista, 26 já tratam o vazio; das
7 restantes, 4 renderizam lista **estática** (as cores do profissional, o catálogo de 17 módulos,
os campos de preferência da vertical) e as outras 3 são exatamente os `<select>` cujo vazio o
achado F1 passou a explicar. Não sobrou tela de lista com vazio mudo.

---

### F1–F2 · A prop existia e era usada em cinco lugares — **ALTO**

O TICKET-105 fechou esta classe em duas telas públicas: `A6` ("Enviar avaliação") e `A15`
("Confirmar agendamento" na página do cliente), com o motivo escrito no arquivo — *"no leitor de
tela saía 'Confirmar agendamento, indisponível' e ponto"*. Para isso nasceu `motivoDesabilitado`,
que o `Button` transforma em `title` e em `<span class="sr-only">`.

Medido: **25** botões com `disabled` no projeto, **5** com a explicação, **9** travados por uma
condição de conteúdo e mudos. O pior deles não é de acessibilidade — é de produto:

> `admin/agenda/novo` → `disabled={servicos.length === 0 || profissionais.length === 0}`

Um salão que apagou os serviços semeados pelo pacote da vertical abre "Novo agendamento", vê o
botão morto e **não descobre por quê**. Não há empty state, não há link, não há frase. A tela mais
usada do produto trava sem uma palavra.

Os outros oito: `orcamentos/novo` (sem profissional), `comanda/[id]` ("Fechar comanda" sem item),
`clientes/importar` (sem escolher a coluna do nome), `config/profissionais` (salvar sem nome),
`config/seguranca` e `(auth)/verificar` (código de 6 dígitos incompleto), e os **dois** botões de
`(public)/confirmar`, que travam enquanto o **outro** está em curso — o spinner que explicaria a
espera está no botão vizinho, não neste.

Junto veio o checkbox de módulo "sempre ligado" em `config/modulos`: o leitor de tela dizia
*"Desligar Agenda, caixa de seleção, marcada, indisponível"*. Quem tenta desligar não descobria que
não dá — descobria que não funcionou.

**A guarda é de classe.** Varre todo `<Button>` com `disabled` em `src/app` e `src/components` e
exige a explicação. Dois detalhes que a fazem funcionar:

- **delimita pelo fim real do elemento** (o `>` fora de chaves), não por uma janela de N
  caracteres — com janela, o `motivoDesabilitado` do botão vizinho vaza para dentro e a guarda
  passa. É a armadilha nº 4 da tabela do `CLAUDE.md`, e o teste do próprio leitor prova que não
  acontece;
- **a dispensa é uma lista fechada** de condições que significam "já estou enviando", e há um teste
  que reprova se essa lista crescer para engolir `!nome` ou `length === 0`. Exceção que cresce
  sozinha é a forma mais silenciosa de uma regra virar decoração.

Mais uma asserção contra copy vazia: `motivoDesabilitado="Indisponível"` reprova. A regra da casa é
que o texto diga **o que fazer**.

---

### F3 · `loyalty_entries` sem unicidade — BAIXO, e por que não consertei agora

`loyalty_entries` não tem restrição de unicidade por `(appointment_id, reason)`, e
`pontuarAtendimentoConcluido` insere sem conferir. Antes da rodada 1, dois "concluir" simultâneos
pontuavam duas vezes.

Hoje o caminho está fechado no app: `transicaoSimples` virou compare-and-swap, então só uma das
duas requisições chega a pontuar. O que falta é a segunda camada, no banco.

**Não adicionei**, e o motivo é o mesmo que fez a `0045` falhar alto em vez de limpar sozinha: um
índice único sobre dado que já pode ter duplicata **para o deploy**. Já existe uma migration nessa
condição esperando conferência em produção; empilhar uma segunda multiplica a chance de o deploy
travar por um motivo que ninguém antecipou. As duas devem ir juntas, na mesma passada em que
alguém rodar a consulta de diagnóstico da `0045` no banco de verdade.

---

### M4 · O heredoc comeu a barra invertida — de novo, e agora com nome

Três vezes nesta auditoria uma asserção nasceu quebrada pelo mesmo motivo, e vale registrar como
procedimento porque não é sobre este projeto:

| O que eu escrevi | O que ficou no arquivo |
|---|---|
| `not.toMatch(/\bauthenticated\b/)` | `/<BS>authenticated<BS>/` — `\b` virou o caractere **backspace** (0x08), e a regex nunca casava |
| `[\s\S]{0,120}` numa template string | `sS{0,120}` — `\s` dentro de template literal JS não é `\s` de regex |
| `'linha1\nlinha2'` numa fixture | uma quebra de linha de verdade no meio da string, e o arquivo nem compilava |

A causa é sempre a mesma: escrever arquivo por heredoc de shell, que colapsa `\` em `\`, e depois
uma linguagem que interpreta `\` de novo. **Regra prática:** nada de barra invertida dentro de
heredoc — use `String.fromCharCode()` no destino, ou monte o texto sem escape. E, sempre que a
guarda contiver regex, **ler o arquivo escrito** (`grep | cat -v` mostra caractere de controle) antes
de acreditar no verde.

As três só apareceram porque cada guarda nova passou por mutação antes de entrar. A do `\b` teria
entrado no repositório parecendo rigorosa e testando nada.

---

### Cobertura acumulada (rodadas 1 a 5)

**Varrido e limpo:** RLS por tabela (52/52); `security_invoker` nas 4 views; `search_path` nas 16
funções `security definer`; 0 vulnerabilidades em 931 dependências; ordem/conflito/parada da fila
offline; estabilidade da chave de idempotência entre reenvios; limpeza própria de `rate_limits`;
compare-and-swap em pacotes; HMAC dos links públicos; estados de vazio das 33 telas de lista do
`/admin`.

**Guardas submetidas a mutação:** 20 existentes × 30 mutações + 12 novas × 35 mutações. Todas as
existentes pegaram; **cinco das novas nasceram cegas e foram corrigidas antes de entrar.**

**Não coberto ainda:** medição no navegador de verdade (390 px, alvos de toque, contraste
renderizado) — as quatro rodadas do `docs/15` cobriram as telas públicas, o `/admin` a 390 px não
foi remedido nesta auditoria; e-2-e; unicidade em `loyalty_entries` (F3, junto da conferência da
0045).


---

## Rodada 6 — a capacidade que o banco recusa

### Sumário

| # | Achado | Severidade | Estado |
|---|---|---|---|
| G1 | `parallel_capacity` é oferecido pela disponibilidade e **proibido pelo banco** | MÉDIO (latente) | guarda de mão dupla |
| G2 | A capacidade contava encostos, não simultaneidade — horário sumia da agenda | MÉDIO | corrigido + teste |

Verificado e **correto**: `computeCycle` (o Motor de Ciclo) — o histórico é ordenado
explicitamente e convertido para o fuso do tenant antes de entrar; descarte de outlier, mistura com
o padrão, clamp e estados batem com o §5.3 passo a passo; `availableSlots` resolve o expediente
para `Instant` uma vez só, com `ZonedDateTime`, e há teste de dia de 23 h e de 25 h.

---

### G2 · Capacidade era contagem, não simultaneidade — MÉDIO

```ts
sobrepostosDeAgendamento++
if (sobrepostosDeAgendamento >= parallelCapacity) return false
```

Contava quantos agendamentos **encostam** na janela do candidato. Com capacidade 2, um serviço de
3 h e dois atendimentos curtos que nem se cruzam — 10:00–10:30 e 11:30–12:00 — somavam 2 e
derrubavam o horário, apesar de em nenhum instante existirem três pessoas. Quanto mais longo o
serviço, mais vizinhos ele encosta e mais horário some.

O sintoma é o que ninguém reclama: a página pública mostra **menos** horários do que o salão tem.
Não gera overbooking, gera agenda vazia — e a capacidade paralela existe justamente para a secagem
de esmalte (§5.5), onde o serviço é longo e os vizinhos são curtos.

Virou linha de varredura: recorta cada ocupação ao pedaço que cai dentro da janela, ordena os
eventos e olha o **pico**. Fim antes de início no mesmo instante, porque atendimento que termina
10:30 e outro que começa 10:30 não são simultâneos. Os dois testes que já existiam (dois que se
cruzam derrubam; folga ignora capacidade) continuam passando — a trava não foi afrouxada.

---

### G1 · E o motivo de ninguém ter visto — MÉDIO, latente

```sql
alter table appointments add constraint appointments_no_overlap
  exclude using gist (professional_id with =, period with &&)
  where (status in ('pending','confirmed','arrived'));
```

A restrição **não sabe o que é capacidade**: proíbe qualquer sobreposição do mesmo profissional. E
a disponibilidade é calculada por profissional, filtrando `appointments` por `professional_id` e
pelos mesmos três estados. Ou seja: com capacidade 2, a disponibilidade oferece o horário e o
`insert` bate na constraint (`23P01`), que o app traduz para `SLOT_TAKEN` — *"esse horário acabou de
ser reservado"*, num horário que o próprio salão abriu.

Não virou incêndio por um acidente: **o formulário de serviço não expõe o campo**. O comentário
dele lista "sinal/capacidade paralela/anamnese" como o que ficou de fora, e só quem chama a API
direto consegue passar de 1. É armadilha, não incêndio — e ela dispara no dia em que alguém
completar o formulário, que é um passo óbvio e já anotado como pendência.

**Não "consertei" escolhendo um lado**, e o motivo é que a escolha não é técnica: ou o banco aprende
a contar capacidade (exclusion constraint não expressa "no máximo N sobrepostos" — precisaria de
trigger com trava, e trava mal feita devolve a corrida que a constraint resolve), ou a capacidade
paralela sai do produto. As duas são decisão de quem define o produto.

O que dá para fazer sozinho é impedir que a armadilha dispare, e é o que a guarda faz, nos dois
sentidos: enquanto o banco não souber contar, o formulário não pode oferecer o campo; e a restrição
de sobreposição não pode sumir — sem ela, o problema deixa de ser agenda vazia e passa a ser
cliente marcada em dobro.

---

## Fechamento — o que ficou, e por que paro aqui

Seis rodadas, **23 achados**, 14 commits, 949 testes passando (eram 877), zero regressão.

### As três coisas que precisam de você

1. **A migration `0045` para o deploy** se existir agendamento com duas comandas em produção. A
   consulta de diagnóstico está na mensagem de erro dela. Apagar comanda é proibido pela regra 11 —
   qual das duas fica com o atendimento é decisão de quem conhece o dado. A unicidade de
   `loyalty_entries` (§F3) deve ir na mesma passada.
2. **`tenants.plan` não tem escritor** (§C1). A trava de plano está inteira de pé sobre uma coluna
   que ninguém escreve: se alguém pagar hoje, não existe caminho no repositório para entregar o que
   comprou. Quem pode promover um tenant é decisão de produto.
3. **Capacidade paralela** (§G1): ou o banco aprende a contar, ou o campo sai do produto.

### O que esta auditoria não cobriu, e fica dito

Medição no navegador de verdade — `/admin` a 390 px, alvos de toque, contraste renderizado. As
quatro rodadas do `docs/15` cobriram as telas **públicas**; o painel não foi remedido aqui, e
leitura de código não pega alvo de toque nem overflow. Também não houve e-2-e nem qualquer execução
contra banco: `tests/integration` e `tests/rls` **não foram rodados** nesta máquina — de propósito,
porque o achado A1 é justamente que eles escreveriam em produção. Tudo que depende deles está
escrito para rodar na CI.

### Por que paro

O retorno caiu de forma clara e medida:

| Rodada | Achados ALTO de correção de dados |
|---|---|
| 1 | 3 |
| 2 | 2 |
| 3 | 2 |
| 4 | 2 |
| 5 | 0 |
| 6 | 0 |

As duas últimas rodadas não encontraram nenhum defeito que corrompa ou perca dado — encontraram
uma classe de acessibilidade e uma armadilha latente. E as frentes que sobram (navegador, e-2-e,
banco) **não são coisa de ler código**: precisam de um Supabase local e de um navegador medindo, que
é exatamente o que o `docs/15` e o `docs/28` fizeram quando foi a hora deles.

Continuar varrendo o mesmo código produziria mais texto e menos achado — que é o oposto do que este
documento existe para fazer. O `docs/25` §"quando parar" já tinha escrito essa regra para a
manutenção noturna; ela vale aqui igual.
