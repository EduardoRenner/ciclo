import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AUTOMACOES } from '@/core/automacoes/catalogo'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/112 EXP-A02 (achados D2 e D3 do `05-avisos.md`): a tela de Automações dizia "falta ligar o
 * envio no WhatsApp" para toda automação parada, inclusive o aviso de estoque, e a de Notificações
 * prometia "Lembretes e alertas no aparelho", que nunca chegam.
 */
describe('cada automação parada diz o motivo dela', () => {
  it('toda automação que depende de rota agendada tem o próprio motivo de parada', () => {
    const comRota = AUTOMACOES.filter((a) => a.rota !== null && !a.sempreLigada)
    expect(comRota.length, 'a varredura não achou automação com rota: ficou cega').toBeGreaterThan(0)
    for (const a of comRota) expect(a.motivoDeParada, a.chave).toBeTruthy()
  })

  it('o aviso de estoque não fala de WhatsApp', () => {
    const estoque = AUTOMACOES.find((a) => a.chave === 'alertas_de_estoque')
    expect(estoque?.motivoDeParada).toBeTruthy()
    expect(estoque?.motivoDeParada).not.toMatch(/whatsapp/i)
  })

  it('a tela usa o motivo do catálogo, e não uma frase fixa de WhatsApp', () => {
    const tela = semComentarios(readFileSync('src/app/admin/config/automacoes/automacoes.tsx', 'utf8'))
    expect(tela).toMatch(/a\.motivoDeParada/)
    expect(tela).not.toMatch(/falta ligar o envio no WhatsApp/)
  })

  it('a tela de notificações não promete lembrete no aparelho', () => {
    const tela = semComentarios(readFileSync('src/app/admin/config/notificacoes/ativar.tsx', 'utf8'))
    expect(tela).not.toMatch(/Lembretes? e alertas no aparelho/i)
  })
})
