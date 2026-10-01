/**
 * `docs/95` E3 — o perfil e a nota de cada cliente, para ORDENAR a fila de chamadas do dono.
 *
 * ## Duas coisas separadas, de propósito
 *
 * - **Perfil** é o rótulo do comportamento (Fiel, Regular, Novo, Atrasado, Faltante, Sumido). Diz
 *   O QUE está acontecendo com a pessoa.
 * - **Nota** (0 a 100) é a prioridade para chamar. Diz QUANTO vale a pena gastar a mensagem do dia
 *   com ela.
 *
 * A palavra "ruim" não existe aqui. A nota só serve para o dono escolher por onde começar a fila
 * dele; nunca para negar atendimento. Rotular pessoa é sensível (a LGPD dá ao titular o direito de
 * pedir revisão de decisão automatizada), então a conta fica sempre à vista: cada componente sai
 * com os pontos que deu e o motivo.
 *
 * ## Por que relativa ao próprio salão
 *
 * "Ticket alto" numa barbearia de R$ 40 e numa clínica de estética de R$ 400 são números que não se
 * comparam. Valor e frequência entram como POSIÇÃO dentro do salão (percentil), não em reais.
 * Regularidade, presença e atraso já são relativos por natureza (razões, não valores).
 *
 * Os pesos são hipótese (`docs/95` §E3) e mudam quando houver resultado medido. Por isso a versão
 * do algoritmo viaja junto com a nota.
 */

export const VERSAO_DA_NOTA = 1

/** Pesos em pontos; a soma é 100. */
export const PESOS = {
  valor: 30,
  frequencia: 20,
  regularidade: 15,
  presenca: 15,
  recencia: 10,
  vinculo: 10,
} as const

export type Componente = keyof typeof PESOS

export type HistoricoDoCliente = {
  clientId: string
  /** Visitas concluídas, com há quantos dias aconteceram e quanto valeram (centavos). */
  visitas: { diasAtras: number; valorCents: number }[]
  /** Faltas (no-show) registradas pelo profissional. */
  faltas: number
  /** Cancelamentos em cima da hora. */
  cancelamentosTardios: number
  /** Ritmo pessoal em dias (`client_cycles.personal_cycle_days`); `null` = ainda sem ritmo. */
  ritmoDias: number | null
  /** Dias desde o cadastro. */
  cadastradoHaDias: number
  /** Quantas pessoas ela indicou e viraram cliente. */
  indicou: number
}

export type Perfil = 'fiel' | 'regular' | 'novo' | 'atrasado' | 'faltante' | 'sumido'
export type Classe = 'ouro' | 'prata' | 'bronze'

export type ParteDaNota = { componente: Componente; pontos: number; maximo: number; motivo: string }

export type NotaDoCliente = {
  clientId: string
  nota: number
  classe: Classe
  perfil: Perfil
  partes: ParteDaNota[]
  versao: number
}

export const ROTULO_DO_PERFIL: Record<Perfil, string> = {
  fiel: 'Fiel',
  regular: 'Regular',
  novo: 'Novo',
  atrasado: 'Atrasado',
  faltante: 'Costuma faltar',
  sumido: 'Sumido',
}

