import { Temporal } from '@js-temporal/polyfill'

import { formatarTelefone } from '@/core/text/telefone'

/**
 * A fala do assistente, num lugar só (docs/85 §2.4).
 *
 * Estas frases nasceram nas respostas rápidas (`server/assistente/respostas-rapidas.ts`), cada uma
 * com uma regra de honestidade aprendida no susto: "atendeu", não "faturou"; "sobrou", não
 * "lucro"; "estimativa, não promessa"; agenda "fechada" não é agenda "vazia". O Motor de
 * Inteligência precisa dizer as MESMAS coisas — e duas cópias da mesma frase divergem com as duas
 * suítes verdes. Então a frase mora aqui, pura, e as duas portas chamam daqui: a resposta rápida
 * busca o dado e chama; o Motor recebe o dado da ferramenta e chama.
 *
 * Nada aqui busca dado, e nada aqui inventa número: tudo o que é dito vem dos parâmetros.
 */

// Formatador local, como em `core/pricing/formatar.ts`: `core/` não importa `@/lib` (guarda
// `core-nao-conhece-o-mundo`), e o formato é o do Intl, não uma regra nossa que possa divergir.
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const reais = (centavos: number) => dinheiro.format(centavos / 100)

// Limita a lista de nomes na frase: um tenant com 40 clientes atrasadas vira uma parede de texto.
const MAX_NOMES_NA_FRASE = 8

