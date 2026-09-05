import { describe, expect, it } from 'vitest'

import { recorteDaLista } from '@/core/ciclo/recorte-da-lista'

/**
 * `listarParaRecuperar` corta `items` em 200 e soma `count`/`totalValueCents` sobre o filtro
 * INTEIRO — de propósito, e documentado lá. O que não existia era alguém contar isso para quem lê
 * a tela: num salão com 300 em risco, o topo dizia "300 clientes · R$ 15.000", a lista trazia 200,
 * e não havia paginação nem uma palavra sobre as outras 100.
 *
 * O defeito só aparece no salão grande — o cliente que menos se pode perder.
 */
describe('o recorte da lista é declarado, não escondido', () => {
  it('lista inteira na tela: nada a declarar', () => {
    expect(recorteDaLista(37, 37)).toBeNull()
    expect(recorteDaLista(0, 0)).toBeNull()
  })

  it('mais no total do que na tela: diz os dois números e como chegar no resto', () => {
    const frase = recorteDaLista(300, 200)

    expect(frase).toContain('Mostrando 200 de 300')
    // Por que essas 200 e não outras — o corte é por valor, e dizê-lo é o que o torna defensável.
    expect(frase).toContain('as de maior valor')
    // Aviso que não diz o que fazer vira só ansiedade.
    expect(frase).toContain('Filtre por situação')
    expect(frase).toContain('as outras 100')
  })

  it('uma só escondida: concorda no singular', () => {
    expect(recorteDaLista(201, 200)).toContain('chegar a outra.')
  })

  it('nunca anuncia recorte quando a tela mostra mais do que o total diz', () => {
    // Defensivo: `count` e `items` vêm da mesma chamada, mas uma divergência futura não pode
    // virar "Mostrando 200 de 150" na cara de quem paga.
    expect(recorteDaLista(150, 200)).toBeNull()
  })
})
