import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/112 EXP-S11: os exemplos que o painel mostra para a profissional preencher eram de barbearia,
 * "Bruno Almeida · Corte + barba", "Corte ilimitado", "Corte grátis", "Marcos / Rafael", "e se eu
 * subir o corte para R$ 55?". Exemplo é a primeira coisa que ensina para que serve o campo: um
 * exemplo de barbearia diz que o produto é de barbearia.
 *
 * A barbearia continua aceita: os campos de preferência dela (`lib/preferencias.ts`) aparecem só para
 * conta de barbearia, e ficam de fora daqui.
 */
const PROIBIDO = /barba|navalha|\bcorte\b/i

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return arquivos(caminho)
    return /\.tsx$/.test(e.name) ? [caminho] : []
  })
}

/** Valores de `placeholder="..."`, `placeholder={'...'}` e `placeholder={"..."}`. */
function placeholders(fonte: string): string[] {
  return [...fonte.matchAll(/placeholder=(?:"([^"]*)"|\{'([^']*)'\}|\{"([^"]*)"\})/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
}

describe('exemplos do painel são de salão (docs/112 EXP-S11)', () => {
  const doPainel = arquivos('src/app/admin').map((f) => ({ f, lista: placeholders(semComentarios(readFileSync(f, 'utf8'))) }))

  it('nenhum placeholder do painel fala de barba, navalha ou corte', () => {
    const total = doPainel.reduce((s, x) => s + x.lista.length, 0)
    // Piso pelo medido em 21/10 (28 placeholders): abaixo de 20 é a varredura que parou de achar.
    expect(total, 'a varredura não achou placeholder nenhum: a guarda ficou cega').toBeGreaterThanOrEqual(20)
    const achados = doPainel.flatMap(({ f, lista }) => lista.filter((p) => PROIBIDO.test(p)).map((p) => `${f}: ${p}`))
    expect(achados).toEqual([])
  })

  it('a prévia das mensagens usa uma cliente e um serviço de salão', () => {
    const editor = readFileSync('src/app/admin/config/mensagens/editor.tsx', 'utf8')
    const exemplo = editor.match(/nome: '([^']+)',\s*servico: '([^']+)'/)
    expect(exemplo, 'não achei o exemplo da prévia: a guarda ficou cega').toBeTruthy()
    expect(`${exemplo![1]} ${exemplo![2]}`).not.toMatch(PROIBIDO)
  })

  it('o exemplo de pergunta do assistente não é sobre corte', () => {
    const planejar = readFileSync('src/core/inteligencia/planejar.ts', 'utf8')
    // Todos os exemplos, não o primeiro: o primeiro é o da contratação, e a guarda passava olhando só ele.
    const exemplos = [...planejar.matchAll(/Por exemplo: "([^"]+)"/g)].map((m) => m[1]!)
    expect(exemplos.length, 'não achei os exemplos: a guarda ficou cega').toBeGreaterThanOrEqual(3)
    expect(exemplos.filter((e) => PROIBIDO.test(e))).toEqual([])
  })

  it('cliente sem vertical cai nos campos neutros, não nos de barbearia', () => {
    for (const f of ['src/app/admin/clientes/nova/page.tsx', 'src/app/admin/clientes/[id]/page.tsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/vertical \?\? 'barber'/)
    }
  })
})
