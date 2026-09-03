import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { textoDeParaQueIndicar, textoDoConviteDoCiclo } from '@/core/billing/convite-do-ciclo'

/**
 * O convite B2B (`docs/30` §3) existe sem a recompensa que o `docs/18` §13.1 já decidiu — um mês
 * para quem indica e um para quem entra — porque não há como concedê-la: `billing_credits` não
 * existe, cobrança automática não existe, e um mês grátis prometido e não entregue custa mais que
 * a indicação inteira vale.
 *
 * Esta guarda é do mesmo tipo de `promessa-de-canal`: exercita a função que tem o direito de
 * escrever a frase, nos DOIS estados do mundo. Enquanto não houver como pagar, o convite não pode
 * falar em prêmio; no dia em que houver, a frase verdadeira volta sozinha.
 */

describe('textoDoConviteDoCiclo', () => {
  const base = { nomeDoNegocio: 'Barbearia do Dom', url: 'https://seuciclo.com.br' }

  it('SEM recompensa, não promete mês grátis, desconto nem nada a ganhar', () => {
    const texto = textoDoConviteDoCiclo(base)

    /*
     * O conceito, não a redação, e `[^\s]*` em vez de `\w*` pela lição já registrada em
     * `promessa-de-canal`: sem a flag `u`, `\w` é `[A-Za-z0-9_]` e não casa `ê`/`ã` — "mês" e
     * "ganhão" escapariam de um padrão baseado em `\w`.
     */
    expect(/ganh[^\s]*/i.test(texto), `prometeu ganho: "${texto}"`).toBe(false)
    expect(/m[êe]s (gr[áa]tis|de graça|livre)/i.test(texto), `prometeu mês grátis: "${texto}"`).toBe(false)
    expect(/desconto|cr[ée]dito|b[ôo]nus|cashback/i.test(texto), `prometeu prêmio: "${texto}"`).toBe(false)

    // E não pode virar silêncio: sem uma razão para a pessoa mandar, o botão é decoração.
    expect(texto.trim().length).toBeGreaterThan(80)
  })

  it('COM recompensa, a frase de prêmio volta — a guarda não trava copy honesta', () => {
    const texto = textoDoConviteDoCiclo({ ...base, temRecompensa: true })
    expect(texto).toMatch(/ganhamos um m[êe]s/i)
  })

  it('sai na voz do profissional, com o nome do negócio dele', () => {
    // `docs/18` §H.4: "o convite deve sair com a cara do profissional, não da marca". Em categoria
    // de autônomo, colega de ofício vale ordens de grandeza mais que anúncio — e só vale se quem
    // recebe reconhecer quem mandou.
    expect(textoDoConviteDoCiclo(base)).toContain('Barbearia do Dom')
    expect(textoDoConviteDoCiclo(base)).toMatch(/^Oi! Eu uso/)
  })

  it('negócio sem nome não deixa buraco na frase', () => {
    // O tenant pode não ter `name` preenchido. Sem este ramo sairia "aqui do ." na cara do colega.
    const texto = textoDoConviteDoCiclo({ ...base, nomeDoNegocio: '   ' })
    expect(texto).not.toMatch(/do\s*[.]/)
    expect(texto).toMatch(/^Oi! Eu uso/)
  })

  it('nenhuma das três palavras que o §4.3 proíbe no convite', () => {
    // "programa", "código" e "cadastre-se" transformam a indicação numa troca comercial, que é
    // justamente o que faz a pessoa não indicar. A regra vale para os dois laços.
    for (const temRecompensa of [false, true]) {
      const texto = textoDoConviteDoCiclo({ ...base, temRecompensa })
      expect(/programa|c[óo]digo de indica|cadastre-se/i.test(texto), `palavra proibida em: "${texto}"`).toBe(false)
    }
  })

  it('os dois estados dizem coisas diferentes', () => {
    // Guarda contra o próprio detector: com os ramos colapsados, as asserções acima podem
    // continuar passando e a função vira decoração.
    expect(textoDoConviteDoCiclo(base)).not.toBe(textoDoConviteDoCiclo({ ...base, temRecompensa: true }))
    expect(textoDeParaQueIndicar(false)).not.toBe(textoDeParaQueIndicar(true))
  })
})

describe('a recompensa continua desligada', () => {
  it('nenhuma tela liga `temRecompensa` enquanto não houver como conceder', () => {
    /*
     * A asserção que impede a boa intenção de virar dívida. `billing_credits` não existe, e ligar
     * este interruptor sem ele publica uma promessa de dinheiro que ninguém pode honrar — a classe
     * de promessa mais cara desta base. Quando a cobrança existir, este teste é o lugar de mudar,
     * junto com a evidência de que o crédito é concedido de verdade.
     *
     * Casa com a CHAMADA e não com o nome solto: `temRecompensa` aparece na assinatura da própria
     * função e no tipo, e casar com isso reprovaria o arquivo canônico para sempre.
     */
    const telas = ['src/app/admin/config/meu-plano/page.tsx']
    for (const tela of telas) {
      const fonte = readFileSync(tela, 'utf8')
      expect(/temRecompensa:\s*true/.test(fonte), `${tela} promete prêmio que o produto não concede`).toBe(false)
    }
  })
})
