import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios, sqlSemComentarios } from '../../helpers/fonte'

/**
 * `monthly_profit` é o fosso do `docs/46`: o que acumula por salão com o TEMPO DE USO, e que um
 * concorrente não tem como copiar porque não viveu o março daquele salão.
 *
 * O valor inteiro está em nunca ser reescrito. Um `update` ali — feito com a melhor das intenções,
 * para "corrigir" um mês — apaga a única coisa que a tabela existe para guardar: o que o número
 * era na época. E o defeito seria invisível, porque a tela continuaria mostrando uma série
 * plausível.
 *
 * Esta base já tem a regra em outro lugar (`CLAUDE.md` nº11: nunca deletar agendamento, movimento
 * de estoque ou auditoria). Aqui ela vale para um agregado.
 */

const SERVICO = join('src', 'server', 'services', 'caixa.ts')

function arquivosTs(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivosTs(caminho))
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

describe('monthly_profit é append-only', () => {
  const arquivos = arquivosTs('src').filter((f) => !f.endsWith('types.gen.ts'))

  it('a varredura enxerga o código e enxerga quem escreve', () => {
    expect(arquivos.length, 'nenhum arquivo lido de src/').toBeGreaterThan(100)
    const servico = semComentarios(readFileSync(SERVICO, 'utf8'))
    expect(
      /from\('monthly_profit'\)[\s\S]{0,80}\.insert\(/.test(servico),
      'ninguém mais grava a série mensal — sem o positivo conhecido esta guarda passaria vazia',
    ).toBe(true)
  })

  /**
   * `upsert` produziria o mesmo SQL hoje, com `ignoreDuplicates: true`. Fica proibido mesmo assim:
   * trocar essa opção para `false` é UMA palavra, e a tabela append-only passa a reescrever o
   * passado sem que o diff pareça perigoso. O verbo é a documentação.
   */
  it('ninguém dá update, delete ou upsert na série', () => {
    const proibidos: string[] = []
    for (const arquivo of arquivos) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const m of fonte.matchAll(/from\('monthly_profit'\)\s*\.\s*(\w+)/g)) {
        if (m[1] !== 'select' && m[1] !== 'insert') proibidos.push(`${arquivo}: .${m[1]}(`)
      }
    }
    expect(
      proibidos,
      'a série mensal é registro contábil: o valor dela é ser o que o número ERA na época. ' +
        'Reescrever um mês apaga exatamente isso, e o defeito seria invisível.',
    ).toEqual([])
  })

  /** O outro lado: a migration não pode ter dado à tabela um caminho de escrita por trigger. */
  it('a migration não cria trigger nem coluna de atualização na tabela', () => {
    const sql = sqlSemComentarios(readFileSync(join('supabase', 'migrations', '0071_serie_mensal_de_lucro.sql'), 'utf8'))
    expect(sql.length, 'a 0071 sumiu do disco').toBeGreaterThan(500)
    expect(/create trigger/i.test(sql), 'trigger na tabela append-only é um caminho de escrita escondido').toBe(false)
    expect(/updated_at/.test(sql), 'coluna de atualização numa tabela que nunca se atualiza é um convite').toBe(false)
    expect(/primary key\s*\(tenant_id,\s*month\)/.test(sql), 'sem a chave, o "insert de novo" duplica em vez de recusar').toBe(true)
  })

  /**
   * "Só mês encerrado é congelado" era uma varredura aqui, e ela era CEGA: procurava
   * `mesCorrente.subtract({ months:` e passou verde com o laço mexido, porque a mesma expressão
   * aparecia noutra linha calculando o limite da janela. A regra virou `mesesJaEncerrados`, com
   * teste de comportamento em `tests/unit/core/serie-mensal.test.ts`. O que sobra aqui é a única
   * coisa que a varredura prova bem: que o serviço CHAMA a função em vez de refazer a conta.
   */
  it('o serviço usa a função que exclui o mês corrente, em vez de refazer a conta', () => {
    const servico = semComentarios(readFileSync(SERVICO, 'utf8'))
    expect(/mesesJaEncerrados\s*\(/.test(servico), 'o serviço voltou a montar a lista de meses por conta própria').toBe(true)
  })

  /**
   * A regra 6 do `CLAUDE.md`: escrita passa por `/api/v1`. A primeira versão desta série gravava na
   * LEITURA da tela do mês — um GET que escreve, fora do caminho que tem idempotência e auditoria.
   * O congelamento mudou para `fecharComanda`, que já é mutação; a leitura só lê.
   */
  it('a leitura da série não escreve — quem congela é o fechamento de comanda', () => {
    const servico = semComentarios(readFileSync(SERVICO, 'utf8'))

    const leitura = /export async function serieMensalDeLucro[\s\S]*?\n\}/.exec(servico)
    expect(leitura?.[0], 'serieMensalDeLucro mudou de forma — esta guarda precisa ser revista').toBeDefined()
    expect(
      /\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(leitura![0]),
      'a leitura da série voltou a escrever: GET que grava é escrita fora do caminho que tem idempotência e auditoria',
    ).toBe(false)

    const fechamento = semComentarios(readFileSync(join('src', 'server', 'services', 'comanda.ts'), 'utf8'))
    expect(
      /congelarMesesFechados\s*\(/.test(fechamento),
      'o fechamento parou de congelar o mês — nenhum caminho grava mais a série, e ela some sem erro nenhum',
    ).toBe(true)
  })
})
