import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TRATAMENTO_NA_ELIMINACAO } from '@/server/services/lgpd'

/**
 * A eliminação do titular (LGPD art. 18, VI) precisa alcançar TODO dado pessoal — e a lista do
 * que ela alcança é escrita à mão, em `lgpd.ts`. Lista escrita à mão envelhece: a auditoria de
 * 2026-08-23 (achado S15) encontrou CPF, endereço, contato de emergência de um terceiro e
 * alergia sobrevivendo à eliminação, todos em colunas das migrations 0017 e 0019 — acrescentadas
 * meses depois que a função nasceu, sem nada no caminho de quem as escreveu que apontasse para
 * lá. O sistema respondia `anonymized: true` e a tela dizia "Cliente eliminada".
 *
 * Este teste é a guarda. Ele lê as **migrations**, não o banco, de propósito: assim reprova no
 * commit que escreve a coluna, antes de ela existir em produção, e roda no CI sem precisar de
 * Postgres nenhum. Coluna nova capaz de carregar dado pessoal nasce reprovando até alguém
 * declarar em `TRATAMENTO_NA_ELIMINACAO` o que a eliminação faz com ela.
 *
 * O filtro é por tipo: `text`, `citext`, `jsonb`, `json`, `inet` e array de texto. Numérico, uuid
 * e timestamp não cabe um nome nem um endereço.
 */

const MIGRATIONS = 'supabase/migrations'
const TIPOS_QUE_CARREGAM_DADO = /^(text\[\]|_text|text|citext|jsonb|json|inet|varchar|character)$/i

/** Linha de constraint, não de coluna — o primeiro token não é nome de coluna. */
const NAO_E_COLUNA = new Set(['primary', 'unique', 'check', 'constraint', 'foreign', 'exclude', 'like'])

function sql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
}

