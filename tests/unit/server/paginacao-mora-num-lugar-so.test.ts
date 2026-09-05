import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `.range()` só pode aparecer em `server/db/paginar.ts`.
 *
 * O PostgREST corta em `max_rows = 1000` e **não erra** — devolve as primeiras mil e cala. Quem
 * soma em cima disso entrega número errado com cara de certo. `buscarTudoPaginado` existe para
 * isso, e o `paginar.ts` conta o defeito real: um tenant com 10 mil atendimentos perdia 90% deles
 * em silêncio.
 *
 * Só que a existência do helper não limpou a família. Em 05/09 ainda havia DUAS cópias do laço
 * escritas à mão — `caixa.ts` (fechamento do dia) e `comissao.ts` (extrato do profissional), as
 * duas somando **dinheiro**. A paginação delas estava certa; o que faltava era a metade que o
 * helper tem e a cópia não: **teto**. Eram `for (;;)` com saída só na página curta, então uma
 * consulta que devolvesse sempre página cheia rodaria para sempre.
 *
 * Por isso a guarda é sobre o LUGAR, e não sobre "tem teto?": cópia nova nasce sem teto justamente
 * porque quem copia copia a parte que entende. Uma implementação só é o que garante que a próxima
 * correção alcance todo mundo — a lição de `consertar-a-pergunta-nao-o-caso`.
 */

const RAIZ = 'src'
const DONO = join('src', 'server', 'db', 'paginar.ts')

function arquivosTs(dir: string): string[] {
  const achados: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) achados.push(...arquivosTs(caminho))
    else if (nome.endsWith('.ts') && !nome.endsWith('.gen.ts')) achados.push(caminho)
  }
  return achados
}

describe('a paginação mora num lugar só', () => {
  const arquivos = arquivosTs(RAIZ)

  it('varreu a base — piso pelo positivo conhecido, para "zero" não sair de uma varredura vazia', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(150)
    // E o dono precisa estar entre eles: se o caminho mudar, o teste abaixo passaria vazio.
    expect(arquivos).toContain(DONO)
  })

  it('nenhum arquivo fora do `paginar.ts` chama `.range(`', () => {
    const forasteiros = arquivos.filter((f) => f !== DONO && semComentarios(readFileSync(f, 'utf8')).includes('.range('))
    expect(forasteiros).toEqual([])
  })

  it('o dono continua tendo teto — sem ele, centralizar não resolveu nada', () => {
    const fonte = semComentarios(readFileSync(DONO, 'utf8'))
    expect(fonte).toMatch(/pagina < MAXIMO_DE_PAGINAS/)
    // Ao estourar o teto tem que ERRAR, não devolver o que já juntou: total parcial é redondo,
    // plausível e não denuncia nada.
    expect(fonte).toMatch(/throw new AppError/)
  })
})
