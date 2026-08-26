# 22 · PROMPT — AUDITORIA DE LANÇAMENTO

> Contrato acordado com o Eduardo em 2026-08-26. Este arquivo **não é a auditoria** — é o contrato
> de como ela tem que ser feita. O resultado é `docs/23-AUDITORIA-LANCAMENTO-PLANO.md`.
>
> Mesma relação que `17 → 18` (monetização) e `19 → 20` (copy).

---

## 0 · Papel

Atuar como **engenheiro de plantão na véspera do primeiro cliente pagante** — não como revisor de
código. A pergunta que governa cada decisão não é "está bem escrito?", é:

> **Se amanhã uma pessoa pagar R$ 49 e confiar a agenda dela a este sistema, o que quebra primeiro
> — e como eu descubro antes dela?**

### 0.1 · O modo de falha número um desta auditoria

Esta é a **sétima** rodada de verificação do CICLO. As seis anteriores (V1–V5, pós-construção,
segurança A–N, falha silenciosa) já varreram código, tela, RLS, acessibilidade e copy. O modo de
falha óbvio é **repetir a varredura que já passou** e voltar com "nenhum achado S0/S1", que é
verdadeiro, barato e inútil.

O risco que sobra depois de seis rodadas de código limpo **não está no código**. Está em três
lugares que nenhuma delas olhou:

| Onde | Por que escapou de todas as rodadas |
|---|---|
| **Ambiente de produção** | não está no repositório. `git` limpo e `pnpm verify` verde não dizem nada sobre o que existe no Vercel |
| **Costura entre agendador e código agendado** | o agendador é do GitHub, o código é nosso, e ninguém revê a emenda. Já é a categoria nº 1 do `docs/21 §6` |
| **Sequência ponta a ponta** | cada parte foi testada sozinha. Ninguém nunca percorreu cadastro → agenda → cobrança → LGPD **em ordem, na mesma base** |

**Regra:** se um achado desta auditoria pudesse ter sido encontrado lendo `src/`, ele provavelmente
já foi encontrado. Achado que só aparece medindo o mundo real vale mais.

---

## 1 · Estado de partida (medido em 2026-08-26, não lembrado)

| Fato | Valor | Como foi obtido |
|---|---|---|
| Tenants na base de produção | **11** — 3 reais, **8 resíduos de teste** | `select` direto |
| Fuso de **todos** os 11 | `America/Sao_Paulo` (UTC-3) | idem |
| Pagantes | **zero** | `plan`: 1 `avancado` de cortesia, 10 `gratis` |
| Cron agendado | `cron.yml`, **5 horários**, em `main` desde 25/08 10:29 UTC | `git log` |
| Execuções agendadas do schedule de 5 horários | **zero até agora** — a primeira janela é 26/08 05:10 UTC | `gh run list` |
| Única execução agendada que já houve | 25/08 **07:06** UTC, para um `cron` de **06:10** | `gh run view` |
| O que ela devolveu | `recompute-cycles` → **`tenantsProcessados: 0`** · `segments` → `11` | log da run |
| Variáveis em produção | 19 | `vercel env ls production` |
| `exigirModulo` ligado em | 4 rotas de escrita, de 82 rotas `v1` | `grep` |

**O item mais importante desta tabela é a linha do 07:06.** Ver §3.1.

---

## 2 · Padrão de evidência

Herdado de `docs/17 §2` e do `CLAUDE.md`, com uma adição que vale só para esta rodada.

### 2.1 · Marcação obrigatória

Todo fato afirmado no plano leva marca:

- **[M]** — **medido** nesta auditoria, com o comando ou a consulta ao lado
- **[R]** — lido no repositório (código, `git log`, documento anterior)
- **[S]** — suposto / inferido. Precisa dizer o que o tornaria falso
- **[E]** — depende do Eduardo (conta, dinheiro, decisão de negócio)

Fato sem marca não entra. Número sem fonte é o defeito que a auditoria do `docs/20` pegou em si
mesma, e vai ser pego de novo aqui.

### 2.2 · "Verde não é prova" vale para esta auditoria também

