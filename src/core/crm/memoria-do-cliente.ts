import { Temporal } from '@js-temporal/polyfill'

/**
 * `docs/84` §4 item 3 (P4): o que o dono sabe de cabeça sobre a cliente antiga e o sistema não
 * dizia — o dia em que ela costuma vir, com quem, e de quanto em quanto tempo ela volta. Tudo sai
 * dos atendimentos concluídos; nenhuma coluna nova, nenhum palpite.
 *
 * ## Por que cada fato tem piso, e diz a contagem
 *
 * "Costuma vir às terças" com 2 visitas é coincidência escrita como hábito. O mesmo defeito que o
 * `ritmo-do-cliente.ts` evita ao não afirmar cadência sem intervalo medido. Então:
 *
 * - **dia da semana:** 4 visitas no mínimo e o dia mais comum em pelo menos metade delas; empate
 *   não afirma nada (dizer "às terças" quando são 3 terças e 3 sábados é escolher por ela);
 * - **quem atende:** 3 visitas com profissional e a mesma pessoa em pelo menos 60% — e só em
 *   negócio com mais de uma pessoa atendendo, porque "sempre com a dona" no salão de uma pessoa só
 *   é ruído na ficha;
 * - **faixa de retorno:** 3 intervalos no mínimo (4 visitas). A faixa é do quartil de baixo ao de
 *   cima, não do menor ao maior: uma volta de 90 dias depois das férias não pode esticar a faixa
 *   de quem vem todo mês.
 *
 * A contagem ("5 de 7 visitas") vai junto na frase, sempre: é o que deixa o dono conferir e
 * discordar.
 *
 * Uma VISITA é um dia: corte e barba no mesmo dia são dois atendimentos e uma ida ao salão —
 * contar dois inflaria o hábito e criaria intervalo de zero dias.
 */

export type AtendimentoConcluido = {
  /** Dia do atendimento, `YYYY-MM-DD`, já no fuso do salão. */
  dia: string
  /** Nome de quem atendeu; `null` quando o profissional foi removido. */
  profissional: string | null
}

export type MemoriaDoCliente = {
  diaDaSemana: { dia: number; vezes: number; de: number } | null
  profissional: { nome: string; vezes: number; de: number } | null
  faixaDeRetorno: { de: number; ate: number; intervalos: number } | null
}

const MINIMO_VISITAS_DIA = 4
const MINIMO_VISITAS_PROFISSIONAL = 3
const PARCELA_PROFISSIONAL = 0.6
const MINIMO_INTERVALOS = 3

/** Índice 1 = segunda … 7 = domingo, o `dayOfWeek` do Temporal. */
const NO_DIA: Record<number, string> = {
  1: 'às segundas',
  2: 'às terças',
  3: 'às quartas',
  4: 'às quintas',
  5: 'às sextas',
  6: 'aos sábados',
  7: 'aos domingos',
}

function maisComum<T>(valores: readonly T[]): { valor: T; vezes: number } | null {
  const contagem = new Map<T, number>()
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1)
  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const [primeiro, segundo] = ordenado
  if (!primeiro) return null
  if (segundo && segundo[1] === primeiro[1]) return null
  return { valor: primeiro[0], vezes: primeiro[1] }
}

/** Posição mais próxima (nearest-rank): sempre um intervalo que aconteceu, nunca uma média inventada. */
function quartil(ordenados: readonly number[], p: number): number {
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(p * ordenados.length) - 1))
  return ordenados[i]!
}

export function memoriaDoCliente(
  atendimentos: readonly AtendimentoConcluido[],
  opcoes: { variosProfissionais: boolean },
): MemoriaDoCliente {
  // Um por dia; quem atendeu naquele dia é o do primeiro atendimento com profissional conhecido.
  const porDia = new Map<string, string | null>()
  for (const a of [...atendimentos].sort((x, y) => x.dia.localeCompare(y.dia))) {
    if (!porDia.has(a.dia) || (porDia.get(a.dia) === null && a.profissional !== null)) porDia.set(a.dia, a.profissional)
  }
  const dias = [...porDia.keys()]
  const visitas = dias.length

  let diaDaSemana: MemoriaDoCliente['diaDaSemana'] = null
  if (visitas >= MINIMO_VISITAS_DIA) {
    const comum = maisComum(dias.map((d) => Temporal.PlainDate.from(d).dayOfWeek))
    if (comum && comum.vezes * 2 >= visitas) diaDaSemana = { dia: comum.valor, vezes: comum.vezes, de: visitas }
  }

  let profissional: MemoriaDoCliente['profissional'] = null
  const comQuem = [...porDia.values()].filter((p): p is string => p !== null)
  if (opcoes.variosProfissionais && comQuem.length >= MINIMO_VISITAS_PROFISSIONAL) {
    const comum = maisComum(comQuem)
    if (comum && comum.vezes >= PARCELA_PROFISSIONAL * comQuem.length) {
      profissional = { nome: comum.valor, vezes: comum.vezes, de: comQuem.length }
    }
  }

  let faixaDeRetorno: MemoriaDoCliente['faixaDeRetorno'] = null
  const intervalos = dias
    .slice(1)
    .map((d, i) => Temporal.PlainDate.from(dias[i]!).until(Temporal.PlainDate.from(d), { largestUnit: 'days' }).days)
    .sort((a, b) => a - b)
  if (intervalos.length >= MINIMO_INTERVALOS) {
    faixaDeRetorno = { de: quartil(intervalos, 0.25), ate: quartil(intervalos, 0.75), intervalos: intervalos.length }
  }

  return { diaDaSemana, profissional, faixaDeRetorno }
}

function visitasDe(vezes: number, de: number): string {
  return `${vezes} de ${de} visitas`
}

/**
 * As frases, prontas — a ficha e o assistente dizem a MESMA coisa, com a mesma contagem. Sem
 * gênero ("atendida"/"atendido"): o sujeito fica implícito na tela da própria pessoa.
 */
export function frasesDaMemoria(m: MemoriaDoCliente): string[] {
  const frases: string[] = []
  if (m.diaDaSemana) {
    frases.push(`Costuma vir ${NO_DIA[m.diaDaSemana.dia]} (${visitasDe(m.diaDaSemana.vezes, m.diaDaSemana.de)}).`)
  }
  if (m.profissional) {
    const { nome, vezes, de } = m.profissional
    frases.push(vezes === de ? `Sempre com ${nome} (${de} visitas).` : `Quase sempre com ${nome} (${visitasDe(vezes, de)}).`)
  }
  if (m.faixaDeRetorno) {
    const { de, ate } = m.faixaDeRetorno
    frases.push(de === ate ? `Costuma voltar em ${de === 1 ? '1 dia' : `${de} dias`}.` : `Costuma voltar entre ${de} e ${ate} dias.`)
  }
  return frases
}
