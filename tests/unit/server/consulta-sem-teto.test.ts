import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-012/013 (achado E-02): o PostgREST corta toda resposta em `max_rows = 1000`
 * (`supabase/config.toml`) SEM erro. Uma leitura de tabela que cresce sem teto nem paginação devolve
 * as primeiras mil linhas e o número da tela sai errado em silêncio — só no negócio grande.
 *
 * Esta guarda acha cada leitura (`.select(`) de tabela que cresce e confere se ela tem: paginação
 * (`buscarTudoPaginado`), teto (`.limit(`/`.range(`), linha única (`.single(`/`.maybeSingle(`),
 * contagem (`head: true`) ou filtro por id. A consulta é recortada do `.from(` até o fim real da
 * expressão (parêntese que fecha, `;` ou vírgula no nível de fora) — não por janela de caracteres
 * (R-19). As que faltam ficam nominalmente na linha de base, que só encolhe.
 */
const TABELAS_QUE_CRESCEM = [
  'appointments',
  'messages',
  'tickets',
  'ticket_items',
  'client_cycles',
  'loyalty_entries',
  'clients',
  'stock_moves',
  'audit_log',
  'package_uses',
  'packages',
  'client_subscriptions',
  'payments',
  'wallet_entries',
]

/** Leituras sem teto que já existiam em 13/10 (50). Muitas são limitadas por outro filtro — a guarda não sabe disso; quem conserta ou prova o teto baixa o número. */
const LINHA_DE_BASE: Record<string, number> = {
  'server/services/agendamentos.ts': 3,
  'server/services/alertas-estoque.ts': 1,
  'server/services/ciclo-de-quem-ja-atende.ts': 2,
  'server/services/ciclo.ts': 2,
  'server/services/clientes.ts': 1,
  'server/services/clube.ts': 3,
  'server/services/comanda.ts': 1,
  'server/services/crm.ts': 4,
  'server/services/estoque.ts': 2,
  'server/services/fidelidade.ts': 1,
  'server/services/health.ts': 1,
  'server/services/importacao-clientes.ts': 1,
  'server/services/lembretes.ts': 2,
  'server/services/lgpd.ts': 2,
  'server/services/link-de-volta.ts': 1,
  'server/services/lista-espera.ts': 1,
  'server/services/ociosidade.ts': 1,
  'server/services/pacotes.ts': 3,
  'server/services/public-booking.ts': 1,
  'server/services/quem-ja-atendo.ts': 1,
  'server/services/recorrencia.ts': 2,
  'server/services/resumo-hoje.ts': 2,
  'server/services/whatsapp-inbound.ts': 1,
  'app/admin/caixa/page.tsx': 1,
}

const COM_TETO = [/\.limit\(/, /\.range\(/, /\.single\(\)/, /\.maybeSingle\(\)/, /head:\s*true/, /\.eq\(\s*'id'/, /\.in\(\s*'id'/]
const ESCRITA = /\.(insert|update|upsert|delete)\(/

/** Recorta cada `.from('tabela')` até o fim da expressão em que está. */
export function consultasSemTeto(fonte: string): string[] {
  const achadas: string[] = []
  const re = new RegExp(`\\.from\\(\\s*'(${TABELAS_QUE_CRESCEM.join('|')})'\\s*\\)`, 'g')
  for (const m of fonte.matchAll(re)) {
    const inicio = m.index!
    let prof = 0
    let fim = inicio
    for (; fim < fonte.length; fim++) {
      const c = fonte[fim]!
      if (c === '(' || c === '[' || c === '{') prof++
      else if (c === ')' || c === ']' || c === '}') {
        if (prof === 0) break
        prof--
      } else if ((c === ';' || c === ',') && prof === 0) break
      else if (c === '\n' && prof === 0 && !/^\s*\./.test(fonte.slice(fim + 1, fim + 80))) break
    }
    const consulta = fonte.slice(inicio, fim)
    if (!/\.select\(/.test(consulta) || ESCRITA.test(consulta)) continue
    const antes = fonte.slice(Math.max(0, inicio - 200), inicio)
    if (/buscarTudoPaginado\(\s*\(\)\s*=>\s*\w*\s*$/.test(antes)) continue
    if (COM_TETO.some((r) => r.test(consulta))) continue
    achadas.push(m[1]!)
  }
  return achadas
}

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

const encontradas = new Map<string, number>()
for (const raiz of ['src/server', 'src/app']) {
  for (const arquivo of arquivos(raiz)) {
    const n = consultasSemTeto(semComentarios(readFileSync(arquivo, 'utf8'))).length
    if (n > 0) encontradas.set(relative('src', arquivo).replaceAll('\\', '/'), n)
  }
}

describe('leitura de tabela que cresce tem teto ou paginação (APR-012)', () => {
  it('controle positivo: acha a consulta solta e aceita as formas com teto', () => {
    expect(consultasSemTeto(`const r = await db.from('appointments').select('id').eq('tenant_id', t)\n`)).toEqual(['appointments'])
    expect(consultasSemTeto(`await Promise.all([db.from('messages').select('id').eq('tenant_id', t), outra])`)).toEqual(['messages'])
    expect(consultasSemTeto(`await db.from('appointments').select('id').eq('tenant_id', t).limit(10)`)).toEqual([])
    expect(consultasSemTeto(`await buscarTudoPaginado(() =>\n    db.from('appointments').select('id').order('id'),\n  )`)).toEqual([])
    expect(consultasSemTeto(`await db.from('appointments').select('id', { count: 'exact', head: true })`)).toEqual([])
    expect(consultasSemTeto(`await db.from('appointments').update({ a: 1 }).select('id')`)).toEqual([])
  })

  it('a varredura acha consultas (não passa vazia)', () => {
    expect([...encontradas.values()].reduce((a, b) => a + b, 0) + Object.keys(LINHA_DE_BASE).length).toBeGreaterThan(0)
  })

  it('nenhuma leitura nova sem teto, nem mais que a linha de base num arquivo', () => {
    const excessos = [...encontradas].filter(([a, n]) => n > (LINHA_DE_BASE[a] ?? 0)).map(([a, n]) => `${a}: ${n} (linha de base ${LINHA_DE_BASE[a] ?? 0})`)
    expect(excessos).toEqual([])
  })

  it('a linha de base acompanha a realidade', () => {
    const sobras = Object.entries(LINHA_DE_BASE).filter(([a, n]) => (encontradas.get(a) ?? 0) < n).map(([a, n]) => `${a}: base ${n}, achadas ${encontradas.get(a) ?? 0}`)
    expect(sobras).toEqual([])
  })
})
