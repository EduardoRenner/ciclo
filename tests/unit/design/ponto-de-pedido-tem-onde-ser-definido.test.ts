import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `products.reorder_point` existe desde a migration 0001 e passou a vida inteira LIDA em três
 * lugares — a regra `precisaRecomprar`, a linha " · repor com N" da lista e o recálculo do selo
 * "Repor" — e escrita em NENHUM. Não havia formulário, rota nem serviço que a definisse.
 *
 * O defeito não é o alerta sumir, é chegar tarde: a regra é "estoque ≤ ponto **ou** cobertura < 7
 * dias", e com o ponto travado em 0 a primeira metade só dispara com o produto já acabado.
 *
 * Esta guarda casa com a ESCRITA (o `reorder_point:` que vai para o `update`) e com o campo
 * chegando na requisição — nunca com o nome da coluna solto, que aparece em `select` por outro
 * motivo, nem com o comentário que explica tudo isso.
 */
const SERVICO = join('src', 'server', 'services', 'estoque.ts')
const TELA = join('src', 'app', 'admin', 'estoque', 'lista.tsx')

function fonte(caminho: string): string {
  const texto = semComentarios(readFileSync(caminho, 'utf8'))
  if (texto.trim().length === 0) throw new Error(`${caminho} veio vazio — a guarda perdeu o alvo`)
  return texto
}

describe('o ponto de pedido tem onde ser definido', () => {
  it('o serviço ESCREVE reorder_point (não só lê)', () => {
    // `reorder_point:` com dois-pontos é chave de objeto — é o que vai para o `update`.
    // O nome solto casaria com qualquer `.select('... reorder_point ...')`.
    expect(fonte(SERVICO)).toMatch(/reorder_point\s*:/)
  })

  it('o esquema aceita reorderPoint como opcional', () => {
    // Obrigatório quebraria toda entrada de estoque que só quer lançar a compra.
    expect(fonte(SERVICO)).toMatch(/reorderPoint\s*:\s*z\.[\s\S]{0,80}?optional\(\)/)
  })

  it('zero é gravado, não confundido com "não mexi nisso"', () => {
    // O bug natural aqui é `entrada.reorderPoint ? {...} : {}` — que trata 0 como ausência e
    // torna impossível DESLIGAR o aviso por quantidade. O teste tem que ser em `undefined`.
    expect(fonte(SERVICO)).toMatch(/reorderPoint\s*===\s*undefined/)
  })

  it('a tela manda o campo na requisição', () => {
    expect(fonte(TELA)).toMatch(/reorderPoint\s*:/)
  })

  it('a linha volta a calcular o alerta com o ponto NOVO, não com o antigo', () => {
    // Usar `p.pontoDePedido` (o valor antigo da linha) deixaria o selo "Repor" mentindo logo
    // depois de a pessoa definir o aviso.
    expect(fonte(TELA)).toMatch(/emAlerta:\s*estoque\s*<=\s*pontoDePedido\b/)
  })
})
