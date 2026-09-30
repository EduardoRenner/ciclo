import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { entender, type Intencao } from '@/core/inteligencia/entender'

/**
 * Gabarito do MI-1 (docs/85 §2.1): frase como o dono escreve → o que o Motor tem que entender.
 *
 * Regra de manutenção: toda frase que o Motor errar entra AQUI, com a resposta certa, ANTES do
 * conserto. É assim que ele aprende sem IA — e é o que impede um conserto de desentender uma
 * frase que já funcionava.
 *
 * "Hoje" é fixo (terça, 29/09/2026): teste que lê o relógio passa 28 dias por mês — o C-07 do
 * clube quebrou exatamente assim neste mesmo dia.
 */
const HOJE = Temporal.PlainDate.from('2026-09-29')

const GABARITO: ReadonlyArray<readonly [string, Intencao]> = [
  // As 9 respostas rápidas, ditas do jeito que se fala.
  ['quem eu preciso confirmar hoje?', 'agenda_de_hoje'],
  ['quanto atendi hoje?', 'agenda_de_hoje'],
  ['tem horário vago amanhã?', 'ocupacao'],
  ['quem eu chamo primeiro?', 'quem_sumiu'],
  ['quanto dinheiro parado eu tenho?', 'quem_sumiu'],
  ['quem sumiu faz mais de 60 dias?', 'quem_sumiu'],
  ['quanto faturei este mês?', 'faturamento'],
  ['quanto sobrou no mês?', 'sobra'],
  ['tem orçamento sem resposta?', 'orcamentos'],
  // As ferramentas de leitura.
  ['como tá o meu dia?', 'agenda_de_hoje'],
  ['quem é a próxima cliente?', 'agenda_de_hoje'],
  ['quem parou de vir?', 'quem_sumiu'],
  ['quais clientes não voltaram', 'quem_sumiu'],
  ['quem passou da hora de voltar', 'quem_sumiu'],
  ['quando a Maria veio pela última vez?', 'historico_cliente'],
  ['qual o telefone da Joana', 'historico_cliente'],
  ['quanto entrou em agosto?', 'faturamento'],
  ['quanto ganhei semana passada', 'faturamento'],
  ['qual foi meu lucro do mês passado?', 'sobra'],
  ['quanto ficou no bolso depois dos custos', 'sobra'],
  ['sobrou horário na sexta?', 'ocupacao'],
  ['a agenda de quinta tá cheia?', 'ocupacao'],
  ['tem vaga sábado?', 'ocupacao'],
  ['quais orçamentos estão parados', 'orcamentos'],
  ['o que tá acabando no estoque?', 'estoque'],
  ['tem produto perto de vencer?', 'estoque'],
  // As que preparam proposta.
  ['marca a Joana amanhã às 15h pra escova', 'agendar'],
  ['agenda a Bia na quinta 10h corte', 'agendar'],
  ['marca como atendida a Carla', 'concluir_atendimento'],
  ['terminei a Paula', 'concluir_atendimento'],
  ['cadastra a Renata 11 98765-4321', 'cadastrar_cliente'],
  ['cliente nova: Luana', 'cadastrar_cliente'],
  ['lança uma hidratação na comanda da Ana', 'item_na_comanda'],
  ['anota na ficha da Sofia que ela prefere a tarde', 'nota_na_ficha'],
  // Raciocínio.
  ['por que o faturamento caiu?', 'por_que'],
  ['pq caiu esse mês', 'por_que'],
  ['e se eu aumentar o corte pra R$ 60?', 'simular'],
  ['vale a pena contratar mais uma pessoa?', 'simular'],
  // Cortesia.
  ['oi', 'saudacao'],
  ['bom dia!', 'saudacao'],
  ['valeu!', 'saudacao'],
  ['obrigada, era isso', 'saudacao'],
  ['o que você sabe fazer?', 'ajuda'],
  // Cortesia NÃO sequestra a pergunta de verdade.
  ['bom dia, quem sumiu?', 'quem_sumiu'],
  // Vieram da primeira sonda (29/09), com frases que o gabarito ainda não tinha: 9 de 31 entendidas,
  // nenhuma errada. As lacunas de vocabulário viraram estas linhas antes do conserto.
  ['quanto eu fiz hoje', 'faturamento'],
  ['como foi o mês', 'faturamento'],
  ['quem não aparece faz tempo', 'quem_sumiu'],
  ['quem tá devendo visita', 'quem_sumiu'],
  ['tem alguém pra hoje à tarde?', 'agenda_de_hoje'],
  ['agenda', 'agenda_de_hoje'],
  ['quanto a Maria já gastou comigo', 'historico_cliente'],
  ['quanto tempo a Bia não vem', 'historico_cliente'],
  ['que dia a Maria costuma vir', 'historico_cliente'],
  ['resolve', 'chamar_de_volta'],
  ['faz isso', 'chamar_de_volta'],
  ['chama a Maria', 'chamar_de_volta'],
  ['manda mensagem pra Joana', 'chamar_de_volta'],
  ['quem eu preciso chamar de volta', 'quem_sumiu'],
  ['com quem a Joana costuma fazer', 'historico_cliente'],
  ['de quanto em quanto tempo a Bia volta', 'historico_cliente'],
  ['qual dia da semana é mais fraco', 'ocupacao'],
]

