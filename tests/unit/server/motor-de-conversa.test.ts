import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it, vi } from 'vitest'

import { FERRAMENTAS, type ContextoFerramenta, type Ferramenta } from '@/server/assistente/ferramentas'
import { responder } from '@/server/providers/ai/motor'
import { executarLaco } from '@/server/services/assistente'

import type { AiProvider } from '@/server/providers/ai/types'

/**
 * MI-2 (docs/85): o Motor de Inteligência no laço DE VERDADE (`executarLaco`), com o catálogo DE
 * VERDADE de ferramentas — mesmos esquemas Zod, mesmas permissões — e só o `executar` trocado por
 * um dublê que devolve a forma real de cada serviço. Se o Motor montar um argumento que o esquema
 * real recusa, o laço recusa aqui também.
 *
 * "Hoje" é fixo (terça, 29/09/2026): a mesma pergunta no mesmo dia dá a mesma resposta.
 */
const HOJE = Temporal.PlainDate.from('2026-09-29')
const TZ = 'America/Sao_Paulo'
const CTX: ContextoFerramenta = { db: {} as never, tenantId: 't1', timezone: TZ }

const motor: AiProvider = { perguntar: async (pedido) => responder(pedido, TZ, HOJE) }

type Dubles = Record<string, (args: Record<string, unknown>) => unknown>

function catalogo(dubles: Dubles, so?: string[]): { ferramentas: Ferramenta[]; chamadas: { nome: string; args: Record<string, unknown> }[] } {
  const chamadas: { nome: string; args: Record<string, unknown> }[] = []
  const ferramentas = FERRAMENTAS.filter((f) => !so || so.includes(f.nome)).map((f) => ({
    ...f,
    executar: vi.fn(async (_ctx: ContextoFerramenta, args: unknown) => {
      chamadas.push({ nome: f.nome, args: args as Record<string, unknown> })
      const duble = dubles[f.nome]
      if (!duble) throw new Error(`o teste não esperava ${f.nome}`)
      return duble(args as Record<string, unknown>)
    }),
  }))
  return { ferramentas, chamadas }
}

const perguntar = (pergunta: string, ferramentas: Ferramenta[], contexto?: unknown) => executarLaco({ provider: motor, ferramentas, ctxFerramenta: CTX, pergunta, contexto })

const RECUPERAR = {
  count: 3,
  totalValueCents: 21_000,
  totalProfitCents: 9_000,
  items: [
    { name: 'Carla', valueCents: 8_000, lateDays: 12 },
    { name: 'Beto', valueCents: 7_000, lateDays: 70 },
    { name: 'Dani', valueCents: 6_000, lateDays: 90 },
  ],
}

