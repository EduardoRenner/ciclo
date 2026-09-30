import { Temporal } from '@js-temporal/polyfill'

import { semAcento } from '@/core/text/normalizar'

/**
 * MI-1 (docs/85 §2.1) — a primeira peça do Motor de Inteligência: da frase do dono para
 * "o que ele quer saber" + "sobre quando / quanto / quem", SEM modelo de linguagem.
 *
 * O Gemini fazia duas coisas no assistente: entender a frase e escrever a resposta. Esta função é
 * a primeira. Ela não entende qualquer frase — entende o domínio do negócio (agenda, clientes,
 * dinheiro, recuperação, estoque, orçamento) — e, quando não entende ou fica entre duas leituras,
 * DIZ isso em vez de chutar. É a mesma filosofia do `resolverPorNome`: empate pergunta, nunca
 * escolhe sozinho. Uma resposta errada dita com confiança custa mais que um "você quis dizer...?".
 *
 * Como decide:
 * 1. normaliza (sem acento, minúsculas) — `\w` não casa acento, então nada de regex sobre o cru;
 * 2. casa as FRASES do vocabulário da mais longa para a mais curta, e cada palavra só serve a uma
 *    frase: "sobrou horário amanhã?" é ocupação, e o "sobrou" não conta de novo para "lucro";
 * 3. soma o peso de cada intenção; abaixo do piso é "não entendi", empate é "ambíguo";
 * 4. extrai as entidades (período, hora, R$, %) por regra própria, e o que sobra — tirando
 *    palavras vazias — é o `resto`, onde mora o nome de quem ou do quê (resolvido contra a base
 *    depois, pelo `resolverPorNome`, nunca aqui).
 *
 * Toda frase que o Motor errar vira linha do gabarito (`tests/unit/core/inteligencia/entender.
 * test.ts`) ANTES do conserto — é assim que ele aprende sem IA.
 */

export const INTENCOES = [
  'agenda_de_hoje',
  'quem_sumiu',
  'historico_cliente',
  'faturamento',
  'sobra',
  'ocupacao',
  'orcamentos',
  'estoque',
  'agendar',
  'concluir_atendimento',
  'cadastrar_cliente',
  'item_na_comanda',
  'nota_na_ficha',
  'chamar_de_volta',
  'por_que',
  'simular',
  'saudacao',
  'ajuda',
] as const
export type Intencao = (typeof INTENCOES)[number]

export type Periodo =
  | { tipo: 'dia'; data: string }
  | { tipo: 'intervalo'; inicio: string; fim: string }
  | { tipo: 'mes'; mes: string }

export type Entidades = {
  periodo?: Periodo
  /** `HH:MM`, 24h. */
  hora?: string
  valorCents?: number
  /** Todos os valores em R$, na ordem da frase: "de R$ 45 para R$ 55" → [4500, 5500]. */
  valoresCents?: number[]
  percentualBps?: number
  /** Palavras que sobraram, na grafia ORIGINAL — candidatas a nome de cliente, serviço, produto. */
  resto: string[]
  /**
   * O mesmo resto, agrupado em trechos contíguos, cada um com a palavra que vinha logo antes
   * (normalizada). É o que separa "lança uma hidratação na comanda DA Ana" (Ana é a cliente) de
   * "marca a Joana PRA escova" (escova é o serviço) sem precisar de modelo de linguagem.
   */
  trechos: { antes: string | null; palavras: string[] }[]
}

export type Entendimento =
  | { tipo: 'intencao'; intencao: Intencao; pontos: number; sobre?: Intencao; entidades: Entidades }
  | { tipo: 'ambiguo'; opcoes: [Intencao, Intencao]; entidades: Entidades }
  | { tipo: 'nao_entendi'; entidades: Entidades }

/** Abaixo disto a frase não diz o bastante — "não entendi" em vez de um palpite. */
export const PISO = 2

/**
 * Intenções que respondem SOBRE outra ("por que o faturamento caiu?", "e se eu aumentar o
 * preço?"). Quando aparecem junto de uma métrica, não é ambiguidade: a métrica vira o `sobre`.
 */