/** `create table [if not exists] nome ( corpo );` — o corpo até o parêntese que fecha na coluna 0. */
function blocosDeCriacao(texto: string): { tabela: string; corpo: string }[] {
  const blocos: { tabela: string; corpo: string }[] = []
  const abertura = /create table\s+(?:if not exists\s+)?(?:public\.)?(\w+)\s*\(/gi
  for (const m of texto.matchAll(abertura)) {
    const inicio = m.index! + m[0].length
    // O `);` de fechamento do CREATE TABLE é o único que começa a linha — os de dentro
    // (`default '{}'::jsonb`, `check (x in (...))`) estão sempre indentados ou no meio da linha.
    const fim = texto.indexOf('\n);', inicio)
    if (fim === -1) continue
    blocos.push({ tabela: m[1]!.toLowerCase(), corpo: texto.slice(inicio, fim) })
  }
  return blocos
}

/** `alter table nome add column [if not exists] coluna tipo …` */
function colunasAdicionadas(texto: string): { tabela: string; coluna: string; tipo: string }[] {
  const re = /alter table\s+(?:public\.)?(\w+)\s+add column\s+(?:if not exists\s+)?(\w+)\s+([\w[\]]+)/gi
  return [...texto.matchAll(re)].map((m) => ({
    tabela: m[1]!.toLowerCase(),
    coluna: m[2]!.toLowerCase(),
    tipo: m[3]!.toLowerCase(),
  }))
}

function colunasDoBloco(corpo: string): { coluna: string; tipo: string }[] {
  const achadas: { coluna: string; tipo: string }[] = []
  for (const linha of corpo.split('\n')) {
    const limpa = linha.replace(/--.*$/, '').trim()
    const m = /^(\w+)\s+([\w[\]]+)/.exec(limpa)
    if (!m) continue
    const coluna = m[1]!.toLowerCase()
    if (NAO_E_COLUNA.has(coluna)) continue
    achadas.push({ coluna, tipo: m[2]!.toLowerCase() })
  }
  return achadas
}

/** Toda coluna que pode guardar texto livre, por tabela — só das tabelas ligadas a `clients`. */
function colunasSensiveisPorTabela(): Map<string, Set<string>> {
  const texto = sql()
  const blocos = blocosDeCriacao(texto)

  const ligadasAClientes = new Set<string>(['clients'])
  for (const { tabela, corpo } of blocos) {
    if (/references\s+(?:public\.)?clients\s*\(/i.test(corpo)) ligadasAClientes.add(tabela)
  }
  for (const { tabela } of colunasAdicionadas(texto).filter((c) => /clients/i.test(c.tipo))) {
    ligadasAClientes.add(tabela)
  }

  const mapa = new Map<string, Set<string>>()
  const registrar = (tabela: string, coluna: string, tipo: string) => {
    if (!ligadasAClientes.has(tabela)) return
    if (!TIPOS_QUE_CARREGAM_DADO.test(tipo)) return
    if (!mapa.has(tabela)) mapa.set(tabela, new Set())
    mapa.get(tabela)!.add(coluna)
  }

  for (const { tabela, corpo } of blocos) {
    for (const { coluna, tipo } of colunasDoBloco(corpo)) registrar(tabela, coluna, tipo)
  }
  for (const { tabela, coluna, tipo } of colunasAdicionadas(texto)) registrar(tabela, coluna, tipo)

  return mapa
}

const SENSIVEIS = colunasSensiveisPorTabela()

describe('o leitor de migrations deste teste', () => {
  /**
   * O parser é regex sobre SQL escrito à mão. Se ele parar de enxergar as migrations (mudança de
   * estilo, arquivo movido), o teste principal passaria vazio e a guarda viraria enfeite — que é
   * pior do que não existir, porque ninguém desconfia de teste verde. Estas âncoras são as
   * colunas exatas do achado S15: se sumirem daqui, o problema é o parser, não o schema.
   */
  it.each([
    ['clients', 'document'],
    ['clients', 'preferences'],
    ['clients', 'emergency_contact'],
    ['appointments', 'client_note'],
    ['client_notes', 'body'],
    ['quotes', 'message'],
    ['consents', 'ip'],
  ])('enxerga %s.%s', (tabela, coluna) => {
    expect(SENSIVEIS.get(tabela)).toBeDefined()
    expect([...SENSIVEIS.get(tabela)!]).toContain(coluna)
  })

  it('acha pelo menos 10 tabelas ligadas a clients', () => {
    expect(SENSIVEIS.size).toBeGreaterThanOrEqual(10)
  })
})

describe('TRATAMENTO_NA_ELIMINACAO cobre o schema', () => {
  const naoDeclaradas = [...SENSIVEIS.entries()].flatMap(([tabela, colunas]) =>
    [...colunas]
      .filter((coluna) => TRATAMENTO_NA_ELIMINACAO[tabela]?.[coluna] === undefined)
      .map((coluna) => `${tabela}.${coluna}`),
  )

  it('nenhuma coluna de dado pessoal ficou sem tratamento declarado', () => {
    // A mensagem é o valor deste teste: quem escreveu a migration precisa saber o que fazer.
    expect(
      naoDeclaradas,
      `Coluna nova capaz de carregar dado pessoal, sem tratamento na eliminação (LGPD art. 18, VI).\n` +
        `Declare cada uma em TRATAMENTO_NA_ELIMINACAO, em src/server/services/lgpd.ts, e implemente:\n` +
        `  anonimiza   → vira null na linha da própria cliente\n` +
        `  redige      → a linha sobrevive (obrigação fiscal) e só o conteúdo pessoal vira null\n` +
        `  apaga_linha → a linha inteira some\n` +
        `  preserva    → fica, e o motivo vai escrito ao lado\n`,
    ).toEqual([])
  })

  it('nada declarado aponta para coluna que não existe mais', () => {
    const fantasmas = Object.entries(TRATAMENTO_NA_ELIMINACAO).flatMap(([tabela, colunas]) =>
      Object.keys(colunas)
        .filter((coluna) => !SENSIVEIS.get(tabela)?.has(coluna))
        .map((coluna) => `${tabela}.${coluna}`),
    )
    expect(fantasmas, 'Declaração sobrando: a coluna saiu do schema e a entrada ficou.').toEqual([])
  })

  it('todo `preserva` tem motivo escrito ao lado', () => {
    // O comentário fica no arquivo, não no objeto — então o que dá para checar aqui é que a
    // linha do `preserva` no fonte tem `//` depois. É a diferença entre uma decisão e um esquecimento.
    const fonte = readFileSync('src/server/services/lgpd.ts', 'utf8')
    const semMotivo = fonte
      .split('\n')
      .filter((l) => /:\s*'preserva'/.test(l) && !/\/\/.+\S/.test(l))
      .map((l) => l.trim())
    expect(semMotivo, 'Preservar dado pessoal é decisão, e decisão precisa do porquê ao lado.').toEqual([])
  })
})
