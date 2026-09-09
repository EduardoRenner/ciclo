import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sqlSemComentarios } from '../../helpers/fonte'

/**
 * A armadilha está escrita na tabela do `CLAUDE.md` com estas palavras: *"Criar view sem
 * `security_invoker = true` → A view fura a RLS. Sempre com `security_invoker`."*
 *
 * Sem a opção, a view roda com os privilégios de **quem a criou** (o dono do schema), e não de quem
 * consulta. As políticas de tenant deixam de ser aplicadas: `select * from v_daily_cash` devolve o
 * caixa de TODOS os salões. É o único defeito desta base que quebra o isolamento ENTRE tenants —
 * todos os outros achados de 2026-09-08 eram vazamento DENTRO de um.
 *
 * ## Por que uma guarda de texto, e por que agora
 *
 * O estado de hoje está certo: medido em produção em 2026-09-09, as cinco views
 * (`v_carteira_resumo`, `v_client_segments`, `v_clientes_a_recuperar`, `v_daily_cash`,
 * `v_recover_revenue`) têm `security_invoker = true`. **E nada guardava isso.** Três coisas se
 * somam para o defeito poder entrar sem ninguém ver:
 *
 * 1. **`create or replace view` NÃO herda a opção.** Uma migration que reescreva uma view
 *    existente e esqueça o `with (security_invoker = true)` a derruba em silêncio — a view continua
 *    funcionando, só que sem RLS. Já registrado nesta base ao mexer na `0067`.
 * 2. **O relatório de isolamento não enxerga view.** `tenant_rls_report()` filtra `relkind = 'r'`,
 *    quer dizer, só tabelas. A `0076` corrigiu a cegueira dele quanto a tabelas sem `tenant_id`, e
 *    esta outra continua: view não aparece, então `tests/rls/isolation.test.ts` não a testa.
 * 3. **A suíte de RLS não roda nesta máquina** (sem Docker, e o banco de dev está atrás). Mesmo se
 *    o relatório enxergasse, ninguém veria vermelho aqui.
 *
 * Então a guarda mora onde o defeito nasce: no texto da migration, que é a única cópia que sempre
 * está por perto.
 */
const DIR = 'supabase/migrations'

/**
 * As cinco que existem hoje, afirmadas POR NOME.
 *
 * Piso contra a cegueira de raiz: uma varredura que parasse de casar `create view` devolveria zero
 * achados e passaria verde, dizendo "nenhuma view sem security_invoker" sobre um corpus que ela não
 * está mais lendo. Nome que já existe é o positivo conhecido — a contagem não serve, porque zero é
 * um número perfeitamente plausível aqui.
 */
const VIEWS_QUE_EXISTEM = [
  'v_carteira_resumo',
  'v_client_segments',
  'v_clientes_a_recuperar',
  'v_daily_cash',
  'v_recover_revenue',
]

type Declaracao = { migration: string; view: string; cabecalho: string }

/**
 * Cada `create [or replace] view`, com o CABEÇALHO dela: do `create` até o `select` do corpo.
 *
 * O recorte para no `select` de propósito. Procurar `security_invoker` na migration inteira seria
 * a armadilha nº 1 da tabela do CLAUDE.md — casar com algo que o arquivo contém por outro motivo:
 * uma migration que cria DUAS views, uma certa e uma errada, passaria verde por causa da primeira.
 * E o corpo do `select` pode citar qualquer coisa.
 */
function declaracoes(): Declaracao[] {
  const achadas: Declaracao[] = []
  for (const nome of readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = sqlSemComentarios(readFileSync(join(DIR, nome), 'utf8')).toLowerCase()
    const padrao = /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z0-9_]+)/g
    let m = padrao.exec(sql)
    while (m !== null) {
      const daqui = sql.slice(m.index)
      // Fim do cabeçalho = o `select` que abre o corpo. Sem ele, o cabeçalho é a declaração toda.
      const fim = daqui.search(/\bselect\b/)
      achadas.push({ migration: nome, view: m[1], cabecalho: fim === -1 ? daqui : daqui.slice(0, fim) })
      m = padrao.exec(sql)
    }
  }
  return achadas
}

const DECLARACOES = declaracoes()

describe('o leitor deste teste', () => {
  it('achou as views que existem — não passa por ter varrido nada', () => {
    const nomes = new Set(DECLARACOES.map((d) => d.view))
    for (const view of VIEWS_QUE_EXISTEM) {
      expect(nomes.has(view), `${view} saiu do alcance da guarda — o padrão parou de casar`).toBe(true)
    }
  })

  it('o cabeçalho para antes do corpo', () => {
    // Se o recorte pegasse a migration inteira, uma declaração errada seria absolvida pela citação
    // de `security_invoker` na irmã dela. A prova é direta: nenhum cabeçalho contém o `from` do
    // corpo da consulta.
    for (const d of DECLARACOES) {
      expect(d.cabecalho.includes(' from '), `o cabeçalho de ${d.view} (${d.migration}) engoliu o corpo`).toBe(false)
    }
  })
})

describe('nenhuma view fura a RLS', () => {
  it('toda view declara `security_invoker = true`', () => {
    const semInvoker = DECLARACOES.filter((d) => !/security_invoker\s*=\s*true/.test(d.cabecalho)).map(
      (d) => `${d.migration} → ${d.view}`,
    )
    expect(
      semInvoker,
      'view sem `with (security_invoker = true)`. Ela roda com o privilégio de quem a CRIOU, não de ' +
        'quem consulta: as políticas de tenant deixam de valer e a consulta devolve o dado de todos ' +
        'os salões. `create or replace view` NÃO herda a opção — quem reescreve precisa repeti-la.',
    ).toEqual([])
  })
})
