import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A página pública mostra *"este horário pede um sinal de R$ 21"* no último instante antes de
 * confirmar — e o agendamento nascia **sem nenhum registro disso**. Quem atende abria a agenda e
 * via só o preço: não sabia que um sinal tinha sido pedido, então não cobrava.
 *
 * O sinal existe para derrubar falta, e o efeito morria na tela que o exibia, porque a informação
 * nunca atravessava para o outro lado do balcão. `appointments.deposit_cents` existe desde a
 * migration 0001 e nunca foi escrito — achado em 2026-09-03 varrendo colunas sem leitor nem
 * escritor, a mesma classe de `fee_cents`, `media.consent_id`, `tenants.plan`,
 * `clients.referred_by`, `trial_ends_at` e `vault_access_log.actor_label`.
 *
 * **A outra metade da guarda, e é a que se perde primeiro:** o valor é um INSTANTÂNEO, não uma
 * derivação. Quem "simplificar" isso juntando `services.deposit_bps` na leitura faz o combinado
 * mudar retroativamente toda vez que o dono mexer no preço ou no percentual — que é exatamente a
 * armadilha *"guarde o valor em centavos; preço muda, histórico não pode mudar"* do `CLAUDE.md`.
 * A casa já tinha decidido isso para `price_cents`; o sinal estava do lado errado da decisão.
 */

const ESCRITA = 'src/server/services/agendamentos.ts'
const TELA = 'src/app/admin/agenda/detalhe.tsx'

/**
 * Retorno de carro fora antes de qualquer coisa. Este checkout é Windows e o `git checkout --` de uma limpeza
 * de mutação devolve o arquivo em CRLF — os âncoras multilinha abaixo pararam de casar e a suíte
 * reprovou código correto. Foi a auto-guarda "achou o insert" que denunciou; sem ela o recorte
 * viria vazio e as asserções passariam sem ter olhado nada.
 */
function fonte(caminho: string): string {
  return semComentarios(readFileSync(caminho, 'utf8').split(String.fromCharCode(13)).join(''))
}

const fonteEscrita = fonte(ESCRITA)
const fonteTela = fonte(TELA)

/**
 * O `insert` de `appointments`, delimitado pelo FIM REAL do elemento (`.select(COLUNAS)`) e não por
 * uma janela de N caracteres — armadilha nº 4 da tabela do `CLAUDE.md`. O arquivo tem outros
 * `insert`, e `deposit_cents` também aparece na string de COLUNAS: casar no arquivo inteiro
 * passaria mesmo com o campo fora do insert.
 */
const inicio = fonteEscrita.indexOf(".from('appointments')\n    .insert({")
const fim = fonteEscrita.indexOf('.select(COLUNAS)', inicio)
const insert = inicio > -1 && fim > inicio ? fonteEscrita.slice(inicio, fim) : ''

/**
 * O conteúdo de uma constante de select, delimitado pelas ASPAS que o fecham.
 *
 * A primeira versão pegava `slice(indexOf(nome), 400)` e a janela alcançava a declaração do tipo
 * logo abaixo — `deposit_cents: number` e `origin: string` em `LinhaAgendaDia` satisfaziam o
 * padrão sozinhos. **Medido:** apagar as duas colunas do select deixava a guarda VERDE. É a
 * armadilha nº 4 do `CLAUDE.md` ("o vizinho cai dentro da janela") de braço com a nº 1 (casar com
 * a declaração do tipo em vez do uso), o mesmo par que já cegou a guarda da trilha do cofre nesta
 * mesma rodada.
 */
function literalDoSelect(nome: string): string {
  const i = fonteEscrita.indexOf(`${nome} =`)
  if (i < 0) return ''
  const abre = fonteEscrita.indexOf("'", i)
  const fecha = fonteEscrita.indexOf("'", abre + 1)
  return abre > -1 && fecha > abre ? fonteEscrita.slice(abre + 1, fecha) : ''
}

describe('o leitor deste teste', () => {
  it('achou o insert do agendamento — não passa por não ter olhado nada', () => {
    expect(inicio, `sumiu o insert de appointments em ${ESCRITA}`).toBeGreaterThan(-1)
    expect(insert.length, 'a região do insert veio vazia').toBeGreaterThan(200)
    // Guarda contra o próprio recorte: se ele deixar de conter o preço, está pegando outro trecho.
    expect(insert, 'o recorte não é o insert do agendamento').toContain('price_cents: servico.price_cents')
  })

  it('leu a tela de quem atende', () => {
    expect(fonteTela.length, `${TELA} veio vazio`).toBeGreaterThan(400)
  })
})

