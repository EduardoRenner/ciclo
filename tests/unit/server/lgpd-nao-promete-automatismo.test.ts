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
import { ROTAS_AGENDADAS, ROTAS_DE_CRON } from '@/core/cron/agendadas'

describe('o FAQ nao promete anonimizacao automatica que nao roda', () => {
  /*
   * O que decide nao e a rota EXISTIR, e ela estar AGENDADA.
   *
   * A primeira versao desta guarda lia o arquivo `agendadas.ts` inteiro e reprovava assim que a
   * rota `lgpd-retention` foi criada — mesmo ela ficando de proposito fora do `on.schedule`, como
   * `reminders` e `campaigns`. Rota que existe e ninguem dispara nao anonimiza ninguem, entao o
   * FAQ continuava certo. Imprecisao de guarda cobra conserto onde nao ha defeito, que custa tanto
   * quanto absolver o errado.
   */
  const agendado = ROTAS_AGENDADAS.some((r) => r.includes('lgpd'))

  it('o job de LGPD nao esta agendado — se entrar no schedule, o FAQ muda junto', () => {
    expect(
      agendado,
      'lgpd-retention entrou no on.schedule: agora a anonimizacao acontece sozinha, e a G92 do FAQ ' +
        'precisa dizer isso — hoje ela diz que nao existe automatismo.',
    ).toBe(false)
  })

  it('a rota existe, e isso e de proposito — o dono liga quando decidir', () => {
    // Construida em 31/08 e deixada fora do schedule: ligar destruicao irreversivel de dado
    // pessoal e decisao do dono, nao efeito colateral de deploy.
    expect(ROTAS_DE_CRON as readonly string[], 'a rota de retencao sumiu do catalogo').toContain('lgpd-retention')
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
