import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { FERRAMENTAS } from '@/server/assistente/ferramentas'

/**
 * Uma ferramenta que PREPARA precisa exigir a mesma permissão que a rota que EXECUTA. Se a da
 * ferramenta for mais frouxa, o assistente monta a proposta, o cartão aparece, o dono confirma —
 * e leva 403. O erro não aparece em teste nenhum: as duas metades estão certas sozinhas, e só a
 * distância entre elas está errada.
 *
 * Esta guarda lê a permissão do ARQUIVO DA ROTA, não uma cópia escrita aqui. Cópia dentro do
 * teste é a definição de guarda cega: passaria verde com a rota mudando embaixo.
 */
const EXECUCAO: Record<string, { ferramenta: string; arquivo: string; metodo: string }> = {
  criar_agendamento: {
    ferramenta: 'preparar_agendamento',
    arquivo: 'src/app/api/v1/appointments/route.ts',
    metodo: 'POST',
  },
  concluir_atendimento: {
    ferramenta: 'preparar_conclusao_de_atendimento',
    arquivo: 'src/app/api/v1/appointments/[id]/complete/route.ts',
    metodo: 'POST',
  },
  adicionar_item_comanda: {
    ferramenta: 'preparar_item_na_comanda',
    arquivo: 'src/app/api/v1/tickets/[id]/items/route.ts',
    metodo: 'POST',
  },
  adicionar_nota: {
    ferramenta: 'preparar_nota_na_ficha',
    arquivo: 'src/app/api/v1/clients/[id]/notes/route.ts',
    metodo: 'POST',
  },
}

/** A permissão exigida dentro do handler do método — não a do GET, que é sempre mais frouxa. */
function permissaoDaRota(arquivo: string, metodo: string): string {
  const fonte = readFileSync(arquivo, 'utf8')
  const inicio = fonte.indexOf(`export const ${metodo} = rota(`)
  // Se o formato do arquivo mudar, a guarda GRITA. Casar vazio e passar verde é como as três
  // guardas cegas de 2026-08-25 sobreviveram.
  expect(inicio, `nao achei o handler ${metodo} em ${arquivo}`).toBeGreaterThan(-1)

  // Delimita pelo proximo `export const` — nunca por uma janela de N caracteres, que deixa o
  // vizinho cair dentro.
  const proximo = fonte.indexOf('export const ', inicio + 10)
  const bloco = fonte.slice(inicio, proximo === -1 ? undefined : proximo)

  const m = bloco.match(/exigirPermissao\(ctx\.papel,\s*'([^']+)'\)/)
  expect(m, `${metodo} de ${arquivo} nao chama exigirPermissao`).not.toBeNull()
  const permissao = m![1]
  expect(permissao, 'exigirPermissao casou sem capturar a permissao').toBeTypeOf('string')
  return permissao!
}

describe('permissao da ferramenta = permissao da rota', () => {
  for (const [acao, alvo] of Object.entries(EXECUCAO)) {
    it(`${alvo.ferramenta} exige o mesmo que a rota de ${acao}`, () => {
      const ferramenta = FERRAMENTAS.find((f) => f.nome === alvo.ferramenta)
      expect(ferramenta, `ferramenta ${alvo.ferramenta} sumiu do catalogo`).toBeDefined()
      expect(ferramenta!.permissao).toBe(permissaoDaRota(alvo.arquivo, alvo.metodo))
    })
  }

  it('toda ferramenta que devolve proposta esta coberta aqui', () => {
    // Sem isto, a proxima ferramenta que operar o produto nasce sem guarda e ninguem percebe —
    // a suite segue verde porque o mapa acima simplesmente nao a menciona.
    const queOperam = FERRAMENTAS.filter((f) => f.nome.startsWith('preparar_')).map((f) => f.nome)
    const cobertas = Object.values(EXECUCAO).map((e) => e.ferramenta)
    expect([...queOperam].sort()).toEqual([...cobertas].sort())
  })
})
