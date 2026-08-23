import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Achado S9 da auditoria de 2026-08-23: `POST /api/v1/auth/logout` existia, estava bem escrita
 * (`signOut({ scope: 'global' })`, que derruba os refresh tokens dos outros aparelhos) — e
 * **nada na interface a chamava**. Zero ocorrências em `src/app`, `src/components` e `src/lib`.
 * Num tablet de balcão, que é o caso de uso central deste produto, não havia como trocar de
 * pessoa: a recepcionista da tarde continuava na sessão da manhã.
 *
 * O componente em si é de browser (`fetch`, `indexedDB`, `useRouter`) e este projeto roda o
 * Vitest em `environment: 'node'`, sem jsdom — então o que dá para travar aqui é o que de fato
 * falhou: a existência da ligação entre a tela e a rota. Um teste de comportamento não teria
 * pego o defeito original, porque não havia comportamento nenhum para testar.
 */

const RAIZES = ['src/app', 'src/components', 'src/lib']

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const FONTES = RAIZES.flatMap(arquivos)
const naoRota = FONTES.filter((f) => !f.includes(join('api', 'v1', 'auth', 'logout')))
const conteudo = new Map(naoRota.map((f) => [f, readFileSync(f, 'utf8')]))

describe('sair da conta (achado S9)', () => {
  it('alguma tela chama POST /api/v1/auth/logout', () => {
    const quemChama = [...conteudo.entries()].filter(([, texto]) => texto.includes('/api/v1/auth/logout')).map(([f]) => f)
    expect(quemChama, 'Nenhuma tela chama a rota de logout — foi exatamente assim que o S9 nasceu.').not.toEqual([])
  })

  it('a tela de configurações é onde o botão vive', () => {
    // Não na Topbar: ela aparece em toda tela, e um alvo de 48px que encerra a sessão a um toque
    // o dia inteiro num tablet de balcão é acidente esperando acontecer.
    const pagina = conteudo.get(join('src', 'app', 'admin', 'config', 'page.tsx'))
    expect(pagina).toBeDefined()
    expect(pagina).toMatch(/SairDaConta/)
  })

  it('sair também apaga a fila offline, que guarda nome e telefone de cliente', () => {
    const quemApaga = [...conteudo.entries()]
      .filter(([, texto]) => texto.includes('/api/v1/auth/logout') && texto.includes('apagarBancoOffline'))
      .map(([f]) => f)

    expect(
      quemApaga,
      'Quem chama o logout precisa apagar o IndexedDB `ciclo-offline` no mesmo caminho: a fila ' +
        'guarda o corpo de cada mutação pendente e sobreviveria para a próxima pessoa do aparelho.',
    ).not.toEqual([])
  })

  it('redireciona com replace, não com push', () => {
    const sair = conteudo.get(join('src', 'app', 'admin', 'config', 'sair.tsx'))
    expect(sair).toBeDefined()
    // `push` deixaria o botão "voltar" do navegador devolver a tela autenticada de quem saiu.
    expect(sair).toMatch(/router\.replace\(/)
    expect(sair).not.toMatch(/router\.push\(/)
  })
})
