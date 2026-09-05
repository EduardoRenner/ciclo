import { describe, expect, it } from 'vitest'

import { ocorrenciaConflitaComFolga, proximasDatas } from '@/core/recurrence/gerar-ocorrencias'

const TETO = 100

describe('proximasDatas · semanal', () => {
  it('toda terça a partir de uma segunda pula pra terça seguinte', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 }, // 2 = terça
      inicio: '2026-08-17', // segunda
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-08-25', '2026-09-01'])
  })

  it('quinzenal (intervaloSemanas 2) pula uma semana inteira entre ocorrências', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 2 },
      inicio: '2026-08-18', // já é terça
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-09-01', '2026-09-15'])
  })

  it('respeita ocorrenciasJaGeradas ao estender uma série existente', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-09-08',
      limite: { tipo: 'numero_de_vezes', total: 5 },
      ocorrenciasJaGeradas: 3, // já rodaram 3 das 5 permitidas
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toHaveLength(2)
  })

  it('para no horizonte de geração mesmo sem fim definido', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-08-18',
      limite: { tipo: 'sem_fim' },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-09-01',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-08-25', '2026-09-01'])
  })

  it('para na data-fim da série mesmo se o horizonte de geração for maior', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-08-18',
      limite: { tipo: 'ate_data', data: '2026-08-25' },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-08-25'])
  })
})

describe('proximasDatas · a_cada_dias', () => {
  it('gera a partir do próprio dia de início, sem procurar weekday', () => {
    const datas = proximasDatas({
      regra: { tipo: 'a_cada_dias', intervaloDias: 15 },
      inicio: '2026-08-01',
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-01', '2026-08-16', '2026-08-31'])
  })
})

describe('proximasDatas · mensal_dia_semana', () => {
  it('primeira segunda do mês', () => {
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 1, ordinal: 1 }, // 1 = segunda
      inicio: '2026-08-01', // sábado
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    // 1ª segunda de ago/2026 = 03; set/2026 = 07; out/2026 = 05
    expect(datas).toEqual(['2026-08-03', '2026-09-07', '2026-10-05'])
  })

  it('ordinal 5 (última do mês) funciona em mês com só 4 ocorrências do weekday', () => {
    // fevereiro/2027 não é bissexto: só 4 domingos. Confirma que "última" não quebra.
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 0, ordinal: 5 }, // 0 = domingo, "última"
      inicio: '2027-02-01',
      limite: { tipo: 'numero_de_vezes', total: 1 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2027-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2027-02-28'])
  })

  it('começar depois do dia-alvo pula para o mês seguinte, sem gerar data no passado', () => {
    /*
     * O caminho mais comum do mundo real, e o único dos três padrões mensais que faltava: os
     * outros casos deste bloco começam todos no dia 1, quando o alvo ainda está à frente. Quem
     * monta "primeira segunda do mês" no dia 15 já passou da primeira segunda daquele mês — a
     * série tem que começar em setembro, não voltar para 03/08.
     */
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 1, ordinal: 1 }, // 1 = segunda
      inicio: '2026-08-15', // sábado; a 1ª segunda de ago/2026 foi dia 03, já passou
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-09-07', '2026-10-05', '2026-11-02'])
  })

  it('ordinal 5 escolhe a 5ª quando o mês realmente tem 5 ocorrências', () => {
    // agosto/2026: sábados caem em 1, 8, 15, 22, 29 — tem 5ª.
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 6, ordinal: 5 }, // 6 = sábado
      inicio: '2026-08-01',
      limite: { tipo: 'numero_de_vezes', total: 1 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-29'])
  })
})

