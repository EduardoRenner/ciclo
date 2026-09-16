import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * T1.5 (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.2, critério de aceite #3): "um teste que varre o
 * app por qualquer combinação de 'Assinar'/'assinatura'/preço com um `<a>`/`<button>` ativo quando
 * `Capacitor.isNativePlatform()` é verdadeiro — visto reprovando com o botão de volta". Este teste
 * nunca tinha sido escrito — achado ao auditar o critério de aceite em 16/09, um dia depois do
 * ticket ter sido marcado "feito por completo". `modulos.tsx` e `orcamentos/lista.tsx` linkavam
 * pra `/precos` sem checar `nativo` até este mesmo commit corrigir os dois.
 *
 * O que este teste casa: todo `href="/precos"` literal em `src/`. Ele não entende JSX (nenhum
 * teste desta base entende — ver `preco-em-um-lugar-so.test.ts`), então a regra é textual, mas
 * casa com o que MUDA quando o defeito volta (regra do CLAUDE.md): a palavra `nativo` tem que
 * aparecer ANTES do href, dentro de uma janela curta, na mesma árvore de ternário. Uma página
 * pública (marketing, sem sessão, sem `nativo` fazendo sentido) fica na lista de exceção — a
 * exceção é por ARQUIVO inteiro, nunca por ocorrência, pra não virar uma lista que qualquer um
 * amplia escondendo o próximo caso real.
 */
const PUBLICO_SEM_TRAVA = new Set([
  // Marketing público: sem sessão, sem tela de cobrança nenhuma alcançável — o link é só
  // informativo, e existe também FORA do app (ex.: alguém abre o link recebido por WhatsApp).
  'src/app/(public)/privacidade/page.tsx',
  'src/app/(public)/termos/page.tsx',
  'src/app/page.tsx',
])

const JANELA_ANTES = 500
const RAIZ = 'src'

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosTsx(caminho)
    return /\.tsx$/.test(nome) ? [caminho.replace(/\\/g, '/')] : []
  })
}

function arquivosComLinkParaPrecos(): { caminho: string; fonte: string }[] {
  return arquivosTsx(RAIZ)
    .map((caminho) => ({ caminho, fonte: semComentarios(readFileSync(caminho, 'utf8')) }))
    .filter(({ fonte }) => fonte.includes('href="/precos"'))
}

describe('nenhum link pra /precos escapa do bloqueio de cobrança no app nativo', () => {
  it('a varredura encontrou pelo menos os arquivos que já se sabe que existem', () => {
    // Não pode passar vazio — senão o teste "passa" só porque parou de achar arquivo nenhum
    // (mesma armadilha que `preco-em-um-lugar-so.test.ts` já documentou: piso não é zelo).
    const caminhos = arquivosComLinkParaPrecos().map((a) => a.caminho)
    expect(caminhos).toContain('src/components/ui/bloqueio-plano.tsx')
    expect(caminhos.length).toBeGreaterThanOrEqual(8)
  })

  it('todo href="/precos" fora da lista pública tem `nativo` guardando por perto', () => {
    const violacoes: string[] = []

    for (const { caminho, fonte } of arquivosComLinkParaPrecos()) {
      if (PUBLICO_SEM_TRAVA.has(caminho)) continue

      let posicao = fonte.indexOf('href="/precos"')
      while (posicao !== -1) {
        const janela = fonte.slice(Math.max(0, posicao - JANELA_ANTES), posicao)
        if (!/nativo/.test(janela)) {
          violacoes.push(`${caminho} (byte ${posicao}): nenhum "nativo" nos ${JANELA_ANTES} caracteres antes do link`)
        }
        posicao = fonte.indexOf('href="/precos"', posicao + 1)
      }
    }

    expect(violacoes, violacoes.join('\n')).toEqual([])
  })

  it('o detector reconhece o defeito que ele impede', () => {
    // Mesmo formato de `modulos.tsx` ANTES da correção: link direto, sem ternário de `nativo`.
    const semGuarda = semComentarios(`
      export default function Modulos() {
        return <Link href="/precos">Ver planos</Link>
      }
    `)
    const posicao = semGuarda.indexOf('href="/precos"')
    const janela = semGuarda.slice(Math.max(0, posicao - JANELA_ANTES), posicao)
    expect(/nativo/.test(janela)).toBe(false)
  })
})
