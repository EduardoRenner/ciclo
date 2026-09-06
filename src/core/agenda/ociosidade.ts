/**
 * `docs/53` D-01 — a cadeira vazia, só o fato, nunca o preço.
 *
 * A pesquisa (`docs/52` pergunta 5, citando a Zenoti) mede a diferença entre ocupação mediana
 * (~47-49%) e a dos melhores salões (~76-79%) como a maior lacuna de todo o levantamento — e
 * NENHUM dos 31 concorrentes pesquisados faz gestão de rendimento (yield management) em beleza.
 * O risco nomeado no `docs/53` §3.3 ataque 2 é real: sugerir desconto é a porta dos fundos da
 * precificação automática, vedada pelo `CLAUDE.md`. Esta primeira fatia (D-01) fica **inteiramente
 * do lado seguro**: nomeia o dia que está parado, nunca o preço — a segunda tela (se um dia
 * existir) é decisão de outro ticket, não deste.
 *
 * Mora em `core/` e não solta a frase pronta na tela pelo mesmo motivo do `frase-da-margem.ts`:
 * a fronteira entre "observação" e "sugestão" precisa ficar guardada por teste, e uma frase escrita
 * direto no componente vira sugestão de preço na primeira vez que alguém "só quiser ajudar".
 */

/** Convenção de `weekdayPg` (`agendamentos.ts`/`public-booking.ts`): 0 = domingo … 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const NOME_DO_DIA: Record<Weekday, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terça',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
}

/**
 * Semanas mínimas de histórico antes de qualquer dia entrar na conta. Sem isto, um salão com duas
 * semanas de uso já veria "sua terça está vazia há 2 semanas" — verdade aritmética, e ainda assim
 * uma acusação fabricada de pouquíssimo dado (a mesma classe de erro que o `margem-do-servico.ts`
 * evita ao exigir 3 comandas fechadas antes de nomear uma parcela dominante).
 */
export const MINIMO_DE_SEMANAS_OBSERVADAS = 4

/** Sequência mínima de semanas vazias para o dia virar destaque — 3 é "não foi coincidência". */
export const MINIMO_DE_SEMANAS_VAZIAS_SEGUIDAS = 3

/**
 * Quantas semanas seguidas, contando da mais recente para trás, estão vazias.
 *
 * `ocorrencias[0]` é a semana mais recente já encerrada (nunca a atual, que ainda não terminou —
 * quem monta a lista decide isso, esta função só conta). Para na primeira ocupada: um dia que
 * esteve cheio há 3 semanas e vazio nas 2 mais recentes tem streak 2, não 5.
 */
export function streakDeSemanasVazias(ocorrencias: readonly boolean[]): number {
  let streak = 0
  for (const ocupado of ocorrencias) {
    if (ocupado) break
    streak++
  }
  return streak
}

export type DiaOcioso = {
  weekday: Weekday
  semanasSeguidasVazias: number
  semanasObservadas: number
}

/**
 * O dia mais parado, ou `null` quando ninguém qualifica. `null` é uma resposta tão válida quanto
 * um dia — "nenhum dia está consistentemente vazio" é bom para o negócio e ruim para o produto
 * mostrar um alarme, e o produto perde essa disputa: nunca fabrica vilão para preencher uma tela.
 */
export function diaMaisOcioso(porWeekday: ReadonlyMap<Weekday, readonly boolean[]>): DiaOcioso | null {
  let pior: DiaOcioso | null = null

  for (const [weekday, ocorrencias] of porWeekday) {
    if (ocorrencias.length < MINIMO_DE_SEMANAS_OBSERVADAS) continue

    const streak = streakDeSemanasVazias(ocorrencias)
    if (streak < MINIMO_DE_SEMANAS_VAZIAS_SEGUIDAS) continue

    if (!pior || streak > pior.semanasSeguidasVazias) {
      pior = { weekday, semanasSeguidasVazias: streak, semanasObservadas: ocorrencias.length }
    }
  }

  return pior
}
