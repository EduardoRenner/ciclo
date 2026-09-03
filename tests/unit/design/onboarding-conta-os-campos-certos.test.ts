import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O H1 do onboarding afirma um NÚMERO: *"Três respostas e sua página está no ar"*. Ele é a variante
 * A do `docs/20-COPY-PLANO.md` §D.9, e o motivo de ela ter ganhado está escrito lá:
 *
 * > *"'Três respostas' é contável, verificável e some se um quarto campo aparecer — o que é bom: a
 * > copy passa a ser um freio contra o formulário crescer."*
 *
 * **Este arquivo é o freio.** Sem ele, a frase é só uma afirmação simpática que vira falsa no dia
 * em que alguém acrescentar um campo, e ninguém vai lembrar de voltar no H1 — é a mesma classe do
 * "menos de três minutos" que o `home-nao-promete-demais` teve que caçar, número sem lastro numa
 * tela de conversão.
 *
 * A guarda amarra as DUAS pontas, e é a amarração que importa: se o número mudar, o campo tem que
 * mudar junto, e vice-versa. Nenhuma das duas pontas sozinha pega o defeito.
 */

const PAGINA = 'src/app/onboarding/page.tsx'
const FORMULARIO = 'src/app/onboarding/formulario.tsx'

/** Como o número aparece escrito na copy. Só os que cabem num formulário de onboarding. */
const NUMERO_POR_PALAVRA: Record<string, number> = { uma: 1, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6 }

/**
 * Quantos campos a pessoa preenche. Conta a prop `rotulo`, que é o rótulo visível de todo
 * componente de campo desta casa (`Input`, `Select`, `PhoneInput`, `MoneyInput`) — e por isso conta
 * o que MUDA quando o defeito volta: campo novo sem rótulo não existe, porque rótulo é obrigatório
 * no design system e a guarda de acessibilidade reprovaria antes.
 *
 * Comentário é removido primeiro: este arquivo de teste e o próprio formulário citam `rotulo` em
 * prosa, e casar com a citação é a armadilha nº 1 da tabela de guarda cega do `CLAUDE.md`.
 */
function camposDoFormulario(): number {
  const fonte = semComentarios(readFileSync(FORMULARIO, 'utf8'))
  return (fonte.match(/\brotulo=/g) ?? []).length
}

function numeroAfirmadoNoH1(): { palavra: string; valor: number } | null {
  const fonte = semComentarios(readFileSync(PAGINA, 'utf8'))
  const h1 = /<h1[^>]*>([^<]+)<\/h1>/.exec(fonte)
  if (!h1) return null
  const m = new RegExp(`\\b(${Object.keys(NUMERO_POR_PALAVRA).join('|')})\\s+respostas?\\b`, 'i').exec(h1[1]!)
  if (!m) return null
  const palavra = m[1]!.toLowerCase()
  return { palavra, valor: NUMERO_POR_PALAVRA[palavra]! }
}

describe('o leitor deste teste', () => {
  it('acha os campos do formulário — não passa por não ter contado nada', () => {
    expect(camposDoFormulario(), 'nenhum campo encontrado: a prop de rótulo mudou de nome').toBeGreaterThan(0)
  })

  it('acha o número escrito no H1', () => {
    const n = numeroAfirmadoNoH1()
    expect(n, 'o H1 não afirma mais um número de respostas — se isso foi de propósito, apague esta guarda junto').not.toBeNull()
  })

  it('não confunde a palavra em comentário com a do H1', () => {
    // O próprio `page.tsx` explica em comentário por que a copy diz "Três respostas". Casar com o
    // comentário faria a guarda passar com o H1 dizendo outra coisa.
    const comentado = semComentarios('{/* a copy diz "Três respostas" de propósito */}\n<h1>Vamos criar seu negócio</h1>')
    expect(/três\s+respostas/i.test(comentado)).toBe(false)
  })
})

describe('o número que o onboarding promete é o número de campos que ele tem', () => {
  it('a copy e o formulário concordam', () => {
    const n = numeroAfirmadoNoH1()!
    expect(
      camposDoFormulario(),
      `o H1 promete "${n.palavra} respostas" e o formulário tem ${camposDoFormulario()} campos. ` +
        'Ou o campo novo sai, ou o H1 muda junto — número em tela de conversão sem lastro é a ' +
        'classe do "menos de três minutos" que o `home-nao-promete-demais` já teve que caçar.',
    ).toBe(n.valor)
  })

  it('o H1 não volta a dizer que está criando o negócio da pessoa', () => {
    /*
     * `docs/20` §D.9: *"'Vamos criar seu negócio' sai por ser factualmente errado: o negócio da
     * pessoa existe há anos; o que está sendo criado é uma conta. É o tipo de frase que quem tem o
     * negócio nota na hora."* Vale para o H1 e para a mensagem de erro.
     */
    const alvos = [PAGINA, FORMULARIO].map((a) => semComentarios(readFileSync(a, 'utf8')))
    for (const [i, fonte] of alvos.entries()) {
      expect(
        /criar (seu|o seu) neg[óo]cio/i.test(fonte),
        `${[PAGINA, FORMULARIO][i]} diz "criar seu negócio" — o negócio dela já existe, o que se cria é a conta`,
      ).toBe(false)
    }
  })

  it('o erro do onboarding diz o que fazer, não só o que falhou', () => {
    // Regra do CLAUDE.md. O endereço da página é o único dos três campos que pode colidir com o de
    // outra pessoa, então é o único que ela consegue consertar sozinha — e é o que o erro nomeia.
    const fonte = semComentarios(readFileSync(FORMULARIO, 'utf8'))
    const m = /setErro\([^)]*?'([^']*n[ãa]o consegui criar[^']*)'/i.exec(fonte)
    expect(m?.[1], 'sumiu a mensagem de falha do cadastro').toBeTruthy()
    expect(
      /tente de novo|confira|verifique/i.test(m![1]!),
      `a mensagem "${m![1]}" diz o que falhou e não o que fazer`,
    ).toBe(true)
  })
})
