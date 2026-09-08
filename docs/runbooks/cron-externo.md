# Runbook · o cron do Motor de Ciclo roda no cron-job.org, não no GitHub

**Situação em 2026-09-08.** O `on.schedule` de `.github/workflows/cron.yml` parou de rodar: a conta
do GitHub estourou os 2.000 min/mês de Actions de repo privado (foi o CI dos ~10 PRs do dia, não o
cron — ver a annotation do run: *"recent account payments have failed or your spending limit needs
to be increased"*). `recompute_cycles` e `recompute_segments` ficaram **54h sem rodar**, `/api/health`
= `ok:false`.

O `docs/18` §L.5 já dizia que Vercel Cron custa (Hobby = 1×/dia; Pro = R$110/mês) e que a alternativa
R$0 era o GitHub Actions. Com o GitHub fora, a alternativa R$0 que sobra e não depende da cota de
ninguém é um agendador HTTP externo.

## O que está configurado (cron-job.org, conta do Eduardo)

Dois jobs, `GET` a cada 3 horas, fuso `America/Sao_Paulo`:

| Job | URL | Header |
|---|---|---|
| `CICLO - motor de ciclo` | `https://seuciclo.com.br/api/cron/recompute-cycles` | `Authorization: Bearer <CRON_SECRET>` |
| `CICLO - segmentos` | `https://seuciclo.com.br/api/cron/segments` | `Authorization: Bearer <CRON_SECRET>` |

- `CRON_SECRET` é a env var do Vercel (Production + Preview + Development). Rotacionar exige
  redeploy — a rota lê `process.env.CRON_SECRET` (`src/app/api/cron/recompute-cycles/route.ts`).
- "Save responses in job history" ligado nos dois, para depurar falha pela resposta.
- 3h é folga: as rotas são idempotentes (upsert por PK, TICKET-036) e não olham hora local desde
  30/08 — reprocessar o mesmo dia não faz mal.

## Conferir que está de pé

```
GET https://seuciclo.com.br/api/health
```

`recomputeCycles` e `recomputeSegments` têm que estar `{"ok":true}`. O limiar é 26h
(`LIMIAR_HEARTBEAT_CICLO_MIN`), então uma execução perdida não acende o alarme; duas seguidas sim.

## Se precisar recriar (conta nova, serviço fora do ar)

Qualquer agendador HTTP serve — cron-job.org, EasyCron, um Vercel Cron se um dia virar Pro, um
GitHub Actions se a cota voltar. O contrato é só: `GET` nas duas URLs acima, com o header
`Authorization: Bearer <CRON_SECRET>`, de hora em hora a cada 3 horas. O `on.schedule` do
`.github/workflows/cron.yml` continua no repositório como backup — no dia em que a cota de Actions
voltar, ele retoma sozinho, e rodar as duas coisas no mesmo dia não causa dano.

## O que NÃO migrou, de propósito

`reminders` e `campaigns` continuam fora de qualquer agendador — elas mandam mensagem para cliente
final e ligá-las é decisão do dono + credencial de WhatsApp (`docs/25` F0). `src/core/cron/agendadas.ts`
é a fonte da verdade de "o que roda sozinho".
