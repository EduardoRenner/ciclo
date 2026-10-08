# docs/102 · Fase 0: evidência

Branch `melhoria/base-2026-10-08`. Banco local compartilhado. Cada mutação foi confirmada aplicada antes de
ler o teste (`grep -c` = 1, ou `has_table_privilege` = `t`) e desfeita depois.

## M0.1 · service worker (`3e8b16eb`)
Porte de `9b7d282c` (branch advocacia). Mutação: `if (false && url.origin !== ORIGEM)` → reprova
`URL assinada do storage (outro host) nunca é interceptada nem cacheada`. Desfeita: 13/13.

## M0.2 · dependências (`4b9f1514`)
`pnpm audit --prod`: de 2 altos e 4 moderados para **nenhum**. Total: de 23 (3 críticos) para 15 (2 críticos,
1 alto, todos de ferramenta de desenvolvimento: `tinypool` exige vitest 4; `braces` não tem versão corrigida).
Typecheck, lint, 3337 testes unitários e build passando com `next` 15.5.27.

## M0.3 · privilégio mínimo e eliminação LGPD (`809e366e`)
Antes (banco local, 59 tabelas do base): `anon` com privilégio em 59; TRUNCATE de `authenticated` em 58;
DELETE sem política de DELETE em 36. Depois: 0, 0, 0; as 23 tabelas com política de DELETE mantêm o DELETE.

Busca antes de revogar: todo `.delete()` nas 36 tabelas roda com `service_role` (`idempotency.ts` dentro de
`withTenant`, `lgpd.ts` chamado com `svc` pelas duas rotas, `onboarding.ts` com `svc`). O cliente do
navegador só aparece em `login-social.tsx`, para OAuth.

| # | Mutação no banco | Confirmação | Reprova |
|---|---|---|---|
| M1 | `grant delete on appointments to authenticated` | `t` | estrutura (DELETE sem política) e comportamento (a dona não apaga agendamento) |
| M2 | `grant select on clients to anon` | `t` | estrutura (anon) e comportamento (anon não lê tabela) |
| M3 | `grant truncate on tickets to authenticated` | `t` | estrutura (TRUNCATE) |
| M4 | tabela nova `zz_mutacao` com `select` para anon | nasce `anon=f, truncate=f, delete=t` | estrutura: anon e DELETE sem política |

M4 mostra que os privilégios padrão funcionam para `anon` e TRUNCATE, e que o DELETE de tabela nova ainda
nasce concedido: a guarda obriga quem criar a tabela a escolher (política de DELETE ou revogar).

**O que a integração achou.** `eliminarCliente` chamado com cliente de SESSÃO apagava zero linhas de
`health_records`, `client_cycles` e `client_scores` (sem política de DELETE), sem erro, e respondia
"eliminado". As duas rotas usam `svc`, então o caminho real não tinha o defeito; a função dependia do
chamador. Agora roda inteira com `service_role`; o teste de sessão prova que o dado de saúde some e que a
contagem bate. Mutação (voltar a usar o cliente de quem chamou) → reprova `chamado com um cliente de SESSÃO`.

**Falhas que não são desta branch.** No banco compartilhado, a suíte de RLS reprova 21 casos em tabelas
`legal_*` (criadas pela branch advocacia, que esta branch não sabe semear) e a integração reprova o catálogo
de profissões (19 em vez de 18: a profissão "advocacia" da 0102). Nas tabelas do base: zero falha.
