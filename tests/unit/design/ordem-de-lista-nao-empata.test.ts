import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Ordenar por `created_at` sem desempate devolve ordem INSTÁVEL quando várias linhas nasceram no
 * mesmo instante — o que é improvável entre pessoas de verdade e garantido em importação e seed.
 *
 * Medido em 04/09 no `dom-rocha`: dois `curl` seguidos na mesma página traziam comentários
 * diferentes, e duas avaliações que eu tinha acabado de editar não apareciam. Foi assim que o
 * defeito apareceu — procurando outra coisa.
 *
 * Os dois lugares guardados aqui são os que a instabilidade MUDA O RESULTADO, não só a ordem:
 *
 * 1. **Avaliações da página pública** — tem `limit(5)`, então o empate muda QUAIS comentários o
 *    visitante lê.
 * 2. **Fila de espera** — `notificarProximoDaLista` escolhe UMA pessoa. Pior: `ordenarCandidatos`
 *    termina em `return 0` apostando explicitamente que "ordem de entrada já vem do
 *    `order('created_at')` da consulta". O `sort` do JS é estável, então a promessa inteira
 *    depende da consulta ser estável — e sem desempate ela não é. Com empate, a vaga que abriu
 *    vai para qualquer um.
 *
 * A guarda casa com a CHAMADA encadeada, não com a string `id` solta — que aparece em todo
 * `select` por outro motivo.
 */
const REVIEWS = join('src', 'server', 'services', 'public-booking.ts')
const FILA = join('src', 'server', 'services', 'lista-espera.ts')

function trecho(caminho: string, ancora: string, fim: string): string {
  const src = semComentarios(readFileSync(caminho, 'utf8'))
  const i = src.indexOf(ancora)
  if (i === -1) throw new Error(`âncora "${ancora}" sumiu de ${caminho} — a guarda perdeu o alvo`)
  const j = src.indexOf(fim, i)
  return src.slice(i, j === -1 ? undefined : j + fim.length)
}

describe('lista com empate de created_at tem desempate estável', () => {
  it('as avaliações da página pública desempatam antes de cortar em 5', () => {
    const bloco = trecho(REVIEWS, "not('comment', 'is', null)", 'limit(5)')
    expect(bloco, 'sem desempate, o `limit(5)` escolhe comentários diferentes a cada carregamento').toMatch(
      /\.order\(\s*'id'/,
    )
  })

  it('a fila de espera desempata antes de escolher quem leva a vaga', () => {
    // Âncora do `notificarProximoDaLista`: `service_id` filtrado pelo slot é o que distingue
    // esta consulta da de `listarFilaDeEspera`, que usa a mesma tabela e os mesmos filtros.
    const bloco = trecho(FILA, "eq('service_id', slot.serviceId)", 'if (error)')
    expect(bloco, 'ordenarCandidatos aposta na ordem desta consulta; sem desempate a vaga vai para qualquer um').toMatch(
      /\.order\(\s*'id'/,
    )
  })

  it('a fila que o salão vê também desempata', () => {
    const bloco = trecho(FILA, "is('fulfilled_at', null)", 'if (error)')
    expect(bloco).toMatch(/\.order\(\s*'id'/)
  })

  it('ordenarCandidatos continua apostando na ordem da consulta (é o que torna o desempate necessário)', () => {
    // Se um dia o desempate entrar no próprio comparador JS, esta guarda deixa de fazer sentido
    // e tem que ser revista em vez de silenciosamente proteger o lugar errado.
    expect(semComentarios(readFileSync(FILA, 'utf8'))).toMatch(/return 0/)
  })
})