/**
 * O limite honesto (docs/85 §5): pedidos que NENHUMA ferramenta atende hoje. "Não entendi" é a
 * resposta CERTA para eles — melhor que fingir. Quando uma ferramenta nova chegar, a frase sai
 * daqui e entra no gabarito acima, com a intenção nova: a mudança fica explícita, não acidental.
 */
const FORA_DO_ALCANCE_HOJE = [
  'desmarca a Joana',
  'cancela o horário da Bia',
  'quanto custa o corte',
  'aumenta o preço do corte',
  'quem faz aniversário essa semana',
  'manda um lembrete pra todo mundo',
  'qual serviço mais vende',
  'quantos clientes eu tenho',
]

describe('entender — gabarito', () => {
  it.each(GABARITO)('"%s" → %s', (frase, esperado) => {
    const r = entender(frase, HOJE)
    expect(r.tipo, JSON.stringify(r)).toBe('intencao')
    expect(r.tipo === 'intencao' ? r.intencao : null).toBe(esperado)
  })
})

describe('entender — não chuta', () => {
  it.each(FORA_DO_ALCANCE_HOJE)('"%s" → não entendi (nenhuma ferramenta atende ainda)', (frase) => {
    expect(entender(frase, HOJE).tipo).toBe('nao_entendi')
  })

  it('frase fora do domínio é "não entendi", nunca um palpite', () => {
    expect(entender('qual a capital da França?', HOJE).tipo).toBe('nao_entendi')
    expect(entender('me conta uma piada', HOJE).tipo).toBe('nao_entendi')
    expect(entender('', HOJE).tipo).toBe('nao_entendi')
  })

  it('uma palavra fraca sozinha não basta: abaixo do piso é "não entendi", não o palpite mais perto', () => {
    // "dinheiro" pesa 1 em faturamento — mas pode ser dinheiro parado, no caixa, a receber. Sem o
    // piso, o Motor responderia faturamento com toda a confiança.
    expect(entender('e o dinheiro?', HOJE).tipo).toBe('nao_entendi')
  })

  it('duas métricas empatadas viram pergunta com as duas opções', () => {
    const r = entender('quanto faturei e quanto sobrou?', HOJE)
    expect(r.tipo).toBe('ambiguo')
    expect(r.tipo === 'ambiguo' ? [...r.opcoes].sort() : []).toEqual(['faturamento', 'sobra'])
  })

  it('"sobrou horário" é ocupação: a frase mais longa consome a palavra antes do "sobrou" de lucro', () => {
    const r = entender('sobrou horário amanhã?', HOJE)
    expect(r).toMatchObject({ tipo: 'intencao', intencao: 'ocupacao' })
  })

  it('"por que o faturamento caiu" não é ambíguo: o porquê é a pergunta, o faturamento é o assunto', () => {
    expect(entender('por que o faturamento caiu?', HOJE)).toMatchObject({ tipo: 'intencao', intencao: 'por_que', sobre: 'faturamento' })
  })
})

