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
    const src = sql()
    const insert = src.slice(src.indexOf('insert into clients'))

    expect(insert.length, `${SEED} não tem mais o insert de clients`).toBeGreaterThan(0)
    expect(
      insert,
      'o insert de clients precisa listar phone_hash — sem ele o reconhecimento e o agendamento de cliente existente quebram em silêncio',
    ).toMatch(/phone_hash/)
    // A coluna na lista não basta: tem que receber valor. `p.phone_hash` é o que o plano calculou.
    expect(insert).toMatch(/p\.phone_hash/)
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

  it('deriva visitas e LTV dos agendamentos, em vez de somar por fora', () => {
    // Número que a tela mostra e número que o histórico prova precisam sair da MESMA fonte,
    // senão a demonstração se contradiz sozinha — é o defeito de `livro-caixa-fonte-unica`.
    const src = sql()
    const update = src.slice(src.indexOf('update clients c set visits_count'))

    expect(update.length, 'o seed não deriva mais visits_count dos agendamentos').toBeGreaterThan(0)
    expect(update).toMatch(/from appointments a/)
    expect(update).toMatch(/filter \(where a\.status = 'done'\)/)
  })
})
