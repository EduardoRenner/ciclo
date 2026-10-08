import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { sugerirPrazo } from '@/core/advocacia/prazo-sugestao'

import { semComentarios } from '../../helpers/fonte'

/**
 * Achado do kit de demonstração (docs/101 T5b.4, 2026-10-08): o cartão "Sugestão a confirmar" da triagem
 * dizia "Regra de contagem ainda não confirmada pela direção". Só que só EXISTE data sugerida quando todas
 * as regras da conta estão confirmadas (`podePreencher` no núcleo): a frase era falsa sempre que aparecia,
 * e o roteiro da demo mandava lê-la em voz alta.
 *
 * E o motivo de "sem sugestão" do núcleo dizia "confirmada pelo sócio" (copy não supõe gênero).
 */
const TRIAGEM = 'src/app/admin/intimacoes/[id]/triagem.tsx'

/** O trecho do cartão da sugestão: do rótulo "Sugestão a confirmar" até o botão "Usar a sugestão". */
function cartaoDaSugestao(): string {
  const fonte = semComentarios(readFileSync(TRIAGEM, 'utf8'))
  const ini = fonte.indexOf('Sugestão a confirmar')
  const fim = fonte.indexOf('Usar a sugestão', ini)
  return ini >= 0 && fim > ini ? fonte.slice(ini, fim) : ''
}

describe('a triagem não contradiz a sugestão', () => {
  it('o recorte do cartão foi achado (sem ele a guarda passaria vazia)', () => {
    expect(cartaoDaSugestao().length).toBeGreaterThan(100)
    expect(cartaoDaSugestao()).toContain('linhasDaMemoria(')
  })

  it('o cartão com data sugerida não diz que a regra falta', () => {
    expect(cartaoDaSugestao()).not.toMatch(/não confirmada/i)
  })

  it('o motivo de "sem sugestão" do núcleo não supõe gênero', () => {
    const r = sugerirPrazo({
      texto: 'Fica a parte intimada para, no prazo de 15 (quinze) dias, apresentar contestação.',
      disponibilizadoEm: '2026-10-07',
      rito: 'civel',
      emDobro: false,
      naoContaveis: [],
      tipoDaComunicacao: 'Intimação',
      confirmadas: [],
    })
    if (r.sugerida !== null) throw new Error('sem regra confirmada não pode haver data')
    expect(r.motivo).toMatch(/Regra ainda não confirmada/)
    expect(r.motivo).not.toMatch(/sócio/)
  })
})
