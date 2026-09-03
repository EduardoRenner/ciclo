import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * **No React 19, `<form action={fn}>` RESETA o formulário quando a ação termina — inclusive quando
 * ela falhou.** Medido no navegador em 2026-09-03, na tela de entrar: errar a senha limpava e-mail
 * E senha, e a pessoa tinha que redigitar o e-mail a cada tentativa.
 *
 * É um dos problemas de maior impacto em UX de login, e é a explicação do relato que originou o
 * conserto: *"a etapa de login está muito ruim"*. Cada erro custava o formulário inteiro — e num
 * fluxo em que errar a senha é o caso comum, não a exceção.
 *
 * **A regra não é "nunca use `action`".** Em formulário de CRIAR, limpar depois do sucesso é
 * desejável: adicionou uma folga, o formulário fica pronto para a próxima. A regra é sobre a
 * FALHA — e como o `action` reseta sem perguntar se deu certo, ele não sabe fazer essa distinção.
 *
 * Nas quatro telas de autenticação a decisão é simples e por isso a guarda começa por elas: o
 * sucesso sempre navega para fora, então não existe caso em que limpar seja desejado. Ali o reset
 * era puro efeito colateral.
 */

const RAIZ = join('src', 'app', '(auth)')

function formularios(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...formularios(caminho))
    else if (/[.]tsx$/.test(e.name) && /<form[\s>]/.test(readFileSync(caminho, 'utf8'))) {
      achados.push(caminho.split(String.fromCharCode(92)).join('/'))
    }
  }
  return achados
}

const TELAS = formularios(RAIZ)

describe('o leitor deste teste', () => {
  it('acha os formulários de autenticação — não passa por não ter olhado nada', () => {
    expect(TELAS.length, 'nenhum formulário encontrado em (auth)').toBeGreaterThanOrEqual(4)
    for (const obrigatoria of ['entrar', 'cadastro', 'nova-senha', 'recuperar-senha']) {
      expect(
        TELAS.some((t) => t.includes(`/${obrigatoria}/`)),
        `${obrigatoria} saiu do alcance da guarda`,
      ).toBe(true)
    }
  })
})

describe('errar não pode custar o que a pessoa digitou', () => {
  it.each(TELAS)('%s não usa `action`, que reseta o formulário mesmo na falha', (tela) => {
    /*
     * Comentário some antes de casar: estes arquivos EXPLICAM em prosa por que não usam `action`,
     * e casar com a explicação reprovaria a documentação que impede o defeito de voltar. É a
     * armadilha nº 1 da tabela de guarda cega do `CLAUDE.md`.
     */
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    expect(
      /<form\s[^>]*\baction=/.test(fonte),
      `${tela} voltou a usar <form action={...}>. No React 19 isso limpa os campos quando a ação ` +
        'termina, inclusive quando ela falhou — e aqui o sucesso navega para fora, então limpar ' +
        'nunca é o que se quer.',
    ).toBe(false)
  })

  it.each(TELAS)('%s envia por `onSubmit` com `preventDefault`', (tela) => {
    // O outro lado: tirar o `action` e não pôr nada no lugar faria o formulário recarregar a
    // página no submit, que é pior que o reset.
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    expect(/onSubmit=/.test(fonte), `${tela} não tem manipulador de envio`).toBe(true)
    expect(/preventDefault\(\)/.test(fonte), `${tela} não impede o envio nativo — a página vai recarregar`).toBe(true)
  })
})

describe('o detector reconhece as duas formas', () => {
  it('acusa `action` e absolve `onSubmit`', () => {
    // Guarda contra o próprio detector: se o padrão parar de casar, tudo acima passa vazio.
    expect(/<form\s[^>]*\baction=/.test('<form action={enviar} className="x">')).toBe(true)
    expect(/<form\s[^>]*\baction=/.test('<form\n  onSubmit={(e) => {}}\n  className="x"\n>')).toBe(false)
  })

  it('não confunde o `action` de outra tag', () => {
    // `action` também é atributo válido em outros contextos; a guarda é sobre `<form>`.
    expect(/<form\s[^>]*\baction=/.test('<Button action="salvar">')).toBe(false)
  })
})
