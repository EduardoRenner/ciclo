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

  /**
   * Segundo achado, 2026-08-25: a decisão de DESCARTAR o que não subiu estava certa e
   * argumentada — num tablet de balcão, mandar depois em nome de quem entrar a seguir seria pior.
   * O que faltava era contar e avisar. Antes disto, quem marcasse doze atendimentos sem rede e
   * saísse perdia os doze sem uma palavra: a tela só dizia "limpa o que estiver guardado aqui".
   *
   * Descartar trabalho em silêncio é o defeito que a pessoa só descobre no dia seguinte, quando o
   * cliente aparece para um horário que não existe.
   */
  it('conta o que sobrou DEPOIS de tentar drenar, não antes', () => {
    const tela = conteudo.get(join('src', 'app', 'admin', 'config', 'sair.tsx'))
    expect(tela).toBeDefined()

    /*
     * `await ...(` e não o nome solto: a primeira versão deste teste procurava `drenarFilaPendente`
     * e casava com a linha de `import` no topo do arquivo, onde a ordem é a dos imports e não a da
     * execução. Passava mesmo quando a contagem voltava a acontecer antes da drenagem — o próprio
     * teste de mutação flagrou isso.
     */
    const depoisDaDrenagem = tela!.indexOf('await drenarFilaPendente(')
    expect(depoisDaDrenagem, 'não achei a CHAMADA de drenarFilaPendente').toBeGreaterThan(-1)
    const releitura = tela!.indexOf('await listarMutacoes(', depoisDaDrenagem)
    expect(
      releitura,
      'a fila precisa ser relida DEPOIS da drenagem — contar antes mede o que ia subir, não o que ficou',
    ).toBeGreaterThan(depoisDaDrenagem)
  })

  it('não apaga a fila sem a pessoa confirmar', () => {
    const tela = conteudo.get(join('src', 'app', 'admin', 'config', 'sair.tsx'))!
    expect(
      /restantes\.length\s*>\s*0\s*&&\s*!confirmado/.test(tela),
      'falta o portão: com mutação pendente e sem confirmação, sair tem que parar e avisar',
    ).toBe(true)
    expect(
      tela.indexOf('setADescartar'),
      'falta guardar a quantidade para poder dizê-la à pessoa',
    ).toBeGreaterThan(-1)
  })

  it('o aviso diz o número, e oferece a saída de não perder', () => {
    const tela = conteudo.get(join('src', 'app', 'admin', 'config', 'sair.tsx'))!
    expect(/\$\{aDescartar\}|\{aDescartar\}/.test(tela), 'o aviso precisa mostrar a quantidade').toBe(true)
    expect(/Continuar na conta/.test(tela), 'a pessoa precisa poder desistir de sair e salvar o trabalho').toBe(true)
    expect(
      /conecte à internet/i.test(tela),
      'o aviso precisa dizer O QUE FAZER para não perder — erro que só descreve o problema é meio erro',
    ).toBe(true)
  })
})