export const ROTULO_DA_CLASSE: Record<Classe, string> = { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze' }

const UM_ANO = 365

function ultimoAno(h: HistoricoDoCliente) {
  return h.visitas.filter((v) => v.diasAtras <= UM_ANO)
}

function receitaDoAno(h: HistoricoDoCliente): number {
  return ultimoAno(h).reduce((soma, v) => soma + v.valorCents, 0)
}

/** Dias desde a visita mais recente; `null` sem nenhuma visita. */
export function diasSemVir(h: HistoricoDoCliente): number | null {
  if (h.visitas.length === 0) return null
  return Math.min(...h.visitas.map((v) => v.diasAtras))
}

/** Atraso relativo ao ritmo: 1 = venceu hoje; 2 = o dobro do ritmo sem vir. `null` sem ritmo. */
export function atrasoRelativo(h: HistoricoDoCliente): number | null {
  const dias = diasSemVir(h)
  if (dias === null || h.ritmoDias === null || h.ritmoDias <= 0) return null
  return dias / h.ritmoDias
}

/** Coeficiente de variação dos intervalos entre visitas; `null` com menos de 3 visitas. */
export function variacaoDosIntervalos(h: HistoricoDoCliente): number | null {
  const dias = [...h.visitas.map((v) => v.diasAtras)].sort((a, b) => b - a)
  if (dias.length < 3) return null
  const intervalos: number[] = []
  for (let i = 1; i < dias.length; i++) intervalos.push(dias[i - 1]! - dias[i]!)
  const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length
  if (media <= 0) return null
  const variancia = intervalos.reduce((a, b) => a + (b - media) ** 2, 0) / intervalos.length
  return Math.sqrt(variancia) / media
}

/**
 * Posição de `valor` entre `todos` (0 = o menor, 1 = o maior), contando empates pela metade.
 * Um salão de um cliente só dá 1 para ele: não há com quem comparar, e puni-lo seria pior.
 */
export function percentil(valor: number, todos: number[]): number {
  if (todos.length <= 1) return 1
  let abaixo = 0
  let iguais = 0
  for (const v of todos) {
    if (v < valor) abaixo++
    else if (v === valor) iguais++
  }
  return (abaixo + (iguais - 1) / 2) / (todos.length - 1)
}

const limitar = (x: number) => Math.min(1, Math.max(0, x))

export function perfilDoCliente(h: HistoricoDoCliente): Perfil {
  const total = h.visitas.length
  if (total <= 1) return 'novo'
  const atraso = atrasoRelativo(h)
  if (atraso !== null && atraso >= 3) return 'sumido'
  const marcados = total + h.faltas + h.cancelamentosTardios
  if (h.faltas + h.cancelamentosTardios >= 2 && (h.faltas + h.cancelamentosTardios) / marcados >= 0.3) return 'faltante'
  if (atraso !== null && atraso >= 1.2) return 'atrasado'
  const cv = variacaoDosIntervalos(h)
  if (ultimoAno(h).length >= 6 && cv !== null && cv <= 0.35) return 'fiel'
  return 'regular'
}

export function classeDaNota(nota: number): Classe {
  if (nota >= 70) return 'ouro'
  if (nota >= 40) return 'prata'
  return 'bronze'
}

/**
 * A nota de cada cliente do salão. Recebe o salão INTEIRO porque valor e frequência são posição
 * relativa: a mesma pessoa tem notas diferentes em salões diferentes, e isso é o certo.
 */
export function notasDoSalao(historicos: HistoricoDoCliente[]): NotaDoCliente[] {
  const comVisita = historicos.filter((h) => h.visitas.length > 0)
  const receitas = comVisita.map(receitaDoAno)
  const frequencias = comVisita.map((h) => ultimoAno(h).length)

  return historicos.map((h) => {
    const partes: ParteDaNota[] = []
    const somar = (componente: Componente, fracao: number, motivo: string) =>
      partes.push({ componente, pontos: Math.round(PESOS[componente] * limitar(fracao)), maximo: PESOS[componente], motivo })

    const receita = receitaDoAno(h)
    const visitasAno = ultimoAno(h).length
    if (h.visitas.length === 0) {
      somar('valor', 0, 'Ainda sem atendimento concluído')
      somar('frequencia', 0, 'Ainda sem atendimento concluído')
    } else {
      const pv = percentil(receita, receitas)
      somar('valor', pv, `Gastou mais que ${Math.round(pv * 100)}% dos clientes no último ano`)
      const pf = percentil(visitasAno, frequencias)
      somar('frequencia', pf, `${visitasAno} ${visitasAno === 1 ? 'visita' : 'visitas'} no último ano`)
    }

    // Quem nunca foi atendido não ganha ponto "neutro": sem nenhum atendimento, regularidade,
    // presença e recência não foram medidas, e dar meia nota a cada uma empatava essa pessoa com um
    // cliente de verdade que some há meses (caso do teste "ordena do jeito que o dono espera").
    const semAtendimento = h.visitas.length === 0
    const cv = variacaoDosIntervalos(h)
    if (semAtendimento) somar('regularidade', 0, 'Ainda sem atendimento concluído')
    else if (cv === null) somar('regularidade', 0.5, 'Pouco histórico para medir a regularidade')
    else somar('regularidade', 1 - cv, cv <= 0.35 ? 'Volta com intervalo parecido' : 'Intervalo entre visitas varia bastante')

    const marcados = h.visitas.length + h.faltas + h.cancelamentosTardios
    const falhas = h.faltas + h.cancelamentosTardios
    if (semAtendimento) somar('presenca', falhas === 0 ? 0.5 : 0, falhas === 0 ? 'Ainda sem atendimento concluído' : `${falhas} ${falhas === 1 ? 'falta ou cancelamento' : 'faltas ou cancelamentos'} e nenhum atendimento`)
    else if (marcados === 0) somar('presenca', 1, 'Sem faltas registradas')
    else somar('presenca', 1 - falhas / marcados, falhas === 0 ? 'Nunca faltou' : `${falhas} ${falhas === 1 ? 'falta ou cancelamento' : 'faltas ou cancelamentos'} em cima da hora`)

    const atraso = atrasoRelativo(h)
    if (semAtendimento) somar('recencia', 0, 'Ainda sem atendimento concluído')
    else if (atraso === null) somar('recencia', 0.5, 'Ritmo ainda não medido')
    else if (atraso <= 1) somar('recencia', 1, 'Dentro do ritmo dele')
    else somar('recencia', 1 - (atraso - 1) / 2, `Passou ${Math.round((atraso - 1) * 100)}% do ritmo sem vir`)

    const antiguidade = limitar(h.cadastradoHaDias / UM_ANO)
    const indicacao = limitar(h.indicou / 2)
    somar(
      'vinculo',
      antiguidade * 0.5 + indicacao * 0.5,
      h.indicou > 0 ? `Indicou ${h.indicou} ${h.indicou === 1 ? 'pessoa' : 'pessoas'}` : `Cliente há ${Math.floor(h.cadastradoHaDias / 30)} meses`,
    )

    const nota = partes.reduce((soma, p) => soma + p.pontos, 0)
    return { clientId: h.clientId, nota, classe: classeDaNota(nota), perfil: perfilDoCliente(h), partes, versao: VERSAO_DA_NOTA }
  })
}
