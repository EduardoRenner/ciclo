import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O seed de demonstração gravou 132 clientes com `phone_e164` preenchido e `phone_hash` NULO.
 *
 * Nada quebrava na tela: o painel listava, a ficha abria, o gráfico somava. Mas toda busca por
 * telefone no produto passa pelo hash, e com ele nulo:
 *
 *   · `reconhecimento.ts` nunca reconhecia ninguém — a funcionalidade parecia não existir;
 *   · `agendamentos.ts` procurava pelo hash, não achava, tentava INSERT e batia na
 *     `clients_unique_phone` pelo `phone_e164` → 500 na cara de quem estava agendando.
 *
 * A demonstração quebrava exatamente na hora de demonstrar, e é o caso de manual de
 * "verde não é prova": nenhum teste reprovava, nenhuma tela reclamava.
 *
 * Esta guarda é de varredura porque o defeito não é de comportamento do app — é de um script que
 * roda fora dele. Casar com o SQL é o único jeito de a regra ter dente. Comentário sai antes de
 * casar: este arquivo e o guardado falam de `phone_hash` o tempo todo, e casar com a explicação
 * em vez do código é a armadilha nº 1 da tabela do CLAUDE.md.
 */

const SEED = join('scripts', 'seed-demo-carteira.sql')

function sql(): string {
  return semComentarios(readFileSync(SEED, 'utf8'))
}

