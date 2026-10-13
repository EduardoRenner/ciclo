import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-011: `.in('coluna', lista)` põe a lista inteira na URL do PostgREST, e o gateway recusa a
 * partir de ~8 KB (medido: entre 210 e 220 UUIDs; com chave de idempotência, ~110). O erro vira
 * `INTERNAL` e a tela — ou o cron — cai inteira, só no negócio movimentado, que é onde o número
 * interessa. Três casos reais: margem dos serviços (APR-010), notas do Recuperar e a faxina de
 * idempotência (APR-011).
 *
 * Esta guarda lista NOMINALMENTE cada `.in(` com lista variável em `src/server`, com o teto que a
 * mantém pequena. Arquivo novo, ou mais chamadas num arquivo listado, reprova: ou a lista tem teto
 * (diga qual aqui), ou vira join/lote. Lista literal (`['a','b']`) e constante em MAIÚSCULAS não
 * entram — o tamanho delas é fixo no código.
 */
const COM_TETO: Record<string, { quantas: number; teto: string }> = {
  'advocacia/estrutura.ts': { quantas: 1, teto: 'a verificar: entidades de UM caso; cresce com a estrutura societária do cliente' },
  'advocacia/pendencias.ts': { quantas: 1, teto: 'itens marcados numa tela de checklist (Zod na borda)' },
  'http/idempotency.ts': { quantas: 1, teto: 'CHAVES_POR_DELETE = 50 (APR-011)' },
  'services/alertas-estoque.ts': { quantas: 1, teto: 'a verificar: produtos do catálogo sem sinal direto' },
  'services/caixa.ts': { quantas: 1, teto: 'profissionais com fatia na concentração do mês (equipe)' },
  'services/consentimentos.ts': { quantas: 1, teto: 'fotos publicadas de UMA cliente' },
  'services/clube.ts': { quantas: 4, teto: 'a verificar: assinantes do clube (63); serviços/profissionais usados por eles (74-80)' },
  'services/crm.ts': { quantas: 1, teto: 'TAMANHO_LOTE_IN' },
  'services/demonstracao.ts': { quantas: 1, teto: 'slugs candidatos de demonstração (lista do código)' },
  'services/ficha-de-consumo.ts': { quantas: 2, teto: 'produtos de UMA ficha; serviços distintos do catálogo' },
  'services/health.ts': { quantas: 1, teto: 'escritórios com segundo fator pendente (poucos)' },
  'services/importacao-clientes.ts': { quantas: 1, teto: 'grupo de hashes em lote' },
  'services/lote-de-importacao.ts': { quantas: 2, teto: 'POR_CONSULTA = 100 hashes; 200 números de linha por consulta' },
  'services/lista-espera.ts': { quantas: 1, teto: 'a verificar: candidatos da lista de espera para UM horário' },
  'services/lembretes.ts': { quantas: 1, teto: 'lotes de 100 (APR-011)' },
  'services/notas-do-cliente.ts': { quantas: 1, teto: 'LOTE_DE_IDS = 100 (APR-011)' },
  'services/orcamentos.ts': { quantas: 1, teto: 'orçamentos vencidos numa passada' },
  'services/quem-ja-atendo.ts': { quantas: 2, teto: 'a verificar (124): hashes de uma importação; 185: ids únicos em lote' },
  'services/recorrencia.ts': { quantas: 1, teto: 'horários futuros de UMA série' },
  'services/servicos.ts': { quantas: 1, teto: 'serviços do catálogo reordenados numa tela' },
  'services/trilha-cofre.ts': { quantas: 2, teto: 'uma página da trilha (limit)' },
}

/**
 * Segundo argumento que começa com identificador minúsculo: o tamanho vem de fora do código. Lista
 * literal (`[`) e CONSTANTE ficam de fora. `(?=[a-z_])` e não `(?!\[)`: com `\s*` antes, o
 * lookahead negativo casava no próprio espaço, por retrocesso (o controle positivo pegou).
 */
const IN_COM_LISTA_VARIAVEL = /\.in\(\s*['"][\w.]+['"]\s*,\s*(?=[a-z_])/g

function contar(fonte: string): number {
  return semComentarios(fonte).match(IN_COM_LISTA_VARIAVEL)?.length ?? 0
}

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

const SERVER = join(process.cwd(), 'src/server')
const encontrados = new Map<string, number>()
for (const arquivo of arquivos(SERVER)) {
  const n = contar(readFileSync(arquivo, 'utf8'))
  if (n > 0) encontrados.set(relative(SERVER, arquivo).replaceAll('\\', '/'), n)
}

describe('.in() com lista variável tem teto (APR-011)', () => {
  it('controle positivo: casa a lista variável, não a literal nem a constante nem o comentário', () => {
    expect(contar(`db.from('x').select('id').in('ticket_id', ids)`)).toBe(1)
    expect(contar(`.in(\n        'ticket_id',\n        tickets.map((t) => t.id),\n      )`)).toBe(1)
    expect(contar(`.in('status', ['closed', 'paid'])`)).toBe(0)
    expect(contar(`.in('status', ESTADOS_NA_FILA as Estado[])`)).toBe(0)
    expect(contar(`// troca o .in('ticket_id', ids) por join\n`)).toBe(0)
  })

  it('a varredura enxerga as chamadas conhecidas (não passa vazia)', () => {
    expect(encontrados.get('services/notas-do-cliente.ts')).toBe(1)
    expect(encontrados.size).toBeGreaterThan(10)
  })

  it('nenhum .in() novo com lista variável sem teto declarado aqui', () => {
    const excessos = [...encontrados]
      .filter(([arquivo, n]) => n > (COM_TETO[arquivo]?.quantas ?? 0))
      .map(([arquivo, n]) => `${arquivo}: ${n} (declaradas ${COM_TETO[arquivo]?.quantas ?? 0})`)
    expect(excessos).toEqual([])
  })

  it('a lista acompanha a realidade (tirou um .in? baixe o número)', () => {
    const sobras = Object.entries(COM_TETO)
      .filter(([arquivo, { quantas }]) => (encontrados.get(arquivo) ?? 0) < quantas)
      .map(([arquivo, { quantas }]) => `${arquivo}: declaradas ${quantas}, encontradas ${encontrados.get(arquivo) ?? 0}`)
    expect(sobras).toEqual([])
  })

  it('margem dos serviços (APR-010) não volta a pôr as comandas na URL', () => {
    const caixa = semComentarios(readFileSync(join(SERVER, 'services/caixa.ts'), 'utf8'))
    expect(caixa).not.toMatch(/\.in\(\s*'ticket_id'/)
  })
})
