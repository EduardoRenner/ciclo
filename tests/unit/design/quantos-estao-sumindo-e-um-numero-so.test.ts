import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios, sqlSemComentarios } from '../../helpers/fonte'

/**
 * "Quantas clientes estão sumindo" é UM número, e o produto dizia três.
 *
 * `client_cycles` guarda uma linha por (cliente, serviço). Três lugares contavam essas linhas
 * como se fossem clientes:
 *
 *   · o cartão rotulado "Clientes" na tela Recuperar — mostrou 149 num salão com 55;
 *   · "N clientes estão sumindo" na Central de Ações, na TELA INICIAL, em cartão de alerta;
 *   · o topo da lista de clientes.
 *
 * O alarme da tela inicial levava para uma lista que mostrava outro número: o produto se
 * contradizia num toque. Medido nas seis contas de demonstração: 72% a 92% das linhas eram de
 * gente que nunca deixou de vir.
 *
 * A definição agora mora na view `v_clientes_a_recuperar` (migration 0058) — uma linha por
 * CLIENTE, sem quem tem qualquer ciclo em dia. Esta guarda existe para impedir que alguém volte a
 * contar `client_cycles` direto, que é o gesto natural de quem não conhece a história.
 *
 * Migration 0089 moveu a contagem da Central de Ações de uma consulta em `crm.ts` para dentro da
 * função `resumo_central_de_acoes` (uma ida de rede em vez de quatro, docs/28 §12) — a mesma view,
 * o mesmo filtro, só que agora escrito em SQL na migration. A guarda passou a olhar os DOIS
 * arquivos: se o dia vier em que a função some ou perder o filtro, ela continua vendo (o teste de
 * mutação da 0089 confirma: tirar `deleted_at is null` da função já reprovou um teste de
 * integração — aqui é o mesmo princípio, aplicado à consistência entre os dois contadores).
 */
const CRM = join('src', 'server', 'services', 'crm.ts')
const MIGRATION_0089 = join('supabase', 'migrations', '0089_resumo_central_de_acoes_em_uma_ida.sql')

const fonte = () => semComentarios(readFileSync(CRM, 'utf8')) + '\n' + sqlSemComentarios(readFileSync(MIGRATION_0089, 'utf8'))

/** Recorta a chamada encadeada que começa em `.from('<tabela>')` até o `,` que fecha o item. */
function consultaDe(src: string, tabela: string): string {
  const i = src.indexOf(`.from('${tabela}')`)
  if (i === -1) return ''
  const fim = src.indexOf('),', i)
  return src.slice(i, fim === -1 ? undefined : fim)
}

describe('quantas clientes estão sumindo', () => {
  it('sai da view que conta cliente, não de client_cycles cru', () => {
    const src = fonte()
    // `.from('v_clientes_a_recuperar')` em TS, `from v_clientes_a_recuperar` em SQL (0089) — a
    // mesma view, duas sintaxes.
    const ocorrencias = src.match(/from\s*\(?'?v_clientes_a_recuperar'?\)?/g) ?? []
    // As DUAS: Central de Ações (função `resumo_central_de_acoes`, 0089) e painel da carteira
    // (lista de clientes, ainda em `crm.ts`).
    expect(
      ocorrencias.length,
      'os dois contadores precisam sair da mesma view, senão as telas se contradizem',
    ).toBe(2)
  })

  it('nenhum contador volta a somar linhas de client_cycles', () => {
    /*
     * Casa com o PAR "contar + filtrar por estado de risco" dentro da mesma consulta — não com
     * `client_cycles` solto, que aparece legitimamente noutros lugares deste arquivo (a ficha da
     * cliente lê o ciclo dela, e ali uma linha por serviço é exatamente o certo).
     */
    const src = fonte()
    const consulta = consultaDe(src, 'client_cycles')
    if (consulta === '') return // nenhuma consulta a client_cycles neste arquivo: também está certo
    expect(
      consulta,
      'contagem por estado de risco direto em client_cycles conta linha, não cliente',
    ).not.toMatch(/count:\s*'exact'/)
  })

  it('os DOIS contadores filtram por quem já atrasou', () => {
    /*
     * Conta as ocorrências em vez de perguntar "existe alguma?".
     *
     * A primeira versão desta guarda usava `toMatch`, e passou com a mutação aplicada: tirar o
     * filtro de UM dos dois contadores deixava o outro intacto, e o `toMatch` achava esse outro.
     * Guarda que pergunta "existe em algum lugar?" nunca pega "sumiu de um lugar" — e o defeito
     * que ela existe para pegar é justamente os dois números divergirem.
     *
     * `due` é "vence hoje", ainda não sumiu. Chamar isso de "está sumindo" assusta à toa, e o
     * alarme que assusta à toa é o que ensina a ignorar todos os outros.
     */
    // `.eq('ja_atrasado', true)` em TS, `ja_atrasado = true` em SQL (0089) — o mesmo filtro, duas
    // sintaxes.
    const filtros = fonte().match(/eq\('ja_atrasado',\s*true\)|ja_atrasado\s*=\s*true/g) ?? []
    expect(filtros.length, 'os dois contadores precisam do mesmo filtro').toBe(2)
  })
})
