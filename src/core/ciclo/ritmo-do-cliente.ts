import { Temporal } from '@js-temporal/polyfill'

/**
 * O que o `docs/48` chama de C4, dito com todas as letras: *"o João vem a cada 18 dias, está há
 * 31"*.
 *
 * ## A fresta que isto ocupa, e o tamanho dela
 *
 * O `docs/47` §1.6 mediu o concorrente mais próximo: o blog do Gendo descreve ciclo individual, e
 * a **página de produto** entrega *"Relatório de clientes sumidos: veja quem não volta há 45
 * dias"* — prazo fixo, igual para todo mundo. O Motor de Ciclo já calcula o ritmo de cada pessoa
 * desde o TICKET-036; o que faltava era **dizer** esse número na tela. Enquanto ele só ordena uma
 * lista por dentro, a diferença para um filtro de data é invisível para quem paga.
 *
 * ## Por que a cadência às vezes não é dita
 *
 * `client_cycles.personal_cycle_days` NUNCA é nulo — quando a pessoa tem uma visita só, ele vale o
 * padrão do serviço (`computeCycle`, passo 3: zero intervalos → só o padrão). Escrever *"vem a
 * cada 21 dias"* nesse caso seria apresentar o palpite do catálogo como se fosse o ritmo daquela
 * pessoa, que é exatamente a acusação que o `docs/47` faz ao Gendo — só que pior, porque com cara
 * de personalizado.
 *
 * Então a cadência só é afirmada quando existe intervalo medido, e a procedência acompanha
 * enquanto a amostra é pequena. É a mesma regra de `reguaDoServico`, um nível abaixo: número sem
 * procedência é número que ninguém deveria usar para decidir.
 */

export type EntradaRitmo = {
  /** `client_cycles.personal_cycle_days`. */
  cicloPessoalDias: number
  /** `client_cycles.last_visit_on`, em `YYYY-MM-DD` no fuso do salão. */
  ultimaVisitaOn: string | null
  /** Hoje, no fuso do salão. */
  hoje: string
  /** Quantas visitas concluídas a pessoa tem NAQUELE serviço. Um intervalo = duas visitas. */
  visitas: number
}

export type RitmoDoCliente = {
  /** "Vem a cada 18 dias" — `null` enquanto não houver intervalo nenhum para medir. */
  cadencia: string | null
  /** "está há 31 dias sem vir" / "veio faz 5 dias" — `null` sem data de última visita. */
  situacao: string | null
  /** "medido em 1 volta" — só enquanto a amostra é pequena o bastante para importar. */
  procedencia: string | null
}

/** Acima disto a amostra já não é a notícia; abaixo, ela é parte da informação. */
const AMOSTRA_PEQUENA = 3

function dias(quantos: number): string {
  return quantos === 1 ? '1 dia' : `${quantos} dias`
}

function voltas(quantas: number): string {
  return quantas === 1 ? '1 volta' : `${quantas} voltas`
}

export function ritmoDoCliente(entrada: EntradaRitmo): RitmoDoCliente {
  const intervalos = Math.max(0, entrada.visitas - 1)

  const cadencia = intervalos > 0 ? `Vem a cada ${dias(entrada.cicloPessoalDias)}` : null
  const procedencia = intervalos > 0 && intervalos <= AMOSTRA_PEQUENA ? `medido em ${voltas(intervalos)}` : null

  let situacao: string | null = null
  if (entrada.ultimaVisitaOn) {
    const desde = Temporal.PlainDate.from(entrada.hoje).since(Temporal.PlainDate.from(entrada.ultimaVisitaOn)).total('days')
    /*
     * Negativo acontece: `last_visit_on` sai de `starts_at` de um atendimento já concluído, e um
     * atendimento pode ser marcado como concluído com data futura (adiantar o fechamento no fim
     * do expediente). "Veio faz -2 dias" na ficha de quem paga não é aceitável; a linha some, que
     * é o comportamento de quem não sabe.
     */
    if (desde >= 0) {
      const arredondado = Math.trunc(desde)
      situacao = arredondado === 0 ? 'veio hoje' : `veio faz ${dias(arredondado)}`
    }
  }

  return { cadencia, situacao, procedencia }
}

/**
 * A frase inteira, na ordem em que o `docs/48` a escreve. Existe para a tela não montar a
 * pontuação por conta própria — foi assim que a versão anterior deste texto saiu com vírgula antes
 * de um trecho que não veio.
 */
export function fraseDoRitmo(ritmo: RitmoDoCliente): string | null {
  const partes = [ritmo.cadencia, ritmo.situacao].filter((p): p is string => Boolean(p))
  if (partes.length === 0) return null
  return `${partes.join(', ')}.`
}
