/**
 * `docs/48` C5 — a prestação de contas do Motor: *"dos 40 que previmos em agosto, 31 voltaram"*.
 *
 * ## Por que isto é a prova, e não a promessa
 *
 * `docs/45` §1.4 (Blue Ocean, quadrante CRIAR) foi categórico: nenhum dos seis concorrentes mostra
 * ao dono o quanto a própria previsão acertou. Todos prometem prever; nenhum se mede contra o que
 * prometeu. E é a única coisa daquela grade que um concorrente **não pode ter amanhã mesmo**,
 * porque exige histórico — previsão feita depois do fato não é previsão.
 *
 * O `docs/48` rebaixou isto de âncora para prova, e com razão: é invisível no dia 1. Mas a base
 * para ele existe desde a `0064` (`cycle_predictions`, append-only, uma linha por visita), e o que
 * faltava era alguém ler.
 *
 * ## A armadilha que este módulo existe para não cair
 *
 * `resolved_at` só é preenchido quando a pessoa **volta**. Contar acerto apenas sobre as previsões
 * resolvidas é viés de sobrevivência puro: quem nunca voltou nunca vira erro, e a taxa de acerto
 * sobe sozinha quanto pior o Motor for. Um número que melhora com o próprio fracasso é pior que
 * número nenhum.
 *
 * Por isso a previsão que já passou da janela de espera e continua em aberto conta como **erro**,
 * não como "ainda pode". E a que passou da data prevista há pouco não conta para lado nenhum — a
 * pessoa ainda pode aparecer amanhã.
 */

/** Uma previsão do `cycle_predictions`, do jeito que ela é lida. */
export type PrevisaoAuditada = {
  /** `YYYY-MM-DD` que o Motor disse. */
  predictedOn: string
  /** `YYYY-MM-DD` da volta, ou `null` enquanto a previsão está em aberto. */
  actualReturnOn: string | null
}

/**
 * Sete dias para cada lado.
 *
 * Não é precisão de relógio: a decisão que este número sustenta é "mandar mensagem esta semana ou
 * não". Uma previsão que erra por três dias acerta a semana, e é a semana que o dono usa.
 */
export const TOLERANCIA_DIAS = 7

/**
 * Trinta dias depois da data prevista, uma previsão em aberto vira erro.
 *
 * O prazo não é arbitrário: `estadoPorAtraso` (`compute.ts`) classifica como `at_risk` a partir de
 * 10 dias e `lost` a partir de 30. Quem passou de 30 sem voltar já é, pelo vocabulário do próprio
 * produto, uma pessoa perdida — contá-la como "ainda pode voltar" seria o produto discordando de
 * si mesmo para melhorar a própria nota.
 */
export const JANELA_DE_ESPERA_DIAS = 30

/** A mesma amostra mínima da calibração: abaixo disso, o percentual descreve o acaso. */
export const MINIMO_PARA_AFIRMAR = 8

export type PrestacaoDeContas = {
  /** Previsões que já têm resposta: a pessoa voltou, ou já passou da janela de espera. */
  conferidas: number
  /** Acertos: voltou dentro de `TOLERANCIA_DIAS` da data prevista. */
  acertos: number
  /** `null` enquanto não há amostra para afirmar — e `null` não é zero. */
  acertoBps: number | null
  /** Ainda podem acontecer: passaram da data há pouco, ou nem chegou o dia. */
  emAberto: number
  detalhe: {
    voltouAntes: number
    voltouNaJanela: number
    voltouDepois: number
    naoVoltou: number
  }
  /** Erro mediano em dias, com sinal: negativo = as pessoas voltam ANTES do que o Motor diz. */
  erroMedianoDias: number | null
}

function diasEntre(de: string, ate: string): number {
  // Datas puras em UTC ao meio-dia: sem hora, não há fuso nem horário de verão para errar.
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  if (ordenados.length % 2 === 0) return (ordenados[meio - 1]! + ordenados[meio]!) / 2
  return ordenados[meio]!
}

export function prestacaoDeContas(previsoes: readonly PrevisaoAuditada[], hoje: string): PrestacaoDeContas {
  const detalhe = { voltouAntes: 0, voltouNaJanela: 0, voltouDepois: 0, naoVoltou: 0 }
  const erros: number[] = []
  let emAberto = 0

  for (const p of previsoes) {
    if (p.actualReturnOn) {
      const erro = diasEntre(p.predictedOn, p.actualReturnOn)
      erros.push(erro)
      if (erro < -TOLERANCIA_DIAS) detalhe.voltouAntes++
      else if (erro > TOLERANCIA_DIAS) detalhe.voltouDepois++
      else detalhe.voltouNaJanela++
      continue
    }

    if (diasEntre(p.predictedOn, hoje) > JANELA_DE_ESPERA_DIAS) detalhe.naoVoltou++
    else emAberto++
  }

  const conferidas = detalhe.voltouAntes + detalhe.voltouNaJanela + detalhe.voltouDepois + detalhe.naoVoltou
  const acertos = detalhe.voltouNaJanela

  return {
    conferidas,
    acertos,
    acertoBps: conferidas >= MINIMO_PARA_AFIRMAR ? Math.round((acertos / conferidas) * 10_000) : null,
    emAberto,
    detalhe,
    // O erro mediano descreve só quem voltou — para quem não voltou não existe "erro em dias", e
    // inventar um (a distância até hoje) faria a mediana crescer todo dia sozinha.
    erroMedianoDias: erros.length >= MINIMO_PARA_AFIRMAR ? Math.round(mediana(erros)) : null,
  }
}
