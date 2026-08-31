import { AppError } from '@/server/http/errors'

/**
 * Le TODAS as linhas de uma consulta, em paginas.
 *
 * Existe porque o PostgREST tem teto de linhas por `.select()` — `max_rows = 1000` na config deste
 * projeto. Passando disso, ele NAO erra: devolve as primeiras 1000 e cala. Quem soma ou conta em
 * cima disso entrega numero errado com cara de certo, que e a pior forma do defeito.
 *
 * O `CLAUDE.md` chama isso de "a armadilha do TICKET-036", e o defeito real está registrado: um
 * tenant com 10 mil atendimentos concluídos perdia 90% deles em silêncio, e o que denunciou foi o
 * teste de performance — `processados` deu **1000**, não 10000. `v_carteira_resumo` (migration
 * 0018) nasceu do mesmo problema, para não trazer 10 mil clientes ao Node só para somar quatro
 * números.
 *
 * Mora aqui, e nao dentro de `segmentos.ts`, desde 31/08: passou a ter dois leitores quando as
 * metricas da ficha da cliente deixaram de ler colunas desnormalizadas e passaram a contar as
 * linhas de verdade. Copiar a funcao para o segundo leitor seria repetir a duplicacao que este
 * projeto vem desfazendo — e a copia que envelhece e sempre a que ninguem lembra que existe.
 */
const TAMANHO_PAGINA = 1000

export async function buscarTudoPaginado<T>(
  consultaBase: () => { range(inicio: number, fim: number): PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<T[]> {
  const tudo: T[] = []
  for (let pagina = 0; ; pagina++) {
    const inicio = pagina * TAMANHO_PAGINA
    const { data, error } = await consultaBase().range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new AppError('INTERNAL', { cause: error })
    tudo.push(...(data ?? []))
    // Pagina incompleta = acabou. Pagina cheia pode ter mais atras dela.
    if (!data || data.length < TAMANHO_PAGINA) break
  }
  return tudo
}
