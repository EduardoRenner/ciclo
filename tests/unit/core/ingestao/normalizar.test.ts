import { describe, expect, it } from 'vitest'

import { dataDoSerialDoExcel, normalizarData, normalizarDinheiro, normalizarEmail, normalizarNome, normalizarTelefone, separarTelefones } from '@/core/ingestao/normalizar'
import { normalizarTelefoneBR } from '@/server/services/telefone'

/** CNV-005: E6. Dados inventados. */
const tel = (v: string, ddd?: number) => {
  const r = normalizarTelefone(v, ddd)
  return r.ok ? `${r.e164}${r.correcoes.length ? ` [${r.correcoes.join(',')}]` : ''}` : `x:${r.motivo}`
}

describe('telefone no core (CNV-005)', () => {
  it('celular e fixo em todo formato comum', () => {
    expect(tel('(11) 99999-0001')).toBe('+5511999990001')
    expect(tel('+55 11 9 9999-0001')).toBe('+5511999990001')
    expect(tel('011 99999-0001')).toBe('+5511999990001')
    expect(tel('0 15 11 99999-0001')).toBe('+5511999990001')
    expect(tel('(41) 3333-4444')).toBe('+554133334444')
    expect(normalizarTelefone('(41) 3333-4444')).toMatchObject({ tipo: 'fixo' })
  })

  it('sem DDD: só com o DDD do salão, e a correção é dita', () => {
    expect(tel('99999-0001')).toBe('x:sem_ddd')
    expect(tel('99999-0001', 41)).toBe('+5541999990001 [ddd_do_salao]')
  })

  it('celular antigo de 8 dígitos ganha o nono dígito, marcado', () => {
    expect(tel('(11) 8765-4321')).toBe('+5511987654321 [nono_digito]')
  })

  it('DDD inexistente, tamanho errado e começo impossível', () => {
    expect(tel('(10) 99999-0001')).toBe('x:ddd_inexistente')
    expect(tel('123')).toBe('x:tamanho')
    expect(tel('(11) 1234-5678')).toBe('x:nao_e_celular_nem_fixo')
    expect(tel('')).toBe('x:vazio')
  })

  it('D2: dois telefones na célula viram dois, celular primeiro', () => {
    const r = separarTelefones('fixo: (11) 3333-0001 / cel: (11) 99999-0001')
    expect(r.map((t) => (t.ok ? t.e164 : t.motivo))).toEqual(['+5511999990001', '+551133330001'])
    expect(separarTelefones('11999990001 e 11988880002')).toHaveLength(2)
  })

  it('paridade com o servidor: onde o servidor aceita, o core dá o mesmo E.164', () => {
    const casos = ['(11) 99999-0001', '+55 21 98888-7777', '011 3030-4040', '5511999990001', '(85) 98765-4321', '(41) 3333-4444', '99999-0001', '(10) 99999-0001', '123']
    for (const c of casos) {
      const servidor = normalizarTelefoneBR(c)
      const nucleo = normalizarTelefone(c)
      if (servidor) expect(nucleo.ok && nucleo.e164, c).toBe(servidor)
      else expect(nucleo.ok, c).toBe(false)
    }
  })
})

describe('nome, e-mail, data e dinheiro (CNV-005)', () => {
  it('nome: caixa refeita só quando veio tudo maiúsculo ou minúsculo', () => {
    expect(normalizarNome('  MARIA   DA SILVA ')).toEqual({ valor: 'Maria da Silva', recaixado: true })
    expect(normalizarNome("joão d'ávila dos santos")).toEqual({ valor: "João D'Ávila dos Santos", recaixado: true })
    expect(normalizarNome('Ronald McDonald')).toEqual({ valor: 'Ronald McDonald', recaixado: false })
  })

  it('e-mail: formato conferido (D12) e domínio trocado vira sugestão, nunca troca calado', () => {
    expect(normalizarEmail(' Maria@Gmial.com ')).toEqual({ ok: true, valor: 'maria@gmial.com', sugestao: 'maria@gmail.com' })
    expect(normalizarEmail('joao@exemplo.com.br')).toEqual({ ok: true, valor: 'joao@exemplo.com.br', sugestao: null })
    expect(normalizarEmail('joao@')).toEqual({ ok: false, motivo: 'formato' })
    expect(normalizarEmail('joao..lima@x.com')).toEqual({ ok: false, motivo: 'formato' })
  })

  it('data: dia/mês, mês/dia, ISO, ano curto, serial do Excel (1900 e 1904)', () => {
    const hoje = '2026-10-13'
    expect(normalizarData('25/08/2026', 'dmy', hoje)).toEqual({ ok: true, iso: '2026-08-25', doExcel: false })
    expect(normalizarData('08/25/2026', 'mdy', hoje)).toEqual({ ok: true, iso: '2026-08-25', doExcel: false })
    expect(normalizarData('2026-08-25 14:30', 'ymd', hoje)).toMatchObject({ ok: true, iso: '2026-08-25' })
    expect(normalizarData('25/08/90', 'dmy', hoje)).toMatchObject({ ok: true, iso: '1990-08-25' })
    expect(dataDoSerialDoExcel(46259)).toBe('2026-08-25')
    expect(dataDoSerialDoExcel(44797, true)).toBe('2026-08-25')
    expect(normalizarData('46259', 'dmy', hoje)).toEqual({ ok: true, iso: '2026-08-25', doExcel: true })
  })

  it('data no futuro, inexistente ou ambígua sem decisão: nunca entra calada (D13)', () => {
    const hoje = '2026-10-13'
    expect(normalizarData('15/08/2062', 'dmy', hoje)).toEqual({ ok: false, motivo: 'futuro' })
    expect(normalizarData('31/02/2026', 'dmy', hoje)).toEqual({ ok: false, motivo: 'invalida' })
    expect(normalizarData('29/02/2025', 'dmy', hoje)).toEqual({ ok: false, motivo: 'invalida' })
    expect(normalizarData('03/08/2026', 'ambigua', hoje)).toEqual({ ok: false, motivo: 'ambigua' })
    expect(normalizarData('08/08/2026', 'ambigua', hoje), 'dia = mês não é ambíguo').toMatchObject({ ok: true, iso: '2026-08-08' })
  })

  it('dinheiro em centavos, em todo formato comum', () => {
    expect(normalizarDinheiro('R$ 1.234,56')).toBe(123456)
    expect(normalizarDinheiro('80')).toBe(8000)
    expect(normalizarDinheiro('80,5')).toBe(8050)
    expect(normalizarDinheiro('45.00')).toBe(4500)
    expect(normalizarDinheiro('1,234.56')).toBe(123456)
    expect(normalizarDinheiro('1.234')).toBe(123400)
    expect(normalizarDinheiro('(R$ 20,00)')).toBe(-2000)
    expect(normalizarDinheiro('grátis')).toBeNull()
  })
})
