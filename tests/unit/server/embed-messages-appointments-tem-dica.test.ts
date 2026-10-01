import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Desde a 0099 existem DUAS ligações entre `messages` e `appointments`: `appointment_id` (o
 * lembrete daquele horário) e `booked_appointment_id` (o horário marcado pelo link de volta). Com
 * duas, o PostgREST recusa embutir uma tabela na outra sem dizer qual ligação usar:
 * "Could not embed because more than one relationship was found". Não é erro de compilação nem de
 * tipo; aparece na hora de rodar, e a migration chega na produção ANTES do código.
 *
 * Foi assim que a resposta de WhatsApp recebida (`whatsapp-inbound.ts`) quebrou no CI do PR #136.
 * Esta guarda exige a dica da FK (`!messages_..._fkey`) em todo embed entre as duas tabelas.
 */

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return nome.endsWith('.ts') || nome.endsWith('.tsx') ? [caminho.split(String.fromCharCode(92)).join('/')] : []
  })
}

/** Cada `.from('<tabela>')` com o `.select('...')` que vem logo depois, até o fim do statement. */
function selectsDe(fonte: string, tabela: string): string[] {
  const limpo = semComentarios(fonte)
  const saida: string[] = []
  for (const m of limpo.matchAll(new RegExp(`\\.from\\('${tabela}'\\)`, 'g'))) {
    const inicio = m.index ?? 0
    const fim = limpo.indexOf('\n\n', inicio)
    const trecho = limpo.slice(inicio, fim > 0 ? fim : undefined)
    const sel = /\.select\(\s*'([^']*)'/.exec(trecho)
    if (sel) saida.push(sel[1]!)
  }
  return saida
}

const FONTES = arquivos('src').map((f) => ({ f, s: readFileSync(f, 'utf8') }))

describe('embed entre messages e appointments diz qual ligação usar (0099)', () => {
  it('a varredura enxerga o embed conhecido (whatsapp-inbound)', () => {
    const conhecidos = FONTES.flatMap(({ f, s }) => selectsDe(s, 'messages').map((sel) => ({ f, sel }))).filter((x) =>
      /\bappointments!/.test(x.sel),
    )
    expect(conhecidos.some((x) => x.f.endsWith('whatsapp-inbound.ts')), 'o detector parou de achar o embed de whatsapp-inbound').toBe(true)
  })

  it('nenhum embed sem dica de FK, nos dois sentidos', () => {
    const ofensores = FONTES.flatMap(({ f, s }) => [
      ...selectsDe(s, 'messages')
        .filter((sel) => /\bappointments(!inner)?\(/.test(sel))
        .map((sel) => `${f}: messages → appointments sem dica: ${sel}`),
      ...selectsDe(s, 'appointments')
        .filter((sel) => /\bmessages(!inner)?\(/.test(sel))
        .map((sel) => `${f}: appointments → messages sem dica: ${sel}`),
    ])
    expect(ofensores).toEqual([])
  })
})
