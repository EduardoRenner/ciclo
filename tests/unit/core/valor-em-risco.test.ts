import { describe, expect, it } from 'vitest'

import { PROBABILIDADE_POR_ESTADO, valorEmRiscoCents } from '@/core/cycle/valor-em-risco'

/**
 * A tabela que ordena a tela "Recuperar receita".
 *
 * `compute.ts` decide o ESTADO de cada combinação (cliente, serviço); este arquivo decide QUANTO
 * vale. Os dois são o `§5.3`, e até agora só o primeiro tinha teste de unidade — o segundo morava
 * em `server/services/ciclo.ts` e só era exercitado pelo teste de integração, que precisa de um
 * Supabase no ar. Uma tabela de cinco números que decide a ordem da tela principal do produto não
 * deveria depender de banco para ser conferida.
 *
 * A promessa que estes números sustentam está na landing, palavra por palavra: *"a lista vem
 * ordenada por quanto vale chamar cada uma, que é o preço do serviço vezes a chance de ela
 * voltar"*.
 */
describe('valor em risco = preço × chance de voltar', () => {
  it('multiplica o preço pela probabilidade do estado', () => {
    // 6000 centavos × 0,65 (late) = 3900 — o mesmo caso do teste de integração, agora sem banco.
    expect(valorEmRiscoCents(6_000, 'late')).toBe(3_900)
  })

  it('arredonda para BAIXO — nunca prometer mais do que entrega', () => {
    /*
     * 4500 × 0,35 = 1575 exato; 4499 × 0,35 = 1574,65, que arredondado para cima viraria 1575 e
     * faria a soma da tela prometer um centavo que não existe. O comentário original da função diz
     * "sempre arredondado para baixo" — isto é o que impede a frase de virar decoração.
     */
    expect(valorEmRiscoCents(4_499, 'at_risk')).toBe(1_574)
    expect(valorEmRiscoCents(1, 'lost')).toBe(0)
  })

  it('quem está em dia não tem valor em risco', () => {
    // `on_track` é 0 por definição: a pessoa não sumiu, não há receita a recuperar dela.
    expect(valorEmRiscoCents(50_000, 'on_track')).toBe(0)
  })

  it('estado desconhecido vale zero, não `NaN`', () => {
    /*
     * O caminho que importa: `client_cycles.state` é um enum do banco, mas a função recebe
     * `string`. Sem o `?? 0`, um estado novo (ou um valor corrompido) faria `preço × undefined`
     * = `NaN`, e `Math.floor(NaN)` é `NaN` — que entraria na coluna e envenenaria a SOMA da tela
     * inteira, não só aquela linha. Zero mantém o defeito local e visível.
     */
    expect(valorEmRiscoCents(10_000, 'estado_que_nao_existe')).toBe(0)
    expect(Number.isNaN(valorEmRiscoCents(10_000, 'estado_que_nao_existe'))).toBe(false)
  })

  it('a ordem dos estados respeita a chance de voltar', () => {
    /*
     * Não fixa os cinco números — fixa a RELAÇÃO entre eles, que é o que a tela promete. Trocar
     * 0,65 por 0,60 é calibragem e não deve reprovar; inverter `due` e `lost` é dizer que quem
     * sumiu há um ano é mais provável de voltar que quem atrasou ontem, e isso reordena a tela
     * inteira ao contrário.
     */
    const { on_track: emDia, due, late, at_risk: emRisco, lost: perdido } = PROBABILIDADE_POR_ESTADO
    expect(due).toBeGreaterThan(late)
    expect(late).toBeGreaterThan(emRisco)
    expect(emRisco).toBeGreaterThan(perdido)
    expect(perdido).toBeGreaterThan(emDia)
  })

  it('nenhuma probabilidade passa de 1 — valor em risco não excede o preço', () => {
    for (const [estado, p] of Object.entries(PROBABILIDADE_POR_ESTADO)) {
      expect(p, `${estado} tem probabilidade fora de 0..1`).toBeGreaterThanOrEqual(0)
      expect(p, `${estado} prometeria mais do que o serviço custa`).toBeLessThanOrEqual(1)
    }
  })
})
