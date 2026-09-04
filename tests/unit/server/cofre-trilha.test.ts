import { afterEach, describe, expect, it, vi } from 'vitest'

import { registrarAcessoAoCofre } from '@/server/services/cofre-trilha'

const T = '11111111-1111-4111-8111-111111111111'
const C = '22222222-2222-4222-8222-222222222222'
const QUEM = { actorId: 'u-1', ip: '203.0.113.9', userAgent: 'Safari' }

/**
 * O banco falso passou a distinguir a TABELA em 2026-09-03, porque `registrarAcessoAoCofre` deixou
 * de fazer só um `insert`: ela agora busca o nome de quem acessou em `profiles`, para gravar em
 * `vault_access_log.actor_label` — o instantâneo que faz a trilha sobreviver à saída do
 * profissional do salão.
 *
 * `nomeDoAtor: null` simula o perfil que não existe (ou a consulta que falhou), que é o caminho em
 * que o rótulo fica vazio e o registro entra assim mesmo.
 */
function bancoFalso(
  erro: { message: string } | null = null,
  nomeDoAtor: string | null = 'Renata Lopes',
) {
  const linhas: Record<string, unknown>[] = []
  const db = {
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: nomeDoAtor === null ? null : { full_name: nomeDoAtor }, error: null }),
        }),
      }),
      insert: async (linha: Record<string, unknown>) => {
        if (tabela === 'vault_access_log') linhas.push(linha)
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
      // O instantâneo do nome. Sem ele, quando este profissional sair do salão, TODOS os acessos
      // dele à ficha de saúde viram "Usuário removido" — de uma vez e para sempre.
      actor_label: 'Renata Lopes',
      action: 'read',
      ip: '203.0.113.9',
      user_agent: 'Safari',
    })
  })

  it('perfil que não existe mais não impede o registro — o rótulo é que fica vazio', async () => {
    /*
     * O contrato desta função é que acesso ao cofre NUNCA fique sem trilha. A busca do nome é
     * melhor esforço: se o perfil sumiu entre o acesso e a gravação, ou se a consulta falhar, o
     * registro entra sem rótulo. Trocar a peça de LGPD por um nome bonito seria o pior negócio
     * possível — e é exatamente o tipo de regressão que um `throw` mal colocado ali produziria.
     */
    const { db, linhas } = bancoFalso(null, null)
    await registrarAcessoAoCofre(db, T, C, 'read', QUEM)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.actor_label).toBeNull()
    expect(linhas[0]?.actor_id).toBe('u-1')
  })

  it('acesso de sistema (sem ator) não inventa rótulo nem vai buscar perfil', async () => {
    // `actor_id: null` é job, não pessoa. Buscar `profiles` por null traria a linha errada ou
    // nenhuma, e gastaria uma consulta para nada.
    const { db, linhas } = bancoFalso()
    await registrarAcessoAoCofre(db, T, C, 'read', { actorId: null, ip: null, userAgent: null })
    expect(linhas[0]?.actor_id).toBeNull()
    expect(linhas[0]?.actor_label).toBeNull()
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