const INTENCOES_DE_RACIOCINIO: ReadonlySet<Intencao> = new Set(['por_que', 'simular'])
const INTENCOES_DE_CORTESIA: ReadonlySet<Intencao> = new Set(['saudacao', 'ajuda'])

/**
 * Vocabulário: `[frase, peso]`. Frase em forma normalizada, palavras separadas por espaço; `*` no
 * fim de uma palavra casa o prefixo ("fatur*" → faturei, faturamento, faturou).
 */
const VOCABULARIO: Record<Intencao, ReadonlyArray<readonly [string, number]>> = {
  agenda_de_hoje: [
    ['agenda de hoje', 5], ['meu dia', 3], ['como ta o dia', 4], ['como esta o dia', 4], ['proxim* cliente', 4],
    ['quem vem', 3], ['quem e a proxima', 4], ['quem e o proximo', 4], ['confirm*', 3], ['quanto atendi', 5],
    ['atendido hoje', 5], ['tem alguem', 3], ['agenda', 2], ['hoje', 1],
  ],
  quem_sumiu: [
    ['sumi*', 4], ['parou de vir', 5], ['pararam de vir', 5], ['nao voltou', 5], ['nao voltaram', 5], ['atrasad*', 3],
    ['recuper*', 4], ['chamar de volta', 5], ['quem chamar', 4], ['chamo primeiro', 4], ['em risco', 4],
    ['dinheiro parado', 5], ['valor parado', 5], ['passou da hora', 5], ['passaram da hora', 5], ['faz tempo que nao', 4], ['nao aparece', 5], ['nao aparecem', 5],
    ['devendo visita', 6], ['faz tempo', 2], ['devendo', 3], ['sem vir', 4],
  ],
  historico_cliente: [
    ['ultima vez', 5], ['veio pela ultima', 5], ['quando veio', 4], ['quando foi', 2], ['historico', 4], ['ficha d*', 3],
    ['telefone d*', 3], ['dados d*', 3], ['quantas vezes', 3], ['ja veio', 3], ['quando vem', 3], ['vem de novo', 3], ['gastou', 4], ['quanto tempo', 4],
    ['nao vem', 3], ['costuma vir', 5], ['costuma', 2], ['costume d*', 4], ['com quem', 3], ['ser atendid*', 3], ['e atendid*', 3], ['de quanto em quanto', 5],
  ],
  // docs/85 §2.5 "resolve": sozinho, vale o que foi respondido antes (`lembrar`); com nome, é direto.
  chamar_de_volta: [
    ['resolve', 6], ['resolva', 6], ['faz isso', 6], ['pode fazer', 5], ['pode mandar', 5], ['manda mensagem', 5], ['mandar mensagem', 5],
    ['chama ela', 6], ['chama ele', 6], ['chamar ela', 6], ['chamar ele', 6], ['manda pra ela', 6], ['manda pra ele', 6],
    ['chama', 4], ['chame', 4], ['de volta', 2],
  ],
  faturamento: [
    ['fatur*', 4], ['quanto entrou', 5], ['entrou', 2], ['quanto fiz', 4], ['quanto eu fiz', 5], ['ganhei', 3], ['vendi', 3], ['receita', 3],
    ['quanto ganhei', 5], ['dinheiro', 1], ['caixa', 2], ['como foi o mes', 4], ['como foi a semana', 4],
  ],
  sobra: [
    ['sobr*', 4], ['lucro', 5], ['lucrei', 5], ['margem', 4], ['ganho liquido', 5], ['no bolso', 4], ['depois dos custos', 5],
  ],
  ocupacao: [
    ['horario vago', 6], ['horario livre', 6], ['horarios vagos', 6], ['horarios livres', 6], ['sobrou horario', 7],
    ['sobra horario', 7], ['tem horario', 5], ['tem vaga', 5], ['vaga*', 3], ['agenda livre', 5], ['agenda cheia', 5],
    ['ocupa*', 4], ['lotad*', 4], ['buraco na agenda', 6], ['quantos agendamentos', 5], ['cabe mais', 4], ['vazi*', 2], ['cheia', 3], ['cheio', 3], ['mais fraco', 5], ['mais parado', 5],
    ['fraco', 3],
  ],
  orcamentos: [
    ['orcament*', 5], ['sem resposta', 3], ['nao respondeu', 3], ['aprovou', 2], ['proposta parada', 5],
  ],
  estoque: [
    ['estoque', 5], ['acabando', 4], ['recomprar', 5], ['repor', 4], ['vencend*', 4], ['perto de vencer', 5],
    ['validade', 4], ['falta produto', 5], ['produto*', 2],
  ],
  agendar: [
    // Não "agend*": "agenda" também é o substantivo ("a agenda de quinta tá cheia?" é ocupação).
    // O verbo aparece com o objeto logo depois, ou nas formas que só o verbo tem.
    ['agendar', 4], ['agende', 4], ['agendei', 4], ['agenda a', 4], ['agenda o', 4], ['agenda pra', 4], ['marca', 3], ['marcar', 3], ['marco', 3], ['bota na agenda', 5], ['coloca na agenda', 5],
    ['poe na agenda', 5], ['encaixa', 4], ['encaixar', 4], ['reserva', 3],
  ],
  concluir_atendimento: [
    ['conclu*', 4], ['finaliz*', 4], ['terminei', 4], ['atendi', 2], ['ja atendi', 4], ['marca como atendid*', 7],
    ['deu baixa', 4], ['dar baixa', 4], ['fecha o atendimento', 6], ['acabei', 3],
  ],
  cadastrar_cliente: [
    ['cadastr*', 5], ['cliente nova', 5], ['cliente novo', 5], ['nova cliente', 5], ['novo cliente', 5],
    ['adiciona* cliente', 5], ['salva o contato', 5],
  ],
  item_na_comanda: [
    ['comanda', 5], ['lanca', 3], ['lancar', 3], ['lanca na conta', 5], ['poe na conta', 5], ['coloca na conta', 5],
    ['cobra tambem', 4],
  ],
  nota_na_ficha: [
    ['anota', 5], ['anotar', 5], ['anotacao', 5], ['nota na ficha', 6], ['observacao', 4], ['escreve na ficha', 6],
    ['registra na ficha', 6], ['guarda que', 3],
  ],
  por_que: [
    ['por que', 5], ['porque', 5], ['pq', 4], ['por qual motivo', 5], ['motivo', 3], ['caiu', 3], ['subiu', 3],
    ['diminuiu', 3], ['aumentou', 3], ['piorou', 3], ['melhorou', 3], ['explica', 3],
  ],
  simular: [
    ['e se', 5], ['se eu', 4], ['quanto daria', 5], ['compensa', 5], ['vale a pena', 5], ['simul*', 5],
    ['o que acontece se', 6], ['e se eu', 6],
    // Os verbos da decisão entram no vocabulário para não virarem "nome de serviço" no resto; pesam
    // pouco de propósito ("aumentar" sozinho não é simulação). "contratar" já é uma pergunta.
    ['aumentar', 1], ['subir', 1], ['baixar', 1], ['reduzir', 1], ['abaixar', 1], ['cobrar', 1],
    ['contratar', 2], ['contratasse', 2], ['abrir', 1], ['abrisse', 1],
  ],
  saudacao: [
    // Agradecimento entra como cortesia, pelo prefixo: um item cobre as duas formas, e a guarda
    // `copy-nao-supoe-genero` continua valendo para o que o produto FALA (isto é o que ele LÊ).
    ['oi', 1], ['ola', 1], ['bom dia', 1], ['boa tarde', 1], ['boa noite', 1], ['e ai', 1], ['tudo bem', 1], ['opa', 1],
    ['obrigad*', 1], ['valeu', 1], ['brigad*', 1],
  ],
  ajuda: [
    ['ajuda', 1], ['o que voce faz', 1], ['o que voce sabe', 1], ['como funciona', 1], ['o que posso perguntar', 1],
    ['o que da pra perguntar', 1],
  ],
}