O `CLAUDE.md` já lista três casos medidos nesta base de check verde mentindo — incluindo, por
nome, **o cron respondendo `200` com `tenantsProcessados: 0`**. Esta auditoria não tem licença
para tratar `success` no Actions, `200` numa rota ou `pnpm verify` limpo como conclusão.

Concretamente: **job verde só conta quando alguém leu o corpo da resposta.**

### 2.3 · Falso alarme descartado é resultado, não desperdício

`docs/21 §5.3` registra um falso alarme descartado porque conferir custou dois minutos. Esta
auditoria faz o mesmo: **hipótese refutada entra no plano com a medição que a refutou**, na mesma
altura de um achado confirmado. Auditoria que só publica acerto está escondendo o custo do método.

> Já aconteceu uma vez nesta rodada, antes mesmo do plano: "o cron de 5 horários nunca disparou"
> parecia um S1 até a aritmética mostrar que a primeira janela ainda não chegou (§1).

### 2.4 · Toda correção nasce com guarda, e a guarda é vista reprovando

Regra do `CLAUDE.md`, sem exceção nesta rodada — inclusive o procedimento de 4 passos
(commitar antes de mutar · reintroduzir cada defeito · **confirmar que a mutação foi aplicada** ·
guarda contra o próprio detector). Na auditoria de 25/08, **três de cinco guardas estavam cegas**.
A taxa base é 60%. Trate cada guarda nova como provavelmente cega até vê-la reprovar.

---

## 3 · Escopo — as seis frentes, em ordem de execução

A ordem não é arbitrária: é do que **já está quebrado agora** para o que **pode quebrar depois**.

### 3.1 · F1 · A costura do agendador (prioridade máxima)

**O fato [M]:** o único disparo agendado que já existiu foi pedido para **06:10 UTC** e aconteceu
às **07:06 UTC** — 56 minutos de atraso. `recompute-cycles` só age no tenant cuja **hora local**
é 3; 06:10 UTC é 03:10 em UTC-3 ✓, mas 07:06 UTC é 04:06 ✗. **Todos os 11 tenants são UTC-3.**

Portanto: **no único dia em que o Motor de Ciclo foi agendado, ele processou zero tenants por
causa do atraso do GitHub — e o job ficou verde.** O Motor de Ciclo é o diferencial que sustenta
o preço (`docs/18`).

O que a auditoria tem que responder:

1. O desenho "hora local exatamente igual a N" é compatível com um agendador que o próprio GitHub
   documenta como **best-effort** (atrasa e **pode pular**)? Medir a margem real, não estimar.
2. `tests/unit/server/cron-cobre-os-fusos.test.ts` confere a aritmética do schedule **nominal**.
   Ele modela atraso? Se não, a guarda prova algo que não é o que acontece.
3. Qual é o desenho que sobrevive a atraso **e** a execução pulada? (Hipótese a testar, não a
   assumir: marcar "já rodei hoje para este tenant" em vez de casar hora exata — o que torna
   qualquer um dos 5 disparos suficiente e os demais inofensivos.)

**Esta frente sozinha justifica a auditoria.** As outras cinco são higiene.

### 3.2 · F2 · Mitigação fantasma no ambiente

`docs/16` já nomeou o padrão desta base: quando falta credencial, o código **degrada e avisa** em
vez de travar — bom hábito cujo efeito colateral é que **mitigação ausente fica indistinguível de
mitigação funcionando**.

Confirmado [M] que continuam **ausentes em produção**, com código que os referencia:

- `UPSTASH_*` → `src/server/services/rate-limit.ts`
- `HCAPTCHA_SECRET` → `src/server/services/captcha.ts`

Num runtime serverless, limite de taxa em memória de instância é **quase nenhum limite**. A
auditoria tem que decidir, por variável: **ligar, remover o código, ou registrar como aceito com
dono e data** — as três são respostas válidas; deixar como está, não é.

`PUBLIC_LINK_SIGNING_KEY`, o S1 aberto desde `docs/16`, **está presente desde 24/08** [M]. Confirmar
que a correção saiu da inércia, não só que a variável existe.

### 3.3 · F3 · Restauração de backup

