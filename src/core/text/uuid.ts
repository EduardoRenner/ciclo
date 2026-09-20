/**
 * O regex de UUID v4 que validava `tenantId`/`chave de idempotência`/argumento de ferramenta de IA
 * antes de entrar numa consulta — idêntico, copiado em cinco arquivos (`core/assistente/acoes.ts`,
 * `server/auth/tenant.ts`, `server/db/filtro.ts`, `server/db/with-tenant.ts`,
 * `server/http/idempotency.ts`), nenhum importando dos outros.
 *
 * Mora em `core/` (regra 5 do `CLAUDE.md`) porque um dos cinco chamadores (`acoes.ts`) também é
 * `core/` — um regex em `server/` não poderia ser importado de lá.
 */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