const PALAVRAS_VAZIAS: ReadonlySet<string> = new Set(
  (
    'a o as os de da do das dos e em no na nos nas num numa um uma uns umas que quem qual quais quanto quanta ' +
    'quantos quantas eu meu minha meus minhas me mim pra para pro pros pras por pelo pela pelos pelas com sem ja tem ' +
    'ter foi esta este esse essa isso isto ate agora voce vc ce la aqui ai se mais menos muito pouco como onde quando ' +
    'ta to sou ser estou estao sao nao sim favor porfa pls hein ne entao tambem so todo toda ' +
    'todos todas dia vez vezes cliente clientes hora horas as ao aos comigo'
  ).split(' '),
)

type Token = { original: string; norm: string }

function tokenizar(texto: string): Token[] {
  const saida: Token[] = []
  // Hífen separa ("sexta-feira", "e-mail" não importa aqui); `/ : , . $ %` ficam dentro do token
  // porque são parte de data, hora e dinheiro.
  for (const pedaco of texto.replace(/[?!;"“”()]/g, ' ').replace(/-/g, ' ').split(/\s+/)) {
    const original = pedaco.replace(/^[.,:]+|[.,:]+$/g, '')
    if (!original) continue
    saida.push({ original, norm: semAcento(original) })
  }
  return saida
}

function casaPalavra(padrao: string, palavra: string): boolean {
  return padrao.endsWith('*') ? palavra.startsWith(padrao.slice(0, -1)) : palavra === padrao
}

type Frase = { intencao: Intencao; palavras: string[]; peso: number }

// Mais longa primeiro; no empate de tamanho, a mais pesada. É esta ordem que faz "sobrou horário"
// consumir as duas palavras antes de "sobr*" ter a chance de pegar a primeira.
const FRASES: Frase[] = (Object.entries(VOCABULARIO) as [Intencao, ReadonlyArray<readonly [string, number]>][])
  .flatMap(([intencao, lista]) => lista.map(([frase, peso]) => ({ intencao, palavras: frase.split(' '), peso })))
  .sort((a, b) => b.palavras.length - a.palavras.length || b.peso - a.peso)

function pontuar(tokens: Token[]): { pontos: Map<Intencao, number>; usados: Set<number> } {
  const pontos = new Map<Intencao, number>()
  const usados = new Set<number>()
  for (const frase of FRASES) {
    const n = frase.palavras.length
    for (let i = 0; i + n <= tokens.length; i++) {
      let casa = true
      for (let j = 0; j < n; j++) {
        if (usados.has(i + j) || !casaPalavra(frase.palavras[j]!, tokens[i + j]!.norm)) {
          casa = false
          break
        }
      }
      if (!casa) continue
      for (let j = 0; j < n; j++) usados.add(i + j)
      pontos.set(frase.intencao, (pontos.get(frase.intencao) ?? 0) + frase.peso)
      break // cada frase conta uma vez: "sumiu, sumiu" não é mais "quem sumiu" que "sumiu"
    }
  }
  return { pontos, usados }
}

// ---------------------------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------------------------

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIAS_DA_SEMANA: Record<string, number> = { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 7 }
const PREPOSICOES_DE_DIA = new Set(['na', 'no', 'nesta', 'neste', 'nessa', 'nesse', 'esta', 'este', 'essa', 'esse', 'proxima', 'proximo', 'ate', 'de', 'em'])

const iso = (d: Temporal.PlainDate) => d.toString()
const mesIso = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`

function semana(hoje: Temporal.PlainDate, deslocamento: number): Periodo {
  const inicio = hoje.subtract({ days: hoje.dayOfWeek - 1 }).add({ weeks: deslocamento })
  return { tipo: 'intervalo', inicio: iso(inicio), fim: iso(inicio.add({ days: 6 })) }
}

function mesRelativo(hoje: Temporal.PlainDate, deslocamento: number): Periodo {
  const m = hoje.toPlainYearMonth().add({ months: deslocamento })
  return { tipo: 'mes', mes: mesIso(m.year, m.month) }
}

/** Frases de período, mais longas primeiro — mesma razão das frases de intenção. */
type ResolvePeriodo = (hoje: Temporal.PlainDate) => Periodo
const PERIODOS_FIXOS: ReadonlyArray<readonly [string, ResolvePeriodo]> = [
  ['depois de amanha', (h) => ({ tipo: 'dia', data: iso(h.add({ days: 2 })) })],
  ['semana que vem', (h) => semana(h, 1)],
  ['semana passada', (h) => semana(h, -1)],
  ['proxima semana', (h) => semana(h, 1)],
  ['esta semana', (h) => semana(h, 0)],
  ['essa semana', (h) => semana(h, 0)],
  ['nesta semana', (h) => semana(h, 0)],
  ['nessa semana', (h) => semana(h, 0)],
  ['da semana', (h) => semana(h, 0)],
  ['na semana', (h) => semana(h, 0)],
  ['mes que vem', (h) => mesRelativo(h, 1)],
  ['mes passado', (h) => mesRelativo(h, -1)],
  ['proximo mes', (h) => mesRelativo(h, 1)],
  ['este mes', (h) => mesRelativo(h, 0)],
  ['esse mes', (h) => mesRelativo(h, 0)],
  ['neste mes', (h) => mesRelativo(h, 0)],
  ['nesse mes', (h) => mesRelativo(h, 0)],
  ['do mes', (h) => mesRelativo(h, 0)],
  ['no mes', (h) => mesRelativo(h, 0)],
  ['anteontem', (h) => ({ tipo: 'dia', data: iso(h.subtract({ days: 2 })) })],
  ['ontem', (h) => ({ tipo: 'dia', data: iso(h.subtract({ days: 1 })) })],
  ['hoje', (h) => ({ tipo: 'dia', data: iso(h) })],
  ['amanha', (h) => ({ tipo: 'dia', data: iso(h.add({ days: 1 })) })],
]

function extrairEntidades(tokens: Token[], hoje: Temporal.PlainDate, usadosPeloVocabulario: Set<number>): Entidades {
  const consumidos = new Set<number>()
  const e: Entidades = { resto: [], trechos: [] }
  const norm = tokens.map((t) => t.norm)
  const consome = (...indices: number[]) => indices.forEach((i) => consumidos.add(i))

  for (let i = 0; i < norm.length; i++) {
    const t = norm[i]!
    const anterior = norm[i - 1]

    // dd/mm ou dd/mm/aaaa — sempre dia-mês (produto pt-BR), nunca mês-dia.
    const data = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t)
    if (data && !e.periodo) {
      const ano = data[3] ? (data[3].length === 2 ? 2000 + Number(data[3]) : Number(data[3])) : hoje.year
      try {
        const d = Temporal.PlainDate.from({ year: ano, month: Number(data[2]), day: Number(data[1]) }, { overflow: 'reject' })
        e.periodo = { tipo: 'dia', data: iso(d) }
        consome(i)
      } catch {
        /* data impossível: fica no resto, não vira outro dia */
      }
      continue
    }

    // Mês pelo nome. "março" normalizado é "marco" — o mesmo que "(eu) marco" — então ele só vale
    // com preposição antes; os outros meses valem soltos.
    const indiceMes = MESES.indexOf(t)
    if (indiceMes >= 0 && !e.periodo && (t !== 'marco' || (anterior && ['em', 'de', 'no'].includes(anterior)))) {
      const anoExplicito = /^\d{4}$/.test(norm[i + 1] ?? '') ? Number(norm[i + 1]) : /^\d{4}$/.test(norm[i + 2] ?? '') && norm[i + 1] === 'de' ? Number(norm[i + 2]) : null
      // Sem ano: o mês mais recente com esse nome que não está no futuro ("agosto" em setembro é
      // este ano; "novembro" em setembro é o do ano passado — ninguém pergunta faturamento futuro).
      const ano = anoExplicito ?? (indiceMes + 1 > hoje.month ? hoje.year - 1 : hoje.year)
      e.periodo = { tipo: 'mes', mes: mesIso(ano, indiceMes + 1) }
      consome(i)
      if (anoExplicito !== null) consome(norm[i + 1] === 'de' ? i + 2 : i + 1, ...(norm[i + 1] === 'de' ? [i + 1] : []))
      continue
    }

    // Dia da semana: o próximo (hoje conta). "segunda" sozinha é ambígua ("segunda vez"), então
    // precisa de "feira" depois ou de preposição antes.
    const dow = DIAS_DA_SEMANA[t]
    if (dow && !e.periodo && (t !== 'segunda' || norm[i + 1] === 'feira' || (anterior && PREPOSICOES_DE_DIA.has(anterior)))) {
      const passada = norm[i + 1] === 'passada' || norm[i + 1] === 'passado' || norm[i + 2] === 'passada'
      const diff = (dow - hoje.dayOfWeek + 7) % 7
      const d = passada ? hoje.subtract({ days: diff === 0 ? 7 : 7 - diff }) : hoje.add({ days: diff })
      e.periodo = { tipo: 'dia', data: iso(d) }
      consome(i)
      if (norm[i + 1] === 'feira') consome(i + 1)
      if (norm[i + 1] === 'passada' || norm[i + 1] === 'passado') consome(i + 1)
      continue
    }

    // Hora: 15h, 15h30, 15:30, "as 15", "15 horas".
    const hora = /^(\d{1,2})(?:h|:)(\d{2})?h?$/.exec(t) ?? (anterior === 'as' && /^\d{1,2}$/.test(t) ? [t, t, undefined] : null) ?? (/^\d{1,2}$/.test(t) && norm[i + 1]?.startsWith('hora') ? [t, t, undefined] : null)
    if (hora && !e.hora && Number(hora[1]) <= 23 && Number(hora[2] ?? 0) <= 59) {
      e.hora = `${String(Number(hora[1])).padStart(2, '0')}:${hora[2] ?? '00'}`
      consome(i)
      continue
    }

    // Dinheiro: "R$ 55", "r$55,90", "55 reais", "R$ 2.500", "R$ 1.234,56". Ponto seguido de TRÊS
    // dígitos é milhar (pt-BR) — sem isto "R$ 2.500" não era dinheiro nenhum (medido no teste do MI-6).
    const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`
    const ehValor = (x: string | undefined) => x !== undefined && new RegExp(`^(?:${NUM})$`).test(x)
    const numeroDinheiro =
      new RegExp(`^r\\$(${NUM})$`).exec(t)?.[1] ??
      (t === 'r$' && ehValor(norm[i + 1]) ? norm[i + 1] : undefined) ??
      (ehValor(t) && (norm[i + 1] === 'reais' || norm[i + 1] === 'real' || norm[i + 1] === 'conto') ? t : undefined)
    if (numeroDinheiro !== undefined) {
      const semMilhar = /^\d{1,3}(?:\.\d{3})+/.test(numeroDinheiro) ? numeroDinheiro.replace(/\./g, '') : numeroDinheiro
      const centavos = Math.round(Number(semMilhar.replace(',', '.')) * 100)
      e.valorCents ??= centavos
      e.valoresCents = [...(e.valoresCents ?? []), centavos]
      consome(i)
      if (t === 'r$' || ['reais', 'real', 'conto'].includes(norm[i + 1] ?? '')) consome(i + 1)
      continue
    }

    // Percentual: "10%", "10 por cento".
    const pct = /^(\d+(?:[.,]\d+)?)%$/.exec(t)?.[1] ?? (/^\d+(?:[.,]\d+)?$/.test(t) && norm[i + 1] === 'por' && norm[i + 2] === 'cento' ? t : undefined)
    if (pct !== undefined && e.percentualBps === undefined) {
      e.percentualBps = Math.round(Number(pct.replace(',', '.')) * 100)
      consome(i)
      if (norm[i + 1] === 'por') consome(i + 1, i + 2)
    }
  }

  // Período por frase fixa ("mês passado", "amanhã") — DEPOIS do laço: data e nome de mês
  // explícitos vencem o genérico ("no mês de agosto" é agosto, não o "no mês" corrente).
  for (const [frase, resolver] of PERIODOS_FIXOS) {
    if (e.periodo) break
    const palavras = frase.split(' ')
    for (let i = 0; i + palavras.length <= norm.length; i++) {
      if (palavras.every((p, j) => norm[i + j] === p)) {
        e.periodo = resolver(hoje)
        consome(...palavras.map((_, j) => i + j))
        break
      }
    }
  }

  // A palavra "de antes" pula o artigo: em "com a Juliana" o que importa é o "com" (profissional),
  // em "lança uma hidratação" é o verbo. Com o artigo no lugar, os dois viravam só "a"/"uma".
  const ARTIGOS = new Set(['a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas'])
  const antesDe = (i: number): string | null => {
    for (let j = i - 1; j >= 0; j--) if (!ARTIGOS.has(norm[j]!)) return norm[j]!
    return null
  }
  let ultimoDoResto = -2
  for (const [i, t] of tokens.entries()) {
    if (consumidos.has(i) || usadosPeloVocabulario.has(i) || PALAVRAS_VAZIAS.has(t.norm)) continue
    e.resto.push(t.original)
    if (i === ultimoDoResto + 1 && e.trechos.length > 0) e.trechos[e.trechos.length - 1]!.palavras.push(t.original)
    else e.trechos.push({ antes: antesDe(i), palavras: [t.original] })
    ultimoDoResto = i
  }
  return e
}