describe('Motor no laço de verdade — leitura', () => {
  it('"quem eu chamo primeiro?" consulta a lista e responde pelo primeiro, com o número dela', async () => {
    const { ferramentas, chamadas } = catalogo({ clientes_para_recuperar: () => RECUPERAR })
    const r = await perguntar('quem eu chamo primeiro?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['clientes_para_recuperar'])
    expect(r.resposta).toBe('Chame primeiro Carla: R$ 80,00 em risco, 12 dias sem voltar.')
  })

  it('"quem sumiu faz mais de 60 dias?" filtra pelo número que a pessoa disse', async () => {
    const { ferramentas } = catalogo({ clientes_para_recuperar: () => RECUPERAR })
    expect((await perguntar('quem sumiu faz mais de 60 dias?', ferramentas)).resposta).toBe('2 pessoas sumiram há mais de 60 dias: Beto e Dani.')
  })

  it('"tem horário vago amanhã?" pede o dia CERTO e, com o dia fechado, diz fechada — nunca livre', async () => {
    const { ferramentas, chamadas } = catalogo({
      ocupacao_do_dia: (a) => ({ data: a.data, quantidadeDeAgendamentos: 0, taxaDeOcupacao: 0, temExpedienteCadastrado: false, previstoCents: 0 }),
    })
    const r = await perguntar('tem horário vago amanhã?', ferramentas)
    expect(chamadas).toEqual([{ nome: 'ocupacao_do_dia', args: { data: '2026-09-30' } }])
    expect(r.resposta).toMatch(/^Amanhã \(30\/09\) não há expediente cadastrado: a agenda está fechada/)
  })

  it('"quanto sobrou no mês passado?" pede agosto e não diz que descontou a maquininha quando não descontou', async () => {
    const { ferramentas, chamadas } = catalogo({
      faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 100_000, profitCents: 40_000, taxasRespondidas: false }),
    })
    const r = await perguntar('quanto sobrou no mês passado?', ferramentas)
    expect(chamadas).toEqual([{ nome: 'faturamento_do_periodo', args: { mes: '2026-08' } }])
    expect(r.resposta).toMatch(/^Sobrou R\$ 400,00 em agosto de 2026, já descontado material e comissão\./)
    expect(r.resposta).toMatch(/A maquininha ainda não entra na conta/)
    expect(r.resposta).not.toMatch(/lucro/i)
  })

  it('resultado sem `taxasRespondidas`: na dúvida, NÃO diz que a maquininha foi descontada', async () => {
    // Achado mutando (29/09): o caso de cima sempre mandava o campo, então trocar o padrão de
    // `false` para `true` passava verde. Sem saber, a frase conservadora é a única honesta.
    const { ferramentas } = catalogo({ faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 100_000, profitCents: 40_000 }) })
    const r = await perguntar('quanto sobrou este mês?', ferramentas)
    expect(r.resposta).not.toMatch(/taxa da maquininha/)
    expect(r.resposta).toMatch(/A maquininha ainda não entra na conta/)
  })

  it('custo fixo respondido chega à frase pela ferramenta: "sobrou" não diz mais que falta o custo fixo', async () => {
    const { ferramentas } = catalogo({
      faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 1, profitCents: 40_000, taxasRespondidas: true, custoFixoRespondido: true }),
    })
    const r = await perguntar('quanto sobrou este mês?', ferramentas)
    expect(r.resposta).toMatch(/a hora de cadeira \(aluguel e contas\)\.$/)
    expect(r.resposta).not.toMatch(/Ainda não desconta/)
  })

  it('pergunta por semana ganha o mês inteiro COM aviso, nunca um número de mês fingindo ser da semana', async () => {
    const { ferramentas } = catalogo({ faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 100_000, profitCents: 0 }) })
    expect((await perguntar('quanto ganhei semana passada', ferramentas)).resposta).toMatch(/^Por semana eu ainda não separo, então vai o mês inteiro\. Você faturou/)
  })

  it('"quanto entrou hoje" responde o ATENDIDO, com o nome certo — não faturamento', async () => {
    const { ferramentas } = catalogo({ resumo_de_hoje: () => ({ revenueTodayCents: 45_000, nextClient: null, restOfDay: [], alerts: [], stockAlerts: [] }) })
    const r = await perguntar('quanto entrou hoje?', ferramentas)
    expect(r.resposta).toMatch(/^Você já atendeu R\$ 450,00 hoje/)
    expect(r.resposta).not.toMatch(/fatur/)
  })

  it('histórico em dois passos: acha a pessoa, abre a ficha, conta a última visita', async () => {
    const { ferramentas, chamadas } = catalogo({
      buscar_cliente: () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Maria Silva' }],
      historico_do_cliente: () => ({
        cliente: { name: 'Maria Silva', visits_count: 4, last_visit_at: '2026-09-10T13:00:00Z', ltv_cents: 32_000, phone_e164: '+5511987654321' },
        ultimosAgendamentos: [{ starts_at: '2026-10-02T17:00:00Z', status: 'confirmed' }, { starts_at: '2026-09-10T13:00:00Z', status: 'done' }],
      }),
    })
    const r = await perguntar('quando a Maria veio pela última vez?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['buscar_cliente', 'historico_do_cliente'])
    expect(chamadas[0]!.args).toEqual({ termo: 'Maria' })
    expect(r.resposta).toBe('Maria Silva veio pela última vez em 10/09/2026, há 19 dias. São 4 visitas no total. Tem horário marcado na sexta (02/10) às 14:00.')
  })

  it('"que dia a Maria costuma vir?": a memória da ficha, dita com a contagem (docs/84 P4)', async () => {
    const { ferramentas, chamadas } = catalogo({
      buscar_cliente: () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Maria Silva' }],
      historico_do_cliente: () => ({
        cliente: { name: 'Maria Silva', visits_count: 7 },
        ultimosAgendamentos: [],
        memoria: ['Costuma vir às terças (5 de 7 visitas).', 'Quase sempre com Ana (6 de 7 visitas).', 'Costuma voltar entre 21 e 28 dias.'],
      }),
    })
    const r = await perguntar('que dia a Maria costuma vir?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['buscar_cliente', 'historico_do_cliente'])
    expect(r.resposta).toBe('Sobre Maria Silva: costuma vir às terças (5 de 7 visitas). Quase sempre com Ana (6 de 7 visitas). Costuma voltar entre 21 e 28 dias.')
    // "com quem" cai no mesmo lugar.
    expect((await perguntar('com quem a Maria costuma ser atendida?', ferramentas)).resposta).toMatch(/^Sobre Maria Silva: /)
  })

  it('sem visita bastante, DIZ isso — não inventa costume', async () => {
    const { ferramentas } = catalogo({
      buscar_cliente: () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Maria Silva' }],
      historico_do_cliente: () => ({ cliente: { name: 'Maria Silva', visits_count: 2 }, ultimosAgendamentos: [], memoria: [] }),
    })
    expect((await perguntar('que dia a Maria costuma vir?', ferramentas)).resposta).toBe(
      'Maria Silva ainda não veio vezes bastante para eu dizer um costume. Com 4 visitas concluídas já dá.',
    )
  })

  it('duas Marias: pergunta qual, e NÃO abre ficha nenhuma', async () => {
    const { ferramentas, chamadas } = catalogo({
      buscar_cliente: () => [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Maria Silva' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Maria Souza' },
      ],
    })
    const r = await perguntar('quando a Maria veio pela última vez?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['buscar_cliente'])
    expect(r.resposta).toBe('Achei mais de uma opção de pessoa: Maria Silva e Maria Souza. Qual delas?')
  })
})

