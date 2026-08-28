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
