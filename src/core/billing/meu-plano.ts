import { NOME_DO_PLANO, ORDEM_DOS_PLANOS, PLANOS, PLANOS_A_VENDA, precoDoPlanoPorMes, type PlanoTier } from './planos'
import {
  descreverDia,
  descreverDiaCurto,
  ultimoDiaDaCortesia,
  ultimoDiaDaGraca,
  ultimoDiaDaPausa,
  type SituacaoDaConta,
} from './prelancamento'

/**
 * O que a tela "Meu plano" diz e oferece em cada estado da conta (docs/87 D1, D2 e §3).
 *
 * A tela foi escrita para o mundo antigo: um degrau atual, os degraus acima à venda, e o Grátis como
 * chão. Com a cortesia isso mente de três jeitos, medidos no navegador em 03/10 com a conta pausada:
 * dizia "Você está no Equipe, R$ 99/mês" (como se estivesse pagando), oferecia o Avançado (que deixou
 * de ser vendido) e não dava como assinar o Solo nem o Equipe.
 *
 * Função pura: o estado já vem calculado (`situacaoDaConta`), e o que sai é DADO, não convite. Quem
 * escreve "chame" ou "fale com" é a página, que é quem consulta o canal de contato (a guarda
 * `falar-com-a-gente-tem-com-quem` proíbe a frase em quem não consulta).
 */

export type TierAVenda = (typeof PLANOS_A_VENDA)[number]

export type OpcaoDeAssinatura = {
  tier: TierAVenda
  /**
   * Quantos profissionais ativos passam do teto da faixa. Zero = cabe. Maior que zero: a tela NÃO
   * mostra o botão de assinar, porque assinar o Solo com 3 profissionais é pagar por uma faixa
   * onde a próxima criação já trava.
   */
  excedeEm: number
}

export type VisaoDoMeuPlano = {
  /** A linha embaixo do título da página. */
  descricao: string
  /** O título do cartão de cima. */
  nome: string
  /** "R$ 49/mês"; `null` quando não há cobrança nenhuma no momento. */
  preco: string | null
  /**
   * A frase do estado (cortesia, graça, pausa). `null` no estado de sempre, onde a tela usa o texto
   * de "como se muda de plano" do canal de contato.
   */
  explicacao: string | null
  /** O que se pode assinar agora. Vazio quando a pessoa já está no degrau mais alto à venda. */
  opcoes: OpcaoDeAssinatura[]
  /** "Escolha seu plano" (sem plano pago) ou "Se precisar de mais" (já paga um). */
  cabecalho: string
  /** Já paga a maior faixa à venda: a tela fala em "mais de 5 profissionais", e não lista nada. */
  noDegrauMaisAlto: boolean
}

function acima(pago: PlanoTier): TierAVenda[] {
  const i = ORDEM_DOS_PLANOS.indexOf(pago)
  return PLANOS_A_VENDA.filter((t) => ORDEM_DOS_PLANOS.indexOf(t) > i)
}

function opcoesPara(tiers: readonly TierAVenda[], profissionaisAtivos: number): OpcaoDeAssinatura[] {
  return tiers.map((tier) => {
    const teto = PLANOS[tier].maxProfissionais
    return { tier, excedeEm: teto === null ? 0 : Math.max(0, profissionaisAtivos - teto) }
  })
}

export function visaoDoMeuPlano(situacao: SituacaoDaConta, planoPago: PlanoTier, profissionaisAtivos: number): VisaoDoMeuPlano {
  const { estado, cortesia } = situacao

  if (estado === 'aberto') {
    return {
      descricao: 'Tudo liberado, sem cobrança.',
      nome: 'Acesso aberto',
      preco: null,
      explicacao: 'Você usa o CICLO inteiro, sem cartão e sem prazo por enquanto. A gente avisa com antecedência antes de qualquer cobrança, e a sua base é sua: dá para exportar quando quiser.',
      opcoes: [],
      cabecalho: '',
      noDegrauMaisAlto: false,
    }
  }

  if (cortesia && estado === 'cortesia') {
    const teste = cortesia.origem === 'teste'
    const ultimo = ultimoDiaDaCortesia(cortesia)
    return {
      descricao: `Tudo liberado, sem cobrança, até ${descreverDiaCurto(ultimo)}.`,
      nome: teste ? 'Teste grátis' : 'Cortesia de pré-lançamento',
      preco: null,
      explicacao: `Você usa o CICLO inteiro até ${descreverDia(ultimo)}, sem cartão. Nada é cobrado sem você escolher um plano abaixo.`,
      opcoes: opcoesPara(PLANOS_A_VENDA, profissionaisAtivos),
      cabecalho: 'Escolha seu plano',
      noDegrauMaisAlto: false,
    }
  }

  if (cortesia && estado === 'graca') {
    return {
      descricao: 'Sua cortesia acabou. Escolha um plano para continuar criando.',
      nome: 'Cortesia encerrada',
      preco: null,
      explicacao: `Tudo continua funcionando até ${descreverDia(ultimoDiaDaGraca(cortesia))}. Depois a conta fica pausada: você vê e exporta tudo, mas não cria nada novo. Assinar um plano reativa na hora.`,
      opcoes: opcoesPara(PLANOS_A_VENDA, profissionaisAtivos),
      cabecalho: 'Escolha seu plano',
      noDegrauMaisAlto: false,
    }
  }

  if (cortesia && estado === 'pausada') {
    return {
      descricao: 'Conta pausada. Escolha um plano para voltar a criar.',
      nome: 'Conta pausada',
      preco: null,
      explicacao: `Você vê e exporta tudo, mas não cria nada novo. Seus dados ficam guardados até ${descreverDia(ultimoDiaDaPausa(cortesia))}, e assinar um plano reativa tudo na hora.`,
      opcoes: opcoesPara(PLANOS_A_VENDA, profissionaisAtivos),
      cabecalho: 'Escolha seu plano',
      noDegrauMaisAlto: false,
    }
  }

  // Conta anterior ao programa, no Grátis: a promessa que ela recebeu continua valendo (os termos
  // diziam que o Grátis não expira), mas o Grátis deixou de ser vendido, então só se oferece o que se vende.
  if (planoPago === 'gratis') {
    return {
      descricao: `Você está no ${NOME_DO_PLANO.gratis}.`,
      nome: NOME_DO_PLANO.gratis,
      preco: precoDoPlanoPorMes('gratis'),
      explicacao: null,
      opcoes: opcoesPara(PLANOS_A_VENDA, profissionaisAtivos),
      cabecalho: 'Escolha seu plano',
      noDegrauMaisAlto: false,
    }
  }

  const tiersAcima = acima(planoPago)
  return {
    descricao: `Você está no ${NOME_DO_PLANO[planoPago]}.`,
    nome: NOME_DO_PLANO[planoPago],
    preco: precoDoPlanoPorMes(planoPago),
    explicacao: null,
    opcoes: opcoesPara(tiersAcima, profissionaisAtivos),
    cabecalho: 'Se precisar de mais',
    noDegrauMaisAlto: tiersAcima.length === 0,
  }
}
