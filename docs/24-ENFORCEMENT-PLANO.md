# 24 · FECHAMENTO DA AUDITORIA DE LANÇAMENTO — PLANO DE EXECUÇÃO

> Escrito em 2026-08-26, 05:15 UTC, contra o estado medido do repositório e da produção.
> Continua `docs/23` — executa as frentes 4 a 7 da tabela do `§9` de lá, mais um achado novo.
> Marcação: **[M]** medido nesta rodada · **[R]** lido no repositório · **[S]** suposto ·
> **[E]** depende do Eduardo.

---

## 1 · Onde a auditoria parou, medido — não lembrado

Entrei nesta sessão com a memória dizendo "auditar o que mudou depois da auditoria A–N de 23/08".
**A memória estava desatualizada.** O repositório já tem remoto no GitHub, 13 PRs mergeados, e uma
auditoria de lançamento (`docs/21`–`23`) que rodou até as 01:45 de hoje. Refazer varredura genérica
seria exatamente o desperdício que o `docs/22 §4` proíbe.

Estado real das seis frentes do `docs/23 §9` [M]:

| # | Frente | Estado | Evidência |
|---|---|---|---|
| 1 | F1 · conserto do agendador | ✅ feito | commit `5424ae4` + `cron-sobrevive-a-atraso.test.ts` |
| 2 | **F1-b · ler o corpo das 5 execuções** | ⏳ **impossível até agora** | **zero runs `schedule` na história do repo** [M] |
| 3 | F2 · as duas variáveis | ✅ fechada | `docs/23 §4`, decisão registrada |
| 4 | **F5 · trava de módulo no servidor** | ❌ **aberta — só a guarda existe** | `SEM_TRAVA_AINDA` intacta com os 4 módulos |
| 5 | F4 · sequência do pagante | ⚠️ parcial consciente | `docs/23 §6.2`, resto é `[E]` |
| 6 | F3 · restauração de backup | ❌ nunca executada | aberta desde `docs/16` |
| 7 | F6 · higiene da base | ✅ virou recomendação | 8 tenants aguardando aprovação |

---

## 2 · F7 · Falso alarme descartado — **os limites numéricos travam sim**

> Publicado por regra do `docs/22 §2.3`. Este achado esteve escrito aqui como "terceira ocorrência
> do mesmo defeito" por cerca de vinte minutos, e caiu ao ser medido direito. Fica registrado com o
> erro à mostra porque **o modo como ele nasceu é mais útil do que o achado teria sido.**

**A hipótese:** `docs/23 §6.1` percorreu o rebaixamento de plano, listou `podeCriar()` como
"correto" e nunca perguntou **quem chama**. Grepei o repositório inteiro:

```
podeCriar        → src/core/billing/planos.ts:342 (definição) + 5 asserções de teste. Zero rotas.
verificarLimite  → 3 chamadas, TODAS renderização (`clientes/page.tsx`, `meu-plano/page.tsx` ×2)
```

Dois símbolos, zero chamadores de produção. Conclusão que escrevi: o teto de 1 profissional do plano
grátis é decorativo, o servidor aceita quantos vierem.

**Refutada [M].** Existe um **terceiro nome**: `exigirLimite`, o wrapper de servidor
(`src/server/services/planos.ts:127`) que envolve `verificarLimite` e lança `PLAN_LIMIT`. Ele é
chamado em `src/app/api/v1/professionals/route.ts:32` — e o comentário em cima dele já dizia a coisa
certa antes de eu chegar:

> "§L.1: o limite vale no SERVIDOR. Esconder o botão na tela não impede ninguém de chamar esta rota
> direto. **Vem antes da idempotência de propósito** — repetir uma requisição que já era proibida
> tem que continuar sendo proibida, não devolver o resultado guardado."

E a cobertura é **completa**, não parcial [M]: só existem dois recursos com teto
(`type Recurso = 'profissionais' | 'clientes'`), com severidade declarada em tabela —
`profissionais: 'duro'`, `clientes: 'suave'`. O duro é travado na única rota que cria. O suave
retorna cedo por decisão documentada (`docs/18 §L.1`), então nenhuma rota precisa dele.

### 2.1 · A lição, que é o que sobra

