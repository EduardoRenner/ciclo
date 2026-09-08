import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Achado da auditoria de 2026-09-08, na família do `catch` que descarta (tabela de armadilhas do
 * `CLAUDE.md`).
 *
 * `despublicarTudoDoCliente` (`services/consentimentos.ts`) apagava a linha de `portfolio_photos`
 * PRIMEIRO e só então tentava `storage.remove` no bucket `vitrine` — que é **público** (0051) e
 * servido com `cacheControl: 31536000`. Quando a remoção falhava, o `console.warn` engolia a
 * falha, a rota devolvia 200 e a cliente lia "consentimento revogado" enquanto a foto dela
 * continuava acessível por URL pública.
 *
 * O agravante é o que a ordem destrói: a linha apagada era a única coisa que guardava o
 * `storage_key`. Sem ela, não sobra de onde reprocessar — o arquivo fica órfão no bucket e fora
 * do alcance do produto para sempre. Não é "a limpeza atrasou"; é "a limpeza nunca mais é
 * possível".
 *
 * **A guarda casa com a ORDEM, não com a presença das duas chamadas.** As duas continuam no
 * arquivo depois do conserto — o que muda quando o defeito volta é qual vem antes. Casar só com
 * "existe `storage.remove`" passaria verde com o defeito inteiro de volta.
 */
const ARQUIVO = join('src', 'server', 'services', 'consentimentos.ts')
const fonte = semComentarios(readFileSync(ARQUIVO, 'utf8'))

describe('revogar uso de imagem tira a foto do ar antes de esquecer onde ela está', () => {
  it('a varredura achou as duas chamadas — não passa vazia', () => {
    // Piso pelo positivo conhecido: se o detector parar de casar, tudo abaixo vira verde falso.
    expect(fonte.indexOf("storage.from('vitrine').remove("), 'sumiu a remoção no Storage').toBeGreaterThan(-1)
    expect(fonte.indexOf("from('portfolio_photos')"), 'sumiu a consulta a portfolio_photos').toBeGreaterThan(-1)
  })

  it('o arquivo sai do bucket ANTES de a linha que aponta para ele ser apagada', () => {
    const iStorage = fonte.indexOf("storage.from('vitrine').remove(")
    // O `.delete()` da cascata, não a leitura: recortado a partir do bloco de `portfolio_photos`
    // que remove, para não casar com outra consulta à mesma tabela no arquivo.
    const iDelete = fonte.indexOf('.delete()', fonte.indexOf("from('portfolio_photos')", iStorage))

    expect(iDelete, 'não achei o delete da cascata').toBeGreaterThan(-1)
    expect(
      iStorage,
      'a linha de portfolio_photos volta a ser apagada ANTES da remoção no Storage. Se o remove ' +
        'falhar, o storage_key some junto e a foto fica pública e irrecuperável — exatamente o ' +
        'defeito que esta guarda existe para pegar.',
    ).toBeLessThan(iDelete)
  })

  it('a falha ao despublicar interrompe, em vez de virar só um aviso no log', () => {
    /*
     * O `console.warn` continua ali de propósito (o rastro importa), então casar com a ausência
     * dele seria errado. O que decide é o `throw` DENTRO do bloco de falha do Storage.
     *
     * **A primeira versão desta asserção era cega, e a mutação revelou.** Ela recortava
     * `fonte.slice(iStorage, fonte.indexOf("from('portfolio_photos')", iStorage))` — com a ordem
     * antiga de volta, o `indexOf` não acha nada depois do storage, devolve -1, e `slice(i, -1)`
     * passa a varrer quase o arquivo inteiro, onde existem outros `throw new AppError` por outro
     * motivo. O caso passava verde com o defeito aplicado: a armadilha da "janela de N
     * caracteres" da tabela do `CLAUDE.md`, na prática.
     *
     * Agora o recorte é o BLOCO `if (erroStorage) { ... }`, delimitado pelo próprio fecho —
     * nunca por distância até outra coisa.
     */
    const iBloco = fonte.indexOf('if (erroStorage) {')
    expect(iBloco, 'não achei o tratamento de falha do Storage').toBeGreaterThan(-1)
    const bloco = fonte.slice(iBloco, fonte.indexOf('\n    }', iBloco))

    expect(
      /throw new AppError/.test(bloco),
      'a falha ao remover do bucket voltou a ser silenciosa: sem `throw`, a rota responde sucesso ' +
        'e promete uma despublicação que não houve.',
    ).toBe(true)
  })
})
