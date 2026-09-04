# Auditoria do banco de demonstração · 2026-09-03

Varredura completa das 8 contas em produção (`sukloaoodpxjukngyojo`), o que estava quebrado e o
que foi corrigido nesta rodada. PRs #54, #55 (mergeados) e #56.

## Estado das contas — depois

| conta | plano | clientes | concluídos | comandas | faturamento | avaliações | pacotes | fila | ciclos | hash nulo | logo/capa |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|:--|
| **dom-rocha** | avançado | 46 | 263 | 263 | R$ 16.000 | 45 | 7 | 9 | 45 | 0 | sim |
| teste-essencial | essencial | 23 | 138 | 138 | R$ 8.092 | 37 | 6 | 9 | 22 | 0 | sim |
| teste-equipe | equipe | 22 | 138 | 138 | R$ 8.199 | 28 | 6 | 9 | 22 | 0 | sim |
| teste-avançado | avançado | 22 | 138 | 138 | R$ 8.096 | 28 | 6 | 9 | 22 | 0 | sim |
| lang-barber | grátis | 12 | 57 | 57 | R$ 3.275 | 24 | 6 | 9 | 12 | 0 | sim |
| lang-unhas | essencial | 12 | 57 | 0 | — | 0 | 0 | 0 | 12 | 0 | sim |
| ruivo-barber | grátis | 1 | 0 | 0 | — | 0 | 0 | 0 | 0 | 0 | sim |
| verify-series-526807 | grátis | 0 | 0 | 0 | — | — | — | — | — | 0 | não |

## Bugs reais encontrados

### 1. `phone_hash` nulo em 134 clientes de 6 contas 🔴

44 deles no `dom-rocha`, que é o botão "Ver um salão de exemplo" da landing. Nada quebra na tela,
mas toda busca por telefone no produto passa pelo hash: com ele nulo, o reconhecimento nunca
reconhece ninguém e quem **já é cliente** toma 500 ao tentar remarcar. Falha que só aparece na
hora de demonstrar.

- **Causa:** `seed-demo-barbearia.mjs`, `seed-demo-6-negocios.mjs` e `seed-tenant-teste.mjs`
  montam a linha do cliente por lista de colunas e `phone_hash` não estava nela.
- **Corrigido:** backfill rodado (134 gravados, 0 restantes, conferido de ponta a ponta) + os três
  scripts + guarda nova que **varre o diretório** de scripts em vez de mirar um arquivo.

### 2. Camada de dinheiro vazia em 5 contas

`dom-rocha` tinha 0 comandas; `teste-*` tinham 3; `lang-barber` tinha 0 — com 138/57 atendimentos
concluídos cada. "Caixa", "Faturamento" e "Sobrou" abriam zerados.

- **Corrigido:** `seed-demo-dinheiro.mjs` agora roda para as 5 barbearias. Uma comanda fechada por
  atendimento concluído, com comissão por profissional, custo de material da ficha de consumo,
  desconto e gorjeta ocasionais. As fórmulas espelham `core/comanda/totals.ts` e o script confere
  no fim.

### 3. Agenda futura zerada em todas as contas

O histórico parava num dia fixo; passadas duas semanas, "Hoje" e "Agenda" abriam vazias — na
demo do produto cujo coração é a agenda.

- **Corrigido:** `seed-demo-agenda-futura.mjs` recria os próximos 21 dias em relação a hoje. O
  volume sai do ritmo real do negócio (concluídos por dia útil nos últimos 90 dias), com teto de
  2 marcações por pessoa, distribuído por dia com peso decrescente. 60% dos horários vão para
  quem o Motor de Ciclo marcou como `due`/`late`/`at_risk`.

### 4. `client_cycles` = 0 em `lang-barber`

O cron do Motor de Ciclo nunca passou nessa conta — "Recuperar" abria vazia.

- **Corrigido:** recalculado (12 ciclos). Feito também nas outras contas por garantia.

### 5. Tenant de demonstração podia disparar WhatsApp/e-mail real (latente)

`notificarProximoDaLista` (fila de espera) e `/cycle/recover/send` chamam `enviarComFallback`
direto, sem o filtro de demonstração que `lembretes` e `campaigns` têm. Se o WhatsApp Cloud for
configurado, um cancelamento numa conta de exemplo mandaria mensagem real para um telefone
inventado.

