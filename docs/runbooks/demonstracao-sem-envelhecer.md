# Runbook · contas de demonstração que não envelhecem (docs/102 M2.1)

**O problema.** O histórico das 13 contas de demonstração (`src/core/tenants/demonstracao.ts`) para no dia em
que o gerador rodou. Duas semanas depois, Hoje e Agenda abrem vazios, e é a primeira tela que um visitante vê.
Medido em 2026-10-08 no banco local: o último agendamento do `demo-salao-encanto` era de 30/09.

**O conserto existe e precisa de agendador.** `scripts/seed-demo-agenda-futura.mjs` recria os próximos 21 dias
de cada conta de demonstração, com o volume tirado do ritmo dos últimos 90 dias do próprio negócio, sem
sobreposição. É idempotente (apaga só os futuros `pending`/`confirmed` e recria). Desde o M2.1 ele **recusa**
qualquer slug fora da lista de demonstração antes de escrever, e a lista é a mesma do produto (teste
`agenda-futura-so-demonstracao`).

## Rodar à mão

```bash
SUPABASE_URL=<url do projeto> SUPABASE_SERVICE_ROLE_KEY=<chave> node scripts/seed-demo-agenda-futura.mjs
```

Sem variáveis, ele usa o `.env.local` e diz em que host está escrevendo na primeira linha. Confira o host antes
de deixar terminar. Para uma conta só: acrescente o slug no fim.

## Agendar (decisão do Eduardo)

O plano recomenda uma vez por semana, segunda de madrugada, no mesmo agendador externo das outras rotas
(`docs/runbooks/cron-externo.md`), ou um job do GitHub Actions que rode o script com os segredos do projeto.
Não fica no `cron.yml` sem a decisão: escreve em produção.

Verde não é prova: o script imprime, por conta, quantos agendamentos criou e se a agenda ficou consistente.
Conta com zero criados é sinal de serviço ou horário de funcionamento faltando, não de sucesso.
