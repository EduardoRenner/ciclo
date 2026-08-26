# 23 · AUDITORIA DE LANÇAMENTO — PLANO

> Escrito contra o contrato de `docs/22-AUDITORIA-LANCAMENTO-PROMPT.md`, em 2026-08-26.
> Marcação: **[M]** medido nesta rodada · **[R]** lido no repositório · **[S]** suposto ·
> **[E]** depende do Eduardo.

---

## 1 · A resposta curta

**Dá para lançar** — mas não hoje, e o que impede **não é o que a memória do projeto dizia**.

Seis rodadas de verificação deixaram o código em ordem. O que sobrou está fora dele: **um
agendador que já falhou uma vez em silêncio**, **duas mitigações que existem no código e não no
ambiente**, e **uma base onde a suíte de teste mora junto com o cliente**.

Nenhum dos três aparece em `pnpm verify`. Os três aparecem para o primeiro pagante.

---

## 2 · F1 · A costura do agendador — **o achado desta auditoria**

### 2.1 · O que aconteceu, medido

O único disparo agendado que já existiu [M]:

| | |
|---|---|
| Pedido para | `cron: '10 6 * * *'` → **06:10 UTC** |
| Aconteceu às | **07:06 UTC** (`gh run view 32820012489`) |
| Atraso | **56 minutos** |
| `recompute-cycles` devolveu | `{"tenantsProcessados": 0}` — HTTP **200**, job **verde** |
| `segments` devolveu | `{"tenantsProcessados": 11}` |

A rota só age no tenant cuja **hora local** é exatamente 3 [R]:

```ts
if (horaLocal !== 3) continue
```

06:10 UTC = 03:10 em UTC-3 ✓ · 07:06 UTC = 04:06 em UTC-3 ✗

E **todos os 11 tenants da base são `America/Sao_Paulo`** [M].

> **Conclusão:** no único dia em que o Motor de Ciclo foi agendado, ele processou **zero** tenants
> — porque o GitHub atrasou 56 minutos — e o job ficou verde. O `segments` "salvou" a aparência:
> processou 11 e pintou a execução de sucesso.

O Motor de Ciclo é o diferencial que sustenta o preço (`docs/18`). Ele é a única coisa que o
CICLO vende e que o Simples Agenda a R$ 39,90 não vende. **Ele nunca rodou sozinho em produção.**

### 2.2 · A reviravolta que barateia o conserto

O cabeçalho da própria rota já responde à pergunta difícil [R]:

> "Rodar `recomputarCiclosDoTenant` de novo pelo mesmo tenant no mesmo dia é inofensivo (upsert
> por PK, TICKET-036) — **a checagem de hora só existe para não gastar processamento à toa, não
> para garantir corretude**."

Então a igualdade exata **não é uma regra de negócio**. É uma otimização escrita para um mundo que
não existe mais: o cron do Vercel a cada 15 minutos, onde "hora == 3" era acertado por 4 disparos
seguidos. Contra um agendador que dispara **uma vez** por janela e é **best-effort**, a mesma linha
virou um ponto único de falha.

**Afrouxar a igualdade para uma janela custa processamento e não custa corretude.** É o conserto
mais barato desta auditoria e o de maior consequência.

### 2.3 · O que a guarda prova, e o que não prova

`tests/unit/server/cron-cobre-os-fusos.test.ts` [R] é um bom teste — lê o YAML e o `.ts` de
verdade, e tem asserção protegendo o próprio regex. Mas ele calcula:

```ts
const utcNecessaria = ((local - offset) % 24 + 24) % 24
return !agendadas.includes(utcNecessaria)   // igualdade exata
```

Ele prova que o schedule **nominal** cobre os quatro fusos. **Não modela atraso.** Ele teria
passado verde no dia 25/08 — e passou — enquanto o Motor de Ciclo processava zero.

Isso não o torna uma guarda cega no sentido do `CLAUDE.md` (ele casa com o que muda). Torna-o uma
guarda **de escopo menor que o problema**: prova a aritmética, não a entrega.

### 2.4 · Margem real do schedule atual (aritmética, a conferir na execução)

Schedule nominal: **05:10, 06:10, 07:10, 08:10, 09:10 UTC** [R]. `recompute-cycles` = hora local 3.

Para UTC-3 (onde estão 11 de 11 tenants [M]), a hora local 3 é atingida pelo slot de 06:10 com
atraso de 0–49 min, ou pelo slot de 05:10 com atraso de 50–109 min. Logo:

- atraso observado de 56 min [M] → **coberto** pelo slot anterior;
- atraso > ~110 min, ou **execução pulada** (o GitHub documenta que pode pular) → **descoberto**.

