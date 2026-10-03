import {
  PRELANCAMENTO,
  descreverDia,
  descreverDiaCurto,
  diaDeBrasilia,
  diasParaOFim,
  fimDaGraca,
  ultimoDiaDaCortesia,
  type SituacaoDaConta,
} from './prelancamento'

/**
 * A faixa que o painel mostra em toda tela enquanto a conta está na cortesia, na graça ou pausada
 * (docs/87 §3.1, "Aviso, nunca surpresa"): a data de fim aparece desde o primeiro dia, a contagem
 * regressiva só nos últimos `diasDaContagemRegressiva`, e o fim da graça é dito por extenso.
 *
 * Função pura: recebe a situação já calculada (`situacaoDaConta`) e devolve o texto. Quem decide
 * o ESTADO é um lugar só; esta função só o diz em português.
 *
 * Três regras de texto, todas herdadas da casa:
 * - a data é sempre um dia de calendário real e fixo, nunca um relógio correndo nem "só hoje";
 * - nenhum travessão e nenhuma palavra com gênero ("bem-vindo"), porque a guarda de copy varre
 *   `src/core` também (a regra 22 do `docs/72` custou 8 frases de tela);
 * - nunca promete o que o produto não faz: "nada é cobrado" é verdade porque assinar é um toque
 *   (docs/87 E5), e a pausa diz que **ver e exportar continuam**.
 */

export type TomDaFaixa = 'acento' | 'warn' | 'danger'

export type FaixaDaConta = {
  tom: TomDaFaixa
  /** A frase inteira, já pontuada. */
  texto: string
  /** O que o toque faz. Sempre leva a "Meu plano". */
  acao: string
}

const ACAO = 'Escolher plano'

/** O último dia em que a graça ainda deixa criar. `fimDaGraca` é a meia-noite SEGUINTE a ele. */
function ultimoDiaDaGraca(cortesia: { ate: string }): string {
  return diaDeBrasilia(new Date(fimDaGraca(cortesia).getTime() - 1))
}

export function faixaDaConta(situacao: SituacaoDaConta, agora: Date): FaixaDaConta | null {
  const { estado, cortesia } = situacao
  if (!cortesia) return null

  if (estado === 'pausada') {
    return {
      tom: 'danger',
      texto: 'Conta pausada: você vê e exporta tudo, mas não cria nada novo. Escolher um plano reativa na hora.',
      acao: ACAO,
    }
  }

  if (estado === 'graca') {
    return {
      tom: 'danger',
      texto: `Sua cortesia acabou. Tudo continua funcionando até ${descreverDiaCurto(ultimoDiaDaGraca(cortesia))}; depois a conta fica pausada.`,
      acao: ACAO,
    }
  }

  if (estado !== 'cortesia') return null

  // "cortesia" é feminino e "teste" é masculino: a contração muda ("da sua cortesia", "do seu teste").
  const deQuem = cortesia.origem === 'teste' ? 'do seu teste' : 'da sua cortesia'
  const ultimo = ultimoDiaDaCortesia(cortesia)
  const dias = diasParaOFim(cortesia, agora)

  if (dias > PRELANCAMENTO.diasDaContagemRegressiva) {
    const abertura = cortesia.origem === 'teste' ? 'Teste grátis' : 'Pré-lançamento'
    return {
      tom: 'acento',
      texto: `${abertura}: tudo liberado até ${descreverDia(ultimo)}. Nada é cobrado sem você escolher um plano.`,
      acao: ACAO,
    }
  }

  if (dias <= 0) return { tom: 'warn', texto: `Hoje é o último dia ${deQuem}. Escolha um plano para continuar criando.`, acao: ACAO }
  if (dias === 1) return { tom: 'warn', texto: `Amanhã é o último dia ${deQuem}. Escolha um plano para continuar criando.`, acao: ACAO }
  return {
    tom: 'warn',
    texto: `Faltam ${dias} dias para o fim ${deQuem} (último dia: ${descreverDiaCurto(ultimo)}). Escolha um plano para continuar criando.`,
    acao: ACAO,
  }
}
