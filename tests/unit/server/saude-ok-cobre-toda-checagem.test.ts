import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bancoSaudavel } from '../../helpers/saude'
import { semComentarios } from '../../helpers/fonte'

import { verificarSaude } from '@/server/services/health'

/**
 * O `ok` do relatório é o veredito que o mundo inteiro lê — o job `vigia` do `cron.yml`, o 503 da
 * rota, qualquer monitor de uptime. Se ele deixar uma checagem de fora, a checagem existe e não
 * serve para nada.
 *
 * Até 05/09/2026 esse veredito era um `&&` escrito à mão, com uma parcela por checagem. Isso é uma
 * SEGUNDA lista das checagens, e o TypeScript não percebe quando ela fica curta: acrescentar uma
 * chave em `checks` e esquecer a parcela compila, passa em tudo, e produz um relatório que mostra
 * a checagem vermelha com `ok: true` no topo.
 *
 * **A primeira versão desta guarda estava CEGA, e a mutação foi quem contou.** Ela iterava as
 * chaves e aplicava `every` sobre um objeto montado ali dentro — ou seja, testava o `every` do
 * próprio teste, nunca o veredito que `verificarSaude` devolve. Com o `&&` à mão de volta, sem a
 * parcela do `schema`, a suíte passava inteira. As duas asserções abaixo existem porque nenhuma
 * das duas sozinha pega o caso: uma exercita a decisão de verdade, a outra impede que ela volte a
 * ser escrita como lista.
 */
describe('o veredito do /api/health cobre TODAS as checagens', () => {
  it('cada checagem que dá para derrubar pela fixture derruba o veredito DE VERDADE', async () => {
    const saudavel = await verificarSaude(bancoSaudavel(), new Date())
    expect(saudavel.ok, 'a fixture não representa um banco saudável — o cenário não foi montado').toBe(true)

    /*
     * Uma entrada por checagem que a fixture consegue adoecer sem inventar um dublê novo. Não são
     * as dez, e é por isso que a segunda asserção existe — mas cada uma destas é uma parcela do
     * `&&` antigo, e a do `schema` é justamente a que a mutação mostrou faltando.
     *
     * `sendReminders` e `sendCampaigns` ficaram DE FORA e não por descuido: envelhecer o heartbeat
     * delas não as adoece, porque `heartbeatVigiado` as dispensa enquanto estiverem fora do
     * `schedule` do `cron.yml` — é o alarme permanente que `core/cron/agendadas.ts` proíbe.
     * Tentar incluí-las foi o que mostrou isso: o teste reprovou dizendo que a fixture não
     * conseguiu adoecê-las, que é a resposta certa.
     */
    const casos = [
      { chave: 'recomputeCycles', banco: bancoSaudavel({ recompute_cycles: 60 * 40 }) },
      { chave: 'recomputeSegments', banco: bancoSaudavel({ recompute_segments: 60 * 40 }) },
      { chave: 'schema', banco: bancoSaudavel({}, [{ name: '0001_initial' }]) },
    ] as const

    for (const { chave, banco } of casos) {
      const relatorio = await verificarSaude(banco, new Date())
      expect(relatorio.checks[chave].ok, `a fixture não conseguiu adoecer \`${chave}\``).toBe(false)
      expect(relatorio.ok, `\`${chave}\` vermelha com veredito verde — o topo mente para quem lê`).toBe(false)
    }
  })

  /*
   * A metade que nenhum caso de comportamento alcança: as checagens que a fixture não sabe
   * adoecer. Enquanto o veredito sair de `every` sobre o próprio objeto, esquecer uma é
   * impossível; no dia em que virar `&&` outra vez, volta a ser questão de memória de quem edita.
   * Por isso a asserção é sobre a FORMA, e não sobre mais um caso.
   */
  it('e o veredito sai do próprio objeto, não de uma lista escrita à mão', () => {
    const fonte = semComentarios(readFileSync('src/server/services/health.ts', 'utf8'))
    const retorno = fonte.slice(fonte.indexOf('const checks = {'))
    expect(
      /ok:\s*Object\.values\(checks\)\.every\(/.test(retorno),
      'o `ok` voltou a ser uma lista à mão. Cada parcela é uma chance de esquecer a checagem nova, ' +
        'e ela nasce muda: vermelha no relatório, verde no topo que o `vigia` lê.',
    ).toBe(true)
  })
})
