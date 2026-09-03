import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Todo script de seed que grava `phone_e164` TEM de gravar `phone_hash` junto.
 *
 * Sem o hash nada quebra na tela — o painel lista, a ficha abre, o gráfico soma. Mas toda busca
 * de cliente por telefone no produto passa pelo hash, e com ele nulo:
 *
 *   · `reconhecimento.ts` nunca reconhece ninguém — a funcionalidade parece não existir;
 *   · `agendamentos.ts` procura pelo hash, não acha, tenta INSERT e bate na `clients_unique_phone`
 *     pelo `phone_e164` → 500 na cara de quem estava agendando, e SÓ para quem já é cliente.
 *
 * Já aconteceu duas vezes. A primeira, 132 clientes de um seed SQL — e a guarda escrita na época
 * (`seed-demo-nao-deixa-hash-nulo`) mira UM arquivo, `seed-demo-carteira.sql`. A segunda foi
 * medida em produção em 03/09: 134 clientes com telefone e sem hash em SEIS tenants, incluindo os
 * 44 do `dom-rocha`, que é a conta que a landing usa como exemplo. A causa eram três scripts
 * `.mjs` que a guarda antiga não olhava — exatamente a armadilha de "consertar o caso em vez da
 * pergunta": corrigir um seed deixa os irmãos sem vigia.
 *
 * Por isso esta guarda **itera o diretório**, nunca uma lista fixa: script novo nasce coberto.
 */
const DIR = 'scripts'

function scriptsDeSeed(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.mjs') || f.endsWith('.sql'))
}

describe('seed que grava telefone grava hash', () => {
  it('o diretório de scripts está ao alcance (a guarda não pode passar vazia)', () => {
    // Guarda contra o próprio detector: se `readdirSync` mudar de lugar ou o diretório sumir,
    // a suíte tem que gritar em vez de aprovar zero arquivos.
    const achados = scriptsDeSeed()
    expect(achados.length).toBeGreaterThanOrEqual(6)
    // Os quatro onde o defeito JÁ apareceu de verdade, nomeados: cobertura por nome, não por contagem.
    for (const arquivo of ['seed-demo-barbearia.mjs', 'seed-demo-6-negocios.mjs', 'seed-tenant-teste.mjs', 'seed-demo-carteira.sql']) {
      expect(achados).toContain(arquivo)
    }
  })

  it.each(scriptsDeSeed())('%s: se escreve phone_e164, escreve phone_hash', (arquivo) => {
    // Comentário fora antes de casar: este projeto fala de `phone_hash` em prosa o tempo todo, e
    // casar com a explicação em vez do código é a armadilha nº 1 da tabela do CLAUDE.md.
    const src = semComentarios(readFileSync(join(DIR, arquivo), 'utf8'))

    // Só interessa quem ESCREVE a coluna. Ler (`.select('phone_e164')`) ou filtrar não conta.
    const escreveTelefone = /phone_e164\s*:/.test(src) || /'phone_e164'/.test(src) || /\binsert\b[\s\S]{0,400}?phone_e164/i.test(src)
    if (!escreveTelefone) return

    const escreveHash = /phone_hash\s*:/.test(src) || /'phone_hash'/.test(src) || /\bphone_hash\b\s*=/.test(src)
    expect(escreveHash, `${arquivo} grava phone_e164 sem phone_hash — reconhecimento morre e remarcar dá 500`).toBe(true)
  })
})
