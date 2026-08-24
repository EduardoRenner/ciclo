/**
 * Mora em `lib/` e não dentro de `app/(public)/precos/` porque tem DOIS leitores: a página pública
 * de preço, que vende para quem ainda não é cliente, e "Meu plano", que mostra a quem já é o que
 * cada degrau acima libera.
 *
 * Ter uma lista só é decisão de produto, não economia de linha: o que a pessoa leu antes de pagar
 * e o que ela vê depois, dentro do app, precisam ser a mesma frase. Duas listas com as mesmas
 * promessas escritas de jeitos diferentes é como se descobre, tarde, que uma das duas mentia.
 */

import { PLANOS, type Capacidade, type ModuloKey, type PlanoTier } from '@/core/billing/planos'

/**
 * Um item de venda do cartão. Quando ele corresponde a um módulo ou a uma capacidade do core, a
 * chave fica registrada — e `tests/unit/design/precos-nao-promete-demais.test.ts` confere que o
 * degrau anunciado é mesmo o degrau que libera aquilo.
 *
 * Sem isso, a página de preço é prosa solta: nada impediria anunciar "controle de estoque" sob o
 * Essencial quando o código só libera no Avançado. Promessa de marketing que o produto não cumpre
 * é a forma mais cara de perder um cliente de ticket baixo — ele paga, descobre, cancela e conta
 * para o bairro inteiro.
 *
 * Item sem chave é copy legítima que não mapeia para um interruptor ("Agenda sem risco de marcar
 * dois no mesmo horário" é o produto, não um módulo).
 */
type ItemDoCartao = { texto: string; modulo?: ModuloKey; capacidade?: Capacidade }

type Plano = {
  /** O degrau; nome e preço vêm do core, para a tabela de preço não virar a quinta cópia deles. */
  tier: PlanoTier
  porDia?: string
  chamada: string
  /** A dor específica que faz alguém subir para cá. Degrau sem isto não deveria existir. */
  paraQuem: string
  inclui: ItemDoCartao[]
  naoInclui?: string[]
  destaque?: boolean
}

/** O conteúdo dos cartões. Os NÚMEROS vêm do core (`PLANOS`), nunca daqui. */
export const CARTOES: Plano[] = [
  {
    tier: 'gratis',
    chamada: 'Para sempre, sem cartão.',
    paraQuem: 'Você atende sozinho e quer sair do caderno.',
    inclui: [
      { texto: 'Agenda sem risco de marcar dois no mesmo horário', modulo: 'agenda' },
      { texto: 'Sua página de agendamento com link para a bio', modulo: 'public_page' },
      { texto: `${PLANOS.gratis.maxClientes} clientes com ficha e histórico`, modulo: 'clients' },
      { texto: 'Motor de Ciclo: veja quem sumiu e quanto isso vale', modulo: 'cycle_engine' },
      { texto: 'Lembrete e confirmação de agendamento', modulo: 'reminders' },
    ],
    naoInclui: ['Mandar mensagem para vários de uma vez — no grátis você manda um a um'],
  },
  {
    tier: 'essencial',
    porDia: 'menos de R$ 1,70 por dia — o preço de um corte, uma vez por mês',
    chamada: 'Por mês, um profissional.',
    paraQuem: 'Você já viu quem sumiu e cansou de mandar mensagem um por um.',
    inclui: [
      { texto: 'Tudo do Grátis, sem limite de clientes' },
      { texto: 'Chamar de volta a base inteira de uma vez', capacidade: 'envio_em_lote' },
      { texto: 'Campanhas para datas e aniversários', modulo: 'campaigns' },
      { texto: 'Comanda, caixa e fechamento do dia', modulo: 'register' },
      { texto: 'Orçamento com aprovação por link', modulo: 'quotes' },
      { texto: 'Sua página fica sem o selo do CICLO', capacidade: 'remover_selo' },
    ],
  },
  {
    tier: 'equipe',
    chamada: `Por mês, até ${PLANOS.equipe.maxProfissionais} profissionais.`,
    paraQuem: 'Você contratou alguém e precisa de agenda e acerto separados.',
    inclui: [
      { texto: 'Tudo do Essencial' },
      { texto: 'Agenda por profissional', modulo: 'team' },
      { texto: 'Comissão e extrato de cada um', modulo: 'team' },
      { texto: 'Relatórios do negócio' },
      { texto: 'Fidelidade e pontos', modulo: 'loyalty' },
    ],
    destaque: true,
  },
  {
    tier: 'avancado',
    chamada: 'Por mês, sem limite de profissionais.',
    paraQuem: `Você passou de ${PLANOS.equipe.maxProfissionais}, controla estoque ou atende com ficha de saúde.`,
    inclui: [
      { texto: 'Tudo do Equipe, com profissionais ilimitados' },
      { texto: 'Controle de estoque', modulo: 'stock' },
      { texto: 'Anamnese e ficha de saúde em cofre cifrado', modulo: 'health_records' },
      { texto: 'Recorrência e pacotes', modulo: 'recurrence' },
    ],
  },
]