describe('o sinal pedido à cliente fica registrado no agendamento', () => {
  it('o insert grava `deposit_cents`', () => {
    expect(
      /deposit_cents:/.test(insert),
      'o agendamento voltou a nascer sem registro do sinal. A página pública continua dizendo ' +
        '"este horário pede um sinal de R$ X" e quem atende não fica sabendo — o sinal existe ' +
        'para derrubar falta e o efeito morre na tela que o exibe.',
    ).toBe(true)
  })

  it('o valor é calculado, não um número fixo', () => {
    /*
     * Casa com a CHAMADA, nunca com o `import`: `sinalEmCentavos` solto no arquivo passaria com
     * `deposit_cents: 0` no insert, que satisfaz a asserção acima e não guarda nada. É a armadilha
     * nº 1 da tabela do `CLAUDE.md`.
     */
    expect(/deposit_cents:\s*\n?\s*sinalEmCentavos\(\{/.test(insert), 'o sinal virou valor fixo no insert').toBe(true)
    expect(/precoCents: servico\.price_cents/.test(insert), 'o cálculo não usa o preço do serviço').toBe(true)
    expect(/depositBps: servico\.deposit_bps/.test(insert), 'o cálculo não usa o percentual do serviço').toBe(true)
  })

  it('o serviço é consultado com os campos que o cálculo precisa', () => {
    // Sem isto o `sinalEmCentavos` receberia `undefined` e o typecheck é a única rede — que some
    // no dia em que alguém tipar o retorno do select como `any`.
    const depois = fonteEscrita.indexOf("from('services')")
    const abre = fonteEscrita.indexOf(".select('", depois) + ".select('".length
    const colunas = fonteEscrita.slice(abre, fonteEscrita.indexOf("'", abre))
    expect(colunas, 'não achei o select do serviço agendável').toContain('duration_min')
    expect(colunas, 'o select do serviço perdeu o percentual do sinal').toContain('deposit_bps')
    expect(colunas, 'o select do serviço perdeu o piso do sinal').toContain('deposit_min_cents')
  })
})

describe('o sinal chega em quem atende', () => {
  it('a tela do agendamento mostra o valor', () => {
    expect(
      /agendamento\.deposit_cents/.test(fonteTela),
      'a tela de quem atende parou de mostrar o sinal. Gravar sem exibir é o mesmo defeito com ' +
        'mais passos: a informação existe no banco e não chega em quem age sobre ela.',
    ).toBe(true)
  })

  it('distingue quem já foi avisada de quem não foi', () => {
    // A distinção é o que torna a linha acionável: introduzir o assunto e lembrar de algo já lido
    // são conversas diferentes, e `public_page` é o único caminho em que a tela mostrou o valor.
    expect(/origin === 'public_page'/.test(fonteTela), 'a tela deixou de dizer se a cliente já viu o valor').toBe(true)
  })

  it('a coluna viaja no select que alimenta a tela', () => {
    const colunas = literalDoSelect('COLUNAS_AGENDA_DIA')
    // Guarda contra o próprio recorte: sem isto, um recorte vazio faria as duas asserções abaixo
    // reprovarem por motivo errado — ou, se fossem `toBe(false)`, passarem sem ter olhado nada.
    expect(colunas, 'não achei o literal de COLUNAS_AGENDA_DIA').toContain('starts_at')
    expect(colunas, 'o recorte pegou mais que o literal do select').not.toContain('LinhaAgendaDia')
    expect(colunas, 'o sinal saiu do select da agenda do dia').toContain('deposit_cents')
    expect(colunas, 'a origem saiu do select da agenda do dia').toContain('origin')
  })
})

describe('o valor é instantâneo, nunca derivado na leitura', () => {
  it('a tela não recalcula o sinal a partir do serviço', () => {
    /*
     * O par da regra, e o que se perde primeiro numa "simplificação": juntar `deposit_bps` na
     * leitura faria o combinado com aquela cliente mudar sozinho toda vez que o dono mexesse no
     * preço ou no percentual. Mesma razão de `price_cents` ser gravado no agendamento.
     */
    expect(/deposit_bps|sinalEmCentavos/.test(fonteTela), 'a tela voltou a derivar o sinal em vez de ler o guardado').toBe(
      false,
    )
  })
})