describe('Motor — "resolve" (docs/84 P2): a chamada de volta, que o dono manda do próprio WhatsApp', () => {
  const CARLA = '33333333-3333-4333-8333-333333333333'
  const LISTA = { ...RECUPERAR, items: RECUPERAR.items.map((i, n) => ({ ...i, clientId: n === 0 ? CARLA : `4444444${n}-4444-4444-8444-444444444444` })) }
  const PROPOSTA = (nome: string) => ({
    status: 'proposta',
    acao: 'chamar_de_volta',
    dados: { clientId: CARLA, serviceId: CARLA, telefone: '+5511987654321', mensagem: `Oi, ${nome}!` },
    resumo: { cliente: nome, servico: 'Corte', Mensagem: `Oi, ${nome}!` },
  })

  it('"quem eu chamo primeiro?" → "resolve": prepara para a MESMA pessoa que a resposta nomeou', async () => {
    const { ferramentas, chamadas } = catalogo({ clientes_para_recuperar: () => LISTA, preparar_chamada_de_volta: () => PROPOSTA('Carla') })
    const r1 = await perguntar('quem eu chamo primeiro?', ferramentas)
    expect(r1.resposta).toMatch(/^Chame primeiro Carla/)
    const r2 = await perguntar('resolve', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.nome)).toEqual(['clientes_para_recuperar', 'clientes_para_recuperar', 'preparar_chamada_de_volta'])
    expect(chamadas.at(-1)!.args).toEqual({ clientId: CARLA })
    expect(r2.proposta?.acao, 'sem proposta não há botão').toBe('chamar_de_volta')
    expect(r2.resposta).toBe('Mensagem pronta para Carla. Toque em "Abrir no meu WhatsApp" para mandar do seu número. Nada foi enviado ainda.')
  })

  it('"faz isso" e "chama ela" valem o mesmo', async () => {
    for (const frase of ['faz isso', 'chama ela']) {
      const { ferramentas, chamadas } = catalogo({ clientes_para_recuperar: () => LISTA, preparar_chamada_de_volta: () => PROPOSTA('Carla') })
      const r1 = await perguntar('quem eu chamo primeiro?', ferramentas)
      await perguntar(frase, ferramentas, r1.contexto)
      expect(chamadas.at(-1), frase).toEqual({ nome: 'preparar_chamada_de_volta', args: { clientId: CARLA } })
    }
  })

  it('depois da ficha de alguém, "chama ela" é aquela pessoa, pelo id', async () => {
    const MARIA = '11111111-1111-4111-8111-111111111111'
    const { ferramentas, chamadas } = catalogo({
      buscar_cliente: () => [{ id: MARIA, name: 'Maria Silva' }],
      historico_do_cliente: () => ({ cliente: { name: 'Maria Silva' }, ultimosAgendamentos: [] }),
      preparar_chamada_de_volta: () => PROPOSTA('Maria Silva'),
    })
    const r1 = await perguntar('quando a Maria veio pela última vez?', ferramentas)
    await perguntar('chama ela', ferramentas, r1.contexto)
    expect(chamadas.at(-1)).toEqual({ nome: 'preparar_chamada_de_volta', args: { clientId: MARIA } })
  })

  it('"chama a Maria" / "manda mensagem pra Joana": direto, pelo nome', async () => {
    const { ferramentas, chamadas } = catalogo({ preparar_chamada_de_volta: () => PROPOSTA('Maria') })
    await perguntar('chama a Maria', ferramentas)
    await perguntar('manda mensagem pra Joana', ferramentas)
    await perguntar('chama a Bia de volta', ferramentas)
    expect(chamadas.map((c) => c.args)).toEqual([{ cliente: 'Maria' }, { cliente: 'Joana' }, { cliente: 'Bia' }])
  })

  it('"resolve" sem nada antes: pergunta quem, e não chama ferramenta nenhuma', async () => {
    const { ferramentas, chamadas } = catalogo({})
    const r = await perguntar('resolve', ferramentas)
    expect(chamadas).toEqual([])
    expect(r.resposta).toMatch(/^Chamar quem\?/)
  })

  it('lista vazia: diz que não há quem chamar — nunca prepara para ninguém', async () => {
    const { ferramentas, chamadas } = catalogo({ clientes_para_recuperar: () => ({ count: 0, totalValueCents: 0, totalProfitCents: 0, items: [] }) })
    const r1 = await perguntar('quem eu chamo primeiro?', ferramentas)
    const r2 = await perguntar('resolve', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.nome)).not.toContain('preparar_chamada_de_volta')
    expect(r2.resposta).toBe('Ninguém passou da hora de voltar agora. Não há quem chamar.')
  })

  it('fora da lista e pediu para parar: diz o porquê, sem cartão', async () => {
    const fora = catalogo({ preparar_chamada_de_volta: () => ({ status: 'nao_da', motivo: 'fora_da_lista', cliente: 'Rita' }) })
    const r1 = await perguntar('chama a Rita', fora.ferramentas)
    expect(r1.resposta).toBe('Rita não está na lista de quem passou da hora de voltar: pode estar em dia, ou ainda sem ritmo medido.')
    expect(r1.proposta).toBeUndefined()
    const parou = catalogo({ preparar_chamada_de_volta: () => ({ status: 'nao_da', motivo: 'pediu_para_nao_receber', cliente: 'Rita' }) })
    expect((await perguntar('chama a Rita', parou.ferramentas)).resposta).toBe('Rita pediu para não receber mensagem. Não preparei nada.')
  })
})