A redundância de 5 slots ajuda por acidente, não por desenho — ela existe para cobrir fusos, e o
efeito de tolerar atraso é um bônus não intencional e não testado. **[S]** até ser medido na
execução com a aritmética completa dos 4 fusos × atraso variável.

### 2.5 · O conserto proposto

Hipótese a validar, não a assumir (`docs/22 §3.1`):

| Opção | Custo | Sobrevive a atraso | Sobrevive a execução pulada |
|---|---|---|---|
| **A** · janela em vez de igualdade (`horaLocal` entre 3 e N) | zero migration; reprocessa alguns tenants à toa — **explicitamente inofensivo** [R] | sim | parcial |
| **B** · marcar "já rodei hoje para este tenant" | precisa de coluna/tabela | sim | **sim** |
| **C** · agendar de hora em hora | ~43% da cota de Actions [R] | sim | parcial |

**Recomendação: A agora, B se a execução mostrar que A deixa buraco.** A é reversível, cabe num PR
e ataca o defeito medido. B é a resposta completa, e só se paga se a taxa de execução pulada for
observável — o que hoje não é, com **n=1** de histórico.

**Honestidade sobre a evidência:** o atraso de 56 min é **um** ponto [M]. Um ponto não é uma
distribuição. O conserto não depende disso — ele se justifica pelo desenho (igualdade exata contra
agendador best-effort), e o ponto medido é o que tirou o risco do papel.

### 2.6 · Ação de verificação imediata

A primeira janela do schedule de 5 horários é **hoje, 26/08, a partir das 05:10 UTC** [M] — ainda
não aconteceu quando este plano foi escrito. **Ler o corpo das respostas das 5 execuções** é a
medição mais barata e mais informativa desta auditoria inteira, e ela acontece sozinha em poucas
horas. `docs/22 §2.2`: job verde só conta quando alguém leu o corpo.

---

## 3 · Falso alarme descartado (publicado por regra do `docs/22 §2.3`)

**Hipótese:** "o schedule de 5 horários está em `main` e nunca disparou — está quebrado."

**Refutada por aritmética de data** [M]: o schedule entrou em `main` no commit `4d34e24`, em
**25/08 10:29 UTC**. Os cinco horários são 05:10–09:10 UTC, todos **anteriores** a 10:29 naquele
dia. A primeira janela possível é 26/08 05:10 UTC, e agora são 03:59 UTC. **Não há execução
faltando.** Zero runs é o número correto.

Custou dois minutos de `git log --format='%ci'` e teria virado um S1 inventado no relatório.

---

## 4 · F2 · Mitigação fantasma no ambiente

19 variáveis em produção [M]. Duas ausentes com código vivo apontando para elas:

| Variável | Código | Efeito real da ausência |
|---|---|---|
| `UPSTASH_*` | `src/server/services/rate-limit.ts` | limite em memória de instância; em runtime serverless cada instância tem o próprio balde → **na prática, quase nenhum limite** [S] |
| `HCAPTCHA_SECRET` | `src/server/services/captcha.ts` | verificação degrada e **deixa passar** [S] — o padrão declarado desta base |

Ambas nomeadas em `docs/16` e ainda abertas. O `[S]` das duas últimas colunas vira `[M]` na
execução, lendo o código de degradação — **não presumir o comportamento, ler**.

**Boa notícia [M]:** `PUBLIC_LINK_SIGNING_KEY`, o S1 mais grave de `docs/16` (links públicos
assinados com o `CRON_SECRET`), **está em produção desde 24/08**. A execução confirma que a
correção saiu da inércia — variável presente não é o mesmo que código usando a variável.

**Regra de fechamento da frente:** cada variável termina em **ligada**, **código removido**, ou
**aceita com dono e data**. Nenhuma termina como está.

---

## 5 · F3 · Restauração de backup

Aberto desde `docs/16`, **nunca executado** [R]. O projeto é Supabase Pro [R], que tem backup
diário — mas "tem backup" e "restaura" são afirmações diferentes, e só a segunda importa.

Plano: restaurar para uma **branch** do Supabase (não sobre produção), conferir contagem de linhas
de `tenants` / `clients` / `appointments` contra a produção, apagar a branch. Se o plano não
permitir branch de restauração, isso vira `[E]` **com o motivo exato**, não um check vazio.

⚠️ Nada nesta frente toca produção. Restauração sobre a base viva **trava e pergunta**
(`docs/22 §5`).

---

## 6 · F4 · Sequência do primeiro pagante

Percorrer em ordem, em tenant descartável, procurando **emenda entre etapas**, não bug de tela.

O ponto mais suspeito, e a razão de a frente existir: **o que acontece quando o plano muda.**
`docs/18 §L.2.1` fixou a ordem obrigatória — aplicar migration → atribuir plano → só então ligar
`exigirModulo`. Os 3 tenants reais estão em `gratis` [M] menos o `dom-rocha`, em `avancado` [M].
Ninguém nunca **rebaixou** um tenant com dados dentro. É exatamente a emenda que nunca rodou.

