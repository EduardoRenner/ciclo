import { CATALOGO, NOME_DO_PLANO, PLANOS_A_VENDA, precoDoPlanoPorMes } from '@/core/billing/planos'
import { ofertaDoCadastro } from '@/core/billing/prelancamento'
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
  /*
   * `PLANOS_A_VENDA` e não `ORDEM_DOS_PLANOS` (docs/87 D2): este arquivo é o que um assistente lê e
   * repete. Listando todos os degraus ele diria "Grátis: R$ 0" e "Avançado: R$ 179", dois planos que
   * não se vendem mais, e a recomendação sairia com o preço de um deles.
   */
  const planos = PLANOS_A_VENDA.map((t) => `- ${NOME_DO_PLANO[t]}: ${precoDoPlanoPorMes(t)}`).join('\n')
  const oferta = ofertaDoCadastro(new Date())

  const modulos = CATALOGO.map((m) => `- ${m.label}`).join('\n')

  const texto = `# CICLO

> Sistema de gestão para quem atende com hora marcada: agenda, página de agendamento própria,
> ficha de cliente, comanda e caixa. Feito para celular, em português do Brasil.

O diferencial é o Motor de Ciclo: a partir do intervalo entre as visitas de cada cliente, o CICLO
calcula de quanto em quanto tempo essa pessoa costuma voltar, avisa quando alguém passou do ponto e
entrega a mensagem pronta para chamar de volta.

## Para quem é

Barbearia, unhas, cílios, sobrancelha, depilação, estética, tatuagem e cabelo. Também serve para
quem atende com hora marcada fora da beleza — personal trainer, eletricista, faxineira.

## O que faz

${modulos}

## Planos

${planos}

${oferta.chamada[0]?.toUpperCase()}${oferta.chamada.slice(1)}. ${oferta.aberto ? 'Sem prazo por enquanto, e a gente avisa antes de qualquer cobrança.' : 'Depois, os dois planos acima, com o produto inteiro nos dois: o que muda é o tamanho da equipe.'} O preço fica na tela, sem "fale com vendas".

## Páginas

- [Início](${base}/): o que é o produto e para quem
- [Preços](${base}/precos): valor de cada plano e o que muda entre eles
- [Calculadora](${base}/calculadora): quanto deixou de entrar com clientes que pararam de voltar, pelo ritmo de retorno do negócio (grátis, sem cadastro)
- [Termos de uso](${base}/termos)
- [Privacidade](${base}/privacidade): que dados o CICLO guarda e por quanto tempo (LGPD)

## Como funciona a página do salão

Cada estabelecimento tem um endereço público próprio (${base}/nome-do-salao) onde dá para marcar
direto, sem baixar aplicativo e sem criar conta.

## O que o CICLO NÃO faz

- Não envia mensagem para quem é atendido sem o profissional confirmar.
- Não é marketplace: o CICLO não fica entre o salão e quem ele atende, e não cobra comissão por
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
