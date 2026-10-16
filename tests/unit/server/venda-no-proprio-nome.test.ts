import { describe, expect, it, vi } from 'vitest'

import { exigirVendaNoProprioNome } from '@/server/services/venda-de-produto'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * APR-040 na venda de balcão (#149): com `comanda:own`, a rota aceitava qualquer `professionalId` do
 * corpo, e a comissão do produto ia para o colega escolhido no seletor.
 */
const TENANT = '00000000-0000-4000-8000-000000000001'
const EU = '00000000-0000-4000-8000-0000000000aa'
const COLEGA = '00000000-0000-4000-8000-0000000000bb'

function bancoQueResponde(resposta: { data: string | null; error: { message: string } | null }) {
  const rpc = vi.fn(async () => resposta)
  return { db: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('venda de balcão com alcance own', () => {
  it('no próprio nome, passa', async () => {
    const { db, rpc } = bancoQueResponde({ data: EU, error: null })
    await expect(exigirVendaNoProprioNome(db, TENANT, EU)).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('my_professional_id', { t: TENANT })
  })

  it('no nome do colega, recusa com FORBIDDEN', async () => {
    const { db } = bancoQueResponde({ data: EU, error: null })
    await expect(exigirVendaNoProprioNome(db, TENANT, COLEGA)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('quem não é profissional do salão também é recusado', async () => {
    const { db } = bancoQueResponde({ data: null, error: null })
    await expect(exigirVendaNoProprioNome(db, TENANT, EU)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('erro do banco não vira permissão', async () => {
    const { db } = bancoQueResponde({ data: null, error: { message: 'timeout' } })
    await expect(exigirVendaNoProprioNome(db, TENANT, EU)).rejects.toMatchObject({ code: 'INTERNAL' })
  })
})