**Um grep negativo só vale o nome que você chutou.** Eu chutei os dois símbolos do `core/` e conclui
ausência a partir do silêncio deles, sem perguntar "existe um terceiro nome para isto na camada de
servidor?" — que é precisamente a camada onde a trava tem que morar. Procurei a função pura onde só
o wrapper podia estar.

Isso é uma variação da armadilha de [[guarda-cega-teste-de-mutacao]] aplicada a mim, não a um teste:
casei com um **rótulo** em vez do **comportamento**. O jeito barato de não repetir é o que fiz
tarde — grepar pelo **erro que a trava lança** (`PLAN_LIMIT`) em vez do nome da função que eu
esperava encontrar.

**Custou vinte minutos e teria virado um achado inventado no relatório**, do mesmo tamanho do que o
`docs/23 §3` evitou por dois minutos de `git log`. A diferença entre os dois é que aquele foi
checado antes de escrever e este depois. Vale como argumento para checar antes.

### 2.2 · O que sobra de verdade

A repetição que o `docs/23 §7.1` apontou continua **em dois casos, não três**: F1 (cron) e F5
(módulos). Não há evidência para promovê-la de "padrão" a "propriedade estrutural" — e a frente que
eu usaria para isso acabou de provar o contrário do que eu queria que ela provasse. **A camada de
servidor deste projeto trava limite numérico corretamente.** O buraco é só de módulo, e é o F5.

---

## 3 · O que vou executar, em ordem

Uma frente, um PR (`docs/22 §5`).

### PR 1 · F5 — trava de módulo nas rotas de escrita

Os quatro módulos vendidos como pagos e hoje livres [M], com as rotas-alvo já levantadas:

| Módulo | Vendido | Rotas de escrita |
|---|---|---|
| `register` (Comanda e caixa) | Essencial R$ 49 | `tickets/[id]/{route,close,cancel,items}` (5 rotas) |
| `team` (Agenda por profissional) | Equipe R$ 99 | `professionals/{route,[id],[id]/business-hours}` (3) |
| `loyalty` (Fidelidade) | Equipe R$ 99 | `clients/[id]/loyalty`, `tenant/loyalty-config` (2) |
| `recurrence` (Recorrência) | Avançado R$ 179 | `appointments/series/{route,[id]/cancel}` (2) |

**Seguro hoje, medido em `docs/23 §7.2`:** os dois tenants `gratis` reais têm zero comandas, zero
fidelidade, zero séries e 1 profissional cada. Ligar a trava não tira nada de ninguém — e a ordem
obrigatória do `docs/18 §L.2.1` (migration → plano atribuído → enforcement) já está cumprida.

Três decisões que a execução tem que tomar com cuidado, e não em bloco:

1. **`GET` continua livre**, sempre. Regra 5.1: cair de plano limita o que dá para **fazer** e nunca
   esconde o que **existe**.
2. **Comanda órfã.** `concluirAgendamento()` cria a comanda automaticamente [R]. Travar a escrita de
   `tickets` faz um tenant `gratis` acumular comanda aberta que não pode fechar. O cartão de preço
   já vendeu "Comanda, caixa e fechamento" como Essencial — então a consequência se **registra**,
   não se rediscute. Mas ela precisa estar escrita antes de alguém descobrir sozinho.
3. **`professionals` PATCH/DELETE do único profissional existente.** Editar quem já existe não é o
   recurso pago; criar o segundo é. Trava boba aqui viola a regra 5.1 no espírito. A decisão vai
   caso a caso, escrita no PR.

Fecha com os 4 módulos saindo de `SEM_TRAVA_AINDA` — a guarda de `docs/23 §7.3` reprova sozinha se
eu tirar da lista sem pôr a trava, e reprova também se eu puser a trava e esquecer de tirar da lista.

### PR 2 · ~~F7~~ — cancelado, o defeito não existe

Ver `§2`. A trava numérica já funciona; não há PR aqui. O que sobra é uma linha de guarda barata,
que cabe **dentro do PR 1**: um teste que case com `exigirLimite` para que a única chamada existente
(`professionals/route.ts:32`) não possa ser removida sem alguém notar. Hoje ela é um ponto único e
nada a protege.

