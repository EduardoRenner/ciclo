import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * `appointment_status` tem SETE valores no banco. `ROTULO_STATUS` da ficha da cliente traduzia
 * seis: faltava `expired`, que é estado alcançável de verdade (`pending → expired` está na máquina
 * de estados). O `?? h.status` do fim então mostrava a palavra inglesa crua "expired" no histórico
 * — numa tela inteira em português, para um dono que não fala inglês.
 *
 * A causa é a de sempre: DOIS lugares guardando a mesma verdade. `appointment-row.tsx` já
 * traduzia `expired` ("Vencido"); a ficha era uma segunda cópia que ficou para trás. O conserto
 * tipou o mapa por `EstadoAgendamento`, então o TypeScript agora cobra — mas o TypeScript só
 * conhece a UNIÃO, e não sabe se ela ainda corresponde ao ENUM do banco. É essa costura que esta
 * guarda cobre, e é por ela que o buraco entrou.
 */
const MIGRACOES = 'supabase/migrations'

/** Valores de um `create type <nome> as enum (...)`, lidos das migrações de verdade. */
function enumDoBanco(nome: string): string[] {
  for (const arquivo of readdirSync(MIGRACOES).sort()) {
    if (!arquivo.endsWith('.sql')) continue
    const sql = readFileSync(`${MIGRACOES}/${arquivo}`, 'utf8')
    const m = sql.match(new RegExp(String.raw`create type\s+${nome}\s+as enum\s*\(([^)]+)\)`, 'i'))
    if (m) return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!)
  }
  return []
}

/** Valores de uma união de literais `export type X = 'a' | 'b'`. */
function uniaoDoCodigo(arquivo: string, tipo: string): string[] {
  const fonte = readFileSync(arquivo, 'utf8')
  const m = fonte.match(new RegExp(String.raw`export type ${tipo}\s*=([^\n]+)`))
  if (!m) return []
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!)
}

const PARES = [
  { enum: 'appointment_status', arquivo: 'src/core/scheduling/state.ts', tipo: 'EstadoAgendamento' },
  { enum: 'cycle_state', arquivo: 'src/core/cycle/compute.ts', tipo: 'EstadoCiclo' },
]

describe('todo estado do banco existe no código', () => {
  for (const par of PARES) {
    it(`${par.tipo} cobre o enum ${par.enum}`, () => {
      const doBanco = enumDoBanco(par.enum)
      const doCodigo = uniaoDoCodigo(par.arquivo, par.tipo)

      // Grita se qualquer um dos dois lados não foi encontrado — passar vazio aqui seria a guarda
      // cega clássica: dois arrays vazios são iguais.
      expect(doBanco.length, `enum ${par.enum} não encontrado nas migrações`).toBeGreaterThan(1)
      expect(doCodigo.length, `união ${par.tipo} não encontrada em ${par.arquivo}`).toBeGreaterThan(1)

      expect([...doCodigo].sort(), `o código e o banco discordam sobre ${par.enum} — algum estado real vai aparecer cru na tela`).toEqual([...doBanco].sort())
    })
  }
})