describe('o seed da carteira de demonstração', () => {
  it('grava phone_hash junto com phone_e164', () => {
    /*
     * Delimitado pelo FIM REAL da lista de colunas, nunca pelo resto do arquivo.
     *
     * A primeira versão desta guarda casava `/phone_hash/` no trecho que ia do `insert into
     * clients` até o fim do arquivo — e passou com a coluna removida da lista, porque
     * `p.phone_hash` continuava logo abaixo, no SELECT. Ou seja: casava com algo que o arquivo
     * contém por outro motivo, que é a armadilha nº 1 da tabela do CLAUDE.md. Só apareceu porque
     * a mutação foi mesmo aplicada e o resultado, lido.
     */
    const src = sql()
    const abre = src.indexOf('insert into clients')
    expect(abre, `${SEED} não tem mais o insert de clients`).toBeGreaterThan(-1)

    const inicioLista = src.indexOf('(', abre)
    const fimLista = src.indexOf(')', inicioLista)
    const colunas = src.slice(inicioLista + 1, fimLista)

    expect(
      colunas,
      'a LISTA DE COLUNAS do insert de clients precisa incluir phone_hash — sem ela o reconhecimento e o agendamento de cliente existente quebram em silêncio',
    ).toMatch(/\bphone_hash\b/)
    expect(colunas, 'phone_e164 sem phone_hash é exatamente o defeito').toMatch(/\bphone_e164\b/)

    // A coluna na lista não basta: tem que receber valor no SELECT.
    expect(src.slice(fimLista), 'phone_hash listado mas sem valor no select').toMatch(/p\.phone_hash/)
  })

  it('calcula o hash com sha256 e um salt vindo de fora do arquivo', () => {
    const src = sql()

    expect(src, 'o hash tem que ser sha256, igual ao hashTelefone() do produto').toMatch(/sha256/)
    // `:'salt'` é a variável do psql. Um salt literal aqui seria segredo no repositório (regra 10).
    expect(src, "o salt tem que entrar por -v salt, nunca literal").toMatch(/:'salt'/)
    expect(
      src,
      'nenhum salt literal pode aparecer no arquivo — regra 10 do CLAUDE.md',
    ).not.toMatch(/PHONE_HASH_SALT\s*=\s*\S/)
  })

  it('confere o próprio resultado antes de terminar', () => {
    // Um seed que não mede o que fez é a mesma classe de problema do cron que respondia 200 com
    // `tenantsProcessados: 0`. A consulta final tem que olhar justamente o que já deu errado.
    const src = sql()
    const conferencia = src.slice(src.lastIndexOf('commit;'))

    expect(conferencia, 'o seed precisa conferir telefone sem hash ao terminar').toMatch(/telefone_sem_hash/)
    expect(conferencia, 'e conferir que nenhum atendimento concluído caiu no futuro').toMatch(/concluido_no_futuro/)
    expect(conferencia, 'e que nada caiu em dia de salão fechado').toMatch(/em_dia_fechado/)
  })

  it('usa a fórmula de lucro do core, não uma reinvenção', () => {
    /*
     * `calcularSobraDaComanda`: max(0, subtotal − desconto) − material − taxa − comissão.
     *
     * O desconto na conta não é detalhe: numa comanda de R$ 100 com R$ 20 de desconto, a versão
     * que o ignorava mostrava "Entrou R$ 80" e "Sobrou R$ 100" — sobrava mais do que entrou. Um
     * seed que reinventa a fórmula ensina a demonstração a mentir de um jeito que o produto já
     * não mente.
     */
    const src = sql()
    const lucro = src.slice(src.indexOf('update tickets t set profit_cents'))

    expect(lucro.length, 'o seed não calcula mais o lucro da comanda').toBeGreaterThan(0)
    expect(lucro, 'o desconto tem que entrar na conta').toMatch(/greatest\(0,\s*t\.subtotal_cents\s*-\s*t\.discount_cents\)/)
    for (const parcela of ['material_cost_cents', 'fee_cents', 'commission_cents']) {
      expect(lucro, `${parcela} não está sendo descontado do lucro`).toMatch(new RegExp(`-\\s*t\\.${parcela}`))
    }
    // A gorjeta é 100% do profissional: se entrar aqui, vira lucro que o salão nunca viu.
    expect(lucro, 'a gorjeta não pode entrar no lucro do salão').not.toMatch(/tip_cents/)
  })

  it('confere o dinheiro e o estoque ao terminar', () => {
    const conferencia = sql().slice(sql().lastIndexOf('commit;'))
    expect(conferencia, 'nada guarda "sobrou mais que entrou"').toMatch(/sobrou_mais_que_entrou/)
    expect(conferencia, 'nada guarda estoque negativo').toMatch(/estoque_negativo/)
  })

  it('o saldo de estoque sai do extrato, não de número digitado', () => {
    // Saldo digitado e extrato discordando é estoque que "some" sem nenhum lançamento que
    // justifique — o mesmo defeito de fonte dupla do livro-caixa.
    const src = sql()
    const saldo = src.slice(src.lastIndexOf('update products p set stock_qty'))
    expect(saldo.length, 'o seed não deriva mais o saldo dos movimentos').toBeGreaterThan(0)
    expect(saldo).toMatch(/from stock_moves/)
  })

  it('deriva visitas e LTV dos agendamentos, em vez de somar por fora', () => {
    // Número que a tela mostra e número que o histórico prova precisam sair da MESMA fonte,
    // senão a demonstração se contradiz sozinha — é o defeito de `livro-caixa-fonte-unica`.
    /*
     * Delimitado pelo `;` do próprio comando, nunca até o fim do arquivo — mesma cegueira do
     * teste de cima, encontrada pela mesma mutação: com a fatia indo até EOF, trocar a tabela
     * DESTE update passava, porque o insert de `loyalty_entries` lá embaixo também diz
     * `from appointments a`. Duas guardas cegas no mesmo arquivo, as duas pela mesma causa.
     */
    const src = sql()
    const inicio = src.indexOf('update clients c set visits_count')
    expect(inicio, 'o seed não deriva mais visits_count dos agendamentos').toBeGreaterThan(-1)

    const update = src.slice(inicio, src.indexOf(';', inicio))

    expect(update, 'as visitas têm que vir da tabela de agendamentos').toMatch(/from appointments a\b/)
    expect(update, 'e contar só o que foi concluído de verdade').toMatch(/filter \(where a\.status = 'done'\)/)
  })
})
