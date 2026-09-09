import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Unidade 13 da auditoria de 2026-09-08 — e ela mudou de forma no caminho, por medição.
 *
 * O plano dizia "migração de Input": trocar os `<input>` crus pelo componente `ui/input`, que traz
 * `<label>` de verdade, `aria-invalid`, texto de ajuda e 16px (a fonte que impede o Safari do
 * iPhone de dar zoom no foco).
 *
 * **Medi antes de migrar, e o número desmontou o plano.** São 60 campos crus, e a primeira
 * varredura acusou 38 sem rótulo. Fui ler: quase todos estão DENTRO de um `<label>` que os
 * envolve, com um `<span>` de rótulo — acessíveis, só verbosos. O detector é que era ingênuo.
 *
 * Refeita a conta considerando o `<label>` envolvente: **dois**. E um desses dois era outro falso
 * positivo meu — o recorte da tag parava no primeiro `>`, que numa JSX é o da seta do
 * `onChange={(e) => ...}`, antes de chegar ao `aria-label` que estava lá.
 *
 * Sobrou UM defeito real, consertado junto: o campo do link de convite em `profissionais/lista.tsx`
 * tinha um `<p>` acima fazendo as vezes de rótulo, sem associação nenhuma. Para quem usa leitor de
 * tela, isso é "editar texto" e mais nada — num campo que guarda a única cópia do convite.
 *
 * ## Por que a guarda, e não a migração
 *
 * Migrar 60 campos mecanicamente é onde o conserto vira defeito: já aconteceu nesta base
 * (`toque-48` em dois links inline deixou o segundo sem área tocável). O que precisa ser garantido
 * não é o COMPONENTE, é a PROPRIEDADE — todo campo tem rótulo associado. Quem migrar depois, por
 * outro motivo, continua passando; quem escrever campo sem rótulo reprova na hora.
 */

/** Tipos que não pedem rótulo visível: ou são invisíveis, ou o rótulo é o texto ao lado. */
const SEM_ROTULO_PROPRIO = new Set(['hidden', 'submit', 'button', 'reset', 'image'])

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).split(String.fromCharCode(92)).join('/')
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (entrada.name.endsWith('.tsx')) achados.push(caminho)
  }
  return achados
}

/**
 * Recorta a tag inteira a partir de `<input`, contando chaves.
 *
 * **Parar no primeiro `>` é errado em JSX**, e foi o que produziu um falso positivo ao escrever
 * esta guarda: `onChange={(e) => setX(...)}` tem um `>` no meio, e o recorte terminava antes dos
 * atributos que vêm depois — `aria-label` inclusive. O `>` que fecha a tag é o que está com
 * profundidade zero de chaves.
 */
export function recortarTag(fonte: string, inicio: number): string {
  let profundidade = 0
  for (let i = inicio; i < fonte.length; i++) {
    const ch = fonte[i]
    if (ch === '{') profundidade++
    else if (ch === '}') profundidade--
    else if (ch === '>' && profundidade === 0) return fonte.slice(inicio, i + 1)
  }
  return fonte.slice(inicio)
}

/**
 * Escondido com `display:none`, e portanto FORA da árvore de acessibilidade.
 *
 * É o padrão consagrado do campo de arquivo: um `<input type="file" className="hidden">` movido
 * por `ref`, com um botão estilizado por cima. O leitor de tela nunca chega nele — quem tem nome
 * acessível é o botão. Os quatro campos de arquivo do projeto são exatamente isso, e reprová-los
 * mandaria alguém pôr rótulo em algo que ninguém lê.
 *
 * `sr-only` NÃO entra aqui, e a diferença é o ponto: `sr-only` esconde do olho e MANTÉM no leitor
 * de tela — um campo assim precisa de rótulo mais do que os outros, não menos.
 */
function escondidoDoLeitor(tag: string): boolean {
  const classe = /className=["']([^"']*)["']/.exec(tag)?.[1] ?? ''
  return classe.split(/\s+/).includes('hidden')
}

/** Está dentro de um `<label>` que o envolve? */
function envolvidoPorLabel(fonte: string, posicao: number): boolean {
  const antes = fonte.slice(0, posicao)
  return antes.lastIndexOf('<label') > antes.lastIndexOf('</label>')
}

type Campo = { arquivo: string; linha: number; tipo: string }

