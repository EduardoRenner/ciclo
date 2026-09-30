# Plano · ligar lembrete, alerta de estoque e campanha

Estado em 2026-09-30: só `recompute-cycles` e `segments` rodam sozinhos (cron-job.org, a cada 3h).
`reminders`, `campaigns` e `stock-alerts` existem, têm teste e estão fora de `ROTAS_AGENDADAS`.
Motivo: mandam mensagem para cliente final, e a produção está ~113 commits atrás.

Ordem importa. Cada fase só começa quando a anterior está verde.

## Fase 0 · Publicar a branch (pré-requisito de tudo)
- Seguir `docs/runbooks/publicar-a-branch-de-trabalho.md`, em fatias.
- Conferir `GET /api/health` depois de cada fatia.
- **Quem faz:** eu preparo as fatias; o Vitor aprova o merge/deploy.

## Fase 1 · Alerta de estoque (risco zero: só avisa o dono)
Código (eu):
1. `ROTAS_AGENDADAS` += `stock-alerts` em `src/core/cron/agendadas.ts`.
2. Descomentar/adicionar o `schedule` dela em `cron.yml` (07:00 por fuso, mesma aritmética das outras).
3. Ligar o heartbeat dela (hoje só loga) e mapear em `ROTA_DO_HEARTBEAT`, senão o health não a vigia.
4. Rodar `saude-vigia-so-o-que-roda` e `cron-cobre-os-fusos`; mutar cada guarda para vê-la reprovar.
Vitor:
- Criar job no cron-job.org: `GET https://seuciclo.com.br/api/cron/stock-alerts`, header
  `Authorization: Bearer <CRON_SECRET>`, a cada 3h, fuso America/Sao_Paulo, guardar histórico.

## Fase 2 · Lembrete de horário (1 pessoa por vez, horário que ela marcou)
Pré-requisitos do Vitor (nenhum é código):
1. Conta no **Resend**, domínio de envio verificado (SPF/DKIM), `RESEND_API_KEY` na Vercel (Production).
2. Decidir: começar só por e-mail (recomendado) ou esperar o WhatsApp.
   Sem `WHATSAPP_*` a rota cai no e-mail, que também é envio real.
3. Um salão real de teste (o do próprio Vitor) com telefone/e-mail de gente que espera a mensagem.
Código (eu):
4. `ROTAS_AGENDADAS` += `reminders`; `schedule: */15 * * * *` no `cron.yml`; guardas verdes e mutadas.
5. Teste de "nunca manda para demo/opt-out/sem contato" reconferido; teto diário por tenant conferido.
Validação (juntos):
6. Disparar UMA vez à mão (`workflow_dispatch` ou curl com o segredo), olhar a tabela `messages`.
7. Só então criar o job `*/15` no cron-job.org e conferir `/api/health` (`sendReminders: ok`).
Reversão: pausar o job no cron-job.org (1 clique). Nada no código precisa mudar.

## Fase 3 · Campanha em lote (só depois de ~20 assinantes)
Pré-requisitos do Vitor:
1. WhatsApp Business (Meta) verificado + `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_APP_SECRET` na Vercel; templates aprovados pela Meta.
2. Plano de aquecimento do número (rampa de volume). Não existe hoje em lugar nenhum.
3. Decisão consciente sobre o teto: campanha fica no nível 2 ("deixa pronto"), nunca 3.
Código (eu): `campaigns` em `ROTAS_AGENDADAS`, 4 horários (10h local em UTC-2..-5) no `cron.yml`.
Validação: 1 salão, 1 rodada à mão, conferir `messages`, depois 4 jobs no cron-job.org.

## Ajustes na página do parceiro (eu, ao fim de cada fase)
Trocar a etiqueta "código pronto, desligado" por "no ar" e atualizar "2 de 8 rotinas agendadas".

## O que só o Vitor pode fazer (resumo)
Aprovar a publicação · criar conta/chave Resend · criar os jobs no cron-job.org ·
verificar o WhatsApp na Meta (quando chegar a hora) · dizer quais salões podem receber mensagem.
