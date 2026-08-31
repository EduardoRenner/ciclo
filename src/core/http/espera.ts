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

  // O caso do limite diário: não promete hora certa porque a janela é deslizante — o crédito volta
  // aos poucos, não à meia-noite. Prometer "amanhã às 00h" seria trocar uma frase errada por outra.
  return 'Você atingiu o limite de uso de hoje. Tente de novo mais tarde.'
}
