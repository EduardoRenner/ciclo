import { describe, expect, it } from 'vitest'

import { decidirMudancaDeSigilo, enxergaOCaso, podeMudarEstado, sigiloInicial } from '@/core/advocacia/casos'
import { MAX_ITENS_NA_COBRANCA, montarMensagem, PROIBIDO_NA_MENSAGEM } from '@/core/advocacia/mensagens'

describe('estados do caso', () => {
  it('anda, espera, conclui, reabre e arquiva', () => {
    expect(podeMudarEstado('aberto', 'em_andamento')).toBe(true)
    expect(podeMudarEstado('em_andamento', 'aguardando_cliente')).toBe(true)
    expect(podeMudarEstado('concluido', 'em_andamento')).toBe(true)
    expect(podeMudarEstado('concluido', 'arquivado')).toBe(true)
  })

  it('arquivado é fim da linha; aberto não pula para arquivado', () => {
    expect(podeMudarEstado('arquivado', 'em_andamento')).toBe(false)
    expect(podeMudarEstado('aberto', 'arquivado')).toBe(false)
  })
})

describe('sigilo', () => {
  it('criminal e júri nascem sigilosos mesmo que escolham normal', () => {
    expect(sigiloInicial('criminal', 'normal')).toBe('sigiloso')
    expect(sigiloInicial('tribunal_juri', 'normal')).toBe('sigiloso')
    expect(sigiloInicial('holding', 'normal')).toBe('normal')
  })

  it('subir para sigiloso: qualquer papel que edita', () => {
    expect(decidirMudancaDeSigilo({ area: 'holding', sigilo: 'normal' }, 'sigiloso', 'reception', null)).toEqual({ ok: true })
    expect(decidirMudancaDeSigilo({ area: 'holding', sigilo: 'normal' }, 'sigiloso', 'finance', null).ok).toBe(false)
  })

  it('descer: só a direção, com motivo, e nunca em criminal', () => {
    const caso = { area: 'holding', sigilo: 'sigiloso' as const }
    expect(decidirMudancaDeSigilo(caso, 'normal', 'manager', 'motivo válido')).toEqual({ ok: false, motivo: 'Só a direção tira o sigilo de um caso.' })
    expect(decidirMudancaDeSigilo(caso, 'normal', 'owner', '  ').ok).toBe(false)
    expect(decidirMudancaDeSigilo(caso, 'normal', 'owner', 'Cliente autorizou')).toEqual({ ok: true })
    expect(decidirMudancaDeSigilo({ area: 'criminal', sigilo: 'sigiloso' }, 'normal', 'owner', 'qualquer motivo').ok).toBe(false)
  })

  it('quem enxerga: direção sempre; normal todos; sigiloso só a equipe do caso', () => {
    const sigiloso = { sigilo: 'sigiloso' as const, equipe: ['ana'] }
    expect(enxergaOCaso(sigiloso, { id: 'x', papel: 'owner' })).toBe(true)
    expect(enxergaOCaso(sigiloso, { id: 'ana', papel: 'professional' })).toBe(true)
    expect(enxergaOCaso(sigiloso, { id: 'beto', papel: 'professional' })).toBe(false)
    expect(enxergaOCaso(sigiloso, { id: 'beto', papel: 'reception' })).toBe(false)
    expect(enxergaOCaso({ sigilo: 'normal', equipe: [] }, { id: 'beto', papel: 'reception' })).toBe(true)
  })
})

describe('mensagem pronta de WhatsApp', () => {
  const base = { primeiroNome: 'Helena', escritorio: 'Alvorada Advocacia', casoParaCliente: 'o planejamento da família' }

  it('cobrança com os itens, sem dado do caso, sem gênero e sem travessão', () => {
    const r = montarMensagem({ tipo: 'cobranca', ...base, itens: ['Matrícula do imóvel', 'Declaração de IR'] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.texto).toBe(
      ['Oi, Helena! Aqui é do Alvorada Advocacia.', 'Para seguir com o planejamento da família, ainda precisamos de:', '• Matrícula do imóvel', '• Declaração de IR', 'Pode enviar por aqui mesmo. Agradecemos.'].join('\n'),
    )
    expect(r.texto).not.toMatch(/[—–]/)
    expect(r.texto).not.toMatch(/obrigad[oa]/i)
  })

  it('sem nome, "Oi!" simples; lista longa é cortada com "e mais N itens"', () => {
    const itens = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']
    const r = montarMensagem({ tipo: 'cobranca', ...base, primeiroNome: null, itens })
    expect(r.ok && r.texto.startsWith('Oi! Aqui é')).toBe(true)
    expect(r.ok && r.texto.split('\n').filter((l) => l.startsWith('•'))).toHaveLength(MAX_ITENS_NA_COBRANCA)
    expect(r.ok && r.texto).toContain('e mais 2 itens.')
  })

  it('recusa quando um campo preenchido errado traria número de processo', () => {
    const r = montarMensagem({ tipo: 'andamento', ...base, casoParaCliente: 'o processo 0001234-56.2026.8.24.0001', frase: 'saiu decisão.' })
    expect(r).toEqual({ ok: false, motivo: 'A mensagem traria número de processo. Corrija o texto do caso ou da pendência antes de enviar.' })
  })

  it('recusa valor, CPF e CNPJ', () => {
    for (const frase of ['o acordo ficou em R$ 50.000.', 'CPF 123.456.789-09 confirmado.', 'empresa 12.345.678/0001-95 registrada.']) {
      expect(montarMensagem({ tipo: 'andamento', ...base, frase }).ok, frase).toBe(false)
    }
  })

  it('controle positivo: o detector de processo acusa com e sem máscara, e não acusa uma data', () => {
    const cnj = PROIBIDO_NA_MENSAGEM.find((p) => p.nome === 'número de processo')!.re
    expect(cnj.test('00012345620268240001')).toBe(true)
    expect(cnj.test('0001234-56.2026.8.24.0001')).toBe(true)
    expect(cnj.test('reunião em 14/10/2026')).toBe(false)
  })
})