describe('Motor no laço de verdade — preparo (nunca executa)', () => {
  it('"marca a Joana amanhã às 15h pra escova": prepara com os argumentos certos, o cartão sai, e o texto não diz que marcou', async () => {
    const { ferramentas, chamadas } = catalogo({
      preparar_agendamento: () => ({
        status: 'proposta',
        acao: 'criar_agendamento',
        dados: { clientId: 'x', serviceId: 'y', professionalId: 'z', startsAt: '2026-09-30T18:00:00Z' },
        resumo: { cliente: 'Joana Lima', servico: 'Escova', profissional: 'Rê', quando: '2026-09-30T15:00', precoCents: 6_000, duracaoMin: 45 },
      }),
    })
    const r = await perguntar('marca a Joana amanhã às 15h pra escova', ferramentas)
    expect(chamadas).toEqual([{ nome: 'preparar_agendamento', args: { cliente: 'Joana', servico: 'escova', quando: '2026-09-30T15:00' } }])
    expect(r.proposta?.acao, 'sem proposta não há botão para confirmar').toBe('criar_agendamento')
    expect(r.resposta).toBe('Joana Lima, Escova, amanhã (30/09) às 15:00 com Rê, R$ 60,00. Confira no cartão e toque em confirmar para marcar. Nada foi feito ainda.')
    expect(r.resposta).not.toMatch(/marquei|agendei|já está marcad/i)
  })

  it('"com a Juliana" vira a profissional, e não parte do nome do serviço (medido no navegador, 29/09)', async () => {
    const { ferramentas, chamadas } = catalogo({ preparar_agendamento: () => ({ status: 'nao_achei', oQue: 'servico', termo: 'x' }) })
    await perguntar('marca a Olívia amanhã às 15h pra manicure com a Juliana', ferramentas)
    expect(chamadas[0]!.args).toEqual({ cliente: 'Olívia', servico: 'manicure', quando: '2026-09-30T15:00', profissional: 'Juliana' })
  })

  it('"qual profissional?" ensina a responder: sem contexto curto, pedir de novo com o nome é o que funciona', async () => {
    const { ferramentas } = catalogo({ preparar_agendamento: () => ({ status: 'qual_delas', oQue: 'profissional', opcoes: ['Juliana Castro', 'Tatiane Moreira'] }) })
    expect((await perguntar('marca a Olívia amanhã às 15h pra manicure', ferramentas)).resposta).toBe(
      'Achei mais de uma opção de profissional: Juliana Castro e Tatiane Moreira. Qual delas? É só pedir de novo com o nome, por exemplo: "... com a Juliana Castro".',
    )
  })

  it('telefone sai no formato que se lê, não em E.164 cru (medido no navegador, 29/09)', async () => {
    const { ferramentas } = catalogo({
      buscar_cliente: () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Olívia Rangel' }],
      historico_do_cliente: () => ({ cliente: { name: 'Olívia Rangel', phone_e164: '+5511930044014' }, ultimosAgendamentos: [] }),
    })
    expect((await perguntar('qual o telefone da Olívia', ferramentas)).resposta).toBe('O telefone de Olívia Rangel é (11) 93004-4014.')
  })

  it('falta a hora: pergunta, e não chama ferramenta nenhuma', async () => {
    const { ferramentas, chamadas } = catalogo({})
    const r = await perguntar('marca a Joana amanhã pra escova', ferramentas)
    expect(chamadas).toEqual([])
    expect(r.resposta).toMatch(/^Pra quando\?/)
  })

  it('cadastro sem telefone: pede o telefone, nunca inventa', async () => {
    const { ferramentas, chamadas } = catalogo({})
    const r = await perguntar('cadastra a Renata', ferramentas)
    expect(chamadas).toEqual([])
    expect(r.resposta).toBe('Qual o telefone de Renata? Sem ele eu não preparo o cadastro.')
  })

  it('cadastro com telefone: nome sem os dígitos, telefone só com dígitos', async () => {
    const { ferramentas, chamadas } = catalogo({ preparar_cadastro_de_cliente: () => ({ status: 'proposta', acao: 'cadastrar_cliente', dados: {}, resumo: {} }) })
    await perguntar('cadastra a Renata Alves 11 98765-4321', ferramentas)
    expect(chamadas).toEqual([{ nome: 'preparar_cadastro_de_cliente', args: { nome: 'Renata Alves', telefone: '11987654321' } }])
  })

  it('a anotação vai palavra por palavra como foi ditada', async () => {
    const { ferramentas, chamadas } = catalogo({ preparar_nota_na_ficha: () => ({ status: 'proposta', acao: 'adicionar_nota', dados: {}, resumo: {} }) })
    await perguntar('anota na ficha da Sofia que ela prefere horário depois das 17h, e não gosta de água muito quente', ferramentas)
    expect(chamadas).toEqual([
      { nome: 'preparar_nota_na_ficha', args: { cliente: 'Sofia', anotacao: 'ela prefere horário depois das 17h, e não gosta de água muito quente' } },
    ])
  })

  it('item na comanda: "da Ana" é a cliente, o resto é o item', async () => {
    const { ferramentas, chamadas } = catalogo({ preparar_item_na_comanda: () => ({ status: 'nao_da', motivo: 'nenhuma_comanda_aberta' }) })
    const r = await perguntar('lança uma hidratação na comanda da Ana', ferramentas)
    expect(chamadas).toEqual([{ nome: 'preparar_item_na_comanda', args: { cliente: 'Ana', item: 'hidratação' } }])
    expect(r.resposta).toMatch(/Não há comanda aberta hoje/)
  })

  it('serviço que não existe: diz qual não achou e lista os que existem', async () => {
    const { ferramentas } = catalogo({ preparar_agendamento: () => ({ status: 'nao_achei', oQue: 'servico', termo: 'luzes', servicosDisponiveis: ['Corte', 'Escova'] }) })
    expect((await perguntar('marca a Joana amanhã às 15h pra luzes', ferramentas)).resposta).toBe('Não achei o serviço "luzes". Os que existem: Corte e Escova.')
  })
})

