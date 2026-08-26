import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * No React 19, `await fetch` sem `try/catch` dentro de uma transição **não** falha em silêncio: a
 * Action que rejeita é RE-LANÇADA para o error boundary, e a tela inteira some. Medido no navegador
 * em 2026-08-25, quebrando o `fetch` de propósito em `/dom-rocha/agendar` — a página caiu e levou
 * junto o serviço, o profissional e o dia que a pessoa já tinha escolhido.
 *
 * Numa rede de subsolo, que é o cenário declarado do produto (§10 do design system), isso acontece
 * por uma piscada.
 *
 * ## Por que uma LINHA DE BASE, e não uma proibição direta
 *
 * Existem 18 arquivos assim hoje. Consertar os 18 de uma vez seria uma edição mecânica grande em
 * telas que dependem de sessão e que eu não consigo abrir no navegador para verificar — trocar um
 * defeito conhecido por 18 mudanças não verificadas não é progresso.
 *
 * Então esta guarda faz duas coisas, e a segunda é a que impede o registro de apodrecer:
 *
 *   1. arquivo NOVO com o defeito **reprova** — a dívida para de crescer;
 *   2. arquivo da lista que já foi consertado **também reprova**, pedindo para sair da lista — a
 *      lista só pode encolher, e nunca vira decoração.
 *
 * **Os 18 foram corrigidos em 2026-08-26** (`try/catch` em volta de cada `await fetch` dentro da
 * transição, revertendo estado otimista quando existia). `DIVIDA_CONHECIDA` está vazia — a guarda
 * continua aqui porque a primeira asserção (nenhuma tela nova entra com o defeito) é permanente,
 * não uma linha de base temporária.
 *
 * O `apiFetch` de `src/lib/offline/api-client.ts` já resolve isto para escrita (enfileira em vez de
 * estourar), e só duas telas usam. O motivo provável está registrado no `DECISOES.md`: ele devolve
 * `{queued}` sem o corpo da resposta, então quem precisa do dado criado de volta não consegue
 * adotá-lo. Reduzir esta lista passa por resolver isso — ou por tratar caso a caso.
 */

/** Arquivos que HOJE têm o defeito. Só pode encolher. */
const DIVIDA_CONHECIDA: readonly string[] = []

function telas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    // Caminho montado com `/` em vez de `path.join`: o resultado é comparado com a lista abaixo,
    // e no Windows o `join` devolveria `\`, que nunca casaria.
    const caminho = `${dir}/${e.name}`
    if (e.isDirectory()) return telas(caminho)
    return e.name.endsWith('.tsx') ? [caminho] : []
  })
}

/**
 * O corpo de cada callback passado a uma transição, casando chaves — e não um regex de uma linha
 * só. Sem contar chave, "tem `try` no arquivo" passaria por "tem `try` em volta do fetch", que são
 * coisas diferentes: um `try` num outro handler do mesmo arquivo não protege este.
 */
function corposDeTransicao(src: string): string[] {
  const corpos: string[] = []
  const abre = /(iniciar\w*|startTransition)\(async \(\) => \{/g
  let m: RegExpExecArray | null
  while ((m = abre.exec(src))) {
    let prof = 1
    let j = m.index + m[0].length
    while (j < src.length && prof > 0) {
      if (src[j] === '{') prof++
      else if (src[j] === '}') prof--
      j++
    }
    corpos.push(src.slice(m.index + m[0].length, j))
  }
  return corpos
}

function corpoTemODefeito(src: string): boolean {
  return corposDeTransicao(src).some((c) => c.includes('await fetch') && !c.includes('try {'))
}

function temFetchDesprotegido(arquivo: string): boolean {
  return corpoTemODefeito(readFileSync(arquivo, 'utf8'))
}

const COM_DEFEITO = telas('src/app')
  .filter(temFetchDesprotegido)
  .map((f) => f.replace('src/app/', ''))

describe('falha de rede não pode derrubar a tela', () => {
  /*
   * `DIVIDA_CONHECIDA` está vazia desde que os 18 foram corrigidos (2026-08-26) — não pode mais
   * guardar o detector contra regex quebrado (ver acima). No lugar, um par de fixtures em
   * memória: se o regex parar de casar `iniciar\w*(async () => {` ou parar de reconhecer
   * `try {`, os dois casos abaixo trocam de veredito e o teste denuncia antes de qualquer coisa
   * confiar no scanner vazio.
   */
  it('o detector reconhece o defeito quando ele existe', () => {
    const comDefeito = `
      function f() {
        iniciarTransicao(async () => {
          await fetch('/api/v1/x')
        })
      }
    `
    expect(corpoTemODefeito(comDefeito), 'o scanner deixou de casar `await fetch` sem `try` numa transição').toBe(true)
  })

  it('o detector NÃO acusa quando o fetch está protegido — prova que não é sempre-true', () => {
    const protegido = `
      function f() {
        iniciarTransicao(async () => {
          try {
            await fetch('/api/v1/x')
          } catch {
            setErro('falhou')
          }
        })
      }
    `
    expect(corpoTemODefeito(protegido), 'o scanner acusou uma transição que já tem try/catch — falso positivo').toBe(false)
  })

  it('o varredor de arquivos ainda encontra as telas do produto', () => {
    expect(telas('src/app').length, 'não achei telas para varrer').toBeGreaterThan(20)
  })

  it('nenhuma tela NOVA entra com o defeito', () => {
    const novos = COM_DEFEITO.filter((f) => !DIVIDA_CONHECIDA.includes(f))
    expect(
      novos,
      `estas telas têm \`await fetch\` numa transição sem \`try\`: no React 19 isso derruba a tela ` +
        `inteira no error boundary quando a rede pisca. Trate a falha ali mesmo — ou use o ` +
        `\`apiFetch\` de lib/offline, que enfileira em vez de estourar.`,
    ).toEqual([])
  })

  it('tela consertada sai da lista — a dívida só encolhe', () => {
    const jaConsertadas = DIVIDA_CONHECIDA.filter((f) => !COM_DEFEITO.includes(f))
    expect(
      jaConsertadas,
      `estas telas não têm mais o defeito e continuam na lista de DIVIDA_CONHECIDA. Remova-as: ` +
        `linha de base que não encolhe vira decoração, e para de significar alguma coisa.`,
    ).toEqual([])
  })
})
