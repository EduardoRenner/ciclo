import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O FAQ (G92) descrevia a anonimizacao por LGPD em tres estagios, sendo o segundo "apos 30 dias,
 * anonimizacao" — automatico — e mandava "explique isso ao titular na resposta".
 *
 * Esse estagio NAO roda. O job `lgpd_retention` esta registrado como pendencia dentro do proprio
 * `lgpd.ts` ("ainda nao existe nesta base") e nao ha rota de cron para ele. `eliminarCliente` so e
 * chamado pelo endpoint manual `POST /clients/[id]/erase`.
 *
 * O que existe funciona bem — o botao apaga de verdade, inclusive a trilha. O problema era dizer ao
 * titular que acontece sozinho. A politica publica (`/privacidade`) sempre esteve correta: descreve
 * o botao, nao um prazo.
 *
 * Esta guarda liga as duas pontas: enquanto nao houver disparo automatico, o FAQ nao pode prometer
 * um. E no dia em que houver, ela reprova e manda atualizar o FAQ — o inverso tambem e defeito.
 */
const FAQ = readFileSync('docs/05-FAQ-DEV.md', 'utf8')
const LGPD = semComentarios(readFileSync('src/server/services/lgpd.ts', 'utf8'))
const AGENDADAS = readFileSync('src/core/cron/agendadas.ts', 'utf8')

describe('o FAQ nao promete anonimizacao automatica que nao roda', () => {
  const temJobAutomatico = /lgpd/i.test(semComentarios(AGENDADAS))

  it('nao ha rota de cron de LGPD — se houver, esta guarda precisa mudar junto', () => {
    expect(temJobAutomatico, 'apareceu cron de LGPD: atualize a G92 do FAQ, que hoje diz que nao existe').toBe(false)
  })

  it('a eliminacao de verdade continua existindo e sendo chamada', () => {
    // O que funciona precisa continuar funcionando: sem isto, "nao prometa" viraria "nao faz".
    expect(LGPD, 'eliminarCliente sumiu do servico de LGPD').toContain('export async function eliminarCliente')
    const rota = readFileSync('src/app/api/v1/clients/[id]/erase/route.ts', 'utf8')
    expect(rota, 'a rota de eliminacao parou de chamar eliminarCliente').toContain('eliminarCliente(')
  })

  it('o FAQ diz explicitamente que o automatismo nao existe', () => {
    expect(FAQ, 'o FAQ voltou a prometer anonimizacao automatica em 30 dias').toMatch(/N[AÃ]O existe/)
    expect(FAQ, 'sumiu o aviso de nao dizer isso ao titular').toMatch(/n[aã]o diga ao titular/i)
  })
})
