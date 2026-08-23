# 16 · AUDITORIA DE SEGURANÇA — 2026-08-23

> Em andamento. Revisão de código e configuração, **não** pentest ofensivo contra produção.
> Modelo de ameaça, escopo e regras no prompt acordado com o Eduardo.

---

## 1 · Fase A — Inventário (concluída)

| Superfície | Números |
|---|---|
| Migrations | 33 |
| Tabelas | 48 |
| Edge Functions do Supabase | **0** (menos superfície) |
| Rotas de cron | 6 |
| Rotas públicas sem sessão (`/api/v1/public/*`) | 9 usando cliente que ignora RLS |
| Funções `security definer` | 10 |
| Arquivos com `SUPABASE_SERVICE_ROLE_KEY` | 1 (`with-tenant.ts`), com regra de lint própria |

---

## 2 · Verificado e CORRETO — o que já está bem feito

Registrado com o mesmo peso dos achados: auditoria que só lista problema não informa o risco real.

| Item | Por que está correto |
|---|---|
| **RLS em 48/48 tabelas** | 25 delas por laço dinâmico na 0001 (`tenant_tables[]`), o resto individualmente. Nenhuma tabela ficou de fora. |
| **`force row level security`** | Presente junto com `enable` em toda tabela — sem isso o dono da tabela furaria a própria política. |
| **`has_tenant()`** | `security definer` **com `set search_path = public`** (sem isso seria sequestrável por schema do atacante), decide por `auth.uid()` do JWT — nunca por dado que o cliente controla — e confere `m.active`, o que revoga ex-funcionário (atacante A2). |
| **Migration 0004** | Já tinha achado e fechado uma falha crítica real: `apply_vertical_pack()` era `security definer` e o PostgREST publica toda função de `public` em `/rest/v1/rpc/` — `anon` podia escrever em qualquer tenant. Revogada, junto com `set_tenant_context`/`clear_tenant_context`. |
| **Todas as 10 funções `security definer`** | Todas com `set search_path` fixo. As 4 que continuam executáveis (`has_tenant`, `tenant_role`, `my_professional_id`, `can_see_appointment`) **precisam** ficar assim (a RLS as avalia como quem consulta) e só respondem sobre o próprio `auth.uid()`. `handle_new_user` está revogada. |
| **Nenhuma política lê `app.tenant_id`** | O `set_tenant_context` seria contornável pelo cliente; conferido que política nenhuma depende dele, e que ele está revogado de `anon`/`authenticated`. |
| **`service_role` confinado** | Um arquivo só, com regra de lint (`ciclo/service-client-confinado`) que reprova o build — não é convenção, é imposto. |
| **Tokens de link público** | HMAC-SHA256, escopo dentro da assinatura (token de lista de espera não vale como confirmação), expiração conferida e **`timingSafeEqual`** com checagem de tamanho antes. Força bruta inviável. |
| **`withTenant` documenta o que NÃO garante** | O comentário explica que `set_tenant_context` não protege nada ali e que o chamador precisa filtrar `tenant_id` — honestidade rara e que evita falsa sensação de segurança. |

---

## 3 · Achados da Fase A

### S1 · `CRON_SECRET` serve a dois domínios de confiança diferentes — MÉDIO

**Onde:** `src/server/services/token-assinado.ts` (assinatura) × `src/app/api/cron/*/route.ts` (autenticação).

O mesmo segredo:
1. **Autentica o Vercel Cron** chamando o app (`Authorization: Bearer $CRON_SECRET`), e
2. **Assina os tokens HMAC dos links públicos** entregues ao cliente final por WhatsApp.

**Cenário (atacante A5).** Se o segredo vazar — log, captura de tela do painel da Vercel, alguém colando num chat — o atacante não ganha só a capacidade de disparar cron. Ganha a de **forjar qualquer token público**: confirmar ou cancelar agendamento alheio, reivindicar vaga de lista de espera de outra pessoa, e **aprovar orçamento** (que vira comanda cobrável). Um vazamento vira comprometimento dos dois domínios de uma vez.

**Armadilha operacional, independente de vazamento:** rotacionar `CRON_SECRET` é higiene normal de segurança — e hoje isso **invalida silenciosamente todo link público em circulação**. Cliente que recebeu "confirme seu horário" no WhatsApp ontem clica hoje e o link não vale mais, sem ninguém entender por quê.

**Correção proposta:** segredo próprio para assinatura de link (ex.: `PUBLIC_LINK_SIGNING_KEY`), com `CRON_SECRET` ficando só para cron. Para não quebrar links em circulação na virada, `verificarTokenAssinado` aceita a chave nova **e** a antiga durante uma janela de transição.

---

### S2 · Segredo de cron comparado sem proteção de tempo — BAIXO

**Onde:** as 6 rotas de `/api/cron/*`, todas com `if (!esperado || recebido !== esperado)`.

Comparação de string com `!==` sai no primeiro byte diferente. O tempo de resposta, em tese, revela quantos bytes iniciais estão certos.

**Honestidade sobre a exploração:** atacar isso remotamente, por HTTPS, contra comparação de string em JavaScript, com o ruído de rede e da Vercel no meio, é **muito difícil** — não é um cenário realista hoje. Reporto como **baixo** por dois motivos que independem da exploração: é uma inconsistência do projeto consigo mesmo (o `token-assinado.ts`, no mesmo código, usa `timingSafeEqual` corretamente), e a correção é de uma linha.

**Correção proposta:** extrair um `compararSegredo()` com `timingSafeEqual` e usar nas 6 rotas.

---

## 4 · Suspeitas em aberto (Fase B em diante)

- `withTenant`/`withNovoTenant` entregam cliente que **ignora a RLS por completo**; a única proteção é cada chamador filtrar `tenant_id` na mão. São 9 rotas públicas sem sessão nesse padrão. **Falta conferir uma a uma.**
- Rate limiting nas rotas públicas: ainda não verificado se existe.
- `can_see_appointment` — a trava de visão por profissional; ainda não lida.

