# 09 · PLATAFORMA — de nicho de beleza a SaaS para qualquer profissional com agenda

> Data: 2026-08-19 · **Documento de planejamento.** Nenhuma linha de código foi alterada.
> Escopo: a virada de produto de "SaaS para profissionais da beleza" para "SaaS para qualquer
> profissional que tem agenda e clientes que voltam" — faxineira, eletricista, personal,
> fotógrafo, professor particular, veterinário, psicólogo, encanador, jardineiro.
>
> O segundo eixo, que é o que faz isso vender: **o profissional configura tudo sozinho**.
> Assina, cria a conta, escolhe a profissão, sobe a logo, ajusta serviços e preços, e sai com
> um link público funcionando — sem ninguém da nossa parte tocar em nada.
>
> Este documento decide **o que é dado e o que é código**. É a única pergunta que importa aqui.

---

## 0. Sumário executivo

1. **A arquitetura já foi construída para isso.** O cabeçalho de `0002_vertical_packs.sql` diz,
   com todas as letras: *"O 'modelo único' só funciona porque a diferença entre as profissões é
   CONFIGURAÇÃO, não código."* A tese está certa e o motor está pronto — o que está limitado é
   o **catálogo**: 8 verticais, todas de beleza, num `enum` do Postgres.
2. **Treze lacunas reais separam o produto de hoje do produto multiprofissão** (§2), todas
   medidas no repositório. As três mais sérias não são cosméticas: **não existe endereço do
   atendimento em lugar nenhum** — nem no banco (G3) nem no formulário público (G13), o que
   torna um agendamento de faxineira ou eletricista literalmente inútil; **recorrência é uma
   coluna órfã** (`appointments.recurrence_id` existe, a tabela por trás dela não); e **8 dos 10
   modelos de WhatsApp são de salão** (G10) — o produto fala com o cliente final, no canal que
   mais importa, assumindo que ele vem até você.
3. **A generalização melhora o produto, não dilui.** O Motor de Ciclo — hoje "cliente de beleza
   que sumiu" — é, na verdade, o motor de retorno de qualquer negócio de serviço: manutenção
   preventiva do eletricista, faxina semanal, retorno de 6 meses do dentista, vacina anual do
   pet. O nome CICLO fica **melhor** depois da virada, não pior.
4. **A configuração de uma profissão cabe em 4 eixos** (§4). É isso que torna "todos os
   profissionais" um problema tratável em vez de promessa vazia: não são dezenas de produtos,
   são pontos num espaço de 4 dimensões. O lançamento leva **12 profissões escolhidas para
   cobrir os 4 eixos** (§5) — se essas 12 rodam sem código específico, o modelo está provado.

---

## 1. O que já está pronto — e o que isso significa

Levantamento no código, não estimativa. **Isto tudo generaliza sem uma linha nova:**

| Já existe | Por que serve a qualquer profissão |
|---|---|
| Multi-tenant com RLS em toda tabela | é o requisito duro de um SaaS de verdade, e é a parte cara — está feita |
| `appointments_no_overlap` (constraint de exclusão no banco) | agenda sem conflito é igual para dentista e para encanador |
| `services.duration_min` aceita **5 a 720 min** | 12 horas. Uma **diária de faxina (8h)** já cabe hoje, sem migration |
| `services.buffer_before_min` / `buffer_after_min` | é onde o **tempo de deslocamento** vai morar (§10) — o conceito já existe |
| `services.cycle_days` (por serviço) | o intervalo de retorno já é por serviço, não global: "corte 21 dias" e "revisão elétrica 365 dias" convivem |
| Motor de Ciclo + estados `on_track/due/late/at_risk/lost` | vocabulário já é neutro de profissão |
| `no_show_score` + `risk_features` | faltar é universal |
| RBAC (owner/manager/professional/reception/finance) | cobre de autônomo a equipe |
| Lembrete e confirmação por WhatsApp | universal |
| Página pública `/[slug]` + agendamento | universal |
| Comanda, caixa, estoque, comissão | opcional por profissão (§6) |
| LGPD: consentimento, cofre, exportar/anonimizar | vale mais fora da beleza, não menos |
| `appointments.parallel_capacity` | aula em grupo, turma, sessão coletiva |
| Importação de clientes por CSV | universal |

**Conclusão honesta:** a virada é de **catálogo e configuração**, não de motor. Isso é uma
posição boa — e rara.

### 1.1 O estado real do produto — medido no banco de produção, não suposto

Este plano foi escrito antes de alguém olhar quantas pessoas usam o CICLO hoje. Olhei. Números
do projeto `sukloaoodpxjukngyojo` em 2026-08-19:

| Medida | Valor | Leitura |
|---|---|---|
| Tenants ativos | 78 | — |
| Tenants criados **há mais de 7 dias** | **0** | todos nasceram em 18 e 19/08 |
| Clientes | 365.588 | ~4.700 por tenant |
| Tenants com **mais de 1.000 clientes** | 35 | nenhum salão real tem isso |
| Maior tenant | **10.004 clientes** | — |
| Agendamentos | 351.211, sendo 350.403 `done` | 99,8% concluídos |
| Vindos da **página pública** | **97** | 0,03% |

Isso não é uso: **é o dado sintético dos testes de integração e de carga**, que nesta máquina
rodam contra a nuvem porque não há Docker local (decisão já registrada). Ele fez o trabalho dele
— os quatro bugs do TICKET-036 (cap de 1.000 linhas do PostgREST, paginação sem `order`
estável) só apareceram por causa dele.

**Duas consequências que este plano precisa absorver:**

1. **O CICLO ainda não tem cliente pagante.** Não é motivo para não fazer a virada — é motivo
   para mudar o *sequenciamento* (§15) e para tratar os alvos da §13.2 como hipóteses sem linha
   de base, não como metas. Escrever 12 packs antes de alguém pagar é a mesma família de erro
   que escrever 40.
2. **O projeto de produção carrega resíduo de teste.** 78 tenants e 365 mil clientes falsos
   precisam sair **antes do primeiro cliente real** — senão o primeiro salão de verdade nasce
   num banco com 10 mil clientes fantasma, com o custo e a confusão que isso traz. É o item
   4.15 do `VERIFICACAO-FINAL.md` ("dados de teste/seed fora da produção"), e não está feito.
   Vale decidir também se o desenvolvimento continua rodando contra o projeto de produção ou
   se ganha um projeto próprio — a segunda opção custa ~US$ 10/mês e resolve a causa.

---

## 2. As treze lacunas

Cada uma verificada no repositório de hoje.

### G1 · `vertical_pack` é um `enum`, e enum não é catálogo

```sql
create type vertical_pack as enum ('barber','nails','lashes','brows','waxing','aesthetics','tattoo','hair');
```

`tenants.vertical` referencia esse tipo. Para ter 40 profissões, o enum teria que crescer 40
vezes — e **`ALTER TYPE ... ADD VALUE` não pode ter o valor novo usado na mesma transação**
(armadilha já documentada nesta família, no `stark-restaurante`). Além disso, profissão vira
dado que o **usuário** escolhe: isso é linha de tabela, não tipo de banco.

**Vira:** tabela `professions` (catálogo global, como `vertical_packs` já é hoje) + FK.

### G2 · O vocabulário está cravado na interface — **e no feminino**

Medido: **13 ocorrências** de concordância no feminino em texto visível.

```
src/app/admin/hoje/hoje.tsx:61          "Próxima cliente"
src/app/admin/clientes/lista.tsx:119    "Nenhuma cliente"
importador.tsx:70,170                   "clientes importadas"
recuperar.tsx:135                       "alguma cliente"
action-bar.tsx:13                       "selecionadas"
```

Para um eletricista, "Próxima cliente" está errado duas vezes: a palavra e o gênero. Este é o
problema **tecnicamente mais chato** de toda a virada (§3.2), e é o que mais aparece na tela.

### G3 · Não existe endereço do atendimento

`clients.address` existe (migration `0019`), mas é **texto livre** e é o endereço **do
cliente**, não **do trabalho**. Não há `lat`/`lng`, não há endereço em `appointments`.

Consequências para metade das profissões novas: a faxineira que atende a mesma cliente em dois
imóveis não tem como distinguir; o eletricista não sabe para onde vai; e **não há como calcular
deslocamento** (§10) sem coordenada.

### G4 · Recorrência é uma coluna órfã

`appointments.recurrence_id uuid` existe. `appointment_origin` tem o valor `'recurring'`.
**Não existe tabela de recorrência** e nada no código produz esse valor — grep confirma.

É andaime sem construção. E recorrência não é um detalhe para o público novo: para faxineira,
personal, professor e jardineiro, **a recorrência É o negócio**.

### G5 · Só existe um modelo de preço: fixo por serviço

`services.price_cents` é um valor fixo. Não cobre:

| Profissão | Como cobra de verdade |
|---|---|
| Consultor, advogado, professor | por hora |
| Eletricista, encanador, chaveiro | visita + hora + material |
| Faxineira, diarista | por diária (meia/inteira) |
| Reforma, pintor, fotógrafo de evento | por orçamento fechado |
| Personal, terapeuta | por pacote de sessões |
| Contador, jardineiro, TI | mensalidade recorrente |

### G6 · Não existe orçamento

Para boa parte das profissões técnicas, **o trabalho não começa por um agendamento — começa por
um orçamento.** Fluxo: pedido → visita técnica (ou orçamento remoto) → aprovação → execução →
cobrança. Hoje o produto começa no agendamento.

*(A família já resolveu isso uma vez: o StarkOS tem orçamento com aprovação por link em
`/aprovar/<token>`. Padrão provado, não precisa ser inventado.)*

### G7 · Não há módulos por tenant

