import { afterEach, describe, expect, it, vi } from 'vitest'

import { registrarAcessoAoCofre } from '@/server/services/cofre-trilha'

const T = '11111111-1111-4111-8111-111111111111'
const C = '22222222-2222-4222-8222-222222222222'
const QUEM = { actorId: 'u-1', ip: '203.0.113.9', userAgent: 'Safari' }

function bancoFalso(erro: { message: string } | null = null) {
  const linhas: Record<string, unknown>[] = []
  const db = {
    from: () => ({
      insert: async (linha: Record<string, unknown>) => {
        linhas.push(linha)
        return { error: erro }
      },
    }),
  }
  return { db: db as never, linhas }
}

describe('registrarAcessoAoCofre', () => {
  afterEach(() => vi.restoreAllMocks())

  it('grava quem abriu a ficha de quem, e de onde', async () => {
    const { db, linhas } = bancoFalso()
    await registrarAcessoAoCofre(db, T, C, 'read', QUEM)
    expect(linhas[0]).toEqual({
      tenant_id: T,
      client_id: C,
      actor_id: 'u-1',
      action: 'read',
      ip: '203.0.113.9',
      user_agent: 'Safari',
    })
  })

  it('exportação de dados é uma ação distinta de leitura', async () => {
    const { db, linhas } = bancoFalso()
    await registrarAcessoAoCofre(db, T, C, 'export', QUEM)
    expect(linhas[0]?.action).toBe('export')
  })

  it('recusa do banco NÃO passa em silêncio', async () => {
    /*
     * O defeito que motivou esta função: os três chamadores faziam `insert` solto, e o
     * supabase-js não lança em erro de banco — devolve `{ error }`. O acesso a dado de saúde
     * ficava sem registro nenhum, sem ninguém saber. Trilha de LGPD que falha calada é pior que
     * trilha ausente.
     */
    const alarme = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = bancoFalso({ message: 'permission denied for table vault_access_log' })

    await registrarAcessoAoCofre(db, T, C, 'read', QUEM)

    expect(String(alarme.mock.calls[0]?.[0])).toContain('cofre_trilha_falhou')
  })

  it('a falha não derruba a operação que a pessoa já concluiu', async () => {
    // Ela já leu a ficha. Estourar aqui mostraria erro para algo que deu certo — e poderia
    // fazê-la tentar de novo, gerando mais acessos ao mesmo dado.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = bancoFalso({ message: 'qualquer coisa' })
    await expect(registrarAcessoAoCofre(db, T, C, 'read', QUEM)).resolves.toBeUndefined()
  })

  it('o alarme não carrega dado de saúde — só identificadores (regra 9 do CLAUDE.md)', async () => {
    const alarme = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = bancoFalso({ message: 'erro' })
    await registrarAcessoAoCofre(db, T, C, 'read', QUEM)

    const payload = String(alarme.mock.calls[0]?.[0])
    expect(payload).toContain(T)
    expect(payload).toContain(C)
    // Nada de conteúdo de ficha, nem de IP ou user-agent de quem acessou.
    expect(payload).not.toContain('203.0.113.9')
    expect(payload).not.toContain('Safari')
  })
})
