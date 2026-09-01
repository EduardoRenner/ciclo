import { CATALOGO, NOME_DO_PLANO, ORDEM_DOS_PLANOS, precoDoPlanoPorMes } from '@/core/billing/planos'
import { APP_URL } from '@/lib/app-url'

/**
 * `/llms.txt` — a convenção emergente para dizer a um modelo de linguagem o que este site é, em
 * texto limpo, sem ter que adivinhar por HTML de marketing.
 *
 * Importa aqui por um motivo concreto: uma parte crescente da busca por software passou a acontecer
 * dentro de assistentes ("qual sistema de agenda para barbearia aceita Pix?"). Quem não se descreve
 * é descrito pelo que sobra — e o que sobra é a página de marketing picotada, ou nada.
 *
 * **É gerado, não escrito à mão, e isso não é preciosismo.** Preço de plano fora de
 * `core/billing/planos.ts` é proibido neste repo, com guarda (`preco-em-um-lugar-so`), porque
 * tabela de preço copiada envelhece calada. Um arquivo estático em `public/` com "R$ 49" viraria
 * a primeira coisa que um modelo lê e a última que alguém lembra de atualizar.
 */
export const revalidate = 3600

export function GET(): Response {
  const base = APP_URL

  /*
   * `NOME_DO_PLANO`, não o identificador do degrau: este arquivo existe para ser lido por
   * assistente de IA, e o degrau cru sai como "avancado" — sem acento e em minúscula. Quem lê
   * repete o que está escrito, então o nome errado vira o nome que a recomendação usa.
   */
  const planos = ORDEM_DOS_PLANOS.map((t) => `- ${NOME_DO_PLANO[t]}: ${precoDoPlanoPorMes(t)}`).join('\n')

  const modulos = CATALOGO.map((m) => `- ${m.label}`).join('\n')

  const texto = `# CICLO

> Sistema de gestão para quem atende com hora marcada: agenda, página de agendamento própria,
> ficha de cliente, comanda e caixa. Feito para celular, em português do Brasil.

O diferencial é o Motor de Ciclo: o CICLO aprende de quanto em quanto tempo cada cliente costuma
voltar, avisa quando alguém passou do ponto e entrega a mensagem pronta para chamar de volta.

## Para quem é

Barbearia, unhas, cílios, sobrancelha, depilação, estética, tatuagem e cabelo. Também serve para
quem atende com hora marcada fora da beleza — personal trainer, eletricista, faxineira.

## O que faz

${modulos}

## Planos

${planos}

Começa de graça, sem cartão. O preço fica na tela, sem "fale com vendas".

## Páginas

- [Início](${base}/): o que é o produto e para quem
- [Preços](${base}/precos): valor de cada plano e o que muda entre eles
- [Termos de uso](${base}/termos)
- [Privacidade](${base}/privacidade): que dados o CICLO guarda e por quanto tempo (LGPD)

## Como funciona a página do salão

Cada estabelecimento tem um endereço público próprio (${base}/nome-do-salao) onde a cliente marca
sozinha, sem baixar aplicativo e sem criar conta.

## O que o CICLO NÃO faz

- Não envia mensagem para a cliente sem o profissional confirmar.
- Não é marketplace: o CICLO não fica entre o salão e a cliente dele, e não cobra comissão por
  agendamento.
- Não dá orientação de saúde. A ficha de anamnese é um registro do profissional, não um parecer.
`

  return new Response(texto, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