/** "A, B e C" — nunca "A, B, C" sem conectivo antes do último, que é como se fala em português. */
export function listarComE(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export function truncarLista(nomes: string[]): string {
  if (nomes.length <= MAX_NOMES_NA_FRASE) return listarComE(nomes)
  const restantes = nomes.length - MAX_NOMES_NA_FRASE
  return `${nomes.slice(0, MAX_NOMES_NA_FRASE).join(', ')} e mais ${restantes}`
}

const comMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ddmm = (d: Temporal.PlainDate) => `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}`
const DIAS = ['', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado', 'no domingo']

/** "hoje (29/09)", "amanhã (30/09)", "na sexta (02/10)", "em 15/11". */
export function rotuloDoDia(dia: Temporal.PlainDate, hoje: Temporal.PlainDate): string {
  const diff = hoje.until(dia, { largestUnit: 'days' }).days
  if (diff === 0) return `hoje (${ddmm(dia)})`
  if (diff === 1) return `amanhã (${ddmm(dia)})`
  if (diff === -1) return `ontem (${ddmm(dia)})`
  if (diff > 1 && diff < 7) return `${DIAS[dia.dayOfWeek]} (${ddmm(dia)})`
  return `em ${ddmm(dia)}`
}

const agendamentos = (n: number) => (n === 1 ? '1 agendamento marcado' : `${n} agendamentos marcados`)

// ---------------------------------------------------------------------------------------------

export function falarConfirmacoesDeHoje(pendentes: ReadonlyArray<{ nome: string; hora: string }>): string {
  if (pendentes.length === 0) return 'Ninguém falta confirmar hoje. Tudo certo!'
  const lista = pendentes.map((p) => `${p.nome} (${p.hora})`).join(', ')
  return pendentes.length === 1 ? `1 cliente falta confirmar hoje: ${lista}.` : `${pendentes.length} clientes faltam confirmar hoje: ${lista}.`
}

/*
  DIZ "ATENDEU", E NÃO "FATUROU". A soma é de `price_cents` dos atendimentos concluídos — preço de
  TABELA. Não enxerga desconto dado na comanda, item extra nem gorjeta: num dia com desconto, é
  MAIOR do que a pessoa recebeu. O dinheiro que entrou mora no caixa, e a frase aponta para lá.
*/
export function falarAtendidoHoje(centavos: number): string {
  return (
    `Você já atendeu ${reais(centavos)} hoje, somando o preço de ` +
    'tabela dos atendimentos concluídos. O que entrou de verdade, já com desconto e gorjeta, está no caixa.'
  )
}

/*
  A checagem de expediente vem ANTES do dia vazio, e essa ordem é o conserto de 2026-09-09.

  O conserto de 30/08 tratou o dia sem expediente que TEM agendamentos e deixou o irmão passar: com
  zero agendamentos, a resposta dizia "sua agenda está totalmente livre" num domingo em que o salão
  nem abre — e o dia fechado sem marcação é justamente o caso mais comum dos dois. "Livre" convida a
  marcar; "fechada" manda cadastrar o expediente.
*/
export function falarOcupacaoDoDia(o: { rotulo: string; quantidade: number; taxa: number; temExpediente: boolean }): string {
  const pct = Math.round(o.taxa * 100)
  if (!o.temExpediente) {
    if (o.quantidade === 0) {
      return `${comMaiuscula(o.rotulo)} não há expediente cadastrado: a agenda está fechada, não vazia. Dá para cadastrar o horário em Config, Horários.`
    }
    return `Sim, ${o.rotulo} você tem horário vago: ${agendamentos(o.quantidade)}. Não há expediente cadastrado para esse dia.`
  }
  // Agora sim: expediente cadastrado E nenhuma marcação. Aqui "livre" é verdade.
  if (o.quantidade === 0) return `Sim, ${o.rotulo} sua agenda está totalmente livre.`
  if (pct >= 100) return `Não, ${o.rotulo} sua agenda já está cheia (100% ocupada).`
  return `Sim, ${o.rotulo} você tem horário vago: ${agendamentos(o.quantidade)}, ${pct}% de ocupação.`
}

export function falarQuemChamarPrimeiro(primeiro: { nome: string; valorCents: number; diasAtrasado: number } | null): string {
  if (!primeiro) return 'Ninguém precisa ser chamado agora, a base inteira está em dia.'
  /*
    A fila é ordenada por lucro em risco, e quem está CHEGANDO na data (`due`) entra nela com
    `late_days` zero ou negativo. Medido no navegador em 29/09: "-2 dias sem voltar". Mesma régua da
    tela Recuperar (`lateDays > 0 ? "Nd de atraso" : "na janela"`).
  */
  if (primeiro.diasAtrasado <= 0) return `Chame primeiro ${primeiro.nome}: ${reais(primeiro.valorCents)} em risco, ainda na janela de voltar.`
  const dias = primeiro.diasAtrasado === 1 ? '1 dia' : `${primeiro.diasAtrasado} dias`
  return `Chame primeiro ${primeiro.nome}: ${reais(primeiro.valorCents)} em risco, ${dias} sem voltar.`
}

/*
  NÃO diz "você TEM R$ X parado". O total é `preço × chance de voltar` — ESTIMATIVA. A tela de
  Recuperar chama de "Dá para recuperar", com "estimativa, não promessa" logo abaixo; a frase
  espelha a tela: o mesmo verbo, a mesma ressalva.
*/
export function falarTotalParaRecuperar(quantidade: number, totalCents: number): string {
  if (quantidade === 0) return 'Ninguém para recuperar agora, toda a base está em dia.'
  const quantas = quantidade === 1 ? '1 pessoa' : `${quantidade} pessoas`
  return (
    `Dá para recuperar cerca de ${reais(totalCents)}, de ${quantas} que ` +
    'estão atrasadas. É estimativa, não promessa: o preço do serviço de cada uma, multiplicado pela chance de voltar.'
  )
}

// "cliente(s) sumida(s)" supunha que quem sumiu é mulher — o CICLO atende barbearia. `docs/20`
// §C.4: reescrever sem gênero, não alternar.
export function falarSumidosHaMaisDe(dias: number, nomes: string[]): string {
  if (nomes.length === 0) return `Ninguém sumiu há mais de ${dias} dias.`
  return `${nomes.length === 1 ? '1 pessoa sumiu' : `${nomes.length} pessoas sumiram`} há mais de ${dias} dias: ${truncarLista(nomes)}.`
}

/** `periodo`: "neste mês, até agora", "em agosto de 2026"... — quem chama sabe qual é. */
export function falarFaturamento(centavos: number, periodo: string): string {
  return `Você faturou ${reais(centavos)} ${periodo}.`
}

/*
  DIZ "SOBROU", NÃO "LUCRO", e as DUAS ressalvas são condicionais.

  "Sobrou" é receita menos material e comissão, menos a taxa da maquininha SE o dono disse quanto
  ela cobra, menos a hora de cadeira (aluguel e contas rateados, migration 0072) SE ele respondeu
  as três perguntas do custo fixo. A frase só diz que descontou o que foi descontado.

  2026-09-29: a versão anterior dizia SEMPRE "ainda não desconta o custo fixo" — verdade até a
  0072 (06/09), falsa desde então para quem respondeu. É a mesma armadilha que a da maquininha já
  tinha resolvido, e a fonte das duas condições é a mesma da tela do caixa.
*/
export function falarSobra(centavos: number, periodo: string, taxasRespondidas: boolean, custoFixoRespondido = false): string {
  const partes = ['material', ...(taxasRespondidas ? ['taxa da maquininha'] : []), 'comissão', ...(custoFixoRespondido ? ['a hora de cadeira (aluguel e contas)'] : [])]
  const ressalvas = [
    ...(custoFixoRespondido ? [] : ['Ainda não desconta o custo fixo.']),
    ...(taxasRespondidas ? [] : ['A maquininha ainda não entra na conta: você não disse quanto ela cobra.']),
  ]
  return `Sobrou ${reais(centavos)} ${periodo}, já descontado ${listarComE(partes)}.${ressalvas.length > 0 ? ` ${ressalvas.join(' ')}` : ''}`
}

export function falarOrcamentosSemResposta(nomes: string[]): string {
  if (nomes.length === 0) return 'Nenhum orçamento parado, todos já tiveram resposta.'
  return `${nomes.length === 1 ? '1 orçamento' : `${nomes.length} orçamentos`} sem resposta: ${truncarLista(nomes)}.`
}

// ---------------------------------------------------------------------------------------------
// Frases do Motor de Inteligência (docs/85 MI-2) — o que a conversa livre precisa além das 9
// respostas rápidas. Mesmas regras: número só dos parâmetros, sem supor gênero, sem travessão,
// começa pela resposta, nada de oferecer ajuda no fim.
// ---------------------------------------------------------------------------------------------

export function falarAgendaDeHoje(o: {
  proximo: { nome: string; hora: string } | null
  restantes: number
  pendentes: ReadonlyArray<{ nome: string; hora: string }>
  atendidoCents: number
}): string {
  const partes: string[] = []
  if (o.restantes === 0) partes.push('Não tem mais ninguém na agenda hoje.')
  else if (o.proximo) {
    const depois = o.restantes - 1
    partes.push(
      `A próxima pessoa é ${o.proximo.nome}, às ${o.proximo.hora}` +
        (depois === 0 ? ', e é a última de hoje.' : `, e depois ${depois === 1 ? 'vem mais 1' : `vêm mais ${depois}`}.`),
    )
  }
  if (o.pendentes.length > 0) partes.push(falarConfirmacoesDeHoje(o.pendentes))
  if (o.atendidoCents > 0) partes.push(`Até agora você atendeu ${reais(o.atendidoCents)}, a preço de tabela.`)
  return partes.join(' ')
}

export function falarPrimeirosParaRecuperar(quantidade: number, totalCents: number, primeiros: string[]): string {
  const base = falarTotalParaRecuperar(quantidade, totalCents)
  if (quantidade === 0 || primeiros.length === 0) return base
  return `${base} Comece por ${listarComE(primeiros.slice(0, 3))}.`
}

export function falarAlertasDeEstoque(itens: ReadonlyArray<{ nome: string; recomprar: boolean; vencendo: boolean; vencido: boolean }>): string {
  const recomprar = itens.filter((i) => i.recomprar).map((i) => i.nome)
  const vencidos = itens.filter((i) => i.vencido).map((i) => i.nome)
  const vencendo = itens.filter((i) => i.vencendo && !i.vencido).map((i) => i.nome)
  if (recomprar.length + vencidos.length + vencendo.length === 0) return 'Nenhum produto para recomprar nem perto de vencer.'
  const partes: string[] = []
  if (recomprar.length > 0) partes.push(`Para recomprar: ${truncarLista(recomprar)}.`)
  if (vencidos.length > 0) partes.push(`Vencido, não use: ${truncarLista(vencidos)}.`)
  if (vencendo.length > 0) partes.push(`Perto de vencer: ${truncarLista(vencendo)}.`)
  return partes.join(' ')
}

export function falarUltimaVisita(o: { nome: string; ultima: string | null; diasDesde: number | null; proxima: string | null; visitas: number }): string {
  const partes: string[] = []
  if (o.ultima === null) partes.push(`${o.nome} ainda não tem visita registrada.`)
  else {
    const ha = o.diasDesde === null ? '' : o.diasDesde === 0 ? ', hoje' : o.diasDesde === 1 ? ', há 1 dia' : `, há ${o.diasDesde} dias`
    partes.push(`${o.nome} veio pela última vez em ${o.ultima}${ha}.`)
  }
  if (o.visitas > 1) partes.push(`São ${o.visitas} visitas no total.`)
  if (o.proxima) partes.push(`Tem horário marcado ${o.proxima}.`)
  return partes.join(' ')
}

export function falarQuantoDeixou(nome: string, ltvCents: number, visitas: number): string {
  if (visitas === 0 || ltvCents === 0) return `${nome} ainda não tem atendimento pago registrado.`
  return `${nome} já deixou ${reais(ltvCents)} aqui, em ${visitas === 1 ? '1 visita' : `${visitas} visitas`}.`
}

/**
 * docs/84 P4: o costume, com a contagem que a ficha também mostra. Sem visita bastante, DIZ isso —
 * "ainda não dá para dizer" é resposta; inventar um hábito com 2 visitas não é.
 */
export function falarCostume(nome: string, frases: readonly string[]): string {
  if (frases.length === 0) return `${nome} ainda não veio vezes bastante para eu dizer um costume. Com 4 visitas concluídas já dá.`
  const [primeira, ...resto] = frases
  return `Sobre ${nome}: ${[primeira!.charAt(0).toLowerCase() + primeira!.slice(1), ...resto].join(' ')}`
}

export function falarTelefone(nome: string, telefone: string | null): string {
  return telefone ? `O telefone de ${nome} é ${formatarTelefone(telefone)}.` : `${nome} não tem telefone cadastrado.`
}

/** Empate: pergunta, nunca escolhe — a regra do `resolverPorNome` dita em voz alta. */
export function falarQualDelas(oQue: string, opcoes: string[]): string {
  return `Achei mais de uma opção de ${oQue}: ${truncarLista(opcoes)}. Qual delas?`
}

export function falarNaoAchei(oQue: string, termo: string, alternativas: string[] = []): string {
  const base = `Não achei ${oQue} "${termo}".`
  return alternativas.length > 0 ? `${base} Os que existem: ${truncarLista(alternativas)}.` : base
}

/**
 * "resolve" (docs/84 P2): quem manda é o dono, do PRÓPRIO número. O texto diz o nome do botão que
 * existe no cartão — "toque em confirmar" apontaria para um botão que não está lá.
 */
export function falarChamadaPronta(nome: string): string {
  return `Mensagem pronta${nome ? ` para ${nome}` : ''}. Toque em "Abrir no meu WhatsApp" para mandar do seu número. Nada foi enviado ainda.`
}

/**
 * A proposta vira cartão com botão; o texto só diz o que vai acontecer e quem decide. NUNCA "já
 * marquei": quem executa é o toque do dono (regra inegociável nº4 do docs/26).
 */
export function falarPropostaPronta(oQue: string, detalhe: string): string {
  return `${detalhe ? `${detalhe} ` : ''}Confira no cartão e toque em confirmar para ${oQue}. Nada foi feito ainda.`
}

// ---------------------------------------------------------------------------------------------
// MI-5 — "por que caiu?". "Valor médio por atendimento", nunca "ticket médio": é jargão.
// ---------------------------------------------------------------------------------------------

type LadoDaComparacao = { rotulo: string; atendimentos: number; receitaCents: number }

const aMaisOuAMenos = (cents: number) => `${reais(Math.abs(cents))} a ${cents < 0 ? 'menos' : 'mais'}`
const atendimentosTxt = (n: number) => (n === 1 ? '1 atendimento' : `${n} atendimentos`)

function porcento(bps: number): string {
  const p = Math.round(Math.abs(bps) / 100)
  return p === 0 ? 'menos de 1%' : `${p}%`
}

export function falarVariacao(o: {
  antes: LadoDaComparacao
  agora: LadoDaComparacao
  deltaCents: number
  deltaBps: number | null
  efeitoAtendimentosCents: number
  efeitoValorMedioCents: number
  valorMedioAntesCents: number
  valorMedioAgoraCents: number
}): string {
  const { antes, agora } = o
  if (antes.receitaCents === 0 && agora.receitaCents === 0) {
    return `Não houve comanda fechada de ${antes.rotulo} nem de ${agora.rotulo}, então não há o que comparar.`
  }
  if (antes.receitaCents === 0) {
    return `De ${agora.rotulo} entraram ${reais(agora.receitaCents)} em ${atendimentosTxt(agora.atendimentos)}. De ${antes.rotulo} não houve comanda fechada, então não dá para comparar.`
  }
  if (o.deltaCents === 0) return `Ficou igual: ${reais(agora.receitaCents)} de ${agora.rotulo} e de ${antes.rotulo}.`

  const verbo = o.deltaCents < 0 ? 'Caiu' : 'Subiu'
  const abertura = `${verbo} ${reais(Math.abs(o.deltaCents))} (${porcento(o.deltaBps ?? 0)}) de ${antes.rotulo} para ${agora.rotulo}: ${reais(agora.receitaCents)} contra ${reais(antes.receitaCents)}.`

  const porVolume = `o número de atendimentos: ${agora.atendimentos} contra ${antes.atendimentos} (${aMaisOuAMenos(o.efeitoAtendimentosCents)})`
  const porValor = `o valor médio por atendimento: ${reais(o.valorMedioAgoraCents)} contra ${reais(o.valorMedioAntesCents)} (${aMaisOuAMenos(o.efeitoValorMedioCents)})`
  const volumePesouMais = Math.abs(o.efeitoAtendimentosCents) >= Math.abs(o.efeitoValorMedioCents)
  const [principal, outro, efeitoOutro] = volumePesouMais ? [porVolume, porValor, o.efeitoValorMedioCents] : [porValor, porVolume, o.efeitoAtendimentosCents]

  // O fator menor só é citado se pesou (10% da diferença ou mais); senão, "praticamente igual".
  const complemento =
    Math.abs(efeitoOutro) * 10 >= Math.abs(o.deltaCents)
      ? ` Também mexeu ${outro}.`
      : volumePesouMais
        ? ' O valor médio por atendimento ficou praticamente igual.'
        : ' O número de atendimentos ficou praticamente igual.'
  return `${abertura} O que mais pesou foi ${principal}.${complemento}`
}

/**
 * O que só o CICLO consegue dizer: quem COSTUMA voltar nesta época e ainda não voltou (Motor de
 * Ciclo). "Dá para recuperar", estimativa e não promessa — a mesma regra de `falarTotalParaRecuperar`.
 */
export function falarQuemCostumaVoltar(quantidade: number, totalCents: number): string {
  if (quantidade === 0) return ''
  const quem = quantidade === 1 ? '1 pessoa que costuma voltar ainda não voltou' : `${quantidade} pessoas que costumam voltar ainda não voltaram`
  return `E ${quem}: dá para recuperar cerca de ${reais(totalCents)} (estimativa, não promessa).`
}

// ---------------------------------------------------------------------------------------------
// MI-6 — "e se...?". Três cenários e o empate, a premissa dita, e quem decide dito também.
// ---------------------------------------------------------------------------------------------

export function falarSimulacaoDePreco(o: {
  servico: string
  precoAtualCents: number
  precoNovoCents: number
  atendimentos: number
  dias: number
  receitaHojeCents: number
  cenarios: ReadonlyArray<{ perda: number; unidade: 'em_dez' | 'pessoas'; receitaCents: number; diferencaCents: number }>
  empateEmCem: number
  aumento: boolean
}): string {
  const base = `Hoje ${o.servico} custa ${reais(o.precoAtualCents)} e foram ${atendimentosTxt(o.atendimentos)} nos últimos ${o.dias} dias (${reais(o.receitaHojeCents)}).`
  const nome = (perda: number, unidade: 'em_dez' | 'pessoas') => {
    if (perda === 0) return o.aumento ? 'se todo mundo continuar vindo' : 'se não vier ninguém a mais'
    const n = Math.abs(perda)
    const verbo = o.aumento ? (n === 1 ? 'deixar de vir' : 'deixarem de vir') : n === 1 ? 'vier a mais' : 'vierem a mais'
    return unidade === 'em_dez' ? `se ${n} em cada 10 ${verbo}` : `se ${n === 1 ? '1 pessoa' : `${n} pessoas`} ${verbo}`
  }
  const cenarios = o.cenarios.map((c) => `${nome(c.perda, c.unidade)}, ${reais(c.receitaCents)} (${c.diferencaCents === 0 ? 'igual' : aMaisOuAMenos(c.diferencaCents)})`)
  const empate = o.aumento
    ? `Empata se até ${o.empateEmCem} em cada 100 deixarem de vir.`
    : `Para empatar, precisam vir ${o.empateEmCem} a mais em cada 100.`
  return `${base} A ${reais(o.precoNovoCents)}: ${cenarios.join('; ')}. ${empate} Quem decide o preço é você: eu não mudo nada.`
}

export function falarSimulacaoDeContratacao(
  o: { custoMensalCents: number; sobraPorAtendimentoCents: number; atendimentosParaSePagar: number; atendimentosHojePorMes: number } | null,
  custoMensalCents: number,
): string {
  if (!o) {
    return `Nos últimos 30 dias não sobrou nada por atendimento (ou não houve comanda fechada), então por essa conta nenhum volume paga ${reais(custoMensalCents)} por mês.`
  }
  const comparacao =
    o.atendimentosParaSePagar > o.atendimentosHojePorMes
      ? `mais do que o negócio inteiro faz hoje (${o.atendimentosHojePorMes} por mês)`
      : `${Math.round((o.atendimentosParaSePagar * 100) / Math.max(1, o.atendimentosHojePorMes))}% do que o negócio faz hoje (${o.atendimentosHojePorMes} por mês)`
  return (
    `Nos últimos 30 dias sobraram ${reais(o.sobraPorAtendimentoCents)} por atendimento, depois de material, comissão e o que mais o caixa já desconta. ` +
    `Para pagar ${reais(o.custoMensalCents)} por mês, a pessoa nova precisa trazer ${atendimentosTxt(o.atendimentosParaSePagar)} a mais por mês: ${comparacao}. ` +
    'A conta não inclui o tempo até a agenda dela encher.'
  )
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const noOuNa = (w: number) => (w === 0 || w === 6 ? 'no' : 'na')

/**
 * "E se eu abrir sábado?" com o único dado honesto que existe: quantas procuras caíram nesse dia
 * fechado (docs/84 §2.2). Nunca vira R$ — procura não é atendimento (docs/84 §7.1) — e zero
 * procura não prova que ninguém viria, só que ninguém procurou pela página.
 */
export function falarProcurasEmDiaFechado(weekday: number | null, porDia: ReadonlyArray<{ weekday: number; procuras: number }>): string {
  const alvo = weekday ?? [...porDia].sort((a, b) => b.procuras - a.procuras)[0]?.weekday ?? null
  if (alvo === null) {
    return 'Nos últimos 30 dias ninguém procurou horário em dia fechado pela sua página de agendamento. Isso não prova que ninguém viria: só que ninguém procurou por lá.'
  }
  const n = porDia.find((p) => p.weekday === alvo)?.procuras ?? 0
  const dia = `${noOuNa(alvo)} ${DIAS_DA_SEMANA[alvo]}`
  if (n === 0) {
    return `Nos últimos 30 dias ninguém procurou horário ${dia} pela sua página de agendamento. Isso não prova que ninguém viria: só que ninguém procurou por lá.`
  }
  return (
    `Nos últimos 30 dias, ${n === 1 ? '1 procura' : `${n} procuras`} ${dia} caíram sem horário na sua página de agendamento. ` +
    'Procura não é atendimento, então não viro isso em dinheiro: é o sinal para você pesar junto com o custo de abrir.'
  )
}
