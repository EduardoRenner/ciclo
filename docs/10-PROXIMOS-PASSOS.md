# 10 · Próximos passos (pós-plataforma)

**2026-08-20.** Todas as fases de `09-PLATAFORMA.md` §15 (P−1 a P11) estão resolvidas: feitas,
parciais por decisão consciente, ou bloqueadas por decisão de negócio real. P4 (onboarding) foi
o achado mais importante da revisão — sem ele, todo o catálogo multi-profissão era inacessível
no cadastro; corrigido no mesmo dia (TICKET-072).

Este documento é o que vem depois: não é mais "ampliar o produto", é **verificar que o que foi
construído aguenta gente de verdade**, e depois voltar a ampliar com base no que faltar.

---

## 1. Verificação estrutural (VERIFICACAO-FINAL.md)

O checklist universal de 15 gates criado no início desta sessão (`C:\Users\Usuario\.claude\code\VERIFICACAO-FINAL.md`)
nunca rodou contra o CICLO de ponta a ponta — só pedaços foram tocados de passagem (RLS, testes,
migrations) como parte de cada fase, nunca como auditoria dedicada. Sequência recomendada,
cada uma cabendo numa iteração do loop:

- **V1 — Gates 0-4** (repositório/higiene, build/lint, testes automatizados, config/segredos,
  banco/RLS). Boa parte já está coberta pela disciplina desta sessão (RLS sempre testado,
  `pnpm verify` rodado a cada commit) — o valor aqui é confirmar formalmente, não descobrir do
  zero.
- **V2 — Gate 5** (segurança de aplicação: auth/autorização, injeção, CSP/headers, abuso/custo).
  CSP com nonce já existe (`src/middleware.ts`); vale conferir contra a lista de armadilhas do
  Anexo A do checklist.
- **V3 — Gate 6** (fluxos de negócio ponta a ponta: jornada principal, pagamento, mensageria,
  painel). Pagamento não se aplica ainda (Asaas bloqueado, P11) — mas os outros três sim, e boa
  parte já foi testada ao vivo nesta sessão fase a fase; falta o passe formal comparando contra
  o checklist.
- **V4 — Gates 7-10** (interface/conteúdo/acessibilidade, responsividade, performance,
  SEO/compartilhamento). Ainda não verificado nesta sessão.
- **V5 — Gates 11-14** (observabilidade/resiliência, legal/LGPD, deploy/pós-deploy, entrega ao
  cliente). **Antes de V5:** confirmar se o CICLO está de fato publicado (há projeto Vercel
  linkado — `starkinovacoes/ciclo` — mas `NEXT_PUBLIC_APP_URL` local aponta pra `localhost:3000`
  e não há remoto git configurado). Se não estiver no ar, gates 13/14 ficam ➖ justificados até
  a decisão de publicar ser tomada — não é trabalho técnico, é decisão do Eduardo.

## 2. Verificação de design (DESIGN-E-INTERFACE.md)

O companheiro do checklist acima (`C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md`) também
nunca rodou dedicado contra o CICLO — só `08-REDESIGN-E-IDENTIDADE.md` (Parte I, already ✅) tratou
disso, e antes da virada multi-profissão. Vale conferir se as telas novas desta sessão (série de
recorrência, orçamento, seletor de modelo de preço, busca de profissão no onboarding) seguem os
mesmos tokens/animação/copy do resto do produto — foram construídas rápido, sob o loop, sem o
mesmo nível de escrutínio visual que o resto já recebeu no `08`.

## 3. Backlog conhecido (não é trabalho novo — é o que já ficou registrado)

Tudo abaixo já está em `09-PLATAFORMA.md` §19, listado aqui só pra não se perder no meio de 15+
entradas:

| Item | Por que ainda não foi feito |
|---|---|
| Preço de faxina/eletricista confirmado com gente da área | P5 usou conhecimento geral, sem WebSearch na sessão |
| Tela de gestão de séries de recorrência (P7) | UI que só faz sentido com tenant de verdade usando |
| Tela de gestão de orçamentos (P8) | mesma razão |
| Converter orçamento aprovado em agendamento (P8) | decisão de UX de como escolher data/hora |
| Extensão automática do horizonte de séries (P7) | precisa de cron, não construído |
| Fotos/galeria na página pública (P6) | precisa de desenho de consentimento LGPD primeiro |
| Instrumentação do funil de onboarding (P4/§13.2) | sem tráfego real ainda pra medir |
| Marca única vs. marca recortada por nicho (§8/§13.1) | decisão comercial do Eduardo |
| Projeto Supabase próprio pra dev (§1.1) | decisão de custo do Eduardo |

## 4. O que só o Eduardo decide (não vira tarefa de loop)

- Preço de cada plano e o que libera (§13).
- Publicar o CICLO de verdade (domínio, Vercel) ou continuar em desenvolvimento.
- Segunda profissão-alvo comercial depois da beleza.
- Credenciais Asaas (P11).
- Nome do produto continuar CICLO ou mudar.

---

**Ordem sugerida pro loop:** V1 → V2 → V3 → V4 → (decisão de publicar) → V5, intercalando com
qualquer achado real que apareça no caminho — o padrão desta sessão inteira foi auditar antes
de construir, e registrar bloqueio real em vez de fingir que resolveu. Continua valendo.

---

## Relatório V1 — Gates 0-4 (2026-08-20, TICKET-073)

