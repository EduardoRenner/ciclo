import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Toda tela do `/admin` que é Server Component `async` e busca dados (`await`) precisa de um
 * `loading.tsx` irmão.
 *
 * Sem ele, o Next não pinta NADA entre o clique e o Server Component terminar de buscar — numa
 * rede de subsolo isso são segundos de tela imóvel que a pessoa lê como "travou". O projeto já
 * pagou esse defeito uma vez (2026-08-18, `docs/DECISOES.md`) e sistematizou a solução em
 * `src/components/ui/esqueleto-tela.tsx` — mas nada impedia a próxima tela de nascer sem o
 * `loading.tsx`, e foi o que aconteceu com `config/modulos` e `config/meu-plano` (Fase M),
 * pegas só numa varredura manual meses depois.
 *
 * Casa com o que MUDA quando o defeito volta: a combinação `export default async function` + uma
 * chamada `await` no corpo (a busca). Página de `redirect` puro (`admin/page.tsx`) não é `async`
 * e não entra; página estática (sem `await`) também não precisa — o Next já mostra o esqueleto de
 * cliente nesses casos.
 */

const RAIZ = 'src/app/admin'

function paginas(dir: string): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achadas.push(...paginas(caminho))
    else if (entrada.name === 'page.tsx') achadas.push(caminho)
  }
  return achadas
}

/** Server Component `async` que busca dados — a que fica com a tela imóvel sem `loading.tsx`. */
function buscaDados(arquivo: string): boolean {
  const src = readFileSync(arquivo, 'utf8')
  return /export default async function/.test(src) && /\bawait\s/.test(src)
}

const PAGINAS = paginas(RAIZ)
const QUE_BUSCAM = PAGINAS.filter(buscaDados)

describe('toda tela do /admin que busca dados tem loading.tsx', () => {
  it('encontra as telas do painel', () => {
    // Guarda contra passar por não ter achado arquivo nenhum (glob quebrado, pasta movida).
    expect(PAGINAS.length).toBeGreaterThanOrEqual(25)
    expect(QUE_BUSCAM.length).toBeGreaterThanOrEqual(20)
  })

  it.each(QUE_BUSCAM)('%s tem um loading.tsx irmão', (arquivo) => {
    const irmao = join(dirname(arquivo), 'loading.tsx')
    expect(
      existsSync(irmao),
      `${arquivo} é Server Component async com fetch e não tem ${irmao} — a tela fica imóvel entre ` +
        'o clique e o fim da busca. Crie o loading.tsx reusando as peças de components/ui/esqueleto-tela.tsx.',
    ).toBe(true)
  })
})

/**
 * O `loading.tsx` acima cobre a espera do SERVIDOR. Sobra a outra, que ele não alcança: o
 * componente de cliente que precisa perguntar ao NAVEGADOR antes de saber o que desenhar.
 *
 * `config/notificacoes/ativar.tsx` fazia `if (estado === 'carregando') return null`. A seção
 * inteira sumia enquanto `serviceWorker.ready` e `getSubscription()` respondiam — e depois
 * aparecia do nada, empurrando o resto da página para baixo. Se a detecção travasse (e ela depende
 * do navegador, não do CICLO), a pessoa ficava olhando para um buraco sem saber que faltava algo
 * ali. Nenhum `loading.tsx` conserta isso: quando o Next terminou, este componente ainda nem
 * começou a perguntar.
 *
 * **Por que por NOME e não por varredura.** Varri `src/app` inteiro: dos treze `return null`, doze
 * são "não há o que mostrar" legítimo — lista vazia, `NOT_FOUND`, provedor social não configurado.
 * Só este era estado de espera. Uma regra que varresse `return null` reprovaria os doze certos, e
 * uma que tentasse adivinhar quais são espera erraria nos dois sentidos. A guarda vale mais
 * apontando o lugar onde o defeito de fato apareceu — que é onde ele volta.
 */
describe('detecção do navegador não deixa a seção em branco', () => {
  const ATIVAR = join('src', 'app', 'admin', 'config', 'notificacoes', 'ativar.tsx')

  it('o estado de carregando desenha esqueleto, não nada', () => {
    const src = readFileSync(ATIVAR, 'utf8')

    // Piso: se o componente parar de ter estado de espera, a asserção abaixo passaria vazia.
    const i = src.indexOf("if (estado === 'carregando')")
    expect(i, `${ATIVAR} não tem mais o ramo de carregando — esta guarda ficou sem objeto`).toBeGreaterThan(-1)

    // Só o ramo, delimitado pelo próximo `if` de estado: fatia por N caracteres pegaria o cartão
    // de `ios_nao_instalado` logo abaixo, que tem conteúdo e faria a asserção passar sempre.
    const ramo = src.slice(i, src.indexOf("if (estado ===", i + 10))

    expect(
      /return null/.test(ramo),
      `${ATIVAR} voltou a devolver null enquanto detecta. A seção some da página e reaparece ` +
        'empurrando o resto; se a detecção travar, fica um buraco sem explicação.',
    ).toBe(false)

    expect(/<Skeleton/.test(ramo), `${ATIVAR}: o ramo de carregando precisa desenhar o esqueleto do cartão`).toBe(true)
    expect(
      /aria-busy/.test(ramo),
      `${ATIVAR}: Skeleton é aria-hidden de propósito, então sem aria-busy o leitor de tela não ` +
        'fica sabendo que há algo vindo.',
    ).toBe(true)
  })
})