### PR 3 · F3 — restauração de backup

Restaurar para uma **branch** do Supabase, nunca sobre produção. Conferir contagem de `tenants` /
`clients` / `appointments` contra a produção, apagar a branch. Se o plano não permitir branch de
restauração, vira `[E]` **com o motivo exato** — nunca um check vazio.

### F1-b · medição, não PR — e é a mais barata da auditoria

São **05:13 UTC** e a janela de hoje é 05:10–09:10 [M]. **Zero runs `schedule` existiram até
agora**, o que é o número correto (`docs/23 §3` provou por aritmética de data que não há execução
faltando). As cinco de hoje são as primeiras da história do projeto.

Ler o **corpo** das respostas — não a cor do job — é o que responde se o Motor de Ciclo processa
tenant sozinho em produção. É a única frente desta auditoria onde o produto já falhou de verdade, e
ela se resolve com o relógio, de graça. É por isso que este trabalho está num loop e não numa
sessão só.

---

## 4 · O que eu **não** vou fazer

- Nova varredura genérica de UI, RLS, acessibilidade ou copy (`docs/22 §4`).
- **Apagar os 8 tenants de resíduo.** É exclusão em produção, e o `docs/23 §8.2` já deixou como
  comando de uma linha aguardando aprovação. Continua aguardando — **`[E]`, e eu não executo.**
- Qualquer coisa que dependa de Asaas ou WhatsApp Cloud API.
- Reabrir a decisão de preço. O cartão é dado de entrada aqui, não hipótese.

---

## 5 · Definição de pronto

- [ ] Os 4 módulos pagos com trava em rota de escrita, e `SEM_TRAVA_AINDA` **vazia**
- [ ] A única chamada de `exigirLimite` protegida por guarda (ver `§3`, PR 1)
- [ ] As 5 execuções agendadas de hoje lidas **no corpo**, com o número de tenants processados
- [ ] `pnpm verify` limpo em cada PR
- [ ] Cada mutação de guarda **vista reprovando** antes de ser aceita ([[guarda-cega-teste-de-mutacao]])

### 5.1 · Tensão honesta, revisada depois do primeiro round

A versão original desta seção dizia que F7 era "um ponto contra" a aposta do `docs/23 §11.1` de que
o risco restante está no ambiente e na costura, não no código. **F7 caiu**, então esse ponto some —
e a aposta segue de pé, agora com uma medição a mais a favor.

O que resta contra ela continua sendo o F5, e ele sozinho é grave: metade do que é vendido como pago
não é travado por nada. Mas F5 tem uma característica que F7 teria negado — ele é **um** subsistema,
com **um** conserto, e não sintoma de uma camada inteira desconectada.

O que tornaria a aposta falsa continua observável: **um terceiro caso do mesmo formato**, achado
durante a execução do PR 1, em subsistema sem relação com cron ou plano. Dois casos são um padrão
digno de nota. Três seriam uma propriedade da base, e a recomendação viraria varredura dirigida a
esse formato. Está escrito aqui antes do resultado, de novo.

---

## 6 · Execução do PR 1 — o que mudou depois de começar

### 6.1 · Havia um PR paralelo, e eu só descobri depois de editar os mesmos arquivos

O **PR #16** (`enforcement-loyalty-recurrence`) já cobria `loyalty` e `recurrence` — 3 dos arquivos
que eu tinha acabado de editar. Ele chegou sozinho a duas das minhas conclusões (travar a config e
não só o lançamento manual; não travar o cancelamento de série), o que é boa notícia sobre o
desenho e má notícia sobre o meu processo: **eu deveria ter rodado `gh pr list` na fase de análise**,
junto com `git log` e `git status`. O `CLAUDE.md` já manda checar colisão com processo paralelo; a
lista de PR aberto é agora parte disso, e não estava.

Custo real: cerca de meia hora de trabalho duplicado em 3 arquivos. Custo evitado: nenhum — nada
foi commitado por cima do trabalho do outro processo.

### 6.2 · O achado que a duplicação rendeu — **a trava do #16 não fecha a automação**

O PR #16 afirma, e o comentário ficou no código:

