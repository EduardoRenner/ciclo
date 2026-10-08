import { describe, expect, it } from 'vitest'

import { corpoComSugestoes } from '@/core/advocacia/captura'
import { consolidarDia, type Alvo } from '@/core/advocacia/intimacoes'

const ALVO: Alvo = { tipo: 'oab', numero: '12345', uf: 'SC' }
const PROCESSO = '00012345620268240001'

/** Item no formato da API do DJEN (o mesmo molde do teste de `intimacoes`), com dados fictícios. */
const bruto = (id: number, texto: string, processo = PROCESSO, tipo = 'Intimação') => ({
  id,
  data_disponibilizacao: '2026-10-06',
  siglaTribunal: 'TJSC',
  tipoComunicacao: tipo,
  nomeOrgao: 'Vara de exemplo',
  texto,
  numero_processo: processo,
  hash: `h${id}`,
  status: 'P',
  motivo_cancelamento: null,
  data_cancelamento: null,
  destinatarios: [{ nome: 'PARTE EXEMPLO', polo: 'A' }],
  destinatarioadvogados: [{ advogado: { nome: 'ADVOGADA EXEMPLO DE TAL', numero_oab: '12345', uf_oab: 'SC' } }],
})

const TEXTO = 'Fica a parte intimada para manifestar-se no prazo de 15 (quinze) dias úteis.'

describe('corpoComSugestoes', () => {
  it('com caso cível e regra confirmada, a sugestão leva data, interno, memória e versão', () => {
    const dia = consolidarDia(1, [bruto(1, TEXTO)], ALVO)
    const corpo = corpoComSugestoes(ALVO, '2026-10-06', dia, new Map([[PROCESSO, { rito: 'civel', emDobro: false, comarca: null }]]), [], ['unidade-civel'])
    const s = corpo.itens[0]!.sugestao
    expect(s).toMatchObject({ suggested_due_on: expect.stringMatching(/^2026-10-\d\d$/), calc_rule_version: expect.any(String) })
    expect('calc_memo' in s && s.calc_memo).toMatchObject({ publicado_em: '2026-10-07', dias_lidos: 15 })
    // o corpo continua no formato que a RPC lê (0113)
    expect(corpo.itens[0]).toMatchObject({ djen_id: 1, texto_sanitizado: expect.stringContaining('15 (quinze)'), numero_processo: PROCESSO })
    expect(corpo.alvo).toBe('oab:12345/SC')
  })

  it('regra ainda não confirmada: sem data, com o motivo', () => {
    const dia = consolidarDia(1, [bruto(1, TEXTO)], ALVO)
    const corpo = corpoComSugestoes(ALVO, '2026-10-06', dia, new Map([[PROCESSO, { rito: 'civel', emDobro: false, comarca: null }]]), [], [])
    expect(corpo.itens[0]!.sugestao).toEqual({ sem_sugestao: expect.stringContaining('não confirmada') })
  })

  it('processo sem caso no escritório: sem data, pedindo o vínculo', () => {
    const dia = consolidarDia(1, [bruto(1, TEXTO)], ALVO)
    const corpo = corpoComSugestoes(ALVO, '2026-10-06', dia, new Map(), [], ['unidade-civel'])
    expect(corpo.itens[0]!.sugestao).toEqual({ sem_sugestao: expect.stringContaining('vincule') })
  })

  it('cada item recebe a SUA sugestão (a ordem dos itens é a das comunicações)', () => {
    const outro = '00099999920268240001'
    const dia = consolidarDia(2, [bruto(1, TEXTO), bruto(2, 'Ato ordinatório: vista dos autos.', outro)], ALVO)
    const corpo = corpoComSugestoes(ALVO, '2026-10-06', dia, new Map([[PROCESSO, { rito: 'civel', emDobro: false, comarca: null }]]), [], ['unidade-civel'])
    const porId = new Map(corpo.itens.map((i) => [i.djen_id, i.sugestao]))
    expect(porId.get(1)).toHaveProperty('suggested_due_on')
    expect(porId.get(2)).toHaveProperty('sem_sugestao')
  })
})