function camposSemRotulo(): Campo[] {
  const achados: Campo[] = []
  for (const arquivo of [...arquivos('src/app'), ...arquivos('src/components')]) {
    // O próprio componente do design system É o lugar onde o `<input>` cru tem que existir.
    if (arquivo.includes('components/ui/input')) continue
    const fonte = readFileSync(arquivo, 'utf8')

    for (let i = fonte.indexOf('<input'); i !== -1; i = fonte.indexOf('<input', i + 1)) {
      const tag = recortarTag(fonte, i)
      const tipo = /type=["']?\{?["']?(\w+)/.exec(tag)?.[1] ?? 'text'
      if (SEM_ROTULO_PROPRIO.has(tipo)) continue
      if (/aria-label(?:ledby)?=/.test(tag)) continue
      if (/\bid=/.test(tag)) continue
      if (escondidoDoLeitor(tag)) continue
      if (envolvidoPorLabel(fonte, i)) continue
      achados.push({ arquivo, linha: fonte.slice(0, i).split('\n').length, tipo })
    }
  }
  return achados
}

describe('o leitor de tag entende JSX de verdade', () => {
  /*
   * Autoteste do detector, e ele não é decoração: a versão que parava no primeiro `>` acusou um
   * campo CORRETO, e eu quase "consertei" código bom. Guarda que reprova o certo custa o mesmo que
   * guarda que absolve o errado.
   */
  it('não termina a tag na seta de uma função', () => {
    const jsx = `<input onChange={(e) => setX(e)} aria-label="Cor" />`
    expect(recortarTag(jsx, 0)).toContain('aria-label')
  })

  it('termina no `>` que fecha a tag, não depois', () => {
    const jsx = `<input value={a} /><p>depois</p>`
    expect(recortarTag(jsx, 0)).toBe('<input value={a} />')
    expect(recortarTag(jsx, 0)).not.toContain('depois')
  })

  it('distingue `hidden` de `sr-only`', () => {
    /*
     * Os dois somem da tela; só um some do LEITOR DE TELA, e é essa a diferença que decide. Sem
     * este caso, alargar a exceção de `hidden` para `sr-only` — que é o erro plausível de quem
     * quiser calar a guarda — passaria sem ninguém ver.
     */
    expect(escondidoDoLeitor('<input type="file" className="hidden" />')).toBe(true)
    expect(escondidoDoLeitor('<input type="text" className="sr-only" />')).toBe(false)
    // Palavra inteira: `overflow-hidden` não esconde campo nenhum.
    expect(escondidoDoLeitor('<input className="overflow-hidden border" />')).toBe(false)
    expect(escondidoDoLeitor('<input className="mt-2" />')).toBe(false)
  })

  it('aguenta chave aninhada', () => {
    const jsx = `<input style={{ width: 10 }} aria-label="X" />`
    expect(recortarTag(jsx, 0)).toContain('aria-label')
  })
})

describe('todo campo de formulário tem rótulo', () => {
  it('a varredura enxerga os campos — não passa por não ter olhado nada', () => {
    /*
     * O piso é o positivo CONHECIDO, não a contagem: são 60 `<input>` crus hoje, e afirmar "achei
     * mais de N" deixaria a guarda passar vazia no dia em que o `<input` mudar de grafia.
     */
    const telas = [...arquivos('src/app'), ...arquivos('src/components')]
    expect(telas.length).toBeGreaterThan(80)
    expect(telas).toContain('src/app/admin/config/negocio/formulario.tsx')

    const crus = telas
      .filter((a) => !a.includes('components/ui/input'))
      .reduce((n, a) => n + (readFileSync(a, 'utf8').split('<input').length - 1), 0)
    expect(crus, 'nenhum `<input>` cru encontrado — o padrão parou de casar').toBeGreaterThan(20)
  })

  it('nenhum campo fica sem rótulo associado', () => {
    const orfaos = camposSemRotulo()
    expect(
      orfaos.map((c) => `${c.arquivo}:${c.linha} (type=${c.tipo})`),
      'campo sem rótulo associado. Para quem usa leitor de tela ele é anunciado como "editar ' +
        'texto", sem dizer de quê. Envolva num `<label>`, dê `id` + `htmlFor`, ou use ' +
        '`aria-label` — ou o componente `ui/input`, que resolve os três de uma vez.',
    ).toEqual([])
  })
})