// ---------------------------------------------------------------------------------------------

export function entender(texto: string, hoje: Temporal.PlainDate): Entendimento {
  const tokens = tokenizar(texto)
  const { pontos, usados } = pontuar(tokens)
  const entidades = extrairEntidades(tokens, hoje, usados)

  const ranking = [...pontos.entries()].sort((a, b) => b[1] - a[1])
  const substantivas = ranking.filter(([i]) => !INTENCOES_DE_CORTESIA.has(i))

  if (substantivas.length === 0 || substantivas[0]![1] < PISO) {
    // Só cortesia ("oi", "o que você faz?") é resposta válida — o Motor se apresenta. Nada disso
    // e nada acima do piso é "não entendi", nunca um palpite.
    const cortesia = ranking.find(([i]) => INTENCOES_DE_CORTESIA.has(i))
    if (cortesia) {
      const ajuda = ranking.find(([i]) => i === 'ajuda')
      return { tipo: 'intencao', intencao: ajuda ? 'ajuda' : cortesia[0], pontos: cortesia[1], entidades }
    }
    return { tipo: 'nao_entendi', entidades }
  }

  const raciocinio = substantivas.find(([i]) => INTENCOES_DE_RACIOCINIO.has(i) && pontos.get(i)! >= PISO)
  const metricas = substantivas.filter(([i]) => !INTENCOES_DE_RACIOCINIO.has(i))
  if (raciocinio) {
    // "Por que o faturamento caiu?" — o porquê é a pergunta, o faturamento é o assunto. Não é
    // ambiguidade entre os dois; ambiguidade seria entre DUAS métricas empatadas como assunto.
    const [a, b] = metricas
    if (a && b && a[1] === b[1]) return { tipo: 'ambiguo', opcoes: [a[0], b[0]], entidades }
    return { tipo: 'intencao', intencao: raciocinio[0], pontos: raciocinio[1], ...(a ? { sobre: a[0] } : {}), entidades }
  }

  const [primeira, segunda] = substantivas
  if (segunda && segunda[1] === primeira![1]) return { tipo: 'ambiguo', opcoes: [primeira![0], segunda[0]], entidades }
  return { tipo: 'intencao', intencao: primeira![0], pontos: primeira![1], entidades }
}
