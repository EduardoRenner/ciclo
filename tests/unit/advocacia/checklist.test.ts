import { describe, expect, it } from 'vitest'

import {
  gerarPendencias,
  proximoLembrete,
  somarDiasUteis,
  transicionar,
  type ModeloDeChecklist,
} from '@/core/advocacia/checklist'

const HOLDING: ModeloDeChecklist = {
  tipoDeCaso: 'holding',
  versao: 1,
  passos: [
    { titulo: 'Contrato social atual', tipo: 'enviar_documento', quemDeve: 'cliente', diasUteis: 5, categoria: 'contrato_social' },
    { titulo: 'Matrícula de cada imóvel', tipo: 'enviar_documento', quemDeve: 'cliente', diasUteis: 10, urgencia: 'alta' },
    { titulo: 'Conferir quadro societário', tipo: 'conferir', quemDeve: 'equipe', diasUteis: 0 },
  ],
}

describe('datas relativas em dias úteis', () => {
  const sem = new Set<string>()

  it('caso aberto num sábado conta a partir de segunda', () => {
    // 2026-10-10 é sábado. Sem feriado cadastrado, segunda 12/10 é útil (o feriado nacional só conta se estiver na lista).
    expect(somarDiasUteis('2026-10-10', 0, sem)).toBe('2026-10-12')
    expect(somarDiasUteis('2026-10-10', 1, sem)).toBe('2026-10-13')
  })

  it('feriado cadastrado é pulado', () => {
    expect(somarDiasUteis('2026-10-09', 1, new Set(['2026-10-12']))).toBe('2026-10-13')
  })

  it('n fora de 0..365 é recusado, sem chute', () => {
    expect(() => somarDiasUteis('2026-10-09', -1, sem)).toThrow(RangeError)
    expect(() => somarDiasUteis('2026-10-09', 1.5, sem)).toThrow(RangeError)
  })
})

describe('gerar pendências do modelo', () => {
  it('uma por passo, na ordem, com a data em dias úteis desde a abertura', () => {
    const p = gerarPendencias(HOLDING, '2026-10-08', [{ data: '2026-10-12', motivo: 'feriado nacional' }])
    expect(p.map((x) => [x.posicao, x.titulo, x.venceEm])).toEqual([
      // qui 08/10 + 5 úteis, pulando sáb, dom e o feriado de seg 12/10: 09, 13, 14, 15, 16
      [1, 'Contrato social atual', '2026-10-16'],
      [2, 'Matrícula de cada imóvel', '2026-10-23'],
      [3, 'Conferir quadro societário', '2026-10-08'],
    ])
    expect(p.every((x) => x.estado === 'pendente' && x.rodada === 1)).toBe(true)
    expect(p[1]!.urgencia).toBe('alta')
    expect(p[0]!.urgencia).toBe('media')
  })

  it('quem é de estágio gera em rascunho: a advocacia aprova antes de o cliente ser cobrado', () => {
    expect(gerarPendencias(HOLDING, '2026-10-08', [], { criadoPorEstagio: true }).every((x) => x.estado === 'rascunho')).toBe(true)
  })

  it('o modelo não é alterado (caso aberto congela a versão; o modelo é só leitura)', () => {
    const antes = JSON.stringify(HOLDING)
    gerarPendencias(HOLDING, '2026-10-08', [])
    expect(JSON.stringify(HOLDING)).toBe(antes)
  })
})