Pendência aberta desde `docs/16`, nunca executada. **Ninguém provou que dá para restaurar.**

Regra desta frente: só conta como feito se houver uma restauração **executada**, com um número de
linhas conferido depois. "O Supabase faz backup automático" é `[S]`, não `[M]`.

### 3.4 · F4 · Sequência do primeiro cliente pagante

Percorrer, na ordem, numa base descartável: cadastro → onboarding → serviço/horário → agendamento
pelo site público → confirmação → comanda → orçamento → **o que acontece quando o plano muda** →
pedido de exportação/exclusão LGPD.

O alvo **não é bug de tela** — seis rodadas já cobriram isso. O alvo é **a emenda entre etapas que
nunca rodaram em sequência na mesma base**.

### 3.5 · F5 · Coerência do que o plano promete

`exigirModulo` está em 4 rotas [M]. A tela `/admin/config/modulos` e a página `/precos` fazem
afirmações sobre o que cada plano permite. **Toda afirmação de plano na interface precisa de um
`exigirModulo` atrás, ou a afirmação sai.** Cobrar por limite que não existe é o pior dos dois
mundos: o cliente descobre, e descobre depois de pagar.

Cuidado registrado em `docs/18 §L.1`: o teto de 50 clientes do grátis é **limite suave** por
decisão. Limite suave declarado não é mentira — limite suave **anunciado como rígido**, é.

### 3.6 · F6 · Higiene da base

8 dos 11 tenants são resíduo de teste [M], e `docs/18` já diagnosticou a causa estrutural:
`.env.local` aponta para **produção**, então a suíte os recria. Limpar sem tratar a causa é o item
`P-B` que o próprio `docs/18` classificou como inútil como escrito.

A pergunta desta frente é a estrutural: **cliente pagante e suíte de teste podem continuar
morando na mesma base?** A resposta pode ser "sim, com estas condições" — mas tem que ser
respondida, não herdada por inércia.

---

## 4 · Fora de escopo, de propósito

- **Redesenho visual e copy** — `08` e `20` já são os documentos disso
- **Preço e empacotamento** — `18`, decidido
- **Construir a máquina de planos (Fase P.2 do `18`)** — o próprio plano manda **não** construir
  antes de ≥10 pagantes. Reabrir isso aqui seria cometer o erro que o `18` existe para evitar
- **Nova varredura genérica de UI/RLS/a11y** — V1–V5 e `docs/21` cobriram; repetir é teatro
- **Qualquer coisa que dependa de credencial Asaas ou WhatsApp Cloud API** — bloqueado no Eduardo
  desde o TICKET-031/043. Entra no plano como `[E]`, não como trabalho

---

## 5 · Como executar

- **Uma frente, um PR**, com teste-guarda quando a correção for de código (`CLAUDE.md`)
- **Rebasear antes de abrir PR** por causa do `docs/DECISOES.md` (armadilha conhecida)
- **Juntar commits antes de empurrar** — `concurrency: cancel-in-progress` reinicia ~5 min de CI
- Achado que dependa do Eduardo **não trava a frente seguinte**: registra com dono e segue
- Migration destrutiva sem plano de reversão **trava** e pergunta

---

## 6 · Definição de pronto

- [ ] As 6 frentes percorridas, cada uma com veredito explícito — inclusive "nada encontrado"
- [ ] Todo fato marcado `[M]` / `[R]` / `[S]` / `[E]`
- [ ] A frente F1 respondida **com medição de margem real**, não com estimativa
- [ ] Toda guarda nova **vista reprovando**, com a mutação **confirmada como aplicada**
- [ ] Restauração de backup **executada**, com contagem conferida — ou registrada como `[E]` com o
      motivo exato de não ter sido possível
- [ ] Todo falso alarme descartado **publicado**, com a medição que o refutou
- [ ] Nenhuma afirmação de plano na interface sem `exigirModulo` atrás — ou a afirmação removida
- [ ] O que ficou aberto tem **dono e data**, não "futuramente"
- [ ] Um parágrafo honesto respondendo: **dá para lançar?** Com o que ainda impede, nominalmente
