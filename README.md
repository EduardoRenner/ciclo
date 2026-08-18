# CICLO

SaaS multi-tenant de gestão para profissionais da beleza (barbearia, unhas, cílios,
sobrancelha, depilação, estética). Mobile-first, pt-BR, Next.js + Supabase.

O diferencial não é a agenda: é o **Motor de Ciclo**, que aprende de quanto em quanto
tempo cada cliente volta, detecta quem está atrasado e traz de volta automaticamente.

## Comandos

```bash
pnpm dev        # sobe o app em http://localhost:3000 (rode `supabase start` antes)
pnpm verify     # typecheck + lint + test:unit + test:rls + build — rode antes de todo commit
pnpm test:rls   # isolamento multi-tenant; nunca pule
pnpm db:types   # regenera src/server/db/types.gen.ts a partir do banco local
pnpm db:reset   # reset do banco local + seed
```

## Onde está o quê

| Caminho | Conteúdo |
|---|---|
| `CLAUDE.md` | Regras invioláveis do repositório. Leia antes de escrever código. |
| `docs/00-BRIEFING.md` | Escopo, definição de pronto, estrutura de pastas. |
| `docs/06-BACKLOG.md` | Os 58 tickets, na ordem de implementação. |
| `docs/DECISOES.md` | Decisões tomadas durante a implementação. |
| `src/core/` | Regra de negócio pura, sem I/O. Não importa de `server/` nem de `app/`. |
| `supabase/migrations/` | Schema versionado. Toda tabela com RLS. |

## Como começar

```bash
pnpm install
cp .env.example .env.local   # preencha as chaves
supabase start
pnpm db:reset
pnpm dev
```
