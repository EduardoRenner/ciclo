import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { OPERADORES } from '@/core/legal/operadores'

import { semComentarios } from '../../helpers/fonte'

/**
 * `/privacidade` dizia "os servidores ficam no Brasil" e nomeava quatro terceiros escritos à mão.
 * A frase era verdadeira só para o banco e as funções, e a lista estava curta. Aqui ela passa a ser
 * GERADA de `core/legal/operadores.ts`, e a guarda impede os dois defeitos de voltarem:
 * operador escrito à mão (que envelhece) e a frase ampla demais.
 *
 * Casa com a CHAMADA que gera a lista, e com os NOMES dos operadores no JSX: nome solto casaria com
 * o comentário que explica por que ele saiu da lista.
 */
const PAGINA = semComentarios(readFileSync('src/app/(public)/privacidade/page.tsx', 'utf8'))

describe('/privacidade lê a lista de operadores', () => {
  it('a lista é gerada da constante, não escrita à mão', () => {
    expect(PAGINA).toMatch(/OPERADORES_NA_POLITICA\.map\(\(o\) =>/)
    expect(PAGINA).toMatch(/\{o\.onde\}/)
    expect(PAGINA).toMatch(/\{o\.dadoQueRecebe\}/)
  })

  it('nenhum operador é nomeado à mão no JSX (o que está na lista vem da constante)', () => {
    for (const o of OPERADORES) {
      expect(PAGINA.includes(o.nome), `a página escreve "${o.nome}" à mão: ele vem de OPERADORES_NA_POLITICA`).toBe(false)
    }
  })

  it('a frase ampla demais não volta: "os servidores ficam no Brasil"', () => {
    expect(PAGINA, 'voltou a dizer que os servidores ficam no Brasil, e só o banco e as funções ficam').not.toMatch(/servidores ficam no Brasil/i)
  })

  it('o que a página diz do lugar e do navegador sai do que o repositório prova', () => {
    expect(PAGINA).toMatch(/O banco de dados e as funções do sistema ficam em São Paulo/)
    expect(PAGINA).toMatch(/As telas só falam com o próprio CICLO e com o banco de dados/)
    // E a constante sustenta a primeira frase: banco e funções são os dois com região provada no código.
    const confirmados = OPERADORES.filter((o) => o.ondeConfirmadoNoCodigo).map((o) => o.id)
    expect(confirmados.sort()).toEqual(['supabase', 'vercel'])
  })

  it('transferência internacional é dita, e o que está fora do Brasil aparece como tal na constante', () => {
    expect(PAGINA).toMatch(/transferência internacional \(LGPD, art\. 33\)/)
    const fora = OPERADORES.filter((o) => o.naPolitica && /fora do Brasil/.test(o.onde)).map((o) => o.id)
    expect(fora, 'a seção 5 promete que quem processa fora aparece como "fora do Brasil"').toEqual(
      expect.arrayContaining(['meta_whatsapp', 'resend', 'sentry', 'web_push']),
    )
  })

  it('o que está desligado não aparece como se recebesse dado', () => {
    for (const o of OPERADORES.filter((x) => !x.naPolitica)) expect(PAGINA.includes(o.nome), `${o.nome} está fora da política e dentro da página`).toBe(false)
    expect(OPERADORES.filter((x) => !x.naPolitica).map((x) => x.id).sort()).toEqual(['gemini', 'hcaptcha'])
  })
})
