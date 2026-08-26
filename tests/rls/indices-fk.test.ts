import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mesma regra do teste de isolamento ao lado: falta de credencial NÃO vira teste
// verde. Um skip silencioso aqui devolveria a dívida que a migration 0042 pagou.
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'O teste de índices de FK precisa de NEXT_PUBLIC_SUPABASE_URL e ' +
      'SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type FkSemIndice = { tabela: string; constraint_name: string; colunas: string[] }

/**
 * Toda chave estrangeira precisa de um índice que a cubra PELO PREFIXO.
 *
 * Por que isso é teste e não faxina de uma vez: o mecanismo de `on delete
 * cascade`/`set null` do Postgres busca a tabela filha **só pela coluna da FK**.
 * Sem índice com essa coluna no começo, cada linha apagada no pai vira varredura
 * sequencial da filha.
 *
 * Já derrubou este banco: a migration 0021 nasceu porque apagar um tenant com
 * 10 mil clientes travava em `statement timeout`. Ela consertou os TRÊS casos que
 * doeram naquele dia — e a auditoria de 2026-08-26 encontrou **62** ainda sem
 * índice, incluindo `tenant_id` em sete tabelas. Conserto pontual sem guarda é
 * conserto que a próxima tabela desfaz.
 *
 * O prefixo é a parte sutil e é onde a 0021 já tinha tropeçado: um índice
 * composto `(tenant_id, client_id)` **não** serve para uma busca só por
 * `client_id`. `fk_sem_indice_report()` (migration 0042) faz essa distinção no
 * catálogo, porque o PostgREST não expõe `pg_constraint`/`pg_index` — mesmo
 * desenho de `tenant_rls_report()` (migration 0005).
 */
const relatorio = await admin.rpc('fk_sem_indice_report')
if (relatorio.error) throw new Error(`fk_sem_indice_report falhou: ${relatorio.error.message}`)
const semIndice = (relatorio.data ?? []) as FkSemIndice[]

describe('toda chave estrangeira tem índice que a cobre', () => {
  it('a função de introspecção existe e respondeu', () => {
    /*
     * Guarda contra o próprio detector. Se a função sumir, for renomeada ou passar
     * a devolver vazio por engano, a asserção principal passaria por não ter o que
     * conferir — "verde por ausência", o defeito nº 1 da tabela do CLAUDE.md.
     * `data` não-nulo prova que a RPC respondeu; o array pode legitimamente ser
     * vazio, e é isso que o outro caso verifica.
     */
    expect(relatorio.data, 'fk_sem_indice_report não devolveu dado nenhum').not.toBeNull()
    expect(Array.isArray(relatorio.data)).toBe(true)
  })

  it('nenhuma FK ficou sem índice', () => {
    const lista = semIndice.map((f) => `${f.tabela}(${f.colunas.join(', ')})`).join('\n  ')
    expect(
      semIndice,
      'estas chaves estrangeiras não têm índice que as cubra pelo prefixo. ' +
        'Apagar a linha PAI vai varrer a tabela filha inteira — foi assim que a 0021 nasceu, ' +
        `com statement timeout num tenant grande:\n  ${lista}`,
    ).toEqual([])
  })
})
