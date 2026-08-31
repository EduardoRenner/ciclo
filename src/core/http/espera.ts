/**
 * A frase do 429 tem que corresponder à espera REAL.
 *
 * `RATE_LIMITED` dizia sempre "Espere um instante e tente de novo." — e as janelas deste produto
 * vão de 2 segundos a 86.400. Para o limite diário do assistente (60 perguntas por salão), "um
 * instante" são 24 horas. Descoberto por acidente em 2026-08-30, esbarrando no próprio limite
 * enquanto testava: a resposta pedia para esperar um instante e o `retryAfterSeconds` dizia 86400.
 *
 * É a mesma classe do "O endereço não existe ou mudou de lugar" consertado no mesmo dia: a frase
 * não descreve o fato. Quem lê "um instante" tenta de novo em vinte segundos, tenta de novo em um
 * minuto, e conclui que o produto está quebrado — quando ele está funcionando como projetado e só
 * não soube dizer isso.
 */
export function textoDeEspera(segundos: number): string {
  if (segundos <= 90) return 'Muitas tentativas seguidas. Espere um instante e tente de novo.'

  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `Muitas tentativas seguidas. Tente de novo em cerca de ${minutos} minutos.`

  const horas = Math.round(segundos / 3600)
  if (horas < 20) {
    return horas === 1
      ? 'Você fez muitas perguntas seguidas. Tente de novo daqui a cerca de uma hora.'
      : `Você fez muitas perguntas seguidas. Tente de novo daqui a cerca de ${horas} horas.`
  }

  /*
   * O caso do limite diário não promete hora certa, e o motivo mudou depois de eu conferir o
   * limitador em vez de supor. Eu tinha escrito aqui que "a janela é deslizante, o crédito volta
   * aos poucos". Está errado: `rate-limit.ts` usa janela FIXA — `expiraEm` é gravado na primeira
   * requisição e a contagem zera de uma vez quando ele passa.
   *
   * A frase genérica continua certa, por outra razão: `limiteDeTaxa()` recebe o TAMANHO da janela,
   * não quanto falta dela. `Resultado` do limitador só devolve `{ permitido, restante }`, sem o
   * instante de reset — então quem monta esta mensagem não tem como saber se faltam 5 minutos ou
   * 20 horas. Prometer hora certa com esse dado seria inventar.
   *
   * Consequência conhecida e NÃO consertada aqui: o `Retry-After` também sai com a janela inteira,
   * e portanto superestima a espera. Consertar de verdade exige devolver o instante de reset nos
   * três backends (memória, Upstash e a RPC `consumir_rate_limit`, que é migração) — e fazer só
   * num deles deixaria o cabeçalho certo às vezes, que é pior do que errado sempre.
   */
  return 'Você atingiu o limite de uso de hoje. Tente de novo mais tarde.'
}
