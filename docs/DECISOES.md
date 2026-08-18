# Decisões tomadas durante a implementação

Formato: `data · pergunta · decisão · motivo`.
Só entra aqui o que **não** estava resolvido em `docs/05-FAQ-DEV.md`.

---

2026-08-17 · Onde mora o repositório? · `C:\Users\Usuario\.claude\code\ciclo` · é onde vivem os
outros projetos da mesma conta; nada na especificação fixava o caminho.

2026-08-17 · A especificação veio como um arquivo único; como fica o `docs/` que o briefing
descreve? · Recortei o documento nos arquivos previstos (`00-BRIEFING` … `06-BACKLOG`) e guardei
o original em `docs/ESPECIFICACAO-COMPLETA.md` · o briefing e o `CLAUDE.md` referenciam esses
caminhos; sem o recorte, toda referência da documentação apontaria para o vazio.

2026-08-17 · Vitest é do TICKET-005, mas a definição de pronto exige `pnpm verify` desde o
TICKET-001 · Instalei o Vitest já no TICKET-001, com `--passWithNoTests` em `test:unit` e
`test:rls` · sem isso o `verify` não existiria no primeiro commit; os testes de verdade entram
nos tickets que os pedem, e o `--passWithNoTests` sai no TICKET-005.

2026-08-17 · Qual base do shadcn/ui, já que a CLI nova pede preset? · `-b radix -p nova` · é a
base Radix clássica, a que a comunidade documenta; o preset só define a paleta inicial, que o
TICKET-013 substitui pelos tokens do CICLO.

2026-08-17 · Fonte da interface · Inter via `next/font/google` · `03-DESIGN-SYSTEM §2` pede uma
família variável e nomeia a Inter; o padrão do `create-next-app` (Geist) foi removido.

2026-08-17 · Não há Docker nem Postgres nesta máquina, e o `supabase start` do TICKET-002 depende
de Docker · Eduardo autorizou criar um projeto Supabase novo (`ciclo`, ref `sukloaoodpxjukngyojo`,
região sa-east-1, US$ 10/mês) e o desenvolvimento roda contra ele · sem banco não dá para cumprir
os TICKET-003/004/005; o ambiente `local` do briefing volta a valer se o Docker for instalado
depois (o `db:types:local` já está no `package.json` para esse caso).

2026-08-17 · `db:types` da PARTE 10 usa `--local`, que exige `supabase start` · `db:types` agora
aponta para `--project-id $SUPABASE_PROJECT_REF` e a versão local virou `db:types:local` · é o
banco que existe hoje; as duas formas geram o mesmo arquivo.

2026-08-17 · **Defeito na 0002:** o cabeçalho promete que `apply_vertical_pack()` é idempotente,
mas rodar duas vezes duplicava tudo (medido: 6→12 serviços, 7→14 produtos, 6→12 dias de
expediente). Os `on conflict do nothing` não tinham índice único para morder · criei a migration
`0003_pack_idempotency.sql` com índices únicos em `services (tenant_id, name)`,
`products (tenant_id, name)` e `business_hours (tenant_id, professional_id, weekday, opens_at)`
· o TICKET-015 chama essa função no onboarding; uma tentativa repetida após falha deixaria o
catálogo duplicado. Verificado: três execuções seguidas agora param em 6/7/7/6.

2026-08-17 · **Falha de segurança na 0002:** `apply_vertical_pack()` é `SECURITY DEFINER` e o
PostgREST expõe toda função do schema `public` em `/rest/v1/rpc/`. O papel `anon` podia chamá-la
com o uuid de qualquer tenant e escrever serviços, produtos e expediente lá dentro, por cima da
RLS · criei a migration `0004_lock_down_helper_functions.sql`, que revoga o EXECUTE de
`apply_vertical_pack`, `set_tenant_context` e `clear_tenant_context` para `anon`/`authenticated`
e fixa o `search_path` das funções que estavam sem · `has_tenant`, `tenant_role`,
`my_professional_id` e `can_see_appointment` continuam executáveis de propósito: as políticas de
RLS avaliam essas funções com o privilégio de quem consulta, então revogar quebraria a RLS
inteira — e elas só respondem sobre o próprio `auth.uid()`.

2026-08-17 · Extensões `btree_gist`, `pg_trgm` e `citext` ficam no schema `public` (aviso do
advisor) · mantidas onde a 0001 as colocou · mover exige recriar o índice trigram de `clients` e
a exclusion constraint de `appointments`; fica anotado para o TICKET-057 (endurecimento final).
