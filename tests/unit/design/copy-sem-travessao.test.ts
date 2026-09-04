import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

/**
 * **O travessão é a assinatura mais reconhecível de texto escrito por IA**, e tirá-lo da copy foi
 * pedido explícito do dono do produto. A remoção foi feita à mão em duas rodadas e **nada impedia a
 * volta**: em 2026-09-03, medindo uma tela nova no navegador, apareceram dois travessões novos numa
 * linha escrita naquela mesma sessão. Varrendo o resto, sobravam **outros 20** que as rodadas
 * anteriores não tinham alcançado — na tela de erro da raiz, na prévia que o WhatsApp mostra, no
 * botão de upgrade, no FAQ da home e nos `aria-label` do expediente.
 *
 * Ou seja: a limpeza manual não termina, porque a cada linha nova o hábito volta. Isto aqui é o que
 * transforma uma faxina em regra.
 *
 * **Alcance: o que RENDERIZA.** `.tsx` é a camada que a pessoa lê, mais as mensagens de erro que a
 * API devolve para a tela. Fica **de fora** de propósito o texto de `throw new Error()` em `.ts` de
 * servidor (`kek.ts`, `whatsapp.ts`, `token-assinado.ts` e companhia): aquilo é recado para quem
 * está depurando, nunca chega em cliente nenhuma, e proibir travessão ali seria regra de estilo
 * disfarçada de guarda de produto. Também ficam de fora os prompts do assistente — que, aliás, já
 * proíbem travessão por conta própria em `services/assistente.ts`.
 *
 * **A única exceção, e ela é tipografia, não prosa:** o travessão SOZINHO dentro de uma string
 * (`'—'`) é a convenção de célula vazia que Stripe, Linear e qualquer painel de dados usam para
 * "não há valor aqui". Trocar por "n/d" ou por vazio piora a leitura da tabela. O que a guarda
 * proíbe é travessão no MEIO de uma frase.
 */

const TRAVESSAO = String.fromCharCode(8212)

/**
 * Comentário fora antes de casar — armadilha nº 1 do `CLAUDE.md`, e aqui ela é quase garantida:
 * este projeto comenta em português com travessão o tempo todo, inclusive **neste arquivo**.
 *
 * Vai além do `semComentarios` da casa de propósito: aquele só apaga `//` que começa a linha, e
 * `src/app/admin/clientes/[id]/saude.tsx` tem um `//` no FIM de uma linha de código, com travessão
 * dentro. Sem tratar esse caso a guarda acusaria um comentário. O `[^:]` antes é o que impede de
 * decapitar `https://` no meio de uma URL.
 */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

/** Uma string cujo conteúdo inteiro é o travessão: a célula vazia. Some da varredura. */
function semPlaceholder(fonte: string): string {
  return fonte.split(`'${TRAVESSAO}'`).join("''").split(`"${TRAVESSAO}"`).join('""')
}

function rastrear(padrao: string): string[] {
  return execSync(`git ls-files "${padrao}"`, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
}

const TELAS = rastrear('src/**/*.tsx')
const ROTAS = rastrear('src/app/api/**/*.ts')

type Achado = { arquivo: string; linha: number; texto: string }

function travessoes(arquivos: string[], apenasMensagem = false): Achado[] {
  const achados: Achado[] = []
  for (const arquivo of arquivos) {
    const limpo = semPlaceholder(semComentarios(readFileSync(arquivo, 'utf8')))
    limpo.split('\n').forEach((linha, i) => {
      if (!linha.includes(TRAVESSAO)) return
      // Nas rotas de API só interessa o texto que volta para a tela, não log nem erro interno.
      if (apenasMensagem && !linha.includes('message:')) return
      achados.push({ arquivo, linha: i + 1, texto: linha.trim().slice(0, 100) })
    })
  }
  return achados
}

describe('o leitor deste teste', () => {
  it('acha os arquivos que renderizam — não passa por ter varrido lista vazia', () => {
    expect(TELAS.length, 'nenhum .tsx rastreado').toBeGreaterThan(50)
    expect(ROTAS.length, 'nenhuma rota de API rastreada').toBeGreaterThan(10)
    /*
     * Piso por NOME, não por contagem: "achei N arquivos" mente quando a varredura olha o lugar
     * errado — é a guarda cega de raiz do `CLAUDE.md`. Estes três são exatamente onde travessão já
     * voltou: a tela de erro da raiz, a home e o detalhe do agendamento.
     */
    for (const obrigatorio of ['src/app/error.tsx', 'src/app/page.tsx', 'src/app/admin/agenda/detalhe.tsx']) {
      expect(TELAS, `${obrigatorio} saiu do alcance da guarda`).toContain(obrigatorio)
    }
  })
})

describe('o detector reconhece as duas formas', () => {
  it('acusa travessão em frase e absolve o placeholder de célula vazia', () => {
    // Guarda contra o próprio detector: se ele parar de casar, tudo abaixo passa vazio.
    const frase = `<p>Seus dados estão salvos ${TRAVESSAO} foi só a exibição.</p>`
    expect(semPlaceholder(semComentarios(frase)).includes(TRAVESSAO), 'o detector cegou para prosa').toBe(true)
    const celula = `valor={taxa ?? '${TRAVESSAO}'}`
    expect(semPlaceholder(semComentarios(celula)).includes(TRAVESSAO), 'o placeholder virou violação').toBe(false)
  })

  it('não acusa comentário, nem no fim da linha, nem em JSX', () => {
    const bloco = `/* explica ${TRAVESSAO} isto */\nconst a = 1`
    const jsx = `{/* explica ${TRAVESSAO} isto */}\n<p>oi</p>`
    const fim = `if (x) return // já abriu ${TRAVESSAO} não repete`
    for (const [nome, fonte] of [
      ['bloco', bloco],
      ['jsx', jsx],
      ['fim de linha', fim],
    ] as const) {
      expect(semComentarios(fonte).includes(TRAVESSAO), `comentário de ${nome} acusado como copy`).toBe(false)
    }
  })

  it('não decapita URL, que também tem duas barras', () => {
    const url = `href="https://exemplo.com/a"`
    expect(semComentarios(url), 'a URL foi cortada no `//`').toContain('exemplo.com/a')
  })
})

describe('a copy do produto não tem travessão', () => {
  it('nenhuma tela renderiza travessão no meio de uma frase', () => {
    const achados = travessoes(TELAS)
    expect(
      achados.map((a) => `${a.arquivo}:${a.linha}: ${a.texto}`),
      'travessão voltou para a copy. É a marca mais reconhecível de texto escrito por IA e a razão ' +
        'do pedido de tirar todos. Reescreva a frase (ponto, vírgula ou dois-pontos resolvem quase ' +
        'sempre); se for célula vazia de tabela, use a string com o travessão sozinho.',
    ).toEqual([])
  })

  it('nenhuma mensagem de erro de API volta com travessão para a tela', () => {
    const achados = travessoes(ROTAS, true)
    expect(
      achados.map((a) => `${a.arquivo}:${a.linha}: ${a.texto}`),
      'o `message:` de uma rota é lido pela pessoa igual a qualquer outra copy.',
    ).toEqual([])
  })
})
