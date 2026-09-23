import { Temporal } from '@js-temporal/polyfill'

/**
 * A frase da tela de resultado quando a base entrou no Motor e NINGUÉM está atrasado.
 *
 * Medido no navegador (docs/82 §16, rodada 17): a linha de "Já atendo" nasce em "Uns 15 dias", o
 * corte de barbearia volta a cada 21, e quem aceitava o padrão via só "2 pessoas cadastradas". A
 * aba Recuperar dizia "Todo mundo em dia". Para uma conta que chegou pela calculadora — cuja
 * pergunta era justamente "quem sumiu?" — o primeiro contato com o Motor era silêncio. Esta frase
 * é o que o Motor tem a dizer nesse caso: quando ele vai ter trabalho, e o que fazer até lá.
 *
 * A promessa "se passar do tempo, aparece no Hoje" só é verdadeira porque o recálculo noturno
 * passou a ler a data informada (`recomputarCiclosDoTenant`, mesma rodada) — antes a ficha de quem
 * entrou em dia congelava.
 *
 * Função pura porque o que precisa de guarda é a CONTA de dias e a frase — não a marcação. As duas
 * portas da base (planilha e memória) usam a mesma, pelo mesmo motivo de `ciclo-de-quem-ja-atende`.
 */
export type PrimeiraVolta = { titulo: string; descricao: string }

/**
 * `porta`: a dica final só faz sentido onde existe o seletor "Última vez". Na planilha a data vem
 * do arquivo, e mandar "adicione com Um mês" apontaria para um campo que aquela tela não tem.
 */
export function primeiraVolta(proximaVolta: string, hoje: Temporal.PlainDate, porta: 'memoria' | 'planilha' = 'memoria'): PrimeiraVolta {
  const data = Temporal.PlainDate.from(proximaVolta)
  const dias = hoje.until(data, { largestUnit: 'day' }).days
  const diaMes = `${String(data.day).padStart(2, '0')}/${String(data.month).padStart(2, '0')}`
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `daqui a ${dias} dias (${diaMes})`
  return {
    titulo: 'Ninguém atrasado por enquanto',
    descricao:
      `O primeiro deve voltar ${quando}. Se passar do tempo, aparece no Hoje para você chamar.` +
      (porta === 'memoria' ? ' Lembrou de alguém que sumiu faz mais tempo? Adicione com "Um mês" ou mais.' : ''),
  }
}
