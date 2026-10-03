import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/87 D1 e D2: o Grátis deixou de ser vendido. Quem chega agora tem dias de uso completo sem
 * cartão e depois escolhe um plano. A promessa velha ("grátis para sempre") continuava em cinco
 * lugares ao mesmo tempo (home, `/precos`, `/cadastro`, `llms.txt` e `/termos`), e cada um tinha o
 * seu motivo para parecer certo. A guarda varre o fonte SEM comentários (os comentários explicam por
 * que a frase saiu, e casariam com ela) e exige o controle positivo em cada superfície: a função da
 * oferta tem que estar lá, senão "não achou a frase proibida" seria só "não achou nada".
 *
 * Não cobre `contato.ts` nem a tela "Meu plano" de propósito: ali a frase "o Grátis não expira" é
 * dita a contas ANTERIORES ao programa, que receberam essa promessa, e a promessa continua valendo.
 */
const SUPERFICIES = {
  home: 'src/app/page.tsx',
  precos: 'src/app/(public)/precos/page.tsx',
  cadastro: 'src/app/(auth)/cadastro/page.tsx',
  llms: 'src/app/llms.txt/route.ts',
  termos: 'src/app/(public)/termos/page.tsx',
  cartoes: 'src/lib/planos-cartoes.ts',
} as const

const FONTE = Object.fromEntries(Object.entries(SUPERFICIES).map(([k, f]) => [k, semComentarios(readFileSync(f, 'utf8'))])) as Record<keyof typeof SUPERFICIES, string>

const PROIBIDO: [RegExp, string][] = [
  [/gr[aá]tis para sempre/i, '"grátis para sempre"'],
  [/para sempre,? (sem|gr[aá]tis)/i, '"para sempre, sem cartão"'],
  [/comece de gra[çc]a/i, '"comece de graça"'],
  [/PLANOS\.gratis|NOME_DO_PLANO\.gratis/, 'o plano Grátis lido como oferta'],
  [/plano gr[aá]tis/i, '"plano grátis"'],
  [/O Gr[aá]tis n[ãa]o expira/i, '"o Grátis não expira"'],
]

describe('a copy pública não promete o Grátis para sempre', () => {
  for (const [nome, fonte] of Object.entries(FONTE)) {
    it(`${nome} não tem a promessa antiga`, () => {
      for (const [padrao, rotulo] of PROIBIDO) expect(fonte, `${SUPERFICIES[nome as keyof typeof SUPERFICIES]} voltou a dizer ${rotulo}`).not.toMatch(padrao)
    })
  }

  it('controle positivo: home, /precos, /cadastro e llms.txt dizem a oferta pela MESMA função que concede a cortesia', () => {
    for (const k of ['home', 'precos', 'cadastro', 'llms'] as const) {
      expect(FONTE[k], `${SUPERFICIES[k]} não chama ofertaDoCadastro: a frase pode ter voltado a ser datilografada`).toMatch(/ofertaDoCadastro\(new Date\(\)\)/)
    }
  })

  it('controle positivo: os termos dizem as datas e os prazos pelas constantes do programa', () => {
    expect(FONTE.termos).toMatch(/PRELANCAMENTO\.diasDaGraca|PRELANCAMENTO\.diasDeGraca/)
    expect(FONTE.termos).toMatch(/PRELANCAMENTO\.diasDePausa/)
    expect(FONTE.termos).toMatch(/cortesiaDoCadastro\(/)
  })

  it('a chamada é calculada DENTRO da página, nunca no topo do módulo (que envelhece numa instância quente)', () => {
    for (const k of ['home', 'precos', 'cadastro', 'llms'] as const) {
      const fonte = FONTE[k]
      const uso = fonte.indexOf('ofertaDoCadastro(new Date())')
      // Antes do uso tem que existir a abertura de uma função (a página, o GET ou generateMetadata).
      const antes = fonte.slice(0, uso)
      expect(antes, `${SUPERFICIES[k]} calcula a oferta no topo do módulo`).toMatch(/(function|=>)\s*[^]*$/)
      const ultimaLinhaDeTopo = antes.split('\n').reverse().find((l) => /^(const|let|var) .*ofertaDoCadastro/.test(l))
      expect(ultimaLinhaDeTopo, `${SUPERFICIES[k]} tem \`const ... = ofertaDoCadastro(...)\` no nível do módulo`).toBeUndefined()
    }
  })
})