Tudo que existe está ligado para todo mundo. Um eletricista não precisa de anamnese, clube de
assinatura, nem ficha de saúde. Pior: **anamnese e dado de saúde ligados por padrão para quem
não é da saúde é passivo de LGPD sem contrapartida.**

### G8 · O onboarding pergunta "qual sua vertical" entre 8 opções de beleza

`src/app/onboarding/formulario.tsx` lista Cílios, Unhas, Barbearia, Sobrancelhas, Estética,
Depilação, Tatuagem, Cabelo. É a porta de entrada — e ela diz, na cara do eletricista, que o
produto não é para ele.

### G9 · Os planos têm nome de beleza

`plan_tier as enum ('start','pro','studio','network')` — "studio" e "network" são vocabulário de
salão. Mesmo problema de enum do G1.

### G10 · Os modelos de WhatsApp são de salão — e é o pior dos dez

`src/server/services/mensagens-prontas.ts` traz 10 modelos prontos. **Oito deles assumem que o
cliente vem até você:**

```
"seu horário na {{negocio}}"        "Te espero na {{negocio}}"
"não aparece na {{negocio}}"        "Passa aqui esse mês"
"Obrigado pela visita"              "aqui na {{negocio}}"
"cliente da casa"                   "segura essa casa"
```

E um deles — *"Qualquer ajuste nos primeiros dias é por nossa conta"* — é literalmente o conceito
de **retoque de unha/cílios**, que não existe em elétrica nem em faxina.

Três agravantes que fazem esta lacuna ser mais séria que as outras nove:

1. **É o canal que mais importa.** Não é uma tela interna: é o texto que sai do produto e chega
   no cliente final por WhatsApp.
2. **São semeados na primeira leitura da tela** (decisão consciente, documentada no arquivo:
   faz negócio antigo ganhar a biblioteca sem migration) — ou seja, **um eletricista que se
   cadastrar hoje recebe automaticamente 10 mensagens escritas para um salão**, já como linhas
   dele, prontas para enviar.
3. **Vira dado do tenant depois de semeado**, então corrigir o padrão depois **não conserta quem
   já recebeu** — a correção precisa vir junto com a virada, não depois.

**Vira:** modelos de mensagem passam a fazer parte do pack de profissão (§3.3), com variante por
eixo 1 (*"Te espero"* para quem recebe, *"Chego às"* para quem vai até o cliente).

### G11 · Um atendimento não pode passar de 12 horas

```sql
duration_min int not null check (duration_min between 5 and 720)
```

720 minutos. A diária de faxina (8h) cabe — foi por isso que a §1 a citou como vitória. Mas
**trabalho de vários dias não cabe de jeito nenhum**: pintor com serviço de 3 dias, instalação
elétrica de 2 dias, reforma, ensaio fotográfico com edição e entrega depois.

Não é caso de aumentar o teto: um serviço de 3 dias **não é um bloco de 72h na agenda** — o
profissional dorme, atende outra coisa no meio, e a agenda precisa mostrar isso. É um **trabalho
com várias sessões**, que é conceito diferente de agendamento e diferente de série recorrente
(§12): a série repete indefinidamente, o trabalho tem começo, fim e um valor só.

Afeta diretamente duas das 12 profissões do lançamento (eletricista e fotógrafo) e o grupo
inteiro de "casa e manutenção" que vem depois. **Decisão a tomar:** ou o primeiro corte assume
"só serviço que cabe num dia" e diz isso na cara, ou entra o conceito de trabalho multi-sessão.
Recomendo assumir o limite no primeiro corte e registrar — é honesto e não trava as 12.

### G12 · O cliente não consegue cancelar nem remarcar sozinho

`confirmacao-token.ts` expõe exatamente duas funções: `gerarTokenConfirmacao` e
`verificarTokenConfirmacao`. O link que vai no WhatsApp **só confirma**. Quem precisa desmarcar
tem que ligar, mandar mensagem, ou simplesmente não aparecer.

Isso briga com a tese central do próprio produto: o CICLO existe para reduzir falta e trazer
cliente de volta, e **a falta mais barata de evitar é a que o cliente avisa**. Um botão
"preciso remarcar" no mesmo link devolve a vaga para a agenda em vez de queimá-la — e, para quem
vai até o cliente, evita deslocamento perdido, que é prejuízo de verdade, não só buraco na
agenda.

O `no_show_score` já existe para *prever* a falta. Faltou o caminho mais simples de *evitá-la*.

### G13 · O agendamento público não pergunta onde é o serviço

`public-booking.ts` lê `tenant.address` — o endereço **do negócio**, para mostrar ao cliente. Em
nenhum ponto do fluxo público se pergunta **o endereço do cliente**.

É a outra metade do G3, e é a metade que aparece primeiro: para faxineira, eletricista,
encanador e jardineiro, um agendamento sem endereço **é um agendamento inútil** — o profissional
recebe "quinta, 14h" e não sabe para onde ir. Sem isso, a página pública (que é o principal valor
do primeiro dia, §8) não serve a metade do catálogo.

---

## 3. A decisão central: profissão é dado

> **Nenhum arquivo em `src/` pode saber o que é uma faxineira.**
> A profissão entra por tabela, o vocabulário entra por token, e o comportamento entra por
> quatro eixos (§4). Se uma profissão nova exigir tocar em componente, **é bug de arquitetura**
> — falta um eixo ou falta um token.