describe('Motor no laço de verdade — honestidade', () => {
  it('não entendeu: diz, não consulta nada, e só sugere o que este acesso pode perguntar', async () => {
    const { ferramentas, chamadas } = catalogo({}, ['clientes_para_recuperar'])
    const r = await perguntar('qual a capital da França?', ferramentas)
    expect(chamadas).toEqual([])
    expect(r.resposta).toBe('Ainda não sei responder isso. Dá para perguntar, por exemplo: "quem sumiu".')
  })

  it('ferramenta fora do papel/plano: diz que não está liberado, e não tenta chamar', async () => {
    const { ferramentas, chamadas } = catalogo({}, ['clientes_para_recuperar'])
    const r = await perguntar('quanto faturei este mês?', ferramentas)
    expect(chamadas).toEqual([])
    expect(r.resposta).toBe('Isso não está liberado no seu acesso ou no seu plano.')
  })

  it('a consulta quebrou: diz que não conseguiu — nunca uma resposta que pareça "está tudo vazio"', async () => {
    const { ferramentas } = catalogo({
      clientes_para_recuperar: () => {
        throw new Error('banco fora')
      },
    })
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await perguntar('quem sumiu?', ferramentas)
    erro.mockRestore()
    expect(r.resposta).toBe('Não consegui consultar isso agora. Tente de novo em instantes.')
  })

  it('agradecimento não vira "obrigado" na voz do produto', async () => {
    const { ferramentas } = catalogo({})
    expect((await perguntar('valeu!', ferramentas)).resposta).toBe('Por nada.')
  })
})

describe('Motor — conversa (MI-4): o contexto volta pelo navegador, e só ele', () => {
  const MARIAS = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Maria Silva' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Maria Souza' },
  ]
  const caixa = () => catalogo({ faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 100_000, profitCents: 0 }) })

  it('"e no mês passado?" repete a pergunta anterior com o período novo', async () => {
    const { ferramentas, chamadas } = caixa()
    const r1 = await perguntar('quanto faturei este mês?', ferramentas)
    expect(r1.contexto, 'sem contexto não há conversa').toBeDefined()
    const r2 = await perguntar('e no mês passado?', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.args)).toEqual([{ mes: '2026-09' }, { mes: '2026-08' }])
    expect(r2.resposta).toBe('Você faturou R$ 1.000,00 em agosto de 2026.')
  })

  it('"e sexta?" depois de "tem horário vago amanhã?" olha a sexta', async () => {
    const { ferramentas, chamadas } = catalogo({
      ocupacao_do_dia: (a) => ({ data: a.data, quantidadeDeAgendamentos: 0, taxaDeOcupacao: 0, temExpedienteCadastrado: true }),
    })
    const r1 = await perguntar('tem horário vago amanhã?', ferramentas)
    const r2 = await perguntar('e sexta?', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.args)).toEqual([{ data: '2026-09-30' }, { data: '2026-10-02' }])
    expect(r2.resposta).toBe('Sim, na sexta (02/10) sua agenda está totalmente livre.')
  })

  it('"qual delas?" → "a Souza": abre a ficha da escolhida pelo id, e responde o que a PRIMEIRA pergunta queria (o telefone)', async () => {
    const { ferramentas, chamadas } = catalogo({
      buscar_cliente: () => MARIAS,
      historico_do_cliente: (a) => ({
        cliente: { name: MARIAS.find((m) => m.id === a.clientId)!.name, phone_e164: '+5511987654321' },
        ultimosAgendamentos: [],
      }),
    })
    const r1 = await perguntar('qual o telefone da Maria?', ferramentas)
    expect(r1.resposta).toMatch(/Qual delas\?$/)
    const r2 = await perguntar('a Souza', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.nome)).toEqual(['buscar_cliente', 'historico_do_cliente'])
    expect(chamadas[1]!.args).toEqual({ clientId: '22222222-2222-4222-8222-222222222222' })
    expect(r2.resposta).toBe('O telefone de Maria Souza é (11) 98765-4321.')
  })

  it('"qual profissional?" → "a Juliana": a mesma preparação, agora com a profissional (o buraco medido no navegador)', async () => {
    let n = 0
    const { ferramentas, chamadas } = catalogo({
      preparar_agendamento: () =>
        n++ === 0
          ? { status: 'qual_delas', oQue: 'profissional', opcoes: ['Juliana Castro', 'Tatiane Moreira'] }
          : { status: 'proposta', acao: 'criar_agendamento', dados: { a: 1 }, resumo: {} },
    })
    const r1 = await perguntar('marca a Olívia amanhã às 15h pra manicure', ferramentas)
    const r2 = await perguntar('a Juliana', ferramentas, r1.contexto)
    expect(chamadas[1]!.args).toEqual({ cliente: 'Olívia', servico: 'manicure', quando: '2026-09-30T15:00', profissional: 'Juliana Castro' })
    expect(r2.proposta?.acao).toBe('criar_agendamento')
  })

  it('"e a Bia?" troca a pessoa e mantém a pergunta', async () => {
    const { ferramentas, chamadas } = catalogo({ buscar_cliente: () => [] })
    const r1 = await perguntar('quando a Maria veio pela última vez?', ferramentas)
    await perguntar('e a Bia?', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.args)).toEqual([{ termo: 'Maria' }, { termo: 'Bia' }])
  })

  it('pergunta completa nova ignora o contexto', async () => {
    const { ferramentas, chamadas } = catalogo({
      faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 1, profitCents: 0 }),
      clientes_para_recuperar: () => RECUPERAR,
    })
    const r1 = await perguntar('quanto faturei este mês?', ferramentas)
    await perguntar('quem sumiu?', ferramentas, r1.contexto)
    expect(chamadas.map((c) => c.nome)).toEqual(['faturamento_do_periodo', 'clientes_para_recuperar'])
  })

  it('"por quê?" é sobre o que acabou de ser respondido: explica o mesmo mês', async () => {
    const { ferramentas, chamadas } = catalogo({
      faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 100_000, profitCents: 0 }),
      explicar_variacao: () => ({ status: 'ok', parcial: false, agora: { rotulo: 'agosto de 2026', atendimentos: 10, receitaCents: 100_000 }, antes: { rotulo: 'julho de 2026', atendimentos: 10, receitaCents: 100_000 } }),
    })
    const r1 = await perguntar('quanto faturei em agosto?', ferramentas)
    const r2 = await perguntar('por quê?', ferramentas, r1.contexto)
    expect(chamadas.map((c) => [c.nome, c.args])).toEqual([['faturamento_do_periodo', { mes: '2026-08' }], ['explicar_variacao', { mes: '2026-08' }]])
    expect(r2.resposta).toMatch(/^Ficou igual/)
  })

  it('sem contexto, "e amanhã?" continua sendo "não entendi" — nada é inventado', async () => {
    const { ferramentas, chamadas } = catalogo({})
    expect((await perguntar('e amanhã?', ferramentas)).resposta).toMatch(/^Ainda não sei responder isso/)
    expect(chamadas).toEqual([])
  })

  describe('o contexto vem do navegador: entrada não confiável', () => {
    it('forma errada, lixo ou tamanho absurdo vira "sem contexto", nunca erro', async () => {
      const { ferramentas, chamadas } = catalogo({})
      for (const lixo of [null, 'texto', 42, { intencao: 'apagar_tudo' }, { intencao: 'faturamento', trechos: [{ antes: null, palavras: ['x'.repeat(10_000)] }] }]) {
        expect((await perguntar('e amanhã?', ferramentas, lixo)).resposta).toMatch(/^Ainda não sei responder isso/)
      }
      expect(chamadas).toEqual([])
    })

    it('contexto forjado não abre ferramenta fora do alcance: a mesma checagem de papel e plano vale', async () => {
      const { ferramentas, chamadas } = catalogo({}, ['clientes_para_recuperar'])
      const forjado = {
        intencao: 'agendar',
        trechos: [],
        chamada: { nome: 'preparar_agendamento', argumentos: { cliente: 'X', servico: 'Y', quando: '2026-09-30T10:00' } },
        pendente: { oQue: 'profissional', opcoes: [{ nome: 'Ana' }, { nome: 'Bia' }] },
      }
      const r = await perguntar('a Ana', ferramentas, forjado)
      expect(chamadas, 'a ferramenta não oferecida a este papel foi chamada').toEqual([])
      expect(r.resposta).not.toMatch(/Confira no cartão/)
    })
  })
})