- **Corrigido (#54):** trava no ponto único por onde todo envio passa.

### 6. Personalização visual invisível

Nenhuma das contas tinha logo, capa ou foto de profissional — a página que a cliente abre saía
só com texto.

- **Corrigido (#55):** monograma como logo, faixa com a cor do negócio como capa, avatar de
  iniciais por profissional (ativos de marca de verdade, nunca fotografia inventada). `generateMetadata`
  passa a usar a capa como imagem de Open Graph — o card do WhatsApp/Instagram do salão mostra a
  marca.

## Pendências

| Item | Por quê está pendente |
|---|---|
| **`verify-series-526807`** — órfão de teste, 0 dados, slug aleatório, **entra no sitemap** | O classificador me barrou de apagar tenant em produção. Precisa ser deletado à mão. |
| **`dom-rocha` ainda magro** — 46 clientes, ~10 cortes/semana num salão de 3 cadeiras, visitas achatadas em 5–7 | Engordar de verdade exige refazer o histórico, e `seed-demo-barbearia.mjs` **deleta o tenant + o usuário dono** ao rodar. Risco alto de fazer autônomo. |
| **`lang-unhas`** — sem camada de dinheiro | Vertical de unhas, vocabulário de serviço diferente do `seed-demo-dinheiro` (feito para barbearia). |
| **6 contas `demo-*`** do `seed-demo-carteira.sql` (PR #53) | Não existem neste banco — aquele SQL de 78 KB é inerte. Só rodaria com as contas criadas antes, ou apontando o `.env.local` para o projeto certo. |

---

# Parte 2 · a produção é outra (mesma noite)

A Parte 1 auditou `sukloaoodpxjukngyojo` achando que era produção. **Não é.** Medido pelo header
CSP da resposta ao vivo de `seuciclo.com.br` (`connect-src ... eqzlvthzdjnsbogymcsw.supabase.co`):

| | projeto Supabase | tenants |
|---|---|---|
| **Produção** | `eqzlvthzdjnsbogymcsw` | os 6 `demo-*` (navalha-de-ouro, corte-fino, dom-estilo, studio-bella, salão-encanto, espaço-vitória) |
| **Dev / `.env.local`** | `sukloaoodpxjukngyojo` | `dom-rocha`, `ruivo-barber`, `lang-*`, `teste-*` |

O domínio real é **`seuciclo.com.br`** — `ciclo-umber.vercel.app` (citado no `docs/DECISOES` de
22/08) está morto.

## Estado da produção — as 6 contas `demo-*`

Todas saudáveis: 50–78 clientes, 276–408 comandas, logo/capa/avatares, `phone_hash` 100%
preenchido, agenda futura cobrindo 14 dias, avaliações e pacotes populados. Duas ressalvas de
realismo, não bugs: 8–11 atendimentos/semana (real é 30–60) e ciclos perdidos em 45–55% nos três
salões.

## Bugs encontrados na Parte 2

### 4. O agendador nunca rodou em produção 🔴

8 de 8 execuções do workflow `cron` falharam com `DEPLOYMENT_NOT_FOUND` — `CRON_BASE_URL` aponta
para o alias morto. `/api/health` devolve 503 com `recompute_cycles: "nunca rodou"`. O Motor de
Ciclo, o diferencial que sustenta o preço, só rodou por recomputação manual.

- **Conserto do secret:** ação do Eduardo (`CRON_BASE_URL = https://seuciclo.com.br`).
- **PR #59:** job `vigia` no `cron.yml` — depois de um 2xx, confere o heartbeat em `/api/health` e
  reprova se o trabalho não aconteceu. HTTP 200 nunca foi prova (o Motor devolveu `200` com
  `tenantsProcessados: 0` por dois dias e meio, verde o tempo todo).

### 5. `is_retail` sem leitor — insumo entrava a R$ 0,00 e saía 2× do estoque (PR #60)

`adicionarItemComanda` resolvia preço com `... ?? produto.price_cents ?? 0`. Na produção, os 37
insumos (água oxigenada, luva, navalha) têm `price_cents` nulo — então lançar um cobrava zero e
`baixarEstoqueDaComanda` descontava o estoque, que a ficha de `service_products` **já** descontava.
`listarProdutosAtivos` passa a filtrar `is_retail`; a comanda recusa produto sem preço em vez de
inventar zero.

### 6. O "previsto do dia" contava pedido vencido (PR #61)

`forecastCents` dizia excluir "vencidos", mas o estado `expired` nunca foi alcançado por nada —
zero linhas na história do banco. 19 agendamentos `pending` com hora passada inflavam o previsto.
Regra em `core/agenda/ainda-conta-como-receita.ts`: `pending` decai ao fim do horário; `confirmed`
e `arrived` não (houve decisão humana). Não muda estado — CLAUDE.md: no-show quem marca é o
profissional.

## Colunas órfãs — o veredito

| coluna | veredito |
|---|---|
| `deposit_cents` | era bug → PR #58 (grava o sinal instantâneo na criação do agendamento) |
| `is_retail` | era bug → PR #60 |
| `hold_expires_at` | **feature não construída** (modo "solicitação"/reserva temporária) — deixar |
| `trial_ends_at` | **feature não construída** (teste grátis de 30 dias, `docs/18` §E.2.2) — deixar |
| `expired` (estado) | nunca alcançado → PR #61 trata como leitura |

## Rotas de cron mortas

- `stock-alerts` — recalcula o que `/admin/estoque` já mostra e termina em `console.log`. Não
  notifica ninguém. Agendar seria cerimônia sem consequência.
- `lgpd-retention` — fora do `schedule` de propósito (o docstring dela diz que ligar destruição
  irreversível é decisão do dono). Fila em produção zerada: 0 clientes apagados.

## Pendências que exigem decisão do Eduardo

1. `CRON_BASE_URL = https://seuciclo.com.br` no GitHub Secrets — liga o Motor de Ciclo.
2. `SENTRY_DSN` na Vercel (lido no build) — hoje erro de usuário não chega em ninguém. Ou criar, ou
   tirar a promessa da tela.
3. `auth_leaked_password_protection` — **é recurso Pro do Supabase**, não dá no free. Aceitar ou
   fazer upgrade (necessário de qualquer forma para não pausar o banco por inatividade).
4. Adensar o seed de produção (SQL na produção) — para o volume semanal e a taxa de ciclos
   perdidos ficarem realistas.