describe('proximasDatas · `inicio` é a âncora, e só `a_cada_dias` sente isso', () => {
  /*
   * A diferença entre os três padrões que ninguém percebe até ela custar caro.
   *
   * `semanal` e `mensal_dia_semana` se REALINHAM sozinhos: o primeiro anda até o weekday pedido,
   * o segundo recalcula a enésima ocorrência dentro de cada mês. Passar um `inicio` qualquer não
   * muda a grade — no máximo muda onde ela começa a ser lida.
   *
   * `a_cada_dias` não tem para onde se realinhar: a grade é "de N em N dias a partir de `inicio`",
   * então `inicio` É a fase. Um `inicio` fora da grade original cria uma grade nova.
   *
   * **Por que isto vira teste agora, com o defeito ainda inalcançável.** `plantarOcorrencias`
   * recebe `aPartirDe` com o comentário "permite estender uma série já plantada sem replantar o
   * passado", e hoje existe UM chamador só, que passa `entrada.startsOn` — a data original. Ou
   * seja: o parâmetro existe para a extensão automática do horizonte, que está registrada como
   * pendente por depender de cron. Quem for construí-la vai passar "hoje" ou "última data + 1",
   * porque é a coisa óbvia a fazer, e nesse dia toda série de `a_cada_dias` muda de ritmo em
   * silêncio — sem erro, sem teste vermelho, e visível só para a cliente que percebe que o
   * horário dela andou.
   *
   * Este bloco fixa o contrato antes disso: a extensão precisa passar uma data QUE ESTEJA na
   * grade original, não uma data arbitrária.
   */
  const REGRA = { tipo: 'a_cada_dias', intervaloDias: 30 } as const

  it('a grade de "a cada 30 dias" sai de `inicio`', () => {
    const datas = proximasDatas({
      regra: REGRA,
      inicio: '2026-01-01',
      limite: { tipo: 'numero_de_vezes', total: 4 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-01-01', '2026-01-31', '2026-03-02', '2026-04-01'])
  })

  it('retomar de uma data FORA da grade original muda o ritmo — é o contrato, não um bug a corrigir aqui', () => {
    /*
     * 05/02 não pertence à grade de 30 em 30 dias que sai de 01/01 (ela passa por 31/01 e 02/03).
     * O resultado sai coerente com o pedido e errado para a cliente: 07/03 em vez de 02/03.
     *
     * A correção certa NÃO é nesta função — ela faz exatamente o que o nome diz. É em quem for
     * chamar `plantarOcorrencias` para estender: tem que calcular a próxima data da grade original
     * (última gerada + intervalo) e passar ELA como `aPartirDe`.
     */
    const retomada = proximasDatas({
      regra: REGRA,
      inicio: '2026-02-05',
      limite: { tipo: 'numero_de_vezes', total: 4 },
      ocorrenciasJaGeradas: 2,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(retomada).toEqual(['2026-02-05', '2026-03-07'])
    expect(retomada, 'a grade original passa por 02/03 — se esta asserção cair, alguém ancorou a série').not.toContain(
      '2026-03-02',
    )
  })

  it('retomar de uma data DA grade original preserva o ritmo — é assim que a extensão tem que chamar', () => {
    const retomada = proximasDatas({
      regra: REGRA,
      inicio: '2026-03-02', // a 3ª data da grade que sai de 01/01
      limite: { tipo: 'numero_de_vezes', total: 4 },
      ocorrenciasJaGeradas: 2,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(retomada).toEqual(['2026-03-02', '2026-04-01'])
  })

  it('`semanal` se realinha sozinho, então retomar de qualquer dia não desloca a grade', () => {
    /*
     * O contraste que prova que o risco é só do `a_cada_dias`: retomar de uma quarta-feira uma
     * série de toda terça devolve as MESMAS terças que a grade original daria dali em diante.
     */
    const comum = { limite: { tipo: 'numero_de_vezes', total: 2 }, horizonte: '2026-12-31', tetoDeSeguranca: TETO } as const
    const daTerca = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-08-25', // terça, na grade
      ocorrenciasJaGeradas: 0,
      ...comum,
    })
    const daQuarta = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-08-19', // quarta, fora da grade — anda até a terça seguinte
      ocorrenciasJaGeradas: 0,
      ...comum,
    })
    expect(daTerca).toEqual(['2026-08-25', '2026-09-01'])
    expect(daQuarta).toEqual(['2026-08-25', '2026-09-01'])
  })
})

describe('proximasDatas · teto de segurança', () => {
  it('nunca ultrapassa tetoDeSeguranca mesmo com limite "sem_fim" e horizonte distante', () => {
    const datas = proximasDatas({
      regra: { tipo: 'a_cada_dias', intervaloDias: 1 },
      inicio: '2026-01-01',
      limite: { tipo: 'sem_fim' },
      ocorrenciasJaGeradas: 0,
      horizonte: '2030-12-31',
      tetoDeSeguranca: 10,
    })
    expect(datas).toHaveLength(10)
  })
})

describe('ocorrenciaConflitaComFolga', () => {
  const inicio = '2026-08-18T17:00:00Z'
  const fim = '2026-08-18T18:00:00Z'

  it('detecta sobreposição parcial', () => {
    expect(ocorrenciaConflitaComFolga(inicio, fim, [{ start: '2026-08-18T17:30:00Z', end: '2026-08-18T19:00:00Z' }])).toBe(true)
  })

  it('não detecta quando a folga termina exatamente quando a ocorrência começa', () => {
    expect(ocorrenciaConflitaComFolga(inicio, fim, [{ start: '2026-08-18T16:00:00Z', end: '2026-08-18T17:00:00Z' }])).toBe(false)
  })

  it('não detecta folga em outro dia', () => {
    expect(ocorrenciaConflitaComFolga(inicio, fim, [{ start: '2026-08-19T00:00:00Z', end: '2026-08-19T23:00:00Z' }])).toBe(false)
  })
})