describe('Motor — o que não respondeu vira sinal (MI-7)', () => {
  it('não entendeu: sinal com tema; entendeu: sem sinal; continuação resolvida pelo contexto: sem sinal', async () => {
    const { ferramentas } = catalogo({
      ocupacao_do_dia: (a) => ({ data: a.data, quantidadeDeAgendamentos: 0, taxaDeOcupacao: 0, temExpedienteCadastrado: true }),
    })
    expect((await perguntar('desmarca a Joana', ferramentas)).sinal).toEqual({ motivo: 'nao_entendi', tema: 'cancelar_ou_remarcar' })
    const r1 = await perguntar('tem horário vago amanhã?', ferramentas)
    expect(r1.sinal).toBeUndefined()
    expect((await perguntar('e sexta?', ferramentas, r1.contexto)).sinal, '"e sexta?" foi entendida pelo contexto').toBeUndefined()
  })
})

describe('Motor — "por que caiu?" com conta, não com opinião (MI-5)', () => {
  const CAIU = {
    status: 'ok',
    parcial: true,
    agora: { rotulo: '1 a 29 de setembro', atendimentos: 40, receitaCents: 400_000 },
    antes: { rotulo: '1 a 29 de agosto', atendimentos: 48, receitaCents: 480_000 },
  }

  it('caiu no mês corrente: decompõe, nomeia o maior fator e soma quem costuma voltar (o que só o CICLO diz)', async () => {
    const { ferramentas, chamadas } = catalogo({ explicar_variacao: () => CAIU, clientes_para_recuperar: () => RECUPERAR })
    const r = await perguntar('por que o faturamento caiu?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['explicar_variacao', 'clientes_para_recuperar'])
    expect(r.resposta).toBe(
      'Caiu R$ 800,00 (17%) de 1 a 29 de agosto para 1 a 29 de setembro: R$ 4.000,00 contra R$ 4.800,00. ' +
        'O que mais pesou foi o número de atendimentos: 40 contra 48 (R$ 800,00 a menos). O valor médio por atendimento ficou praticamente igual. ' +
        'E 3 pessoas que costumam voltar ainda não voltaram: dá para recuperar cerca de R$ 210,00 (estimativa, não promessa).',
    )
  })

  it('sem acesso à lista de quem voltar: explica só o caixa, sem tentar abrir o que não pode', async () => {
    const { ferramentas, chamadas } = catalogo({ explicar_variacao: () => CAIU }, ['explicar_variacao'])
    const r = await perguntar('por que caiu?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['explicar_variacao'])
    expect(r.resposta).not.toMatch(/costuma/)
  })

  it('mês fechado ("em agosto"): pede agosto, e não mistura a lista de HOJE numa explicação do passado', async () => {
    const { ferramentas, chamadas } = catalogo({ explicar_variacao: () => ({ ...CAIU, parcial: false }), clientes_para_recuperar: () => RECUPERAR })
    await perguntar('por que caiu em agosto?', ferramentas)
    expect(chamadas).toEqual([{ nome: 'explicar_variacao', args: { mes: '2026-08' } }])
  })

  it('"por que sobrou menos?": diz que o que explica é o faturamento, em vez de fingir que explicou a sobra', async () => {
    const { ferramentas } = catalogo({ explicar_variacao: () => CAIU }, ['explicar_variacao'])
    expect((await perguntar('por que sobrou menos?', ferramentas)).resposta).toMatch(/^O que eu já sei explicar é o faturamento\. Caiu/)
  })
})

describe('Motor — "e se...?" com a premissa na cara e o preço do dono (MI-6)', () => {
  const PRECO = (a: Record<string, unknown>) => ({
    status: 'ok',
    servico: 'Corte feminino',
    precoAtualCents: 4_500,
    precoNovoCents: (a.precoNovoCents as number | undefined) ?? 4_950,
    atendimentos: 30,
    dias: 90,
  })
  const VETO = /sugiro|recomendo|deveria|o ideal (é|seria)|melhor preço/i

  it('"de R$ 45 para R$ 55": simula o ÚLTIMO valor, em três cenários e o empate — e diz quem decide', async () => {
    const { ferramentas, chamadas } = catalogo({ simular_preco: PRECO })
    const r = await perguntar('e se eu subir o corte de R$ 45 para R$ 55?', ferramentas)
    expect(chamadas).toEqual([{ nome: 'simular_preco', args: { servico: 'corte', precoNovoCents: 5_500 } }])
    expect(r.resposta).toBe(
      'Hoje Corte feminino custa R$ 45,00 e foram 30 atendimentos nos últimos 90 dias (R$ 1.350,00). ' +
        'A R$ 55,00: se todo mundo continuar vindo, R$ 1.650,00 (R$ 300,00 a mais); ' +
        'se 1 em cada 10 deixar de vir, R$ 1.485,00 (R$ 135,00 a mais); ' +
        'se 2 em cada 10 deixarem de vir, R$ 1.320,00 (R$ 30,00 a menos). ' +
        'Empata se até 18 em cada 100 deixarem de vir. Quem decide o preço é você: eu não mudo nada.',
    )
    expect(r.resposta).not.toMatch(VETO)
  })

  it('percentual: "10% a mais" vai como percentual, e a ferramenta faz a conta do preço', async () => {
    const { ferramentas, chamadas } = catalogo({ simular_preco: PRECO })
    await perguntar('e se eu aumentar a escova 10%?', ferramentas)
    expect(chamadas).toEqual([{ nome: 'simular_preco', args: { servico: 'escova', percentualBps: 1_000, aumento: true } }])
  })

  it('redução: os cenários são de gente A MAIS, e o empate diz quantos precisam vir', async () => {
    const { ferramentas } = catalogo({ simular_preco: PRECO })
    const r = await perguntar('e se eu baixar o corte pra R$ 40?', ferramentas)
    expect(r.resposta).toMatch(/se 1 em cada 10 vier a mais/)
    expect(r.resposta).toMatch(/Para empatar, precisam vir 13 a mais em cada 100\./)
    expect(r.resposta).not.toMatch(/deixar de vir/)
  })

  it('sem o preço: pergunta para quanto — nunca escolhe um (veto de preço)', async () => {
    const { ferramentas, chamadas } = catalogo({})
    const r = await perguntar('e se eu subir o corte?', ferramentas)
    expect(chamadas).toEqual([])
    expect(r.resposta).toMatch(/^Para quanto\?/)
    expect(r.resposta).not.toMatch(VETO)
  })

  it('serviço por hora ou sob orçamento: diz que não há preço fechado para simular', async () => {
    const { ferramentas } = catalogo({ simular_preco: () => ({ status: 'nao_da', motivo: 'preco_nao_fixo', servico: 'Instalação' }) })
    expect((await perguntar('e se eu subir a instalação pra R$ 200?', ferramentas)).resposta).toMatch(/^Instalação não tem um preço fechado/)
  })

  it('contratação: sem o custo, pergunta; com o custo, conta pelo que SOBRA por atendimento', async () => {
    const { ferramentas, chamadas } = catalogo({
      simular_contratacao: (a) => ({ status: 'ok', custoMensalCents: a.custoMensalCents, atendimentos: 120, sobraCents: 300_000, dias: 30 }),
    })
    expect((await perguntar('vale a pena contratar mais uma pessoa?', ferramentas)).resposta).toMatch(/^Quanto essa pessoa custaria por mês/)
    const r = await perguntar('e se eu contratar alguém por R$ 2.500?', ferramentas)
    expect(chamadas).toEqual([{ nome: 'simular_contratacao', args: { custoMensalCents: 250_000 } }])
    expect(r.resposta).toMatch(/sobraram R\$ 25,00 por atendimento/)
    expect(r.resposta).toMatch(/precisa trazer 100 atendimentos a mais por mês: 83% do que o negócio faz hoje \(120 por mês\)/)
  })

  it('"e se eu abrir domingo?": responde com as procuras que caíram no dia fechado — e nunca vira R$', async () => {
    const { ferramentas, chamadas } = catalogo({ procuras_sem_horario: () => [{ weekday: 0, procuras: 5 }, { weekday: 6, procuras: 2 }] })
    const r = await perguntar('e se eu abrir domingo?', ferramentas)
    expect(chamadas.map((c) => c.nome)).toEqual(['procuras_sem_horario'])
    expect(r.resposta).toBe(
      'Nos últimos 30 dias, 5 procuras no domingo caíram sem horário na sua página de agendamento. ' +
        'Procura não é atendimento, então não viro isso em dinheiro: é o sinal para você pesar junto com o custo de abrir.',
    )
    expect(r.resposta).not.toMatch(/R\$/)
  })

  it('dia sem procura: diz que ninguém procurou pela página — e que isso não prova que ninguém viria', async () => {
    const { ferramentas } = catalogo({ procuras_sem_horario: () => [{ weekday: 0, procuras: 5 }] })
    expect((await perguntar('e se eu abrir sábado?', ferramentas)).resposta).toBe(
      'Nos últimos 30 dias ninguém procurou horário no sábado pela sua página de agendamento. Isso não prova que ninguém viria: só que ninguém procurou por lá.',
    )
  })

  it('"e se eu abrir segunda?" fala da SEGUNDA — não do dia mais procurado (medido no navegador)', async () => {
    const { ferramentas } = catalogo({ procuras_sem_horario: () => [{ weekday: 0, procuras: 3 }] })
    expect((await perguntar('e se eu abrir segunda?', ferramentas)).resposta).toMatch(/ninguém procurou horário na segunda/)
  })

  it('"e se eu abrir um dia a mais?" sem dia: fala do dia mais procurado', async () => {
    const { ferramentas } = catalogo({ procuras_sem_horario: () => [{ weekday: 1, procuras: 3 }, { weekday: 0, procuras: 4 }] })
    expect((await perguntar('e se eu abrir um dia a mais?', ferramentas)).resposta).toMatch(/^Nos últimos 30 dias, 4 procuras no domingo/)
  })
})

describe('Motor — próximo passo em botão (MI-3)', () => {
  type Botao = { rotulo: string; pergunta: string }
  const botoes = (r: { sugestoes?: unknown }) => (r.sugestoes ?? []) as Botao[]

  it('depois do faturamento do mês: "por quê?", "e o mês passado?" e o que sobrou — e cada botão é uma pergunta que funciona', async () => {
    const { ferramentas, chamadas } = catalogo({
      faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 100_000, profitCents: 40_000 }),
      explicar_variacao: () => ({ status: 'ok', parcial: true, agora: { rotulo: 'a', atendimentos: 1, receitaCents: 1 }, antes: { rotulo: 'b', atendimentos: 1, receitaCents: 1 } }),
    })
    const r1 = await perguntar('quanto faturei este mês?', ferramentas)
    expect(botoes(r1).map((b) => b.rotulo)).toEqual(['Por quê?', 'E o mês passado?', 'Quanto sobrou no mês'])
    // Tocar "E o mês passado?" = mandar a pergunta do botão com o contexto: tem que pedir agosto.
    await perguntar(botoes(r1)[1]!.pergunta, ferramentas, r1.contexto)
    expect(chamadas.at(-1)).toEqual({ nome: 'faturamento_do_periodo', args: { mes: '2026-08' } })
  })

  it('botão cuja ferramenta não está liberada para este acesso não aparece', async () => {
    const { ferramentas } = catalogo({ faturamento_do_periodo: (a) => ({ month: a.mes, revenueCents: 1, profitCents: 0 }) }, ['faturamento_do_periodo'])
    expect(botoes(await perguntar('quanto faturei este mês?', ferramentas)).map((b) => b.rotulo)).not.toContain('Por quê?')
  })

  it('"qual delas?": as opções são os botões, e tocar uma abre a ficha certa', async () => {
    const { ferramentas, chamadas } = catalogo({
      buscar_cliente: () => [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Maria Silva' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Maria Souza' },
      ],
      historico_do_cliente: () => ({ cliente: { name: 'Maria Souza', phone_e164: '+5511987654321' }, ultimosAgendamentos: [] }),
    })
    const r1 = await perguntar('qual o telefone da Maria?', ferramentas)
    expect(botoes(r1)).toEqual([
      { rotulo: 'Maria Silva', pergunta: 'Maria Silva' },
      { rotulo: 'Maria Souza', pergunta: 'Maria Souza' },
    ])
    const r2 = await perguntar(botoes(r1)[1]!.pergunta, ferramentas, r1.contexto)
    expect(chamadas.at(-1)!.args).toEqual({ clientId: '22222222-2222-4222-8222-222222222222' })
    expect(r2.resposta).toBe('O telefone de Maria Souza é (11) 98765-4321.')
    // Depois do telefone, o botão oferece o que ainda não foi perguntado — com o nome, para funcionar sozinho.
    expect(botoes(r2).map((b) => b.pergunta)).toEqual(['quanto Maria Souza já gastou comigo?', 'que dia Maria Souza costuma vir?'])
  })

  it('depois de simular preço, NENHUM botão de outro preço — seria sugerir preço em forma de botão (veto)', async () => {
    const { ferramentas } = catalogo({
      simular_preco: () => ({ status: 'ok', servico: 'Corte', precoAtualCents: 4_500, precoNovoCents: 5_500, atendimentos: 30, dias: 90 }),
    })
    const r = await perguntar('e se eu subir o corte para R$ 55?', ferramentas)
    expect(botoes(r)).toEqual([])
  })

  it('não entendeu: os botões são o que este acesso pode perguntar, no máximo 3', async () => {
    const { ferramentas } = catalogo({}, ['clientes_para_recuperar', 'ocupacao_do_dia'])
    expect(botoes(await perguntar('qual a capital da França?', ferramentas)).map((b) => b.rotulo)).toEqual(['Quem sumiu', 'Horário vago amanhã'])
  })

  it('horário vago de amanhã → "E depois de amanhã?", e o botão pede o dia certo', async () => {
    const { ferramentas, chamadas } = catalogo({
      ocupacao_do_dia: (a) => ({ data: a.data, quantidadeDeAgendamentos: 0, taxaDeOcupacao: 0, temExpedienteCadastrado: true }),
    })
    const r1 = await perguntar('tem horário vago amanhã?', ferramentas)
    expect(botoes(r1).map((b) => b.rotulo)).toEqual(['E depois de amanhã?'])
    await perguntar(botoes(r1)[0]!.pergunta, ferramentas, r1.contexto)
    expect(chamadas.at(-1)!.args).toEqual({ data: '2026-10-01' })
  })
})