describe('estados', () => {
  it('caminho feliz: pendente → recebido → em conferência → concluído', () => {
    let s = { estado: 'pendente' as const, rodada: 1 }
    const r1 = transicionar(s, 'receber')
    expect(r1).toEqual({ ok: true, estado: 'recebido', rodada: 1, zerarLembretes: false })
    const r2 = transicionar({ estado: 'recebido', rodada: 1 }, 'conferir')
    expect(r2.ok && r2.estado).toBe('em_conferencia')
    const r3 = transicionar({ estado: 'em_conferencia', rodada: 1 }, 'concluir')
    expect(r3.ok && r3.estado).toBe('concluido')
    s = { estado: 'pendente', rodada: 1 }
    expect(transicionar(s, 'concluir').ok).toBe(true)
  })

  it('devolver exige motivo e abre rodada nova, zerando a escada', () => {
    expect(transicionar({ estado: 'recebido', rodada: 1 }, 'devolver', '')).toEqual({
      ok: false,
      motivo: 'Escreva o motivo (pelo menos 5 letras): ele fica no histórico.',
    })
    expect(transicionar({ estado: 'recebido', rodada: 1 }, 'devolver', '    ').ok).toBe(false)
    expect(transicionar({ estado: 'recebido', rodada: 1 }, 'devolver', 'Matrícula ilegível')).toEqual({
      ok: true,
      estado: 'devolvido',
      rodada: 2,
      zerarLembretes: true,
    })
  })

  it('cancelar exige motivo; concluída não volta', () => {
    expect(transicionar({ estado: 'pendente', rodada: 1 }, 'cancelar').ok).toBe(false)
    expect(transicionar({ estado: 'pendente', rodada: 1 }, 'cancelar', 'Cliente desistiu do caso').ok).toBe(true)
    const r = transicionar({ estado: 'concluido', rodada: 1 }, 'receber')
    expect(r).toEqual({ ok: false, motivo: 'Não dá para marcar como recebida uma pendência concluída.' })
  })

  it('rascunho só sai por aprovação ou cancelamento', () => {
    expect(transicionar({ estado: 'rascunho', rodada: 1 }, 'receber').ok).toBe(false)
    expect(transicionar({ estado: 'rascunho', rodada: 1 }, 'aprovar')).toEqual({ ok: true, estado: 'pendente', rodada: 1, zerarLembretes: false })
  })
})

describe('escada de lembretes', () => {
  const base = { estado: 'pendente' as const, quemDeve: 'cliente' as const, rodadaDesde: '2026-10-01', jaPreparados: [] as number[], ligarJaCriado: false }

  it('D0 no dia da rodada', () => {
    expect(proximoLembrete(base, '2026-10-01')).toEqual({ tipo: 'mensagem', marco: 0 })
  })

  it('marco é "chegou ou passou": job parado no D3 sai no D4, uma vez', () => {
    const p = { ...base, jaPreparados: [0] }
    expect(proximoLembrete(p, '2026-10-05')).toEqual({ tipo: 'mensagem', marco: 3 })
    expect(proximoLembrete({ ...p, jaPreparados: [0, 3] }, '2026-10-05')).toEqual({ tipo: 'nada' })
  })

  it('atraso de vários dias não gera rajada: sai só o maior marco alcançado', () => {
    expect(proximoLembrete(base, '2026-10-09')).toEqual({ tipo: 'mensagem', marco: 7 })
  })

  it('D+10 vira tarefa de ligar, uma vez', () => {
    expect(proximoLembrete({ ...base, jaPreparados: [0, 3, 7] }, '2026-10-11')).toEqual({ tipo: 'ligar' })
    expect(proximoLembrete({ ...base, ligarJaCriado: true }, '2026-10-20')).toEqual({ tipo: 'nada' })
  })

  it('pendência da equipe, recebida ou concluída nunca gera lembrete ao cliente', () => {
    expect(proximoLembrete({ ...base, quemDeve: 'equipe' }, '2026-10-05')).toEqual({ tipo: 'nada' })
    for (const estado of ['recebido', 'em_conferencia', 'concluido', 'cancelado', 'rascunho'] as const) {
      expect(proximoLembrete({ ...base, estado }, '2026-10-05'), estado).toEqual({ tipo: 'nada' })
    }
  })

  it('devolvida conta da nova rodada', () => {
    expect(proximoLembrete({ ...base, estado: 'devolvido', rodadaDesde: '2026-10-08' }, '2026-10-08')).toEqual({ tipo: 'mensagem', marco: 0 })
  })
})