> "aqui, não em `clients/[id]/loyalty`, é onde a fidelidade automática é LIGADA
> (`pointsPerReal > 0`) — a partir daí `pontuarAtendimentoConcluido` pontua sozinho"

**Falso, e medido em produção [M].** `pointsPerReal` **nunca é ligado por ninguém**:
`CONFIG_PADRAO.pointsPerReal` é `1`, e `lerConfigFidelidade` devolve esse padrão para quem não tem
`settings.loyalty`. A consulta na base real:

| | |
|---|---|
| Tenants com `settings.loyalty` gravado | **0 de 11** |
| Lançamentos de fidelidade em `dom-rocha` | **9**, com 263 atendimentos concluídos |

Ou seja: `PATCH /tenant/loyalty-config` nunca foi chamado na história do projeto, e a fidelidade
automática rodava mesmo assim — inclusive para tenant `gratis`. Travar aquela rota impede **ligar o
que já vinha ligado por omissão**. A trava que fecha de verdade é dentro de
`pontuarAtendimentoConcluido`, e é a que este PR acrescenta.

Isto **não** é um terceiro caso do formato "guarda prova a aritmética, não a entrega" (`§5.1`): é
uma premissa errada sobre o valor padrão, não uma trava desconectada. A aposta do `docs/23 §11.1`
segue de pé.

### 6.3 · Segunda correção: travar resgate cobra da pessoa errada

O #16 trava `POST /clients/[id]/loyalty` inteiro. Mas `points < 0` é **resgate**, e quem paga o
bloqueio não é o dono do salão que mudou de plano — é a cliente dele, que juntou ponto sob uma
promessa e ouve "não dá para usar". A regra 5.1 protege o que já existe, e saldo acumulado é
exatamente isso. Neste PR a trava passa a valer só para `points > 0`.

O mesmo princípio guiou o resto e vale escrever de uma vez, porque decidiu quatro casos:

> **A trava fica na porta de entrada do recurso pago (criar, ligar, configurar), nunca na saída
> (fechar, cancelar, resgatar, apagar).** Cair de plano limita o que dá para FAZER; prender o que
> já existe é a mesma violação da regra 5.1 pela porta dos fundos.

Por ele: `register` trava lançar item, não fechar comanda (que `concluirAgendamento` cria sozinho);
`recurrence` trava criar série, não cancelar; `team` trava expediente **por profissional**, não o
`default` do próprio negócio; `loyalty` trava ganhar, não resgatar.

### 6.4 · F1 não está em produção — e ninguém tinha notado

`origin/main` ainda tem `if (horaLocal !== 3) continue` [M]. A correção do achado nº 1 da auditoria
— o cron que processou zero tenants — vive **só no PR #15, ainda aberto**. Produção roda com o
defeito.

Não mergeei: é a branch padrão do repositório e a decisão é do Eduardo (consultado em 26/08, resposta:
reportar, não mexer). **Fica como o item mais urgente desta auditoria que não depende de código
novo** — o conserto existe, está revisado e parado.

### 6.5 · F1-b — **medido e fechado. E a resposta é a pior possível.**

Os cinco disparos de 26/08 aconteceram, todos. Todos atrasados [M]:

| Slot pedido | Rodou às | Atraso |
|---|---|---|
| 05:10 | 05:46 | +36 min |
| 06:10 | 07:06 | +56 min |
| 07:10 | 07:57 | +47 min |
| 08:10 | 09:00 | +50 min |
| 09:10 | 09:52 | +42 min |

O atraso não é evento raro: é **característica**, entre 36 e 56 minutos, em 5 de 5. E como todos os
slots atrasam **juntos**, a redundância de cinco horários não compensa — a janela inteira desliza.

O corpo das respostas, lido por nome de job (não por ordem no log):

| Run | `recompute-cycles` | `segments` |
|---|---|---|
| 07:06 | **0** | 11 |
| 07:57 | **0** | 21 |
| 09:00 | **0** | 0 |
| 09:52 | **0** | 0 |

**O Motor de Ciclo processou zero tenants em todos os cinco disparos — segundo dia seguido.**

