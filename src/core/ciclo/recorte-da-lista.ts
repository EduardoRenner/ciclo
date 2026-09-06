/**
 * A lista de recuperação mostra no máximo 200 linhas, e os dois números do topo somam o filtro
 * INTEIRO. Isso é deliberado e está documentado em `listarParaRecuperar` — "a profissional precisa
 * do número certo mesmo pedindo `limit=20`". O que nunca foi dito é para quem lê a tela.
 *
 * Num salão com 300 clientes em risco, o topo anuncia *"300 clientes · R$ 15.000 para recuperar"*,
 * a lista traz 200, e não há paginação, contagem parcial nem uma palavra sobre as outras 100. A
 * pessoa trabalha a lista até o fim, manda para todo mundo que vê, e sai convicta de que cobriu os
 * R$ 15.000 — cobriu uns R$ 11.000. O erro cresce junto com o cliente: só acontece com o salão
 * grande, que é justamente o que não se quer perder.
 *
 * O corte em si é bom e não muda: `quemRecuperar` ordena por `valueCents` desc antes do `slice`,
 * então as 200 exibidas são mesmo as de maior valor. Bom corte, dito em voz alta, continua bom;
 * calado vira número que não fecha.
 *
 * Devolve `null` quando não há nada a declarar — a tela não deve carregar uma linha de aviso
 * permanente sobre um recorte que, na esmagadora maioria dos salões, não existe.
 */
export function recorteDaLista(total: number, mostrados: number): string | null {
  if (mostrados >= total) return null

  const escondidos = total - mostrados
  const outras = escondidos === 1 ? 'a outra' : `as outras ${escondidos}`
  return `Mostrando ${mostrados} de ${total}, as de maior valor. Filtre por situação para chegar ${outras}.`
}
