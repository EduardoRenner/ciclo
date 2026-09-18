import { estadoPorAtraso, type EstadoCiclo } from '@/core/cycle/compute'
import { diasEntre, JANELA_DE_ESPERA_DIAS, type PrevisaoAuditada } from '@/core/cycle/prestacao-de-contas'
import { PROBABILIDADE_POR_ESTADO } from '@/core/cycle/valor-em-risco'

/**
 * `docs/73` F1 — a metade do D+E (`docs/46`) que ficou faltando.
 *
 * `PROBABILIDADE_POR_ESTADO` (`valor-em-risco.ts`) é um palpite de lançamento, igual para todo
 * tenant, desde o primeiro commit — nunca foi medido contra o que de fato acontece. É o mesmo
 * defeito que `cycle_days` tinha antes da `0065`: um número fixo decidindo o que a tela ordena e
 * anuncia como dinheiro, sem nenhum retorno da realidade daquele salão específico.
 *
 * `cycle_predictions` já guarda o que falta para medir: cada linha resolvida sabe se a pessoa
 * voltou, e há quantos dias de atraso ela estava quando isso aconteceu (ou quando a janela de
 * espera expirou sem volta). `estadoPorAtraso` (`compute.ts`) já converte esse atraso em estado —
 * rodar a MESMA função sobre o atraso na resolução, em vez de sobre o atraso de hoje, dá a
 * pergunta certa: "de quem chegou a este estado, quantos voltaram?"
 *
 * Este arquivo não lê banco (regra 5 do `CLAUDE.md`): recebe os desfechos já resolvidos e devolve
 * a tabela calibrada. Quem lê `cycle_predictions` e monta a lista de desfechos é responsabilidade
 * de `server/services/previsao.ts`.
 */

export type DesfechoPorEstado = {
  /** O estado (`estadoPorAtraso`) no momento em que a previsão foi resolvida ou expirou sem volta. */
  estado: EstadoCiclo
  /** Voltou dentro da janela, ou não voltou (previsão expirou por `JANELA_DE_ESPERA_DIAS`). */
  voltou: boolean
}

/**
 * Mesmo piso de `MINIMO_DE_AMOSTRA` (`calibracao.ts`) e `MINIMO_PARA_AFIRMAR`
 * (`prestacao-de-contas.ts`) — abaixo disso, o percentual descreve o acaso, não o salão.
 */
export const MINIMO_POR_ESTADO = 8

/**
 * `on_track` nunca entra no cálculo, e a regra não é uma exceção rara: é definicional.
 * `on_track` é 0 porque quem está em dia não tem receita em risco — não existe "chance de
 * on_track voltar", a pergunta não faz sentido para esse estado.
 *
 * Estado sem amostra suficiente mantém `tabelaPadrao` — um salão novo, com poucos ciclos
 * resolvidos, continua usando o palpite global em vez de calibrar sobre 3 casos.
 */
export function calibrarProbabilidadePorEstado(
  desfechos: readonly DesfechoPorEstado[],
  tabelaPadrao: Record<EstadoCiclo, number> = PROBABILIDADE_POR_ESTADO,
): Record<EstadoCiclo, number> {
  const contagem = new Map<EstadoCiclo, { total: number; voltou: number }>()

  for (const d of desfechos) {
    if (d.estado === 'on_track') continue
    const atual = contagem.get(d.estado) ?? { total: 0, voltou: 0 }
    atual.total += 1
    if (d.voltou) atual.voltou += 1
    contagem.set(d.estado, atual)
  }

  const resultado = { ...tabelaPadrao }
  for (const [estado, c] of contagem) {
    if (c.total < MINIMO_POR_ESTADO) continue
    resultado[estado] = c.voltou / c.total
  }
  return resultado
}

/**
 * A ponte entre `cycle_predictions` cru e `calibrarProbabilidadePorEstado`: recebe as mesmas
 * linhas que `prestacaoDeContas` já lê (`predictedOn`/`actualReturnOn`) e classifica cada uma pelo
 * ESTADO que ela tinha ao ser resolvida — não pelo estado de hoje, que já é outra pergunta.
 *
 * Resolvida (`actualReturnOn` presente): o atraso na volta vira estado via `estadoPorAtraso`, e
 * conta como conversão. Alguém que voltou 35 dias atrasada — depois de já ter passado pela faixa
 * que hoje mostraria "perdida" — é exatamente o dado que falta para responder "de quem chega a
 * 'perdida', quantos ainda voltam?".
 *
 * Não resolvida: só conta como "não voltou" quando já passou de `JANELA_DE_ESPERA_DIAS` sem
 * volta — mesma régua de `prestacaoDeContas`, para as duas leituras nunca divergirem sobre o
 * que é uma previsão "decidida". Quem ainda está dentro da janela é indeterminado e fica de fora:
 * contar como erro agora inflaria a taxa de "não voltou" com gente que ainda pode aparecer amanhã.
 */
export function calibrarProbabilidadeDeResolvidas(
  previsoes: readonly PrevisaoAuditada[],
  hoje: string,
  tabelaPadrao: Record<EstadoCiclo, number> = PROBABILIDADE_POR_ESTADO,
): Record<EstadoCiclo, number> {
  const desfechos: DesfechoPorEstado[] = []

  for (const p of previsoes) {
    if (p.actualReturnOn) {
      const atrasoNaVolta = diasEntre(p.predictedOn, p.actualReturnOn)
      desfechos.push({ estado: estadoPorAtraso(atrasoNaVolta), voltou: true })
      continue
    }
    if (diasEntre(p.predictedOn, hoje) > JANELA_DE_ESPERA_DIAS) {
      desfechos.push({ estado: 'lost', voltou: false })
    }
    // Ainda dentro da janela, sem volta: outcome indeterminado, fica fora da amostra.
  }

  return calibrarProbabilidadePorEstado(desfechos, tabelaPadrao)
}

/**
 * `docs/73` T4 — a tela "Recuperar receita" precisa saber SE a calibração está ativa, sem
 * precisar entender a tabela inteira. `true` quando pelo menos um estado (fora `on_track`, que
 * nunca calibra) já tem amostra suficiente e divergiu do padrão global.
 *
 * Devolve um booleano, não uma frase pronta: o rótulo em português de cada estado mora na camada
 * de UI (`RUBRICA_ESTADO`, `recuperar.tsx`), e `core/` não pode conhecer esse vocabulário (regra 5
 * do `CLAUDE.md`). Quem decide COMO dizer isso é quem já tem os rótulos — esta função só decide
 * SE há algo para dizer.
 */
export function algumEstadoFoiCalibrado(
  calibrada: Record<EstadoCiclo, number>,
  tabelaPadrao: Record<EstadoCiclo, number> = PROBABILIDADE_POR_ESTADO,
): boolean {
  return (Object.keys(tabelaPadrao) as EstadoCiclo[]).some((estado) => estado !== 'on_track' && calibrada[estado] !== tabelaPadrao[estado])
}
