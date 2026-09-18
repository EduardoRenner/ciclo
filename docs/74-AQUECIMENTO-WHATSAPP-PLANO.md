# 74 · AQUECIMENTO DO NÚMERO DE WHATSAPP — plano de rampa

> Recomendado duas vezes sem ser escrito: `docs/53` já nomeava o risco em palavras fortes ("o
> número do WhatsApp Business do CICLO pode ser banido pela Meta, e isso afeta TODOS os tenants")
> e `docs/63-AUDITORIA-PENDENCIAS-2026-09-13.md` §3 confirmou por busca completa em `docs/` e
> `src/` que não existe rascunho nenhum. Este documento é a resposta — a mesma varredura, feita de
> novo esta noite, mesmo resultado, e desta vez com o plano escrito.

---

## 1 · Por que "teto por tenant" não é a mesma coisa que "aquecimento do número"

`src/server/services/mensageria.ts` já tem um freio real (`TETO_DIARIO_CAMPANHA = 100`,
`TETO_DIARIO_TRANSACIONAL = 300`, por tenant, por dia, via `limitador()`). Esse freio resolve um
problema diferente do que este documento trata: ele impede que **um tenant** (bug de loop, campanha
mal configurada) mande volume absurdo. Ele não limita o **volume total do número compartilhado**
— e é o número, não o tenant, que a Meta avalia.

A WhatsApp Cloud API classifica todo número de negócio numa **camada de limite de mensagens**
(*messaging limit tier*), que sobe conforme o número acumula volume entregue com boa qualidade e
cai (ou o número é suspenso) se a taxa de bloqueio/denúncia dos destinatários for alta cedo demais.
Um número novo começa na camada mais baixa (histórico público da Meta: 250 destinatários únicos
por 24h) e SOBE automaticamente com uso consistente e de boa qualidade — mas SOBE MAIS DEVAGAR, ou
cai, se o volume disparar antes de o número ter reputação. Com `N` tenants cada um mandando até 100
campanhas/dia desde o primeiro dia, o número inteiro pode ultrapassar o limite da camada inicial
na primeira semana — e cada tenant, isoladamente, nunca veria o próprio teto disparar, porque o
teto dele é por tenant.

**A pergunta que falta responder, e que este documento responde:** quando a conta comercial da
Meta existir (`docs/55` §3.4, item de negócio) e alguém for religar `reminders`/`campaigns` no
`cron.yml` (hoje só acionáveis manualmente por `workflow_dispatch` — confirmado em
`.github/workflows/cron.yml`, ausentes da `matrix` agendada), **em que ordem e em que volume os
tenants entram**, para o número construir reputação em vez de gastá-la de uma vez.

---

## 2 · O que a rampa precisa fazer

1. **Um orçamento GLOBAL diário**, separado do teto por tenant — um segundo `limitador()` com
   chave `mensagens:${categoria}:GLOBAL:dia` (mesma função, chave nova, zero código novo de
   infraestrutura) que soma TODO envio do tenant compartilhado, campanha e transacional juntos.
2. **Elegibilidade por fase**, não "todos ligados no dia 1": um subconjunto de tenants entra por
   vez, e o resto continua no fallback manual (o botão que já existe hoje e não depende da conta
   comercial) até a fase seguinte abrir.
3. **Critério de avanço de fase objetivo**, não uma data no calendário: só avança se a taxa de
   qualidade do número (visível no Meta Business Manager, também exposta por webhook de
   `message_template_status_update`/`account_update` da própria Cloud API) continuar em `GREEN`
   pelo período mínimo da fase.
4. **Critério de parada automática**: se a Meta rebaixar a camada do número ou marcar qualidade
   `RED`/`YELLOW` em qualquer momento, a rampa CONGELA na fase atual (não avança, não recua
   sozinha) e alerta o Eduardo — decisão de retomar é humana, não automática.

---

## 3 · A rampa proposta

Números de partida abaixo são **estimativa `[S]`**, no mesmo padrão de `TETO_DIARIO_CAMPANHA`
(registrado como estimativa sem uso real para calibrar) — a estrutura de fases é o que importa
mais que o valor exato, e o valor exato é fácil de ajustar num único `const`.

| Fase | Duração mínima | Quem entra | Orçamento GLOBAL/dia (campanha) | Avança se |
|---|---|---|---|---|
| 0 — fallback manual (hoje) | — | ninguém no automático | 0 | decisão de ligar o F0 (Eduardo) |
| 1 — piloto | 7 dias corridos | os 3-5 tenants mais antigos e de menor volume histórico de campanha (não os maiores — um tenant grande que falha na fase 1 gasta reputação demais) | 50 | qualidade `GREEN` os 7 dias inteiros, zero bloqueio reportado pela Meta |
| 2 — expansão | 7 dias corridos | + próximos ~20% da base, por ordem de antiguidade de conta | 150 | qualidade `GREEN` os 7 dias inteiros |
| 3 — geral, com teto | 7 dias corridos | todo mundo | 400 | qualidade `GREEN` os 7 dias inteiros |
| 4 — sem orçamento global | — | todo mundo | o teto por tenant já existente passa a ser a única defesa | fase 3 completa sem incidente |

Cada fase **dobra o orçamento global** em vez de liberar tudo de uma vez — a mesma lógica que já
rejeita "descontar sem medir" em outras partes desta base (`docs/46`, sobre suavização de régua:
"não adicionar sem sintoma medido"). Aqui o sintoma que falta é a reputação do número, que só se
mede vivendo a fase anterior.

---

## 4 · Onde isso entra no código, quando for a hora

- `dentroDoTetoDiario` (`mensageria.ts`) ganha uma segunda checagem, cumulativa com a por-tenant:
  `dentroDoOrcamentoGlobalDiario(kind)`, mesma função `limitador()`, chave
  `mensagens:${categoria}:GLOBAL:dia`. As duas checagens são "E", não "OU" — qualquer uma bloqueando
  já basta.
- **Elegibilidade por fase** precisa de UM dado que hoje não existe em lugar nenhum: uma lista (ou
  uma coluna, ex. `tenants.grupo_de_rampa`) dizendo em que fase cada tenant entra. A forma mais
  simples e mais alinhada com "não precifica automaticamente, não decide sozinho": uma
  configuração estática revisada manualmente a cada avanço de fase — não um algoritmo que decide
  quem é "menor volume" sozinho, porque a fase 1 é exatamente o momento de menor tolerância a erro
  de critério.
- **O painel de qualidade da Meta não tem webhook lido nesta base ainda.** Antes da fase 1 valer a
  pena, vale assinar `account_update`/`message_template_status_update` (a Cloud API já os emite)
  e gravar num lugar que o Eduardo veja sem abrir o Meta Business Manager toda hora — mas isso é
  construção condicional a existir conta comercial pra testar contra, então fica fora do escopo
  de código deste documento (mesmo raciocínio do `docs/73` F3: não constrói sem o sintoma para medir
  contra).

## 5 · O que este documento NÃO decide

- Os números exatos de orçamento por fase (`[S]`, calibrável antes do dia 1 da fase 1, sem custo
  de mudar depois).
- Quais tenants especificamente entram na fase 1 — decisão do Eduardo, quando a conta comercial
  existir e a base de tenants reais for maior que a de demonstração de hoje.
- Se a rampa deve existir como código (cron que avança fase sozinho) ou como checklist manual
  revisado semana a semana. Dado que são só ~4 fases e o critério de avanço já exige olhar o painel
  da Meta manualmente, **checklist manual é a opção mais simples que atende ao critério de aceite**
  (a mesma regra do `CLAUDE.md` para decisão sem informação suficiente) — automatizar a decisão de
  avançar fase antes de ter um tenant real usando é a mesma classe de erro que motivou não
  construir suavização de régua sem sintoma medido.
