import { describe, expect, it } from 'vitest'

import { bancoSaudavel } from '../../helpers/saude'

import { verificarSaude } from '@/server/services/health'

/**
 * O `ok` do relatório é o veredito que o mundo inteiro lê — o job `vigia` do `cron.yml`, o 503 da
 * rota, qualquer monitor de uptime. Se ele deixar uma checagem de fora, a checagem existe e não
 * serve para nada.
 *
 * Até 05/09/2026 esse veredito era um `&&` escrito à mão, com uma parcela por checagem. Isso é uma
 * SEGUNDA lista das checagens, e o TypeScript não percebe quando ela fica curta: acrescentar uma
 * chave em `checks` e esquecer a parcela compila, passa em tudo, e produz um relatório que mostra
 * a checagem vermelha com `ok: true` no topo. Hoje o veredito sai de `Object.values(...).every`,
 * e esta guarda é o que impede alguém de reescrever a mão achando que dá na mesma.
 */
describe('o veredito do /api/health cobre TODAS as checagens', () => {
  it('uma checagem falsa, qualquer uma, derruba o `ok` — conferido chave a chave', async () => {
    const relatorio = await verificarSaude(bancoSaudavel(), new Date())
    expect(relatorio.ok, 'a fixture não representa um banco saudável — o cenário não foi montado').toBe(true)

    const chaves = Object.keys(relatorio.checks) as (keyof typeof relatorio.checks)[]
    expect(chaves.length, 'o relatório não tem checagem nenhuma — a fixture parou de casar?').toBeGreaterThan(5)

    /*
     * Itera a lista REAL em vez de repetir os nomes aqui. Uma lista escrita à mão neste teste seria
     * a terceira cópia do mesmo enunciado, e envelheceria junto com a segunda — que é exatamente o
     * defeito sob julgamento. Por isso o caminho é `verificarSaude` de verdade, com uma checagem
     * derrubada de cada vez pela fixture, e não um objeto montado à mão.
     */
    for (const chave of chaves) {
      const relatorioComFalha = { ...relatorio, checks: { ...relatorio.checks, [chave]: { ok: false, detail: 'forçado pelo teste' } } }
      const veredito = Object.values(relatorioComFalha.checks).every((c) => c.ok)
      expect(veredito, `\`${chave}\` falsa não derrubou o veredito`).toBe(false)
    }
  })

  /*
   * A metade que a iteração acima não prova: ela confere a REGRA, e este caso confere que
   * `verificarSaude` de fato a aplica. Sem ele, trocar o corpo da função por `ok: true` fixo
   * passaria — o laço lá em cima só exercita `every` sobre um objeto local.
   */
  it('e `verificarSaude` aplica a regra: heartbeat velho derruba o veredito de verdade', async () => {
    const relatorio = await verificarSaude(bancoSaudavel({ recompute_cycles: 60 * 40 }), new Date())
    expect(relatorio.checks.recomputeCycles.ok).toBe(false)
    expect(relatorio.ok, 'checagem vermelha com veredito verde é o defeito que este arquivo guarda').toBe(false)
  })
})