describe('entender — período', () => {
  const periodo = (frase: string) => entender(frase, HOJE).entidades.periodo

  it('dias relativos', () => {
    expect(periodo('tem horário vago amanhã?')).toEqual({ tipo: 'dia', data: '2026-09-30' })
    expect(periodo('quanto atendi ontem')).toEqual({ tipo: 'dia', data: '2026-09-28' })
    expect(periodo('quem vem depois de amanhã')).toEqual({ tipo: 'dia', data: '2026-10-01' })
    expect(periodo('quanto atendi hoje?')).toEqual({ tipo: 'dia', data: '2026-09-29' })
  })

  it('semana começa na segunda', () => {
    expect(periodo('quanto ganhei semana passada')).toEqual({ tipo: 'intervalo', inicio: '2026-09-21', fim: '2026-09-27' })
    expect(periodo('tem vaga essa semana?')).toEqual({ tipo: 'intervalo', inicio: '2026-09-28', fim: '2026-10-04' })
  })

  it('mês relativo, e mês pelo nome sem ano é o mais recente que não está no futuro', () => {
    expect(periodo('quanto faturei este mês?')).toEqual({ tipo: 'mes', mes: '2026-09' })
    expect(periodo('qual foi meu lucro do mês passado?')).toEqual({ tipo: 'mes', mes: '2026-08' })
    expect(periodo('quanto entrou em agosto?')).toEqual({ tipo: 'mes', mes: '2026-08' })
    expect(periodo('quanto entrou em novembro?')).toEqual({ tipo: 'mes', mes: '2025-11' })
    expect(periodo('quanto entrou em agosto de 2025?')).toEqual({ tipo: 'mes', mes: '2025-08' })
  })

  it('nome de mês explícito vence o genérico "no mês"', () => {
    expect(periodo('quanto entrou no mês de agosto?')).toEqual({ tipo: 'mes', mes: '2026-08' })
  })

  it('"marco" sozinho é o verbo, não março', () => {
    expect(periodo('marco a Joana amanhã')).toEqual({ tipo: 'dia', data: '2026-09-30' })
    expect(periodo('quanto entrou em março?')).toEqual({ tipo: 'mes', mes: '2026-03' })
  })

  it('dia da semana é o próximo (hoje conta); com "passada" é o anterior', () => {
    expect(periodo('sobrou horário na sexta?')).toEqual({ tipo: 'dia', data: '2026-10-02' })
    expect(periodo('tem vaga terça?')).toEqual({ tipo: 'dia', data: '2026-09-29' })
    expect(periodo('quanto atendi sexta passada')).toEqual({ tipo: 'dia', data: '2026-09-25' })
    expect(periodo('tem vaga segunda-feira?')).toEqual({ tipo: 'dia', data: '2026-10-05' })
  })

  it('"segunda" sem feira nem preposição não vira dia ("segunda vez")', () => {
    expect(periodo('é a segunda vez que ela falta')).toBeUndefined()
  })

  it('dd/mm é dia-mês; data impossível não vira outro dia', () => {
    expect(periodo('tem vaga 03/10?')).toEqual({ tipo: 'dia', data: '2026-10-03' })
    expect(periodo('tem vaga 31/02?')).toBeUndefined()
  })
})

describe('entender — hora, dinheiro, percentual e o resto', () => {
  it('hora em vários formatos', () => {
    expect(entender('marca a Joana amanhã às 15h', HOJE).entidades.hora).toBe('15:00')
    expect(entender('agenda a Bia 9h30', HOJE).entidades.hora).toBe('09:30')
    expect(entender('marca a Bia 14:15', HOJE).entidades.hora).toBe('14:15')
    expect(entender('marca a Bia às 10', HOJE).entidades.hora).toBe('10:00')
  })

  it('dinheiro em centavos, percentual em basis points', () => {
    expect(entender('e se eu aumentar o corte pra R$ 60?', HOJE).entidades.valorCents).toBe(6000)
    expect(entender('e se o corte custar 55,90 reais', HOJE).entidades.valorCents).toBe(5590)
    expect(entender('e se eu aumentar 10%', HOJE).entidades.percentualBps).toBe(1000)
    // Milhar com ponto, como todo mundo escreve (achado no teste do MI-6: "R$ 2.500" não era valor).
    expect(entender('e se eu contratar alguém por R$ 2.500?', HOJE).entidades.valorCents).toBe(250_000)
    expect(entender('custa R$ 1.234,56', HOJE).entidades.valorCents).toBe(123_456)
    expect(entender('pra R$ 55.90', HOJE).entidades.valorCents).toBe(5_590)
    expect(entender('de R$ 45 para R$ 55', HOJE).entidades.valoresCents).toEqual([4_500, 5_500])
    expect(entender('e se eu aumentar 7,5 por cento', HOJE).entidades.percentualBps).toBe(750)
  })

  it('o resto guarda o nome na grafia original, sem as palavras vazias nem o que já foi entendido', () => {
    expect(entender('quando a Maria Conceição veio pela última vez?', HOJE).entidades.resto).toEqual(['Maria', 'Conceição'])
    expect(entender('marca a Joana amanhã às 15h pra escova', HOJE).entidades.resto).toEqual(['Joana', 'escova'])
    expect(entender('quem não aparece faz tempo', HOJE).entidades.resto).toEqual([])
  })

  it('trechos: o resto agrupado com a palavra de antes (pulando o artigo), que é o que separa quem de quê', () => {
    expect(entender('lança uma hidratação na comanda da Ana', HOJE).entidades.trechos).toEqual([
      { antes: 'lanca', palavras: ['hidratação'] },
      { antes: 'da', palavras: ['Ana'] },
    ])
    expect(entender('marca a Joana amanhã às 15h pra escova', HOJE).entidades.trechos).toEqual([
      { antes: 'marca', palavras: ['Joana'] },
      { antes: 'pra', palavras: ['escova'] },
    ])
    expect(entender('quando a Maria Conceição veio pela última vez?', HOJE).entidades.trechos).toEqual([{ antes: 'quando', palavras: ['Maria', 'Conceição'] }])
    // O motivo de pular o artigo: com ele, "com a Juliana" gravava "a" e a profissional se perdia.
    expect(entender('marca a Olívia amanhã às 15h pra manicure com a Juliana', HOJE).entidades.trechos).toContainEqual({ antes: 'com', palavras: ['Juliana'] })
  })
})
