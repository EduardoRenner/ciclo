/**
 * `docs/50` L-09 — a série que só o tempo dá.
 *
 * O `docs/46` escolheu como mecanismo de defesa o que **acumula por salão com o tempo de uso**, e
 * não com escala: mecanismo cuja força cresce com o tamanho da base é o campo onde o líder vence
 * por definição. A frase que esta função sustenta — *"seu lucro por atendimento subiu 12% desde
 * março"* — nenhum concorrente pode dizer sobre o salão de outra pessoa, e o próprio CICLO não
 * consegue dizer sobre um salão que chegou ontem.
 *
 * A comparação é do **lucro por atendimento**, não do lucro do mês. Um mês com mais dias úteis, ou
 * com uma semana de festa, mexe no total sem dizer nada sobre a saúde do negócio; o que sobra de
 * cada atendimento é a medida que sobrevive à sazonalidade — e é a que muda quando o dono mexe em
 * preço, comissão ou ficha, que é o ponto inteiro desta série existir.
 */

export type MesFechado = {
  /** Primeiro dia do mês, `AAAA-MM-DD`. */
  month: string
  revenueCents: number
  profitCents: number
  ticketsCount: number
}

export type PontoDaSerie = MesFechado & {
  /**
   * Lucro médio por atendimento no mês, em centavos. `null` quando não houve comanda fechada —
   * dividir por zero devolveria `Infinity`, e um mês sem movimento não tem média nenhuma.
   */
  lucroPorAtendimentoCents: number | null
}

export type SerieMensal = {
  pontos: PontoDaSerie[]
  /**
   * A frase da variação, ou `null` quando não há o que comparar. Compara o mês fechado mais
   * recente com o mais antigo da série que TAMBÉM tenha atendimento — pular os meses vazios evita
   * a comparação contra `null` sem inventar zero para eles.
   */
  variacaoBps: number | null
  primeiroMesComparado: string | null
  ultimoMesComparado: string | null
}

/**
 * Menos que isto e a "variação" é ruído de dois meses. Não protege contra sazonalidade — nada
 * protege, com três pontos — mas impede a tela de anunciar tendência com base em uma comparação
 * só, que é o erro que faria o dono mexer em preço por causa de um dezembro.
 */
export const MINIMO_DE_MESES = 3

export function serieMensal(meses: readonly MesFechado[]): SerieMensal {
  const pontos: PontoDaSerie[] = [...meses]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      lucroPorAtendimentoCents: m.ticketsCount > 0 ? Math.round(m.profitCents / m.ticketsCount) : null,
    }))

  const comparaveis = pontos.filter((p) => p.lucroPorAtendimentoCents !== null)
  if (pontos.length < MINIMO_DE_MESES || comparaveis.length < 2) {
    return { pontos, variacaoBps: null, primeiroMesComparado: null, ultimoMesComparado: null }
  }

  const primeiro = comparaveis[0]!
  const ultimo = comparaveis[comparaveis.length - 1]!
  const base = primeiro.lucroPorAtendimentoCents!

  /*
   * Base zero ou negativa não tem variação percentual que signifique alguma coisa: "subiu 400%
   * desde março" partindo de um março no vermelho é aritmética que não descreve nada. A série
   * continua aparecendo; só a frase da variação cala.
   */
  if (base <= 0) return { pontos, variacaoBps: null, primeiroMesComparado: null, ultimoMesComparado: null }

  return {
    pontos,
    variacaoBps: Math.round(((ultimo.lucroPorAtendimentoCents! - base) / base) * 10_000),
    primeiroMesComparado: primeiro.month,
    ultimoMesComparado: ultimo.month,
  }
}

/**
 * Os meses **já encerrados**, do mais recente para o mais antigo, a partir do mês corrente.
 *
 * Existe como função pura por causa de uma guarda cega: a versão anterior varria o serviço
 * procurando `mesCorrente.subtract({ months:` e passou VERDE com o laço mexido, porque a mesma
 * expressão aparecia noutra linha, calculando o limite da janela. Varrer fonte prova que um texto
 * existe, nunca que um caminho executa — e aqui o caminho é o que importa: congelar o mês CORRENTE
 * grava um número que ainda vai mudar, para sempre.
 *
 * Recebe o primeiro dia do mês corrente no fuso do salão. Nunca o devolve.
 */
export function mesesJaEncerrados(mesCorrente: string, quantos: number): string[] {
  const [ano, mes] = mesCorrente.split('-').map(Number)
  const meses: string[] = []

  for (let i = 1; i <= quantos; i++) {
    // Aritmética de calendário na mão, em base 0, para não depender de fuso nenhum: estes são
    // rótulos de mês, não instantes.
    const total = ano! * 12 + (mes! - 1) - i
    meses.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`)
  }

  return meses
}
