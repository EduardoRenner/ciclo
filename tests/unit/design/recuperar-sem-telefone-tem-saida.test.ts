import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/82` §7, medido em 2026-09-23: a base trazida de memória chega sem telefone (o campo é
 * opcional de propósito), e na tela Recuperar o único botão era "Avisar", que para essa pessoa
 * termina em "sem telefone cadastrado". A saída é o `wa.me` sem número, que abre o seletor de
 * contatos do próprio WhatsApp do dono. O defeito volta sem erro nenhum: basta o botão de envio
 * deixar de depender do telefone.
 */
const fonte = semComentarios(readFileSync(join(__dirname, '..', '..', '..', 'src/app/admin/recuperar/recuperar.tsx'), 'utf8'))

describe('Recuperar: quem não tem telefone tem saída', () => {
  it('o link manual existe e leva o texto de volta', () => {
    expect(fonte).toContain('linkWhatsAppCompartilhar(textoDeVolta(')
  })

  it('o "Avisar" do item só aparece para quem tem telefone', () => {
    const inicio = fonte.indexOf('item.phone ? (')
    expect(inicio, 'o ramo por telefone sumiu do item da lista').toBeGreaterThan(-1)
    const ramoComTelefone = fonte.slice(inicio, fonte.indexOf(') : (', inicio))
    expect(ramoComTelefone).toContain('onClick={() => enviar([item])}')
    const ramoSemTelefone = fonte.slice(fonte.indexOf(') : (', inicio), fonte.indexOf(')}', fonte.indexOf(') : (', inicio)))
    expect(ramoSemTelefone).toContain('linkWhatsAppCompartilhar(')
    expect(ramoSemTelefone).not.toContain('enviar([item])')
  })

  it('quem pediu para não receber e não tem telefone não ganha o "Chamar"', () => {
    const optOut = fonte.indexOf('item.optOut && !item.phone ? (')
    // O fim do ramo é o `: item.phone ? (` seguinte — procurar só `item.phone ? (` casaria dentro
    // do próprio `!item.phone ? (` e a fatia examinada sairia vazia (guarda cega, pega por mutação).
    const ramoComTelefone = fonte.indexOf(') : item.phone ? (', optOut)
    expect(optOut, 'o ramo de opt-out sumiu do item da lista').toBeGreaterThan(-1)
    expect(ramoComTelefone, 'o ramo com telefone sumiu depois do opt-out').toBeGreaterThan(optOut)
    const ramoOptOut = fonte.slice(optOut, ramoComTelefone)
    expect(ramoOptOut).toContain('Pediu para não receber')
    expect(ramoOptOut).not.toContain('linkWhatsAppCompartilhar(')
  })
})

