import { describe, expect, it } from 'vitest'

import { limiarPertoDoPremio } from '@/core/loyalty/limiar'
import { lerConfigFidelidade } from '@/server/services/fidelidade'

/**
 * O card "clientes perto do prêmio" (`centralDeAcoes`, `crm.ts`) usava `>= 80` cravado, enquanto
 * `rewardThreshold` é escolha do dono (1 a 100.000, padrão 100). Com o padrão a conta fechava por
 * coincidência — 80 é 80% de 100 — e por isso o defeito sobreviveu.
 *
 * **A primeira versão desta guarda era cega**, e isso ficou registrado de propósito: ela
 * espelhava `Math.ceil(0.8 * premio)` dentro do próprio arquivo de teste. Provava que a fórmula
 * é proporcional — não que o PRODUTO a usa. Com o defeito reintroduzido em `crm.ts`
 * (`const limiarDePontos = 80`), ela passou **verde**. Por isso a regra foi extraída para
 * `core/loyalty/limiar.ts` e este teste passou a chamar a MESMA função que a tela chama.
 */
describe('limiarPertoDoPremio', () => {
  it('no prêmio padrão (100), continua valendo 80 — o comportamento anterior é preservado', () => {
    expect(limiarPertoDoPremio(lerConfigFidelidade({}).rewardThreshold)).toBe(80)
  })

  it('prêmio ALTO não chama de "perto" quem mal começou', () => {
    // Prêmio 500: com o `>= 80` antigo, quem tinha 16% do caminho já era anunciado como perto.
    expect(limiarPertoDoPremio(500)).toBe(400)
    expect(limiarPertoDoPremio(500), 'voltou ao número fixo: 80 não é "perto" de 500').toBeGreaterThan(80)
  })

  it('prêmio BAIXO não deixa a automação cega para quem está de fato perto', () => {
    // O caso pior do defeito: prêmio 50, cliente com 40 pontos (80% do caminho) NUNCA aparecia,
    // porque 40 < 80. O resumo proativo ficava cego justamente para quem existe para pegar.
    const limiar = limiarPertoDoPremio(50)
    expect(limiar).toBe(40)
    expect(40 >= limiar, 'cliente a 80% do prêmio precisa entrar no card').toBe(true)
    expect(limiar, 'voltou ao número fixo: 80 é mais que o próprio prêmio de 50').toBeLessThan(80)
  })

  it('é proporcional, não constante — dobrar o prêmio dobra o limiar', () => {
    // Guarda contra o próprio detector: se alguém trocar por OUTRA constante, os casos acima
    // ainda poderiam passar por acaso. Esta prova a RELAÇÃO.
    expect(limiarPertoDoPremio(200)).toBe(2 * limiarPertoDoPremio(100))
    expect(limiarPertoDoPremio(1000)).toBe(10 * limiarPertoDoPremio(100))
  })

  it('nunca devolve 0 no prêmio mínimo — limiar 0 faria o card disparar para a base inteira', () => {
    // `rewardThreshold` aceita 1. `Math.floor` daria 0, e `saldo >= 0` é todo mundo, inclusive
    // quem nunca pontuou. O `ceil` existe por isso, e esta asserção é o que o prende.
    expect(limiarPertoDoPremio(1)).toBe(1)
    expect(limiarPertoDoPremio(1)).toBeGreaterThan(0)
  })
})