Matriz de escopo preenchida: site público ✅, painel admin ✅ (owner/manager/professional/
reception/finance), banco Supabase ✅ (`sukloaoodpxjukngyojo`), auth de usuário final ✅,
pagamento online ➖ (Asaas bloqueado, P11), mensageria ✅ (WhatsApp Cloud API + push + e-mail
fallback), IA em rota pública ➖ (não existe), upload de arquivo ✅ (bucket `media`), cron ✅
(lembretes, health check, fila de jobs), dado sensível ✅ (anamnese/saúde, LGPD), deploy ⬜
**não confirmado** — há projeto Vercel linkado (`starkinovacoes/ciclo`) mas `NEXT_PUBLIC_APP_URL`
local aponta pra `localhost:3000` e não há `git remote` configurado; não é ➖, é pendência real
de confirmar com o Eduardo antes de V5.

### Achado real (S1/S2 — corrigido nesta rodada)

**`public.profiles` nunca teve FK pra `auth.users`.** Confirmado: `select count(*)` batia
2342 em `profiles` contra **2** em `auth.users` — 2340 linhas órfãs com dado pessoal de
verdade (`full_name`, `email`, `phone`) sem conta nenhuma por trás. Causa raiz: a limpeza de
76 tenants de teste em P−1 apagou as contas de `auth.users` correspondentes, mas sem
`on delete cascade` os `profiles` ficaram pra trás — puro debris da limpeza anterior, não
histórico de negócio (confirmado: zero linhas em `memberships`/`appointments`/`tickets`/
`quotes`/etc. referenciavam qualquer um dos 2340 ids órfãos antes de apagar). Corrigido com
migration `0032`: apaga os órfãos, adiciona `profiles_id_fkey ... on delete cascade` — trava a
causa raiz pra isso nunca mais acontecer (inclusive protege o "direito ao esquecimento" da
LGPD: deletar uma conta agora limpa o perfil junto, automaticamente).

### Confirmado limpo (com evidência)

- **Gate 0** (higiene): `git status` limpo, nenhum segredo real no histórico (os 2 falsos
  positivos de `eyJ`/hash encontrados eram checksum de pacote no `pnpm-lock.yaml`), zero
  arquivo de rascunho/backup, zero TODO/FIXME real (1 falso positivo: "TODO tenant" é a
  palavra "todo" em português, não um marcador). Um `console.log` encontrado
  (`stock-alerts/route.ts`) é log estruturado JSON, mesmo padrão usado em toda a base — não é
  resíduo de depuração.
- **Gate 1** (build/estática): `typecheck`, `lint` e `build` de produção zero erro/warning.
  `pnpm audit --prod`: nenhuma vulnerabilidade. First Load JS compartilhado: **187 kB**
  (número registrado pra comparar em builds futuros). `/dev/ui` (vitrine de componentes) já
  tem `notFound()` gated por `NODE_ENV === 'production'` — confirmado no código, não suposto.
- **Gate 2** (testes): 410 unitários + 133 de RLS + 239 de integração, todos verdes.
  **Zero** `.skip`/`describe.skipIf` em todo o repo — todo teste de integração exige
  credencial real (lança erro se faltar `.env.local`), nunca pula em silêncio. O `it.each`
  dinâmico de `isolation.test.ts` (descoberta de tabela por introspecção) já tem o guard
  `expect(tabelas.length).toBeGreaterThan(20)` contra o caso "lista vazia = teste sempre
  verde" (armadilha real documentada no checklist, StarkOS).
- **Gate 3** (config/segredos): `.env.example` cobre as 23 variáveis realmente lidas em
  `src/` (conferido campo a campo via grep). `service_role`/`SERVICE_ROLE` só aparece nos
  dois arquivos autorizados (`with-tenant.ts`, `server-client.ts`) — tem regra de lint
  (`eslint.config.*`) travando isso, não é só convenção.
- **Gate 4** (banco/RLS): **todas** as 50 tabelas de `public` têm `rls_enabled: true`, sem
  exceção (`list_tables` verbose). `appointments_no_overlap` é `EXCLUDE USING gist` de
  verdade (concorrência travada no banco, não só no app). Nenhum float em coluna de dinheiro
  (busca por `parseFloat`/`Number(...)` perto de `price`/`cents` = zero resultado; tudo
  `bigint _cents`). `get_advisors` (segurança): 4 tabelas com RLS sem policy (todas
  service-role-only por design — `cron_heartbeats`, `idempotency_keys`, `job_queue`,
  `webhook_events` — INFO, não é falha), 3 extensões no schema `public` (WARN, baixo risco,
  padrão herdado do Supabase), 4 funções `SECURITY DEFINER` chamáveis por
  `anon`/`authenticated` (`can_see_appointment`, `has_tenant`, `my_professional_id`,
  `tenant_role` — são helpers `language sql stable`, só leitura, usados dentro das próprias
  políticas de RLS — seguro por desenho, não pendência), e "leaked password protection"
  desligada (WARN — é um toggle no painel do Supabase, ação de 1 clique, registrada abaixo).

### Pendências registradas (não bloqueiam, ficam para depois)

- **Ativar "leaked password protection"** no painel do Supabase Auth — ação de 1 clique fora
  do código, não uma correção de migration.
- **Confirmar status de deploy** com o Eduardo antes de V5 (projeto Vercel existe, não está
  claro se está publicado de verdade).
- Extensões `btree_gist`/`pg_trgm`/`citext` fora do schema `public` — baixo risco, baixa
  prioridade, backlog.

**Próxima fase do loop:** V2 — Gate 5 (segurança de aplicação).
