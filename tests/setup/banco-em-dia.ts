import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

import { compararSchema, MIGRATIONS_ESPERADAS } from '@/core/schema/versao'

import type { Database } from '@/server/db/types.gen'

/**
 * Recusa rodar as suítes de banco contra um schema ATRÁS do código.
 *
 * ## O defeito, medido em 2026-09-10 acontecendo
 *
 * O banco local desta máquina tinha **80 migrations aplicadas contra 83 no disco** — faltavam
 * exatamente a `0081`, `0082` e `0083`, que são o lote de recorte de RLS. E o `pnpm verify` passou
 * **verde**, `test:rls` incluído: 332 casos aprovaram um banco onde as políticas que eles existem
 * para checar ainda não tinham sido criadas.
 *
 * Não é hipótese. É a suíte de isolamento entre salões dando OK para um schema sem as políticas.
 *
 * ## Por que nada pegava
 *
 * A comparação existe e é boa (`compararSchema`), mas só roda em `/api/health`, em tempo de
 * execução. Entre o `supabase start` e o primeiro teste não havia ninguém. O mesmo buraco já tinha
 * quebrado `/admin/hoje` no local (faltava a view da `0058`) e a produção em 2026-09-04.
 *
 * ## A regra, e ela é a mesma da vigia de schema
 *
 * Só reprova o que dá para **provar**:
 *
 *   - lista lida e curta → vermelho, nomeando o que falta;
 *   - `PGRST202` (a função da `0062` não existe) → vermelho, porque isso PROVA que o banco está
 *     antes da `0062`;
 *   - qualquer outro erro de leitura → **não** derruba. Alarme permanente é o que
 *     `core/cron/agendadas.ts` proíbe, e travar `pnpm verify` por uma diferença de permissão local
 *     seria trocar um falso verde por um falso vermelho. Grita no stderr e deixa passar.
 *
 * Mora aqui, e não dentro de cada arquivo, pelo mesmo motivo de `so-banco-local.ts`: são 44 suítes,
 * e proteção que depende de alguém lembrar de repetir já falhou 44 vezes.
 */
dotenv.config({ path: '.env.local' })

const URL_DO_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ESCAPE = 'PERMITIR_BANCO_DEFASADO'

function grite(mensagem: string): void {
  // `console.warn` some no meio de 300 linhas de saída do vitest. A moldura é para não sumir.
  const barra = '='.repeat(78)
  process.stderr.write(`\n${barra}\n${mensagem}\n${barra}\n\n`)
}

if (URL_DO_BANCO && CHAVE && process.env[ESCAPE] !== '1') {
  const db = createClient<Database>(URL_DO_BANCO, CHAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await db.rpc('migracoes_aplicadas')

  if (error?.code === 'PGRST202') {
    throw new Error(
      `O banco de teste está ANTES da migration 0062: a função \`migracoes_aplicadas\` não existe ` +
        `nele. O código espera ${MIGRATIONS_ESPERADAS} migrations.\n\n` +
        `Rodar a suíte assim produz VERDE FALSO — foi o que aconteceu em 2026-09-10, com test:rls ` +
        `aprovando um banco sem as políticas que ele deveria estar checando.\n\n` +
        `Aplicar com \`npx supabase migration up --local\` (ou \`pnpm db:reset\` para recomeçar).`,
    )
  }

  if (error || !data) {
    grite(
      `AVISO: não deu para conferir se o banco de teste está em dia (${error?.code ?? 'sem dados'}).\n` +
        `A suíte vai rodar, mas um verde daqui NÃO afirma que o schema bate com o código.`,
    )
  } else {
    /*
      A comparação sai de `compararSchema`, que é a MESMA que o `/api/health` usa. Reescrever a
      regra aqui criaria a segunda cópia da fórmula, com a sua própria guarda — e é assim que duas
      definições divergem com as duas suítes verdes (armadilha já registrada na casa).
    */
    const estado = compararSchema(data.map((linha) => linha.name))
    if (!estado.ok) {
      throw new Error(
        `${estado.detail}\n\n` +
          `Por isso a suíte não vai rodar: em 2026-09-10 um banco 3 migrations atrás passou o ` +
          `\`pnpm verify\` inteiro no verde, test:rls incluído. O verde não teria significado nada.\n\n` +
          `Aplicar com \`npx supabase migration up --local\`.\n\n` +
          `Se você REALMENTE quer rodar contra este schema, repita com ${ESCAPE}=1.`,
      )
    }
  }
}