Alvo concreto: rebaixar um tenant descartável **cheio** de `avancado` para `gratis` e responder —
o dono perde acesso ao que já criou? A tela explica ou só quebra? `docs/18` regra 5.1 diz que cair
de plano limita o que dá para **fazer** e nunca esconde o que **existe**. Isso é verificável.

---

## 7 · F5 · Coerência do que o plano promete

`exigirModulo` está em **4** rotas [M]: `campaigns`, `quotes`, `inventory/entries`, `clients/[id]/vault`.

**Correção de memória desatualizada:** a lacuna de `docs/18 §L.2.1` — "a tela promete que Campanhas
é do Essencial mas `POST /api/v1/campaigns` continua liberado" — **está fechada** [M]
(`src/app/api/v1/campaigns/route.ts:21`). O documento `18` está desatualizado neste ponto e a
execução deve corrigi-lo, não replicá-lo.

O que resta é o inverso: varrer `/precos` e `/admin/config/modulos` e conferir que **toda
afirmação tem um `exigirModulo` atrás**. Atenção ao limite suave de 50 clientes (`docs/18 §L.1`):
limite suave é decisão legítima; **anunciá-lo como rígido** é o defeito.

---

## 8 · F6 · Higiene da base

**8 de 11 tenants são resíduo de teste** [M]: `health-*`, `alertas-estoque-*`, `recuperar-*`,
`clientes-*`, `risco-*`, `rls-a-*` ×3.

Causa estrutural já diagnosticada [R]: `.env.local` aponta para **produção**, então
`test:integration` e `test:rls` criam tenant e usuário de auth na base real. Limpar sem tratar a
causa é o item `P-B` que o próprio `docs/18` classificou como inútil como escrito — eles voltam na
próxima execução da suíte.

Duas consequências que a execução tem que separar:

1. **Cosmética:** lixo na base. Some com um `delete`, volta amanhã.
2. **Estrutural, e é a que importa:** a suíte de teste **cria usuário de auth e apaga tenant** na
   mesma base onde moraria o cliente pagante. Um `afterAll` com o filtro errado alcança dado real.
   Hoje o risco é baixo porque há 3 tenants e nenhum pagante. **No dia do primeiro pagante, é o
   maior risco não mitigado do projeto** [S] — e a mitigação (projeto Supabase separado para
   teste) custa **US$ 10/mês** e é `[E]`.

Esta frente provavelmente termina em **recomendação com preço**, não em código.

---

## 9 · Ordem de execução e forma

Uma frente, um PR (`docs/22 §5`).

| # | Frente | Depende de | Termina em |
|---|---|---|---|
| 1 | **F1** conserto do agendador + guarda que modela atraso | — | PR com código e teste |
| 2 | **F1-b** ler o corpo das 5 execuções de hoje | relógio (05:10–09:10 UTC) | medição no `docs/23` |
| 3 | **F2** decidir as duas variáveis | — | PR e/ou `[E]` com dono |
| 4 | **F5** coerência interface × `exigirModulo` | — | PR ou "nada encontrado" |
| 5 | **F4** sequência do pagante, com foco em rebaixar plano | F5 | achados |
| 6 | **F3** restauração de backup | — | medição ou `[E]` com motivo |
| 7 | **F6** recomendação estrutural | F4 | recomendação com preço |

**F1 primeiro porque é o único achado onde o produto já falhou de verdade.** O resto é prevenção.

---

## 10 · O que esta auditoria **não** vai fazer

Repetido de `docs/22 §4` porque é o principal risco de desperdício: nada de nova varredura genérica
de UI, RLS, acessibilidade ou copy; nada de construir a máquina de planos da Fase P.2; nada que
dependa de Asaas ou WhatsApp Cloud API.

---

## 11 · Definição de pronto

Herdada de `docs/22 §6`. O item que decide se este documento prestou:

- [ ] **F1 corrigido, com guarda vista reprovando**, e as 5 execuções de hoje lidas **no corpo**
- [ ] Um parágrafo honesto respondendo "dá para lançar?", com o que impede, nominalmente e com dono

### 11.1 · Tensão honesta, registrada antes de começar

Este plano aposta que **o risco restante do CICLO está no ambiente e na costura, não no código**.
Se a execução das seis frentes voltar sem nenhum achado além do F1, essa aposta estava certa e o
projeto está pronto para um piloto pago. Se voltar com muitos, ela estava errada — e a conclusão
correta passa a ser que seis rodadas de verificação de código não substituem **uma** de operação.

O que tornaria esta aposta falsa é observável, e está escrito aqui antes do resultado.
