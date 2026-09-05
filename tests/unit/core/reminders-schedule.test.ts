import { describe, expect, it } from 'vitest'

import { lembretesDevidos } from '@/core/reminders/schedule'

const TZ = 'America/Sao_Paulo'

describe('lembretesDevidos', () => {
  it('nenhum lembrete devido logo depois de marcar (dias antes das duas datas)', () => {
    const devidos = lembretesDevidos('2026-09-10T14:00:00-03:00', TZ, '2026-09-01T10:00:00-03:00')
    expect(devidos).toEqual([])
  })

  it('confirmação (D-1 18h) fica devida quando o relógio passa desse horário', () => {
    const startsAt = '2026-09-10T14:00:00-03:00'
    const antes = lembretesDevidos(startsAt, TZ, '2026-09-09T17:59:00-03:00')
    const depois = lembretesDevidos(startsAt, TZ, '2026-09-09T18:00:01-03:00')

    expect(antes.find((d) => d.kind === 'confirmation')).toBeUndefined()
    expect(depois.find((d) => d.kind === 'confirmation')).toMatchObject({ template: 'confirmacao_d1' })
  })

  it('lembrete (D-0 T-3h) fica devido 3h antes do horário marcado', () => {
    const startsAt = '2026-09-10T14:00:00-03:00'
    const antes = lembretesDevidos(startsAt, TZ, '2026-09-10T10:59:00-03:00')
    const depois = lembretesDevidos(startsAt, TZ, '2026-09-10T11:00:01-03:00')

    expect(antes.find((d) => d.kind === 'reminder')).toBeUndefined()
    expect(depois.find((d) => d.kind === 'reminder')).toMatchObject({ template: 'lembrete_d0' })
  })

  it('T-3h antes das 8h (agendamento de manhã cedo) é grudado nas 8h, não mandado de madrugada', () => {
    // Agendamento às 9h: T-3h cairia às 6h, dentro da janela proibida (H109).
    const startsAt = '2026-09-10T09:00:00-03:00'

    const antesDas8 = lembretesDevidos(startsAt, TZ, '2026-09-10T07:59:00-03:00')
    const depoisDas8 = lembretesDevidos(startsAt, TZ, '2026-09-10T08:00:01-03:00')

    expect(antesDas8.find((d) => d.kind === 'reminder')).toBeUndefined()
    expect(depoisDas8.find((d) => d.kind === 'reminder')).toMatchObject({ template: 'lembrete_d0' })
  })

  it('T-3h depois das 21h (agendamento de madrugada) é grudado nas 20h, não mandado tarde da noite', () => {
    // Agendamento à 1h da manhã: T-3h cairia às 22h do dia anterior, fora da janela (§7, FIM 21h).
    const startsAt = '2026-09-11T01:00:00-03:00'

    const antesDas20 = lembretesDevidos(startsAt, TZ, '2026-09-10T19:59:00-03:00')
    const depoisDas20 = lembretesDevidos(startsAt, TZ, '2026-09-10T20:00:01-03:00')

    expect(antesDas20.find((d) => d.kind === 'reminder')).toBeUndefined()
    expect(depoisDas20.find((d) => d.kind === 'reminder')).toMatchObject({ template: 'lembrete_d0' })
  })

  it('as duas datas podem estar devidas ao mesmo tempo se o job ficou parado', () => {
    const startsAt = '2026-09-10T14:00:00-03:00'
    const devidos = lembretesDevidos(startsAt, TZ, '2026-09-10T12:00:00-03:00')

    expect(devidos.map((d) => d.kind).sort()).toEqual(['confirmation', 'reminder'])
  })

  it('marcar hoje para daqui a pouco também devolve os dois — é o mesmo mecanismo, não um caso à parte', () => {
    /*
     * O irmão do caso acima, e ele existe porque o comentário da função dizia o OPOSTO: que para
     * agendamento de última hora "a lista pode vir vazia, e está certo: não existe lembrete a
     * mandar para quem marcou faltando 1h". Vem cheia — D-1 18h é ontem, então já passou, e T-3h
     * também. Quem ler aquela frase e for "consertar" vai suprimir a confirmação depois que o dia
     * do atendimento chega, e nisso perde duas coisas de uma vez: o pedido de confirmação é quem
     * carrega o LINK de confirmar, e o caso do job parado (teste acima) depende exatamente de a
     * véspera atrasada ainda valer.
     *
     * Por que a redundância não é defeito: o texto das duas mensagens leva a data por extenso
     * (`lembretes.ts` — *"no dia 10/09 14:00. Responda para confirmar"*), então nenhuma afirma
     * "amanhã" para um atendimento de hoje.
     *
     * Se um dia isto DEVER mudar, o lugar é o texto ou o dedupe de `messages`, não a função de
     * horário — e aí este teste é o que obriga a decisão a ser consciente.
     */
    const startsAt = '2026-09-10T18:00:00-03:00'
    const marcadoUmaHoraAntes = lembretesDevidos(startsAt, TZ, '2026-09-10T17:00:00-03:00')

    expect(marcadoUmaHoraAntes.map((d) => d.kind).sort()).toEqual(['confirmation', 'reminder'])
  })

  it('agendamento que já começou não tem lembrete nenhum — evita mensagem fora de hora', () => {
    const startsAt = '2026-09-10T14:00:00-03:00'
    expect(lembretesDevidos(startsAt, TZ, '2026-09-10T14:00:00-03:00')).toEqual([])
    expect(lembretesDevidos(startsAt, TZ, '2026-09-12T00:00:00-03:00')).toEqual([])
  })

  it('respeita o fuso do tenant, não o do processo rodando o job', () => {
    // 18h em São Paulo é 21h em UTC (verão) ou 20h (horário padrão) — o que
    // importa é que o cálculo usa o fuso passado, não o relógio local do servidor.
    const startsAt = '2026-09-10T14:00:00-03:00'
    const justoNoLimite = lembretesDevidos(startsAt, TZ, '2026-09-09T21:00:00Z') // 18h em -03:00
    expect(justoNoLimite.find((d) => d.kind === 'confirmation')).toBeDefined()
  })
})