A causa não é a que o `docs/23` §2 supunha ter consertado. O conserto da janela estava certo e
estava **em `main`** — mas nunca chegou em produção: este projeto não tem integração git↔Vercel, e
o deploy é manual. Produção rodou o dia 26 inteiro com a igualdade exata do dia 25. Descoberto ao
abrir o site de produção e ver que ele ainda servia `ciclo-wordmark-escuro.png`, arquivo que dois
PRs atrás já tinha sido renomeado.

**A lição, e ela é maior que o F1:** um conserto mergeado não é um conserto entregue. A auditoria
inteira mediu `main` e concluiu que o F1 estava fechado. Nenhuma das frentes perguntou "isto está
no ar?". Vale a mesma régua do `docs/22 §2.2` (job verde só conta quando alguém leu o corpo):
**PR mergeado só conta quando alguém abriu a produção.**

Deploy feito em 26/08 15:4x UTC, e verificado no ar depois (marca aqua, wordmark aparado, telefone
com 49px tocáveis).

**Falso alarme descartado no caminho:** `segments` reportou 21 tenants processados enquanto a base
tem 11, e quase virou "o contador mente". Não mente — eram ~10 tenants transitórios de uma execução
da suíte de integração, que roda contra produção por causa do `.env.local` (o F6 do `docs/23` §8).
Foram apagados pelo `afterAll` depois, e é por isso que `created_at > now() - 24h` devolve zero
agora.

### 6.6 · O que o F1-b revelou de novo: o Motor de Ciclo não tinha vigilância nenhuma

Investigando por que dois dias de silêncio não geraram nenhum sinal, a resposta apareceu inteira:

- `cron.yml` confere **só o código HTTP** (`2xx passa`). `200 {"tenantsProcessados":0}` é verde.
- `registrarHeartbeat` existe e é chamado por `campaigns` e `reminders` — **não por
  `recompute-cycles`**.
- `/api/health` vigia `send_reminders` e `send_campaigns` — **não o Motor de Ciclo**.

O job que sustenta o preço do produto era o único sem heartbeat e sem checagem de saúde.

**Conserto:** `recompute-cycles` passa a registrar heartbeat, e `/api/health` passa a vigiá-lo com
limiar de 26h (mesmo de `send_campaigns`, que também é 1×/dia — e com folga de sobra para os 56 min
de atraso medidos).

O detalhe que decide se o conserto vale: **o heartbeat só bate quando `processados > 0`**.
Registrar a cada chamada reproduziria o defeito numa camada nova — "a rota foi chamada" já era
verdade nos dez disparos zerados. Há teste guardando as duas metades, e as duas foram vistas
reprovando.

**Consequência esperada e correta:** `/api/health` devolve **503** até o primeiro ciclo rodar de
verdade (janela de 27/08). Não é regressão — é o endpoint finalmente dizendo a verdade que ele
vinha escondendo há dois dias. Cura sozinho no primeiro disparo elegível.

### 6.6 · F1-b fechada, F3 decidida — continuação em outra sessão, mesmo dia

**F1-b, com os 5 corpos lidos:** as 5 execuções agendadas de hoje (05:46–09:52 UTC) rodaram todas
**antes** do merge do PR #15 (12:58 UTC) — o §6.4 acima registrou exatamente essa lacuna algumas
horas antes de ela se confirmar. `recompute-cycles` devolveu `tenantsProcessados: 0` nas 5 de 5,
`segments` acertou 2 de 5. Ou seja: a previsão do §6.4 ("produção roda com o defeito") bateu, com
número. PR #14, #15 e #16 foram mesclados em `main` nesta continuação (decisão de quem estava
consultando o Eduardo na hora — registrada em `docs/DECISOES.md`). Disparo manual de
`workflow_dispatch` depois do merge (13:15 UTC) devolveu `0` de novo — não é regressão, é a janela
`[3h, 6h)` local não alcançando as 10:15 locais do disparo. A validação real acontece sozinha no
schedule de amanhã. Detalhe completo em `docs/DECISOES.md`, entrada de hoje.

**F3, decidida sem gastar:** apresentado o custo real da branch de teste ($0,01344/hora), a decisão
foi não gastar — CICLO ainda não foi lançado. Fica `[E]`, sem prazo. Detalhe em `docs/DECISOES.md`.