É a mesma regra que a família já usa no Stark Base ("se um reskin exigiu tocar no motor, é bug
do template"), aplicada a um produto multi-tenant de verdade.

**Trava sugerida:** teste que varre `src/` procurando nome de profissão em texto visível e
reprova o build. Barato, e impede a regressão silenciosa que sempre acontece na pressa.

### 3.1 O que o vocabulário precisa cobrir

| Token | Beleza | Faxina | Elétrica | Aula | Vet |
|---|---|---|---|---|---|
| `cliente` | cliente | cliente | cliente | aluno | tutor |
| `atendimento` | atendimento | faxina | serviço | aula | consulta |
| `profissional` | profissional | profissional | técnico | professor | veterinário |
| `serviço` | serviço | serviço | serviço | matéria | procedimento |
| `local` | salão | — | obra | — | clínica |
| `agenda` | agenda | agenda | agenda | grade | agenda |

### 3.2 O problema do português — e a saída barata

Português tem gênero e número em tudo: *"Nenhum**a** client**e** ainda"*, *"3 alun**o**s
selecionad**o**s"*, *"a faxineira"* / *"o faxineiro"*. Um sistema de tokens ingênuo produz
"Nenhuma aluno" no primeiro dia.

Duas saídas:

1. **Cara:** cada token guarda `{singular, plural, gênero}` e toda string passa por um
   compositor que faz concordância. Funciona, mas contamina todo o código de interface e é
   fonte infinita de bug bobo.
2. **Barata, e a que recomendo:** **regra de copy que dispensa concordância.** Em vez de
   "Nenhuma cliente ainda" → *"Sem clientes ainda"*. Em vez de "3 selecionadas" → *"3
   marcados"*… ou melhor: *"Avisar 3"*. Em vez de "Próxima cliente" → *"A seguir"*.

A opção 2 resolve ~90% dos casos, deixa o texto **mais curto e melhor**, e só os poucos casos
irredutíveis usam `{singular, plural, gênero}`. **Escrever para não precisar de concordância é
uma disciplina de redação, não uma feature** — e é mais barata que qualquer motor de i18n.

> Efeito colateral bom: as 13 strings do G2 já melhoram como texto. "A seguir" é melhor que
> "Próxima cliente" mesmo num salão.

### 3.3 O esquema (esboço)

Sem isto, P0 não é executável — é intenção, não plano.

```sql
-- catálogo global, mesmo padrão de vertical_packs: leitura pública, escrita só pelo servidor
create table professions (
  id                uuid primary key default gen_random_uuid(),
  slug              citext not null unique,
  nome              text not null,
  grupo             text not null,              -- beleza | casa | saude | fitness | educacao | pet | eventos | profissional
  sinonimos         text[] not null default '{}',   -- "diarista" acha faxina (§7 passo 2)
  -- os 4 eixos de §4
  onde              text not null,              -- no_local | vai_ate | remoto | hibrido
  cobranca          text not null,              -- fixo | hora | visita_hora | diaria | orcamento | pacote | recorrente
  inicio            text not null,              -- direto | solicitacao | orcamento_antes
  ritmo             text not null,              -- avulso | recorrente | sazonal | sob_demanda
  -- configuração
  vocab             jsonb not null,             -- §3.1
  duracao_padrao_min int not null,
  ciclo_padrao_dias int not null,
  modulos_padrao    jsonb not null,             -- §6
  campos_ficha      jsonb not null default '[]',
  mensagens         jsonb not null default '[]',-- G10: modelos por profissão
  ativa             boolean not null default true
);

create table profession_services (
  profession_id     uuid not null references professions(id) on delete cascade,
  nome              text not null,
  duracao_min       int not null,
  preco_sugerido_cents bigint not null,
  ciclo_dias        int,
  posicao           int not null default 0
);

-- tenants ganha:
--   profession_id uuid references professions(id)
--   vocab_override jsonb not null default '{}'   (o dono pode reescrever qualquer rótulo)
--   onde/cobranca/inicio/ritmo  (copiados da profissão, editáveis depois)
--   professions_extra uuid[]    (profissão não é porta de mão única, §5)

create table tenant_modules (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  modulo      text not null,
  ligado      boolean not null,
  origem      text not null,      -- 'plano' | 'dono' — o que bloqueou, para a tela explicar (§6)
  primary key (tenant_id, modulo)
);
```

Cuidados que valem para as duas tabelas de catálogo: RLS ligada com `select using (true)` e
**nenhum grant de escrita** para `anon`/`authenticated` — é o mesmo desenho de `vertical_packs`,
e a função que aplica o pack precisa manter o `revoke execute` da migration `0004` (§14).

### 3.4 Como o vocabulário chega no código

O ponto que decide se P1 funciona ou vira gambiarra espalhada:

- O vocabulário efetivo é `professions.vocab` **mesclado campo a campo** com
  `tenants.vocab_override` — mesmo padrão do `getEffectiveBrand()` do Stark Base: override nunca
  sobrescreve com vazio, e falha de banco cai no padrão em vez de derrubar a tela.
- Resolvido **uma vez por requisição**, no contexto do tenant que já existe, e entregue junto —
  não pode virar uma consulta nova por componente.
- **Precisa chegar aos dois lados**: interface *e* servidor. Os modelos de mensagem (G10), o
  texto da página pública, os e-mails e os PDFs bebem da mesma fonte. Vocabulário que só existe
  no cliente resolve metade do problema e cria a outra metade.
- Um único ponto de leitura na interface. Se aparecerem dois jeitos de pegar o rótulo, em três
  meses existem quatro.

---

### 3.5 Uma fronteira que precisa estar escrita: sem identidade de cliente entre tenants

`clients.user_id` existe hoje ("se criou conta no app da cliente"). É tentador, num produto
multiprofissão, deixar o cliente final ter **uma conta só** que enxerga a manicure, o
eletricista e o veterinário dele.

**Não.** No momento em que existe identidade de cliente atravessando tenants, o produto vira
marketplace por acidente: aparece busca, aparece descoberta, aparece disputa por quem é dono do
relacionamento — e o §17 (não virar marketplace) vira letra morta sem ninguém ter decidido nada.

**Decisão:** cada tenant é dono da própria lista de clientes. O cliente final não precisa de
conta para nada essencial (agendar, confirmar, aprovar orçamento e avaliar funcionam por link
com token — padrão que o produto já usa). Se um dia isso mudar, que seja uma decisão explícita,
com esta seção sendo revogada por escrito.

---

## 4. Os quatro eixos — o coração do modelo

Toda profissão de serviço com agenda é um ponto neste espaço. É o que torna "todos os
profissionais" tratável.

### Eixo 1 · Onde acontece
`no_local` (cliente vem) · `vai_ate_o_cliente` · `remoto` · `hibrido`

Muda: endereço, deslocamento, raio de atendimento, link de vídeo.

### Eixo 2 · Como cobra
`fixo` · `por_hora` · `visita_mais_hora` · `diaria` · `orcamento` · `pacote` · `recorrente`

Muda: tela de preço, comanda, o que aparece na página pública.

### Eixo 3 · Como começa
`agendamento_direto` · `solicitacao_com_aprovacao` · `orcamento_antes`

> Este eixo é mais importante do que parece. **Psicólogo, advogado e médico não deixam
> desconhecido marcar direto na agenda** — querem receber um pedido e aprovar. Hoje o produto só
> sabe fazer agendamento direto. Sem este eixo, várias profissões de alto valor ficam de fora.

**Modo solicitação, especificado** (é barato e destrava um grupo inteiro do catálogo):

- A página pública mostra os horários e o cliente **pede** um deles; o texto diz "pedido de
  horário", nunca "confirmado".
- O horário entra como `pending` **segurando a vaga** por um prazo configurável — o mecanismo
  já existe: `appointments.hold_expires_at`, hoje usado para reserva aguardando sinal.
- O profissional recebe **push** (o módulo de push existe, TICKET-056) e aprova ou recusa em um
  toque, com opção de sugerir outro horário.
- Aprovou → vira `confirmed` e dispara a confirmação por WhatsApp. Recusou ou expirou → a vaga
  volta para a agenda automaticamente.
- Configurável por serviço, não só por tenant: a primeira consulta pede aprovação, o retorno de
  quem já é cliente pode ser direto.

Reaproveita `hold_expires_at`, o estado `pending`, push e a mensageria — **nenhuma peça nova de
infraestrutura.** É a razão de este eixo ser prioridade alta com custo baixo.

### Eixo 4 · Com que ritmo
`avulso` · `recorrente` · `sazonal` · `sob_demanda`

Muda: se o Motor de Ciclo **aprende** o intervalo (avulso) ou se ele é **contratado**
(recorrente) — ver §9.

### Exemplos preenchidos

| Profissão | Onde | Como cobra | Como começa | Ritmo |
|---|---|---|---|---|
| Barbeiro | no local | fixo | direto | avulso |
| Faxineira | vai até | diária | direto | **recorrente** |
| Eletricista | vai até | visita+hora | **orçamento antes** | sob demanda |
| Personal | híbrido | pacote | direto | recorrente |
| Psicólogo | híbrido | fixo | **solicitação** | recorrente |
| Fotógrafo | vai até | orçamento | orçamento antes | sazonal |
| Professor particular | híbrido | por hora | solicitação | recorrente |
| Veterinário | no local | fixo | direto | avulso + sazonal (vacina) |
| Jardineiro | vai até | fixo | direto | recorrente |
| Manicure | no local | fixo | direto | avulso |

**Nenhuma dessas linhas exige código próprio.** É esse o teste do modelo.

---

## 5. Catálogo de profissões — 12 no lançamento, não 40

⚠️ **Correção de rota em relação à primeira versão deste documento**, que propunha ~40 profissões
de largada. Estava errado, e contradizia o próprio risco do §18: **40 profissões rasas é
exatamente como se vira "produto de ninguém".**

O que faz o pack funcionar não é existir — é o serviço vir com **nome, duração e preço que a
pessoa da área reconhece como certos**. Isso é pesquisa, não `INSERT`. Um eletricista que abre o
app e vê "Instalação de tomada · 40 min · R$ 90" entende na hora que o produto é dele. O mesmo
eletricista vendo "Serviço 1 · 60 min · R$ 100" fecha o app.

**Lançamento — 12 profissões, escolhidas para cobrir os 4 eixos, não por popularidade:**

| Profissão | Cobre o quê |
|---|---|
| Barbearia, manicure, cabeleireiro | a base atual, que não pode regredir |
| **Faxina/diarista** | vai até o cliente + diária + **recorrente** |
| **Eletricista** | vai até + visita+hora + **orçamento antes** |
| Encanador | idem, valida que o pack de "casa" generaliza |
| **Personal trainer** | híbrido + pacote + recorrente |
| **Psicólogo** | remoto/híbrido + **solicitação com aprovação** |
| Professor particular | por hora + recorrente + híbrido |
| **Fotógrafo** | orçamento + sazonal + vai até |
| Banho e tosa | no local + avulso, fora da beleza humana |
| Jardineiro | vai até + recorrente + sazonal |

Se essas 12 funcionam sem código específico, **o modelo está provado** e o resto do catálogo
vira trabalho de conteúdo em lote, sem risco de arquitetura.

**Mas "existir" e "estar pronta para vender" são coisas diferentes** — e a §1.1 (nenhum cliente
pagante ainda) obriga a separar as duas:

| Profundidade | Quantas | O que significa |
|---|---|---|
| **Profunda** | 3 | preço e duração pesquisados com gente da área, modelos de WhatsApp escritos à mão, página pública revisada. É o que se leva para vender |
| **Rasa** | 9 | serviços plausíveis, sem pesquisa de campo. Existem para **provar os 4 eixos**, não para conquistar cliente |

As 3 profundas do primeiro teste de mercado: **faxina/diarista** (volume, recorrência nativa,
dor de agenda real), **eletricista** (ticket alto, orçamento, ninguém organiza) e **uma das
três de beleza** (é onde já há conhecimento acumulado e onde a base atual está). Se nenhuma das
três converter, o problema não é o catálogo — e escrever as outras 9 em profundidade não teria
consertado nada.

**Os outros 8 grupos** (saúde, fitness, educação, pet, eventos, serviços profissionais, casa
completa, beleza completa) entram **por demanda medida**, não por palpite: o campo **"Outro"**
do onboarding é texto livre, e o que as pessoas digitam ali **é a fila de priorização**. É
pesquisa de mercado de graça, e evita escrever 28 packs que ninguém pediu.

**Regra:** profissão **não é porta de mão única.** Quem entra como "faxineira" pode adicionar
"passadeira" depois; quem é "cabeleireiro" pode virar "cabeleireiro + estética". O tenant tem
uma profissão principal e pode ter secundárias.

---

## 6. Módulos — o que liga e desliga

O que o usuário pediu: *"ajustar funcionalidades nas configurações de cada compra"*.

| Módulo | Padrão | Observação |
|---|---|---|
| Agenda | **sempre ligado** | é o produto |
| Motor de Ciclo | **sempre ligado** | é o diferencial |
| Página pública | ligado | pode ser desligada por quem não quer agenda aberta |
| Clientes / CRM | ligado | |
| Lembrete e confirmação | ligado | |
| Recorrência | por eixo 4 | ligado se o ritmo é recorrente |
| Orçamento | por eixo 3 | |
| Deslocamento e rota | por eixo 1 | só para quem vai até o cliente |
| Comanda e caixa | por profissão | |
| Estoque | desligado | poucos precisam |
| Fidelidade / pontos | desligado | |
| Assinatura / clube | desligado | |
| Campanhas | ligado | |
| Equipe e comissão | desligado no modo solo | |
| **Anamnese e dado de saúde** | **desligado** | ⚠️ só liga por escolha explícita, com o texto de consentimento certo. Dado de saúde ligado para quem não é da saúde é passivo de LGPD sem contrapartida |
| Documentos e contratos | desligado | futuro |

Duas fontes de verdade combinadas: **plano** (o que a assinatura libera) e **escolha do dono**
(o que ele quer ver). O que estiver fora do plano aparece bloqueado com o motivo — nunca some
sem explicação.

**Modo solo:** quando o tenant tem 1 profissional, toda a interface de equipe, atribuição e
comissão **desaparece**. Um autônomo não deveria ver "atribuir profissional" nunca.

---

## 7. Onboarding de 3 minutos — o mecanismo de venda

O momento que decide se a pessoa fica: ela precisa sair da primeira sessão **com um link
funcionando para mandar no WhatsApp**. Esse é o "aha".

| # | Passo | Detalhe |
|---|---|---|
| 1 | Criar conta | e-mail ou telefone |
| 2 | **"O que você faz?"** | busca com sinônimos ("diarista" acha faxina, "eletricista predial" acha eletricista), agrupada, com "Outro" |
| 3 | Nome do negócio | slug sugerido automaticamente, editável, com checagem de disponibilidade ao vivo |
| 4 | Onde atende | pré-preenchido pelo eixo 1 da profissão — só confirma |
| 5 | Serviços | **já vêm preenchidos** pelo pack, com preço e duração realistas. Editar inline, apagar, adicionar |
| 6 | Horários | pré-preenchidos (seg–sex 9–18), editar em um toque |
| 7 | Marca | logo (opcional) e cor. Sem logo → monograma gerado |
| 8 | **Pronto** | mostra o link público, com botão "copiar" e "mandar no WhatsApp" |

**Regras:**
- Todo passo depois do 3 é **pulável**. Quem quer ver o produto agora vê o produto agora.
- O onboarding **nunca** é um formulário longo numa tela só.
- O link público funciona **antes** de qualquer configuração fina.
- Se a pessoa abandonar no meio, a conta continua válida e ela cai no "Hoje" com um cartão
  "termine de configurar" — não perde nada.

---

## 8. Personalização — o que o dono controla sozinho

**Identidade:** nome, logo, cor de destaque, capa, tagline, endereço, telefone, WhatsApp,
Instagram, horários, política de cancelamento.

**Página pública = o site que ele não tem.** Para a maioria dos autônomos, isso é o principal
valor entregue no primeiro dia: hoje eles têm só o Instagram. A página precisa entregar
serviços com preço (ou "sob orçamento"), fotos do trabalho, avaliações, WhatsApp, endereço/área
de atendimento e o botão de agendar.

> Isso conecta com `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §10: **dentro do app a cor é do
> CICLO; na página pública a cor é do negócio.** A decisão já está tomada e vale exatamente
> aqui — a marca do eletricista manda na página dele, e o instrumento continua neutro.

**Agenda:** horários, intervalos, folgas, antecedência mínima, janela máxima, política de
sinal, quem pode marcar direto e quem precisa de aprovação.

**Link por profissional:** numa equipe, cada profissional tem o próprio link — é o que faz cada
barbeiro divulgar o próprio, e é argumento direto do plano de equipe.

---

## 9. O Motor de Ciclo universal

A parte que **melhora** com a virada. O motor deixa de ter um modo e passa a ter dois:

| Modo | Quando | Como funciona |
|---|---|---|
| **Aprendido** | ritmo `avulso` | o que já existe: aprende o intervalo de cada cliente e detecta quem atrasou |
| **Contratado** | ritmo `recorrente` | o intervalo é o contrato ("toda terça"). Falhou uma ocorrência = **alerta imediato**, não "talvez tenha sumido" |

A diferença entre os dois é grande na prática: a faxineira que perdeu a terça-feira precisa
saber **hoje**; a cliente de manicure que não voltou em 40 dias é uma conversa de nutrição.

E a expansão do vocabulário do ciclo é o que vende para as profissões novas:

| Profissão | O que o Motor de Ciclo faz |
|---|---|
| Eletricista | manutenção preventiva anual, revisão de quadro |
| Dentista | retorno de 6 meses |
| Veterinário | vacina anual, vermífugo, banho mensal |
| Faxineira | faxina semanal que falhou |
| Personal | aluno que parou de aparecer |
| Jardineiro | poda sazonal |
| Contador | obrigação mensal |

**Uma coisa a não perder de vista:** hoje o produto se vende como "SaaS de beleza com Motor de
Ciclo". Depois da virada, ele se vende como **"o sistema que faz seu cliente voltar"** — que é
uma promessa maior e mais fácil de explicar.

---

## 10. Deslocamento e rota

Para quem vai até o cliente, agendar 9:00 no centro e 10:00 do outro lado da cidade é um produto
quebrado.

**A parte elegante:** `services.buffer_before_min` e `buffer_after_min` **já existem**. O tempo
de deslocamento pode morar neles, calculado por agendamento — o motor de conflito
(`appointments_no_overlap`) passa a proteger o deslocamento **de graça**, sem conceito novo.

O que precisa entrar, **em duas etapas de custo muito diferente**:

**P2.5 — barato, e é pré-requisito de faxina e eletricista (G3+G13):**
- endereço estruturado no **agendamento**, não só no cliente (a mesma cliente pode ter dois imóveis)
- o campo no formulário público — sem ele o agendamento chega sem destino
- o endereço visível na agenda e no card do dia, com link para abrir no mapa do celular
- buffer fixo configurável por profissional ("reservo 30 min entre atendimentos")

**P9 — caro, e adiado de propósito:**
- `lat`/`lng` e geocodificação
- área de atendimento (raio ou lista de bairros) → a página pública recusa endereço fora
- estimativa de deslocamento entre agendamentos consecutivos → buffer **automático**
- aviso ao marcar algo geograficamente impossível
- "meu dia" em ordem de rota, não só em ordem de horário
- taxa de deslocamento como item de cobrança

**Decisão a tomar antes de P9:** geocodificação custa (Google/Mapbox) ou é imprecisa (gratuita).
O buffer fixo de P2.5 resolve boa parte do problema com uma fração do custo — e só a experiência
com cliente real diz se o buffer automático vale o preço.

---

## 11. Orçamento com aprovação por link

Fluxo: pedido (público ou manual) → orçamento montado no painel → **link enviado por WhatsApp**
→ cliente aprova/recusa sem instalar nada → aprovado vira agendamento → execução → cobrança.

Detalhes que a família já aprendeu (StarkOS): rota de token precisa de
`Referrer-Policy: no-referrer` (senão o token vaza no header ao clicar pelo WhatsApp), e
**orçamento sem valor visível é assinatura em branco** — na tela de aprovação o valor aparece.

Bônus barato e de alto valor: orçamento aprovado com **validade** ("vale por 15 dias") e
lembrete automático de orçamento parado — é receita que já estava na mesa.

---

## 12. Recorrência de verdade

Fecha o G4. Requisitos que separam recorrência boa de ruim:

- **Série** com regra (toda terça 14h; a cada 15 dias; primeira segunda do mês)
- Alterar **uma ocorrência** não quebra a série; alterar a série pergunta "só esta ou todas?"
- **Fim** da série: data, número de ocorrências ou sem fim
- Feriado e folga do profissional **deslocam ou pulam** a ocorrência, com aviso
- Cancelar uma ocorrência ≠ cancelar o contrato
- A série alimenta o Motor de Ciclo no modo contratado (§9)
- Cobrança recorrente é assunto separado (§13) — não misturar agenda com financeiro

---

## 13. Planos e cobrança

⚠️ **Decisão de negócio, não técnica — quem define é o Eduardo.** Este documento só registra as
quatro regras de engenharia que valem independentemente do preço escolhido:

1. **Nunca prender dado.** Cair de plano limita funcionalidade — nunca esconde nem apaga cliente
   e histórico. Além de correto, é o que evita processo e review ruim.
2. **Bloqueio por plano sempre mostra o motivo e o caminho**, nunca some da tela (§6).
3. Os nomes atuais (`start/pro/studio/network`) têm cheiro de salão **e são `enum`** — mesmo
   problema do G1/G9, mesma solução.
4. A cobrança depende do Asaas, **bloqueado por credencial** (tickets 031/032/033/043). O plano
   não pode fingir que isso está resolvido — é a razão de P11 ser a última fase.

A única decisão de plano que é *também* de produto está na §13.1, porque muda o que se constrói.

### 13.1 O plano grátis é canal de distribuição, não só isca

Aqui está a parte que a primeira versão deste documento não tinha, e que responde ao "**para
vender**" do pedido original: um SaaS de autônomo não se vende por anúncio — o CAC não fecha.
Ele se vende **pelo próprio uso**. Três mecanismos, e todos são *funcionalidade*, não marketing:

- **Assinatura na página pública.** Todo agendamento no plano grátis acontece numa página com
  "feito com CICLO". Quem agenda é outro profissional, é parente, é vizinho — e uma parcela
  deles também tem agenda para organizar. É o laço de distribuição mais barato que existe, e é
  literalmente o motivo de o plano grátis existir.
- **O link é o produto.** A pessoa manda o link no status do WhatsApp, na bio do Instagram, no
  grupo do bairro. Cada envio é impressão. Por isso o onboarding (§7) termina **no link com
  botão de copiar**, e não numa tela de "parabéns".
- **Indicação com contrapartida dos dois lados** — um mês para quem indica e para quem entra.
  Barato de construir (o produto já tem `clients.referred_by` e bônus de indicação
  implementados) e é o canal que funciona em categoria de autônomo, onde as pessoas se conhecem
  por ofício e por bairro.

**Consequência de produto:** a marca na página pública precisa ser **discreta e bonita**, não um
banner. Feia, o profissional paga só para removê-la e o laço se fecha uma vez; boa, ela circula
e traz gente. Isso conecta direto com `08-REDESIGN-E-IDENTIDADE.md` §10 — na página pública a
cor é do negócio, e o CICLO é só um selo no rodapé.

---

### 13.2 Como saber se funcionou

A primeira versão deste plano tinha só critério técnico. Falta o que importa para um SaaS —
e nada disso é medido hoje:

| Métrica | Por que essa | Alvo inicial |
|---|---|---|
| **Ativação** — % que sai do cadastro com serviço + horário + link | é o único número que diz se o onboarding funciona | > 60% |
| **Tempo até o link pronto** | é a promessa do §7, e vira critério de aceite (§16.4) | < 3 min (mediana) |
| **Tempo até o 1º agendamento real** | ativação de verdade é alguém marcando, não a config | < 7 dias |
| **% que compartilha o link** | mede o laço da §13.1 | — |
| Retenção em 30/90 dias | churn de autônomo é alto e precisa de linha de base | — |
| Onde o onboarding é abandonado, passo a passo | diz o que consertar em vez de adivinhar | — |
| O que digitam em "Outro" | é a fila do catálogo (§5) | — |

**Instrumentar o funil de onboarding entra em P4** — medir depois de construir é como a maioria
dos produtos descobre tarde demais que a ativação é 12%.

---

## 14. Migração dos tenants de beleza que já existem

Não pode quebrar quem já usa.

1. `professions` nasce **populada com as 8 verticais atuais**, com os mesmos slugs.
2. `tenants.profession_id` é preenchido a partir de `tenants.vertical` (mapeamento 1:1).
3. `tenants.vertical` **fica** por um ciclo, como coluna redundante, e só sai depois que nada
   mais a lê. Enum não se apaga com pressa.
4. Vocabulário e módulos recebem o padrão da profissão — **nenhum tenant existente muda de
   comportamento** no dia da migração.
5. `apply_vertical_pack()` vira `apply_profession_pack()` mantendo a idempotência e o
   `revoke execute from anon, authenticated` (a correção de segurança da migration `0004`
   **não pode se perder na renomeação** — função `SECURITY DEFINER` que escreve, exposta pelo
   PostgREST, foi um furo real neste projeto).

---

## 15. Plano de execução

| Fase | O que | Risco | Depende de |
|---|---|---|---|
| **P−1 · Higiene** | limpar o resíduo de teste do banco (§1.1) e decidir se dev ganha projeto próprio | Baixo | ✅ 2026-08-19: 76 tenants de teste removidos (78→2, só `dom-rocha` e `ruivo-barber` reais ficaram). Achado ao executar: 3 FKs sem índice simples causavam timeout no cascade — migration `0021_indices_fk_orfas` corrigiu; decisão sobre projeto Supabase próprio para dev segue aberta |
| **P0 · Catálogo** | `professions` + `profession_services`; seed das 8 atuais; `tenants.profession_id`; migração não destrutiva (§14) | Médio | ✅ 2026-08-19 (TICKET-059): migration `0022_professions_catalog` — as 8 verticais seedadas com vocabulário/eixos, `tenants.profession_id`/`vocab_override` criados, backfill 1:1 (2/2 tenants). `vertical` intacto — nada consome `profession_id` ainda, é P1/P2. `pnpm verify` completo (369 testes unitários + 121 de isolamento RLS, as duas tabelas novas descobertas automaticamente) |
| **P1 · Vocabulário** | tokens em `professions` + merge com override (§3.4); regra de copy sem concordância (§3.2); varrer as 13 strings do G2; **os 10 modelos de WhatsApp do G10**; teste que reprova profissão cravada em `src/` | Médio | ⚠️ 2026-08-19 (TICKET-060), **parcial por decisão consciente**: as 13 strings do G2 reescritas (regra §3.2 — "A seguir", "Sem clientes ainda", "Avisar 3" em vez de concordância) e os 10 modelos do G10 reescritos sem presumir local, com teste de regressão (`tests/unit/server/mensagens-prontas.test.ts`, 12 casos). **O mecanismo de merge `professions.vocab`+`vocab_override` e o teste-guarda "profissão cravada em `src/`" ficaram de fora** — nada no app ainda lê `profession_id` em runtime (é P2/P3), então o guard falharia contra toda string hoje legítima. Corrigir a armadilha real (G2/G10) valia por si; trocar toda a interface para renderizar por token é trabalho de P2/P3, não encaixa nesta rodada |
| **P2 · Eixos** | os 4 eixos como colunas; comportamento derivado deles; **modo solicitação (§4 eixo 3)**, que reusa `hold_expires_at` + push | Médio | ⚠️ 2026-08-19 (TICKET-061), **parcial**: (1) migration `0023_tenant_eixos` — os 4 eixos viraram colunas em `tenants`, copiadas da profissão no backfill (2/2 tenants). (2) Fechado o buraco real do "modo solicitação": todo agendamento público já nascia `pending` (ninguém precisou construir isso), mas **nada avisava a equipe** — `notificarEquipe()` push best-effort em `criarAgendamentoPublico`, nunca derruba o agendamento se falhar (testado ponta a ponta com dispositivo morto). **Achado que corrige a leitura anterior:** não existe NENHUM caminho de auto-confirmação hoje — `professions.inicio = 'direto'` nas 8 verticais de beleza é vocabulário para quando esse modo existir, não descrição do presente. Construir o "direto" de verdade (bypass de revisão humana, precisa decidir limite de risco/sinal) fica para fase própria, não decisão a tomar dentro de uma migration de coluna |
| **P2.5 · Endereço mínimo** | fecha **G3 + G13**: endereço estruturado no agendamento, campo no formulário público, exibição para o profissional. **Sem** mapa, sem geocodificação, sem rota | Baixo | ✅ 2026-08-19 (TICKET-062): migration `0024` — `appointments.address`, texto livre, opcional pra qualquer tenant (não gated por eixo, pra não ramificar interface sem tenant real que precise ainda). Campo no formulário público (`agendar.tsx`), aceito em `criarAgendamento`/booking admin, exibido em `DetalheAgendamento` com ícone. Round-trip testado ponta a ponta (`booking-publico.test.ts`, +2 casos: com e sem endereço) |
| **P2b · Modo direto de verdade** | branch de auto-confirmação para `inicio='direto'` (hoje não existe — achado em P2). Precisa decidir limite de risco/sinal antes de bypassar revisão humana — não é migration de coluna, é decisão de produto com risco real | **Alto** | ⬜ não feito de propósito, ver nota de P2 |
| **P3 · Módulos** | `tenant_modules`, tela de configuração, modo solo | Médio | ⚠️ 2026-08-19 (TICKET-064), **parcial**: migration `0025` (`tenant_modules`, RLS igual `subscription_plans`/`message_templates`) — schema pronto, **nenhuma tela lê ainda**, mesma disciplina de P0. Modo solo (mecanismo **diferente**, deriva de `professionals.length`, não de módulo) corrigido em 2 telas reais: seletor de profissional no novo agendamento (`agenda/novo/formulario.tsx`, não existia) e confirmado que a agenda (`agenda.tsx`) já fazia isso desde antes — achado que valida o padrão em vez de inventar um novo. **Tela de configuração de módulos e sweep completo de modo solo (config/comissão) ficam de fora**, registrados como pendência |
| **P4 · Onboarding** | fluxo de 3 min (§7), busca de profissão, link público no fim, **instrumentação do funil (§13.2)** | Médio | ✅ 2026-08-20 (TICKET-072): **achado crítico na revisão geral pós-P11** — esta fase nunca tinha sido executada, e sem ela P0/P5/P7/P9/P10 inteiros ficavam inacessíveis: o cadastro só oferecia as 8 verticais de beleza (`vertical_pack` enum), sem NENHUM jeito de uma eletricista ou faxineira se cadastrar, mesmo com 17 profissões prontas no catálogo desde P0/P5. Corrigido com retrocompatibilidade total: `executarOnboarding()` ganhou `professionId?` opcional (as 38 chamadas existentes, incluindo as 34 de teste, continuam funcionando sem mudar uma linha). Migration `0031` — `vertical_pack` ganhou o valor `'general'` (pra profissão fora das 8 legadas; os poucos lugares que leem `tenant.vertical` já tinham fallback gracioso, auditado antes) + `apply_profession_pack()` (o RPC que §14 item 5 já previa, nunca construído) que planta o catálogo de `profession_services` pra profissão nova. **Decisão que evita regressão:** as 8 verticais legadas continuam usando `apply_vertical_pack()` (catálogo mais rico e testado em `vertical_packs`) mesmo quando escolhidas via `professionId` — só profissão NOVA usa o RPC novo, senão nail/lashes/etc perderiam catálogo real por um catálogo vazio. Onboarding UI reescrita: busca de verdade (usa `professions.sinonimos`, ex. "diarista" acha "faxina" — coluna que existia desde a migration 0022 e nunca tinha sido lida) em vez do dropdown de 8 itens fixo. Verificado ao vivo, cadastro real do zero: login → busca "eletric" → seleciona Eletricista → nome do negócio → Criar — caiu em `/admin/hoje` com os 5 serviços reais de eletricista (P5) já cadastrados, `profession_id`+eixos corretos no tenant (`vai_ate`/`visita_hora`/`orcamento_antes`/`sob_demanda`), página pública `/carlos-eletricista` funcionando e agendável. **Instrumentação do funil (§13.2) ficou de fora desta rodada** — registrado em §19: dá pra medir "tempo até o link pronto" e "tempo até o 1º agendamento" com os timestamps que já existem (`tenants.created_at`, `appointments.created_at`), sem instrumentação nova; o que exigiria tracking de verdade ("onde abandona passo a passo", "% que compartilha o link") é trabalho maior, sem tráfego real ainda pra medir (P−1: zero clientes pagantes) |
| **P5 · Catálogo** | **3 profissões profundas + 9 rasas** (§5) | Médio — as 3 são pesquisa, não `INSERT` | ✅ 2026-08-19 (TICKET-065): migration `0026` — **barber** (profunda de beleza) ganhou os 6 serviços do catálogo real do `dom-rocha` (não inventados); **faxina** e **eletricista** (profundas novas) com 4 e 5 serviços, preço/duração de mercado brasileiro plausível; mais 7 rasas (encanador, personal, psicólogo, professor, fotógrafo, banho e tosa, jardineiro), 1-2 serviços cada. 17 profissões no catálogo (8 de beleza pré-existentes + 9 novas). Teste de integridade novo (`catalogo-profissoes.test.ts`, 7 casos) trava preço/duração > 0, nome não-genérico, e os 4 eixos preenchidos em toda profissão — nada na aplicação lê a tabela ainda, então sem esse teste uma migration futura poderia corromper o catálogo sem ninguém notar |
| **P5.5 · Cliente se resolve sozinho** | fecha **G12**: cancelar e remarcar pelo mesmo link do WhatsApp, devolvendo a vaga à agenda | Baixo | ✅ 2026-08-19 (TICKET-063): novo `POST /api/v1/public/appointments/cancel/[token]`, mesmo token HMAC do TICKET-030 (nunca precisou de tabela nova — o token já autoriza qualquer ação sobre aquele agendamento, não só confirmar). "Remarcar" **não** ganhou fluxo próprio — vira cancelar + link "Marcar outro horário" pra página pública já existente, decisão de escopo pra não duplicar a UI de escolha de horário dentro de uma página sem sessão. A tela `/confirmar/[token]` parou de disparar a confirmação sozinha ao abrir (agora é escolha: "Vou sim" / "Preciso desmarcar") — com duas ações possíveis, disparar uma automaticamente deixou de fazer sentido |
| **P6 · Marca e página** | personalização + página pública como mini-site (§8) + **assinatura discreta do plano grátis (§13.1)** | Médio | ✅ 2026-08-19 (TICKET-066): **avaliações** — `client_reviews` existia desde a migration `0020` mas só era lida no painel; a página pública prometia isso desde que o plano foi escrito. `perfilPublico()` ganhou `reviews.{average,count,recentes}` (média conta **todas** as notas, não só a amostra exibida — senão mentiria); seção nova em `secoes.tsx` (estrelas + até 5 comentários com texto), some sozinha com 0 avaliações. Verificado ao vivo contra o banco real: `dom-rocha` (1 avaliação) mostra completo, `ruivo-barber` (0) esconde a seção sem quebrar layout. **"Feito com CICLO"** já existia sem condição nenhuma — decidi **não** amarrar isso a `tenant.plan` agora, porque cobrança (Asaas) está bloqueada e todo tenant hoje é "grátis" por definição; virar `if (tenant.plan === 'gratis')` seria código morto sem ninguém pra testar o caminho pago. **Fotos/galeria** ficaram de fora desta rodada: exigem um filtro de consentimento (LGPD, imagem de cliente) que o plano ainda não desenhou — registrado em §19, não é esquecimento. A pergunta de marca única vs. marca recortada (final desta seção) segue **sem resposta**, mas não bloqueou P6: nada do que foi construído (avaliações, watermark) depende dela |
| **P7 · Recorrência** | fecha o G4 (§12) | **Alto** | ✅ 2026-08-20 (TICKET-067): `appointment_series` (migration `0027`) — a coluna `appointments.recurrence_id` existia desde a `0001` sem tabela-mãe nem gerador (achado, grep confirmou zero uso); agora tem FK de verdade. Gerador puro em `src/core/recurrence/gerar-ocorrencias.ts` cobre os 3 padrões do §12 (semanal/quinzenal, a cada N dias, enésimo dia da semana no mês — inclusive "última do mês" em mês sem 5ª ocorrência) — 13 testes unitários. `plantarOcorrencias` (server) planta até 26 ocorrências por rodada, num horizonte de 90 dias, **pulando** (não deslocando — decisão registrada abaixo) o que cai em folga do profissional ou colide com outro agendamento, sem derrubar o resto da série se uma data falhar. Cancelar a série (`POST /api/v1/appointments/series/[id]/cancel`) cancela só as ocorrências futuras ainda pendentes — o que já foi concluído ou já cancelado individualmente fica intacto; cancelar **uma** ocorrência (endpoint que já existia) nunca toca a série, porque cada ocorrência é uma linha normal de `appointments`. UI mínima: toggle "Repetir" no formulário de novo agendamento (weekday vem da própria data/hora escolhida, sem campo duplicado). 8 testes de integração + 3 de RLS a mais (127 no total). Verificado ao vivo: série de 8 ocorrências semanais criada pelo formulário, plantada certinha no banco (24/08 a 12/10, 10:00 local). **Não construído nesta rodada:** tela de gestão listando séries ativas com botão de cancelar — hoje cancelar uma série só é possível via API direta ou SQL; registrado em §19 |
| **P8 · Orçamento** | fluxo + aprovação por link (§11) | Médio | ✅ 2026-08-20 (TICKET-068): `quotes`/`quote_items` (migration `0028`), token HMAC próprio (`orcamento-token.ts`, escopo `orcamento`, mesma família do de confirmação) com validade técnica generosa (180 dias) independente da validade de NEGÓCIO (`valid_until`, checada em `orcamentoExpirado()` no core) — as duas nunca podem se confundir. Painel: `/admin/orcamentos/novo` (itens dinâmicos, `MoneyInput`, validade 7/15/30 dias ou sem fim), entrada pela ficha da cliente ("Criar orçamento", ao lado de "Marcar horário"). **Envio por WhatsApp é link manual (`wa.me`)**, não Cloud API — decisão consciente, registrada em DECISOES.md: exigiria template pré-aprovado pela Meta, que esta sessão não tem como configurar; o mesmo padrão já usado no botão "Falar no WhatsApp" da página pública. Página pública `/orcamento/[token]`: valor **sempre visível antes de qualquer botão** (§11 — "orçamento sem valor visível é assinatura em branco"), Aprovar/Recusar idempotentes (clicar 2× não quebra, mas aprovar um já recusado é erro de verdade), aviso à equipe via push best-effort (`notificarEquipe`, reaproveitado de P2.5). `Referrer-Policy: no-referrer` do §11 **não precisou de override**: o middleware global já usa `strict-origin-when-cross-origin`, que não vaza o path/token em navegação cross-origin — verificado antes de adicionar header redundante. Verificado ao vivo: orçamento de R$450 criado pelo formulário, link `/orcamento/[token]` mostrando valor+validade corretos, aprovado pelo botão, `quotes.status='approved'` confirmado no banco. **Não construído nesta rodada** (registrado em §19): tela listando orçamentos existentes (só criar tem UI; consultar status é só pelo link ou SQL) e "converter orçamento aprovado em agendamento" (fluxo termina em `approved`, não abre a agenda sozinho — decidir data/hora é uma etapa manual do profissional) |
| **P9 · Deslocamento avançado** | área de atendimento, buffer automático, ordem de rota (§10) | **Alto** | 🟡 2026-08-20 (TICKET-069): **parcial por bloqueio real, não por atalho.** A parte cara (lat/lng + geocodificação, área de atendimento, estimativa automática de deslocamento, ordem de rota, taxa de deslocamento) segue **bloqueada** — depende da decisão de negócio do §10 ("geocodificação custa ou é imprecisa"), registrada em §19, sem solução de engenharia que a contorne. Duas fatias baratas que **não** dependiam dessa decisão foram entregues: (1) achado real ao investigar — `agendamentos.ts` (fluxo de agendamento manual do painel) nunca lia `services.buffer_before_min`/`buffer_after_min` ao calcular as alternativas do 409 SLOT_TAKEN, hardcoded em `0`/`0`; só o booking público (`public-booking.ts`) respeitava o buffer configurado. Corrigido — agora os dois caminhos usam a mesma regra (teste de integração novo prova que o buffer bloqueia as alternativas erradas). (2) o link "abrir no mapa" que §10 já prometia pra P2.5 e nunca foi construído: endereço do agendamento agora é um link (`maps.google.com/search`, texto puro, sem geocodificação nem custo) em vez de texto morto |
| **P10 · Preço** | modelos do G5 | Médio | ✅ 2026-08-20 (TICKET-070): dos 6 modelos que G5 listava como faltando, **3 já existiam** antes desta rodada — "por orçamento fechado" fechou em P8 (`quotes`/`quote_items`), "por pacote" e "mensalidade recorrente" já existiam desde a `0019` (`packages`/`client_subscriptions`, "clube de assinatura") e nunca tinham sido cruzados com o G5 no plano. Restavam 3: por hora, visita+hora, diária. Migration `0029` — `services.pricing_model` (`fixed`\|`hourly`\|`visit_hourly`\|`daily`) + `hourly_rate_cents` + `half_day_price_cents`, com o mesmo `price_cents` mudando de sentido conforme o modelo (documentado via `comment on column`). **Decisão de escopo:** isso mexe só no CATÁLOGO (o que aparece pro cliente antes de agendar) — a cobrança final de verdade já era flexível desde sempre via `ticket_items`/`quote_items` (qty × preço livre), então não precisou reescrever o motor de agendamento nem a comanda. Núcleo puro `src/core/pricing/formatar.ts` (achado: a pasta já existia desde o `TICKET-001`, só com um `.gitkeep` — vaga reservada e nunca usada, mesmo padrão do G4/`tenants.cobranca` órfão). Formulário de serviço ganhou o seletor "Como cobra" com campos condicionais; catálogo admin, formulário de novo agendamento e página pública passaram a usar `formatarPreco()` em vez de sempre tratar `price_cents` como total fechado. Verificado ao vivo: serviço "Consultoria por Hora" (R$ 80/hora) criado pelo formulário, aparecendo como "R$ 80,00/hora" tanto no catálogo admin quanto na página pública |
| **P11 · Planos** | limites, bloqueio por plano, cobrança | **Alto** | 🟡 2026-08-20 (TICKET-071): **bloqueado de propósito, com uma fatia real entregue.** A cobrança de verdade (limites por plano, upgrade/downgrade, integração Asaas) segue **bloqueada** — depende de credencial (tickets 031/032/033/043) e de decisão de negócio (preço de cada tier, o que cada um libera) que só o Eduardo pode tomar; nenhuma integração fake foi construída. Auditoria antes de bloquear achou a fatia do item 3 do §13: `plan_tier` (`start`/`pro`/`studio`/`network`) tinha "cheiro de salão" (G9) — **e grep confirmou que nenhuma linha de código lê `tenants.plan` hoje**, cobrança nunca foi de fato construída. Sem nenhum call site pra atualizar, renomear os valores do enum (migration `0030`: `start→gratis`, `studio→profissional`, `network→avancado`, `pro` já era neutro) foi risco zero. **Não** virou tabela-catálogo (a "mesma solução do G1" que o §13 cita) nesta rodada: os limites/preços de cada tier ainda não foram decididos, e catalogar algo que ninguém decidiu o conteúdo ainda seria estrutura especulativa |

**Ordem obrigatória: P0 → P1 → P2 antes de qualquer coisa.** Enquanto profissão for enum e
vocabulário for texto cravado, tudo o mais é retrabalho.

**Correção em relação à 2ª versão deste documento:** o endereço estava inteiro dentro de P9,
marcada como risco Alto e adiada — **enquanto faxina e eletricista eram escolhidas como duas das
três profissões profundas.** Isso se contradizia: sem endereço, um agendamento dessas duas é
inútil (G13). O trabalho foi partido: **P2.5 é o mínimo que as destrava e tem risco baixo**
(guardar e mostrar um endereço não tem nada de difícil); o que é caro — geocodificação, área,
rota — fica em P9 e continua adiado.

**Primeiro corte vendável (MVP da virada):** P0, P1, P2, **P2.5**, P3, P4, P5, **P5.5**, P6.
Vende para autônomo que atende no local **ou** que vai até o cliente, desde que não precise de
otimização de rota. P7/P8/P9 são o que abre faxina recorrente e serviço técnico completo.

**Por onde eu começaria, considerando a §1.1 (nenhum cliente pagante):**
`P0 + P1 + P2.5` — e então **as 3 profissões profundas de P5, e tentar vender**. Esse conjunto
já entrega um produto que fala a língua de outra profissão e aceita um serviço com endereço,
que é o mínimo para um eletricista usar de verdade. Módulos (P3), onboarding novo (P4) e página
(P6) são investimentos que ficam **muito** mais fáceis de acertar depois que alguém pagou e
disse o que faltou — e muito fáceis de errar antes disso.

**Sobre o G11 (trabalho de vários dias):** ficar de fora do primeiro corte, assumido e escrito.
Nenhuma das 3 profundas depende dele; pintor e reforma, que dependem, não estão nas 12.

---

## 16. Critérios de aceite

1. `grep -rn "vertical_pack" src/` → zero fora da camada de compatibilidade.
2. Nenhum nome de profissão em texto visível de `src/` — há teste.
3. As 13 strings com concordância no feminino (G2) → **zero**.
4. Criar conta como eletricista, sem tocar em código, e ter link público funcionando em
   **menos de 3 minutos** — cronometrado, não estimado.
5. Trocar a profissão de um tenant não quebra dado existente.
6. Tenant de beleza existente não muda de comportamento após a migração.
7. Módulo desligado não aparece na navegação, e módulo bloqueado por plano aparece **com o
   motivo**.
8. Modo solo não mostra nenhuma interface de equipe.
9. `apply_profession_pack()` continua idempotente e sem `execute` para `anon`/`authenticated`.
10. Anamnese e dado de saúde **desligados** por padrão em profissão fora da saúde.
11. Nenhuma regra de RLS enfraquecida — o teste de isolamento continua passando.
12. **Nenhum dos modelos de mensagem semeados assume onde o atendimento acontece** (G10): conta
    nova de eletricista não recebe "Te espero na", "Passa aqui" nem "pela visita". Verificável
    por varredura nos modelos de cada pack.
13. **Nenhuma consulta a cliente atravessa tenant** (§3.5) — o teste de isolamento já cobre;
    o que entra é a decisão escrita, para ninguém "melhorar" isso sem revogá-la.
14. As 12 profissões do §5 funcionam **sem uma linha de código específica** — é o teste do
    modelo dos 4 eixos, e se falhar, falta um eixo (não falta um `if`).
15. O funil de onboarding está instrumentado antes do lançamento (§13.2) — sem isso não há como
    saber se a ativação é 60% ou 12%.
16. **Agendar pela página pública como cliente de eletricista guarda o endereço do serviço, e o
    profissional o vê na agenda** (G3+G13). É o teste que separa "funciona" de "existe" para
    metade do catálogo.
17. ✅ **O link do WhatsApp permite cancelar** (e a vaga cancelada volta para a agenda) **e
    oferece remarcar** via link para a página pública — G12, verificado ponta a ponta, sem
    login, 5 testes de integração (`confirmacao-cancelamento.test.ts`).
18. **Nenhum tenant de teste no banco de produção** antes do primeiro cliente real (§1.1) —
    `select count(*) from tenants` bate com a quantidade de negócios reais.
19. Nenhum serviço com `duration_min` acima do teto é aceito sem mensagem clara explicando o
    limite (G11) — o produto diz o que não faz, em vez de falhar estranho.

---

## 17. O que não fazer

- **Não virar marketplace.** Marketplace é outro negócio (precisa gerar demanda, não organizar
  agenda) e mataria o foco. O produto é ferramenta do profissional, não vitrine de busca.
- **Não fazer código por profissão.** No dia em que existir `if (profissao === 'eletricista')`
  em `src/`, o modelo morreu.
- **Não construir ERP.** Nota fiscal, folha, contabilidade — não.
- **Não fazer app nativo agora.** PWA cobre o caso (TICKET-055), e o público novo trabalha em
  campo com sinal ruim — offline vale mais que loja de app.
- **Não migrar todo mundo de uma vez.** §14 existe por isso.
- **Não prometer rota otimizada no primeiro corte.** Buffer configurável entrega quase tudo por
  quase nada (§10).
- **Não deixar o dono escolher a cor do app inteiro** — decisão já tomada no `08`, e ela é o que
  mantém o produto neutro entre uma manicure e um eletricista.

---

## 18. Riscos

| Risco | Mitigação |
|---|---|
| **Explosão de escopo** — "todos os profissionais" vira produto de ninguém | Os 4 eixos (§4) são o limite: se uma profissão não couber neles, ela **não entra** no catálogo |
| Concordância em português vira pesadelo | Regra de copy (§3.2) em vez de motor de i18n |
| Perder o foco no diferencial | Motor de Ciclo é módulo **sempre ligado**; a virada existe para ampliar o alcance dele, não para diluí-lo |
| Tenant de beleza quebrado na migração | §14, e critério de aceite 6 |
| Custo de geocodificação | Começar sem mapa (§10) |
| Catálogo raso vira objeção de venda | 12 profundas em vez de 40 rasas (§5); o resto entra por demanda medida |
| Cobrança bloqueada no Asaas | Já é pendência conhecida; P11 é a última fase de propósito |
| **Self-serve empurra o suporte para o produto** — quem configura errado conclui que "não funciona", e não abre chamado: some | Padrão bom em tudo (pack já preenchido, horário já preenchido), passo pulável, e o cartão "termine de configurar" no Hoje. E §13.2 mede onde abandonam, em vez de adivinhar |
| **Canibalizar a base de beleza** — o produto fica genérico e para de parecer feito para salão | O vocabulário por profissão faz o oposto: hoje a manicure vê "cliente"; depois vê a língua dela. O critério 6 protege o comportamento; o §5 mantém as 3 profissões de beleza no primeiro lote |
| Distribuição não resolvida — construir tudo e ninguém achar | §13.1 trata isso como funcionalidade (assinatura na página, link, indicação), não como marketing posterior. Se o laço não funcionar, é melhor descobrir com 12 profissões do que com 40 |
| **Ampliar antes de provar que alguém paga** (§1.1) — o risco mais sério da lista, e o único que nenhuma decisão técnica resolve | A sequência recomendada (§15) põe `P0+P1+P2.5` + 3 packs profundos **antes** de módulos, onboarding novo e página. É o menor investimento que permite tentar vender para uma profissão nova. Se ninguém pagar, o dinheiro não foi gasto em 12 packs e num onboarding redesenhado |
| **Primeiro cliente real nasce num banco com 365 mil clientes falsos** | P−1 é pré-requisito de venda, não de desenvolvimento. E a causa (dev rodando contra produção por falta de Docker) merece decisão própria |
| **Modelos de WhatsApp errados chegam ao cliente final antes de alguém notar** | G10 é semeado na primeira leitura e vira dado do tenant — corrigir depois não conserta quem já recebeu. Por isso está em P1, não em "polimento" |

---

## 19. O que este documento **não** decidiu

Honestidade sobre o que ainda é pergunta aberta, para não parecer mais resolvido do que está:

- 🔴 **Prioridade máxima do backlog (achado em V2, docs/10-PROXIMOS-PASSOS.md):** cadastro de
  segundo fator (MFA/TOTP) não existe — zero UI de enrollment. `exigirAal2()` trava 3 rotas
  reais (`data-export`, `erase` LGPD, `vault` de saúde — esta última já é chamada pela tela
  real `admin/clientes/[id]/saude.tsx`), tornando-as **permanentemente inacessíveis** hoje, pra
  qualquer conta. Não é lacuna técnica pequena — é recurso do tamanho de uma fase inteira (QR
  code, verificação de TOTP, gestão de fatores, desafio no login), por isso não foi construído
  dentro da auditoria que o achou. Deveria ser a próxima fase de CONSTRUÇÃO do produto.
- **Preço dos planos** e o que exatamente cada um libera — §13 é proposta.
- **Se o nome do produto muda.** Minha leitura é que **CICLO fica melhor** depois da virada (§9),
  mas é decisão do dono.
- **Qual profissão é o segundo alvo comercial** depois da beleza. Faxina/diarista é a aposta
  óbvia (volume, recorrência nativa, dor de agenda real), mas isso é decisão de mercado e deve
  vir de conversa com gente da área, não deste documento.
- **Geocodificação paga ou não** (§10).
- **Se "Outro" no onboarding vira profissão genérica** ou fila de curadoria — a §5 assume fila
  de curadoria, mas isso é escolha, não conclusão.
- **Se o desenvolvimento ganha um projeto Supabase próprio** (~US$ 10/mês) ou continua rodando
  contra produção — a §1.1 mostra o custo de continuar como está, mas a conta é do dono.
- **Se o produto entra em campo com o teto de 12h assumido** (G11) ou se trabalho multi-sessão
  entra antes — depende de qual profissão vier primeiro, e isso ainda não está decidido.
- ✅ **Qual é a terceira profissão profunda** (§5): decidido em 2026-08-19 (P5) — **barbearia**,
  reaproveitando o catálogo real do tenant `dom-rocha`. Ficou a aposta segura (onde há
  conhecimento acumulado), não a que mais provaria generalização (psicólogo/solicitação faria
  isso melhor) — critério de negócio, não técnico.
- **Preço de faxina/diarista e eletricista precisa de confirmação de campo.** P5 usou preço/
  duração plausíveis de mercado brasileiro (conhecimento geral, sem pesquisa ao vivo — sem
  WebSearch disponível na sessão), não o mesmo nível de confiança do catálogo real de barbearia.
  Antes de usar essas duas pra vender de verdade, vale confirmar os números com alguém da área.
- **Tela de gestão de séries de recorrência** (§12): P7 (TICKET-067) construiu criar série
  (formulário) e cancelar série (API), mas não uma tela que liste as séries ativas de um
  tenant com botão de cancelar/editar — hoje isso só é possível via chamada direta à API ou
  SQL. Não é esquecimento: o valor principal do P7 (a série existir e gerar ocorrências de
  verdade) já está entregue e testado; a tela de gestão é trabalho de UI que pode vir depois,
  quando houver um tenant de verdade usando recorrência pra guiar o design da lista.
- **Extensão automática do horizonte de geração** (§12): cada série planta até 90 dias à
  frente na criação; estender pra sempre (rolar o horizonte conforme o tempo passa) precisa de
  um cron/job novo, que este ticket não construiu — registrado, não esquecido. Uma série "sem
  fim" simplesmente para de ter ocorrências novas depois dos 90 dias até alguém rodar a
  extensão manualmente ou o job existir.
- **Tela de gestão de orçamentos** (§11): P8 (TICKET-068) construiu criar (formulário) e
  aprovar/recusar (link público), mas não uma lista no painel dos orçamentos de um tenant com
  status de cada um — hoje isso só é visível pelo link que o cliente recebeu ou por SQL. Mesmo
  raciocínio do P7 pra séries de recorrência: o valor principal (orçamento existir, ter link,
  aprovação funcionar) está entregue e testado; a tela de gestão é UI que pode vir depois.
- **Converter orçamento aprovado em agendamento** (§11): o fluxo hoje termina em
  `status = 'approved'` — não cria um `appointment` sozinho. `quotes.converted_appointment_id`
  já existe no schema pra quando isso for construído, mas a conversão em si (escolher
  data/hora de verdade, checar disponibilidade) é trabalho de UI que ficou de fora desta
  rodada. Aprovar um orçamento hoje avisa a equipe (push); virar agendamento é passo manual do
  profissional pela tela normal de "novo agendamento".
- **Instrumentação do funil de onboarding** (§13.2): P4 (TICKET-072) resolveu o bloqueio crítico
  (cadastro só aceitava as 8 verticais de beleza), mas não construiu tracking de funil. "Tempo
  até o link pronto" e "tempo até o 1º agendamento real" já dá pra medir com os timestamps que
  existem (`tenants.created_at`, `appointments.created_at`) — não precisa de instrumentação
  nova. "% que compartilha o link" e "onde abandona passo a passo" exigem tracking de verdade
  (evento por etapa do formulário), que é trabalho maior e sem tráfego real ainda pra
  justificar — P−1 encontrou zero clientes pagantes. Vale construir quando houver gente de
  verdade tentando se cadastrar pra medir.
- **Fotos/galeria na página pública** (§8): adiado em P6 (TICKET-066). `client_reviews` já tem
  comentário de texto e nota, mas foto de cliente na página pública de um profissional levanta
  consentimento (LGPD, imagem de terceiro) que este plano não desenhou — quem autoriza, onde
  fica o "retirar consentimento", o que acontece com foto já publicada se o cliente sair da
  base. Não é trabalho de UI, é decisão de produto/jurídico primeiro.

Nada disso bloqueia P0–P3, que é onde o trabalho começa.

**Uma pergunta que eu deixei passar na primeira versão e que precisa de resposta antes da
comunicação de vendas (não bloqueou a parte técnica de P6, que seguiu neutra de marca):**
o produto continua se vendendo como **um** produto para todas as profissões, ou vira marca com
recortes ("CICLO para casa", "CICLO para saúde") na comunicação, com o mesmo motor por baixo?
Tecnicamente é indiferente — a arquitetura dos 4 eixos suporta os dois. Comercialmente muda
tudo: página de vendas, anúncio, prova social. Não é decisão de engenharia, mas **é decisão de
alguém**, e trava a §13.1 (o texto da assinatura discreta do plano grátis, se algum dia vier a
existir) e a versão final de vendas de §8 — não o que já foi construído.

---

## 20. Registro de revisão

**2ª versão, mesmo dia.** A 1ª foi revisada criticamente antes de qualquer execução. O que mudou:

| Mudança | Por quê |
|---|---|
| **+ G10** (modelos de WhatsApp de salão) | Furo real: 8 dos 10 modelos assumem que o cliente vem até você, são semeados na primeira leitura e viram dado do tenant. A 1ª versão não olhou o canal mais importante do produto |
| **+ §3.3** esquema concreto | P0 dizia "cria `professions`" sem dizer com quê. Era intenção, não plano executável |
| **+ §3.4** mecanismo do vocabulário | Faltava dizer como o token chega no código — e que o **servidor** também precisa dele (mensagem, página pública, PDF) |
| **+ §3.5** sem identidade entre tenants | Fronteira que faltava explicitar. Sem ela, alguém "resolve" isso um dia e o produto vira marketplace sem ninguém ter decidido |
| **+ §4** spec do modo solicitação | A 1ª versão dizia que isso destrava psicólogo/advogado e deixava em uma linha. Incoerência própria |
| **+ §13.1 e §13.2** distribuição e métricas | O pedido dizia "**para vender**" e a 1ª versão entregou arquitetura sem uma linha sobre como alguém acha o produto, nem sobre como saber se funcionou |
| **− catálogo: 40 → 12** | A 1ª versão contradizia o próprio risco de "produto de ninguém". 12 profundas provam o modelo; 40 rasas provam o contrário |
| **− §13 planos encolhida** | Estava especificando decisão que não é minha. Ficaram só as 4 regras de engenharia |
| **+ 4 critérios e 3 riscos** | Cobrindo G10, a fronteira de tenant, o teste das 12 profissões, suporte e canibalização da base |

**3ª versão** — verificação fio a fio, com consulta ao banco de produção. O que mudou:

| Mudança | Por quê |
|---|---|
| **+ §1.1** o estado real, medido | As duas versões anteriores planejaram sem olhar se alguém usa o produto. Olhei: 78 tenants, **nenhum com mais de 7 dias**, 35 com mais de mil clientes, um com 10.004, e 97 agendamentos vindos da página pública em 351 mil. É dado de teste de carga — **não há cliente pagante**, e o banco de produção está com resíduo que precisa sair antes do primeiro real |
| **+ G11** teto de 12h por atendimento | `duration_min ≤ 720`. Diária de faxina cabe (a §1 comemorou isso), trabalho de vários dias não cabe — e não é caso de aumentar o teto, é conceito diferente |
| **+ G12** cliente não cancela nem remarca | O token do WhatsApp só confirma. Briga com a tese do próprio produto: a falta mais barata de evitar é a que o cliente avisa |
| **+ G13** o formulário público não pede endereço | Outra metade do G3, e a que aparece primeiro: agendamento de faxineira sem endereço é inútil |
| **~ P9 partida em P2.5 + P9** | **Contradição minha:** faxina e eletricista foram escolhidas como profissões profundas enquanto o endereço estava numa fase Alto risco e adiada. Guardar endereço é barato; geocodificação e rota é que não são |
| **+ P−1 e P5.5** | Higiene do banco (§1.1) e o cancelamento pelo link (G12) — duas fases baratas que não existiam |
| **~ §5: 12 profissões viram 3 profundas + 9 rasas** | "Existir no catálogo" e "estar pronta para vender" são coisas diferentes, e sem cliente pagante não se justifica pesquisar preço de 12 áreas |
| **~ recomendação de início** | Era `P0+P1+P5`. Vira `P0+P1+P2.5` + as 3 profundas, **e tentar vender** — módulos, onboarding e página são fáceis de errar antes de alguém pagar |
| **+ 4 critérios de aceite** | G3+G13 ponta a ponta, G12, banco limpo, e o limite do G11 dito na cara em vez de falhar estranho |
