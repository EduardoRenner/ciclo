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
type ItemDoCartao = {
  texto: string
  modulo?: ModuloKey
  capacidade?: Capacidade
  /**
   * O item anuncia um TETO (hoje só o de profissionais). Desde a D2 (docs/87) as duas faixas vendem o
   * mesmo produto e diferem só no tamanho da equipe, então o que o Equipe tem de próprio é um teto
   * maior, e não um módulo. `precos-nao-promete-demais` confere que o número do texto é o do core.
   */
  limite?: 'profissionais'
}

type Plano = {
  /** O degrau; nome e preço vêm do core, para a tabela de preço não virar a quinta cópia deles. */
  tier: PlanoTier
  porDia?: string
  chamada: string
  /** A dor específica que faz alguém escolher este degrau. Degrau sem isto não deveria existir. */
  paraQuem: string
  inclui: ItemDoCartao[]
  naoInclui?: string[]
  destaque?: boolean
}

/**
 * O conteúdo dos cartões: SÓ o que está à venda (`PLANOS_A_VENDA`, docs/87 D2). O Grátis e o
 * Avançado não têm cartão. Os NÚMEROS vêm do core (`PLANOS`), nunca daqui.
 */
export const CARTOES: Plano[] = [
  {
    tier: 'essencial',
    porDia: 'menos de R$ 1,70 por dia, o preço de um corte uma vez por mês',
    chamada: 'Por mês, um profissional.',
    /*
      "Por conta" e não "quem atende sozinho": escolher um gênero é o erro que a tabela do
      `docs/20-COPY-PLANO.md` §C.4 nomeia, e `copy-nao-supoe-genero` varre `src/lib` também.
    */
    paraQuem: 'Você atende por conta e quer o produto inteiro, sem escolher módulo.',
    inclui: [
      { texto: 'Agenda sem risco de marcar dois no mesmo horário', modulo: 'agenda' },
      { texto: 'Sua página de agendamento com link para a bio, sem o selo do CICLO', modulo: 'public_page', capacidade: 'remover_selo' },
      { texto: 'Clientes com ficha e histórico, sem limite', modulo: 'clients' },
      { texto: 'Motor de Ciclo: veja quem sumiu e quanto isso vale', modulo: 'cycle_engine' },
      /*
        "Lembrete e confirmação de agendamento" continua fora, pelo mesmo motivo de 2026-08-24
        (docs/20-COPY-PLANO.md §A.4 e §S.1/C-2): o módulo `reminders` existe, mas a rota que dispara
        o lembrete não roda em produção, e anunciar automação que não executa é a promessa mais cara
        que este produto pode fazer. O agendador é `.github/workflows/cron.yml` (o `vercel.json`
        fica vazio de propósito); `src/core/cron/agendadas.ts` é a lista que o código usa. Volta
        quando `reminders` entrar no schedule.
      */
      { texto: 'Chamar de volta a base inteira de uma vez', capacidade: 'envio_em_lote' },
      { texto: 'Campanhas para datas e aniversários', modulo: 'campaigns' },
      { texto: 'Comanda, caixa e fechamento do dia', modulo: 'register' },
      { texto: 'Orçamento com aprovação por link', modulo: 'quotes' },
      { texto: 'Controle de estoque', modulo: 'stock' },
      { texto: 'Anamnese e ficha de saúde em cofre cifrado', modulo: 'health_records' },
      { texto: 'Recorrência e pacotes', modulo: 'recurrence' },
      { texto: 'Fidelidade e pontos', modulo: 'loyalty' },
      { texto: 'Relatórios do negócio' },
    ],
  },
  {
    tier: 'equipe',
    chamada: `Por mês, até ${PLANOS.equipe.maxProfissionais} profissionais.`,
    paraQuem: 'Você contratou alguém e precisa de agenda e acerto separados.',
    inclui: [
      { texto: 'Tudo do Solo, sem tirar nada' },
      {
        texto: `Até ${PLANOS.equipe.maxProfissionais} profissionais, cada um com agenda, comissão e extrato próprios`,
        limite: 'profissionais',
      },
    ],
    destaque: true,
  },
]
