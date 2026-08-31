import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Data de view roda no fuso da SESSAO, e a sessao do PostgREST e UTC. Medido em producao em
 * 2026-08-31: `current_setting('TimeZone')` = 'UTC'.
 *
 * Em Brasilia (UTC-3) isso desloca todo corte de dia/mes em tres horas, sempre para o lado errado:
 *
 *   31/08 20:00 no salao -> mes 8 no servidor, mes 8 no salao   ok
 *   31/08 21:00 no salao -> mes 9 no servidor, mes 8 no salao   ERRA
 *
 * Quatro aparicoes desta classe no projeto: `v_daily_cash` foi ABANDONADA por causa dela (ver o
 * comentario no topo de `caixa.ts`), `receitaAtribuidaAoCiclo` foi corrigida em 28/08,
 * `v_client_segments` na 0048 e `v_carteira_resumo` na 0049. Esta guarda existe para nao haver uma
 * quinta.
 */
const DIR = join('supabase', 'migrations')
const NL = String.fromCharCode(10)

/*
 * Excecao unica e declarada. `v_daily_cash` (0001) tem o defeito e continua no banco, mas NINGUEM
 * a consulta: `caixa.ts` soma `tickets` direto justamente por causa disso, e o unico lugar do
 * codigo que a menciona e o comentario explicando o abandono. Fica registrada aqui em vez de ser
 * corrigida ou derrubada — derrubar objeto de banco em producao e decisao do Eduardo, e consertar
 * uma view que ninguem le seria trabalho para ninguem. Se um dia alguem voltar a consulta-la, o
 * conserto vem junto.
 */
const ABANDONADAS_COM_MOTIVO: Record<string, string> = {
  v_daily_cash: 'abandonada: caixa.ts soma tickets direto por causa deste mesmo defeito',
}

/**
 * A ULTIMA declaracao de cada view, na ordem das migrations.
 *
 * Migration e historico append-only: a 0010 e a 0018 ainda contem as versoes com o defeito, e a
 * 0048/0049 as substituiram. A primeira versao desta guarda varria todas as declaracoes e reprovava
 * as antigas — acusando um defeito ja consertado. O que vale e o que esta no banco AGORA, que e a
 * ultima declaracao.
 */
function viewsDeclaradas(): { nome: string; corpo: string; arquivo: string }[] {
  const achadas: { nome: string; corpo: string; arquivo: string }[] = []
  for (const arquivo of readdirSync(DIR).sort()) {
    if (!arquivo.endsWith('.sql')) continue
    const sql = readFileSync(join(DIR, arquivo), 'utf8')
    for (const linhas of [sql.split(NL)]) {
      let dentro: string[] | null = null
      let nome = ''
      for (const l of linhas) {
        const abre = l.match(/create\s+(?:or\s+replace\s+)?view\s+([a-z_]+)/i)
        if (abre) {
          nome = abre[1]!
          dentro = [l]
          continue
        }
        if (dentro === null) continue
        dentro.push(l)
        if (l.trimEnd().endsWith(';')) {
          achadas.push({ nome, corpo: dentro.join(NL), arquivo })
          dentro = null
        }
      }
    }
  }
  // Ultima declaracao vence: `achadas` ja vem na ordem dos arquivos.
  const ultima = new Map<string, { nome: string; corpo: string; arquivo: string }>()
  for (const v of achadas) ultima.set(v.nome, v)
  return [...ultima.values()]
}

describe('view nao corta o dia no fuso do servidor', () => {
  const views = viewsDeclaradas()

  it('a varredura acha as views — senao passa vazia', () => {
    expect(views.length, 'nenhuma view encontrada nas migrations — o extrator quebrou').toBeGreaterThan(3)
  })

  for (const { nome, corpo, arquivo } of views) {
    it(`${nome} (${arquivo}) usa o fuso do salao`, () => {
      /*
       * Qualquer corte de data conta, nao so `now()`. `v_daily_cash` faz
       * `date_trunc('day', t.closed_at)` sobre uma coluna `timestamptz` — mesma classe, outra
       * forma, e a primeira versao desta guarda nao a pegava.
       */
      const usaDataDaSessao = /current_date|current_timestamp|date_trunc\s*\(/i.test(corpo)
      if (!usaDataDaSessao) return

      const converte = /at\s+time\s+zone/i.test(corpo)
      if (converte) return

      expect(
        ABANDONADAS_COM_MOTIVO[nome],
        `${nome} corta data no fuso da sessao (UTC) e nao converte para o fuso do tenant. ` +
          'Em Brasilia isso erra o dia/mes nas tres horas antes da meia-noite. ' +
          'Conserte com `at time zone t.timezone` (ver 0048/0049) ou declare o motivo em ABANDONADAS_COM_MOTIVO.',
      ).toBeDefined()
    })
  }
})
