# Runbook · Resposta a incidente

Referência curta pra quando algo dá errado em produção. Passo a passo em `04-SEGURANCA-LGPD.md
§4`; este documento detalha COMO executar cada passo neste projeto específico.

## 1. Detectar

- Sentry (erro de aplicação).
- `/api/health` (banco, fila parada, taxa de falha de mensagem, `send_reminders` sem rodar).
- Aviso externo (cliente, parceiro, pesquisador de segurança).

## 2. Conter

- Chave/sessão comprometida: revogar no painel do Supabase (Authentication → Users → Revoke) e,
  se for uma chave de API (WhatsApp, Asaas, Supabase), trocar no painel do provedor e atualizar
  a variável de ambiente na Vercel.
- Serviço isolado: pausar o projeto Supabase (só em caso extremo — derruba todo mundo) ou
  desabilitar o cron específico em `vercel.json` + redeploy.
- **Nunca apague evidência** (log, linha de `audit_log`, `vault_access_log`) — mesmo que pareça
  a coisa certa a fazer, a investigação depende disso.

## 3. Avaliar

- Quais tenants foram afetados: `select distinct tenant_id from audit_log where created_at
  between ... and ...` (ajuste a janela e a tabela conforme o incidente).
- Quais titulares (clientes finais): join com `clients`/`appointments` a partir do `tenant_id`.
- Categoria de dado: comum, sensível (saúde/anamnese, `health_records`/cofre), ou financeiro
  (`tickets`/`payments`)? Sensível e financeiro exigem comunicação mais rápida.

## 4. Comunicar

- ANPD e titulares em prazo razoável quando houver risco relevante (LGPD art. 48).
- Modelo de comunicação: `docs/lgpd/modelo-comunicacao.md` (criar quando o primeiro incidente
  exigir — não existe um genérico bom o bastante pra manter pronto sem contexto real).
- Contatos definidos antes de precisar: responsável técnico de plantão, DPO, jurídico, suporte.

## 5. Corrigir

- Patch + teste de regressão (nunca só o patch — todo incidente de código vira um teste que
  falha sem o fix, `pnpm verify` continua sendo o portão).
- Migration corretiva pelo MCP do Supabase, salva em `supabase/migrations/`, nunca só aplicada
  direto no banco.

## 6. Aprender

- Post-mortem sem culpa em 5 dias úteis, publicado internamente.
- Se o incidente revelou uma armadilha nova do projeto, registrar em `docs/DECISOES.md` com a
  data — é exatamente o padrão que este projeto já usa pra todo defeito achado durante o
  desenvolvimento.

---

## Checar `/api/health` manualmente

```bash
curl -s https://<domínio>/api/health | jq
```

`200` com `"ok": true` = tudo certo. `503` = pelo menos um `checks.*.ok` é `false` — o campo
`detail` de cada check diz o quê.

## Teste de restauração de backup

O Supabase mantém PITR (point-in-time recovery) de 30 dias (RPO 15 min, RTO 4h — J130). Teste
mensal, registrado aqui com data e resultado:

| Data | Quem testou | Resultado | Observação |
|---|---|---|---|
| _(ainda não realizado)_ | | | Primeiro teste de restauração pendente — agendar antes do primeiro cliente real (J132). |

Procedimento: Supabase Dashboard → Database → Backups → escolher um ponto no tempo → restaurar
em um projeto de teste (nunca sobrescrever produção direto) → rodar `pnpm test:rls` contra o
projeto restaurado → confirmar que os dados batem com o esperado para aquele instante →
registrar nesta tabela.
