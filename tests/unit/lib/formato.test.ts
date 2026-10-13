import { describe, expect, it } from 'vitest'

import { formatarTelefone, horaLocal, mascaraTelefone } from '@/lib/formato'

describe('formatarTelefone', () => {
  it('mostra o E.164 do banco como a profissional lê', () => {
    expect(formatarTelefone('+5511987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('+551133334444')).toBe('(11) 3333-4444')
  })

  it('número que não é celular brasileiro aparece cru, não sumido', () => {
    // Base importada de planilha tem de tudo; esconder é pior que mostrar torto.
    expect(formatarTelefone('+351912345678')).toBe('+351912345678')
    expect(formatarTelefone(null)).toBeNull()
  })
})

describe('mascaraTelefone', () => {
  it('formata enquanto digita, sem travar em nenhum tamanho intermediário', () => {
    expect(mascaraTelefone('1')).toBe('1')
    expect(mascaraTelefone('11')).toBe('11')
    expect(mascaraTelefone('119')).toBe('(11) 9')
    expect(mascaraTelefone('11987')).toBe('(11) 987')
    expect(mascaraTelefone('1198765')).toBe('(11) 9876-5')
    expect(mascaraTelefone('11987654321')).toBe('(11) 98765-4321')
  })

  it('aceita o fixo de 8 dígitos que salão antigo ainda usa', () => {
    expect(mascaraTelefone('1133334444')).toBe('(11) 3333-4444')
  })

  it('descarta o +55 colado de um contato do WhatsApp', () => {
    expect(mascaraTelefone('+55 11 98765-4321')).toBe('(11) 98765-4321')
  })

  it('ignora o que passa de 11 dígitos em vez de deixar a máscara explodir', () => {
    expect(mascaraTelefone('119876543219999')).toBe('(11) 98765-4321')
  })

  it('é idempotente — reaplicar a máscara no valor já mascarado não muda nada', () => {
    // O componente controla o campo com a saída da própria função; sem isto o
    // valor se desfaria a cada tecla.
    expect(mascaraTelefone(mascaraTelefone('11987654321'))).toBe('(11) 98765-4321')
  })
})

/**
 * Consolidada em 2026-09-20 (BL-26) de três cópias — `admin/agenda/agenda.tsx` e
 * `admin/hoje/hoje.tsx` (sem `timezone`, telas internas) e `[slug]/agendar/agendar.tsx` (com
 * `timezone`, página pública vista de qualquer fuso). Nenhuma das três tinha teste, e a
 * consolidação também não ganhou um — a função que decide QUE HORAS aparecem no agendamento da
 * cliente, na página pública, sem cobertura nenhuma.
 */
describe('horaLocal', () => {
  it('formata HH:MM no fuso pedido, não no do ambiente que roda o teste', () => {
    // 23:30 UTC é 20:30 em São Paulo (UTC-3) e 08:30 do dia seguinte em Tóquio (UTC+9) — o
    // mesmo instante, duas leituras diferentes. Prova que o parâmetro `timezone` é respeitado,
    // não só aceito.
    const instante = '2026-06-15T23:30:00Z'
    expect(horaLocal(instante, 'America/Sao_Paulo')).toBe('20:30')
    expect(horaLocal(instante, 'Asia/Tokyo')).toBe('08:30')
  })

  it('o painel não depende do fuso do runtime: o servidor UTC desenha a hora do salão', () => {
    // APR-019. A premissa antiga ("as telas internas não passam fuso, quem olha já está no fuso do
    // salão") esquecia que o HTML sai do SERVIDOR, que na Vercel é UTC: a Agenda mostrava 12:00
    // para 09:00 até a hidratação. Com o fuso do negócio, o resultado é o mesmo em qualquer runtime.
    const instante = '2026-06-15T12:00:00Z'
    expect(horaLocal(instante, 'America/Sao_Paulo')).toBe('09:00')
  })

  it('meia-noite tem dois dígitos, nunca a hora nua', () => {
    expect(horaLocal('2026-06-15T00:05:00Z', 'UTC')).toBe('00:05')
  })
})
