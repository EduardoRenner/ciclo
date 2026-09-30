import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { criarCliente } from '@/server/services/clientes'
import { importarClientes, preVisualizarCsv } from '@/server/services/importacao-clientes'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de importação precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const MAPA = { name: 'Nome', phone: 'Telefone', email: 'E-mail', tags: 'Etiquetas' }

let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `import-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Importação' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Importação',
    vertical: 'nails',
    slug: `import-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('preVisualizarCsv', () => {
  it('devolve cabeçalhos e uma amostra, sem tocar no banco', () => {
    const csv = 'Nome,Telefone\nAna,11987654321\nBia,11987654322\n'
    const preview = preVisualizarCsv(csv)
    expect(preview.colunas).toEqual(['Nome', 'Telefone'])
    expect(preview.sample).toHaveLength(2)
  })

  it('csv vazio ou sem cabeçalho estoura VALIDATION_ERROR', () => {
    expect(() => preVisualizarCsv('')).toThrow()
  })
})

describe('importarClientes — contra o projeto real', () => {
  it(
    'importa 500 linhas em menos de 10 segundos',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const linhas = Array.from(
        { length: 500 },
        (_, i) => `Cliente ${marca} ${i},119${String(10000000 + i).padStart(8, '0')},,`,
      )
      const csv = ['Nome,Telefone,E-mail,Etiquetas', ...linhas].join('\n')

      const inicio = Date.now()
      const resultado = await importarClientes(svc, tenantId, csv, MAPA)
      const duracao = Date.now() - inicio

      expect(resultado.imported).toBe(500)
      expect(resultado.errors).toEqual([])
      expect(duracao).toBeLessThan(10_000)
    },
    15_000,
  )

  it(
    'linha inválida não derruba o lote — as outras importam mesmo assim',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = [
        'Nome,Telefone',
        `Boa Um ${marca},11955501111`,
        ',11955502222', // nome em branco
        `Ruim Telefone ${marca},10999999999`, // DDD 10 nunca existiu
        `Boa Dois ${marca},11955503333`,
      ].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })

      expect(resultado.imported).toBe(2)
      expect(resultado.errors).toHaveLength(2)
      expect(resultado.errors.map((e) => e.linha)).toEqual([3, 4])
    },
    30_000,
  )

  it(
    'telefone repetido no próprio arquivo: a primeira importa, a repetida é sinalizada',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = `1195${String(6000000 + Math.floor(Math.random() * 900000)).padStart(7, '0')}`
      const csv = ['Nome,Telefone', `Primeira ${marca},${telefone}`, `Repetida ${marca},${telefone}`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })

      expect(resultado.imported).toBe(1)
      expect(resultado.skipped).toHaveLength(1)
      expect(resultado.skipped[0]?.motivo).toContain('repetido no próprio arquivo')
    },
    30_000,
  )

  it(
    'telefone que já existe no tenant é sinalizado, não importado de novo',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = `1196${String(1000000 + Math.floor(Math.random() * 900000)).padStart(7, '0')}`
      await criarCliente(svc, tenantId, { name: 'Já Existe', phone: telefone, tags: [], marketingOptIn: false })

      const csv = ['Nome,Telefone', `Duplicada ${marca},${telefone}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })

      expect(resultado.imported).toBe(0)
      expect(resultado.skipped).toHaveLength(1)
      expect(resultado.skipped[0]?.motivo).toContain('Já existe')
    },
    30_000,
  )

  it(
    'cliente sem telefone é importada normalmente (D47)',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone', `Sem Telefone ${marca},`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })
      expect(resultado.imported).toBe(1)
    },
    30_000,
  )
})

describe('importarClientes — previsão (F2/ticket 13, docs/25-ESTRATEGIA-E-EXECUCAO.md)', () => {
  it(
    'sem ninguém mapear a coluna de última visita, previsao é null',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone', `Sem Previsao ${marca},`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone' })
      expect(resultado.previsao).toBeNull()
    },
    30_000,
  )

  it(
    'última visita há 2 anos: computeCycle de verdade marca como atrasado, em qualquer ciclo do tenant',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const duasAnosAtras = new Date()
      duasAnosAtras.setFullYear(duasAnosAtras.getFullYear() - 2)
      const dataIso = duasAnosAtras.toISOString().slice(0, 10)

      const csv = ['Nome,Telefone,UltimaVisita', `Sumida ${marca},,${dataIso}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(1)
      // `cyclesGravados: 0` não é detalhe de forma: este caso importa SEM escolher serviço, e a
      // afirmação é que nesse caminho a previsão continua sendo só prévia de tela (2026-09-10).
      expect(resultado.previsao).toEqual({ comDataInformada: 1, jaDevendoVoltar: 1, cyclesGravados: 0, proximaVolta: null })
    },
    30_000,
  )

  it(
    'última visita ontem: dentro do ciclo, não conta como atrasado — mas conta em comDataInformada',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const dataIso = ontem.toISOString().slice(0, 10)

      const csv = ['Nome,Telefone,UltimaVisita', `Veio Ontem ${marca},,${dataIso}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(1)
      // `proximaVolta`: quem veio ontem está em dia, então a tela tem uma data para dizer — e ela é futura.
      expect(resultado.previsao).toMatchObject({ comDataInformada: 1, jaDevendoVoltar: 0, cyclesGravados: 0 })
      expect((resultado.previsao?.proximaVolta ?? '') > new Date().toISOString().slice(0, 10), 'a primeira volta de quem veio ontem devia ser futura').toBe(true)
    },
    30_000,
  )

  /*
   * BL-51 (2026-09-28): até aqui este caso afirmava que `10/03/2024` "importa igual, sem contar pra
   * previsão" — e isso era o DEFEITO escrito como regra. Toda planilha brasileira usa dd/mm/aaaa;
   * descartar a data em silêncio fazia o Motor de Ciclo nascer vazio para quem migrou. A troca é
   * deliberada: o formato brasileiro agora conta, e o que não é data é CONTADO e avisado na tela.
   */
  it(
    'data no formato brasileiro (dd/mm/aaaa): grava last_visit_at e conta na previsão',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone,UltimaVisita', `Data BR ${marca},,10/03/2024`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(1)
      expect(resultado.errors).toEqual([])
      expect(resultado.datasNaoReconhecidas).toBe(0)
      expect(resultado.previsao).toMatchObject({ comDataInformada: 1, jaDevendoVoltar: 1 })

      const { data: cliente } = await svc
        .from('clients')
        .select('last_visit_at')
        .eq('tenant_id', tenantId)
        .eq('name', `Data BR ${marca}`)
        .maybeSingle()
      // 10/03 é 10 de MARÇO: dd/mm, nunca mm/dd. E conferido NO FUSO DO SALÃO: cortar a string no
      // "T" passava tanto com o defeito de 29/09 (meia-noite UTC = dia 9 em Brasília) quanto sem ele.
      expect(Temporal.Instant.from(String(cliente?.last_visit_at)).toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString()).toBe('2024-03-10')
    },
    30_000,
  )

  it(
    'texto que não é data: cliente importa igual, sem previsão — e a conta volta para a tela avisar',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const csv = ['Nome,Telefone,UltimaVisita', `Data Ruim ${marca},,ontem`, `Sem Data ${marca},,`].join('\n')

      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(2)
      expect(resultado.errors).toEqual([])
      expect(resultado.previsao).toBeNull()
      // Célula VAZIA não é data ilegível — só "ontem" conta. Senão o aviso culpa quem não informou nada.
      expect(resultado.datasNaoReconhecidas).toBe(1)
    },
    30_000,
  )

  it(
    'só conta quem foi de fato importado — a linha pulada por duplicata não entra na previsão',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = `1197${String(2000000 + Math.floor(Math.random() * 900000)).padStart(7, '0')}`
      await criarCliente(svc, tenantId, { name: 'Já Existe Com Previsao', phone: telefone, tags: [], marketingOptIn: false })

      const duasAnosAtras = new Date()
      duasAnosAtras.setFullYear(duasAnosAtras.getFullYear() - 2)
      const dataIso = duasAnosAtras.toISOString().slice(0, 10)

      const csv = ['Nome,Telefone,UltimaVisita', `Duplicada ${marca},${telefone},${dataIso}`].join('\n')
      const resultado = await importarClientes(svc, tenantId, csv, { name: 'Nome', phone: 'Telefone', lastVisit: 'UltimaVisita' })

      expect(resultado.imported).toBe(0)
      expect(resultado.skipped).toHaveLength(1)
      expect(resultado.previsao).toBeNull()
    },
    30_000,
  )
})

/**
 * A base importada TEM que aparecer no Motor de Ciclo.
 *
 * Até 2026-09-10 ela não aparecia, e o jeito como falhava é o pior possível: tudo respondia certo.
 * O importador lia a data de última visita, rodava `computeCycle` (o algoritmo de verdade), mostrava
 * "47 já devendo voltar" na tela — e descartava o resultado. `clients.last_visit_at` nem era
 * gravado, com a coluna existindo desde a `0001`.
 *
 * A cadeia, conferida naquele dia:
 *   1. `insert` em `clients` sem `last_visit_at`;
 *   2. nenhuma linha em `client_cycles` (a PK exige `service_id`, e importado não tem serviço);
 *   3. `recompute-cycles` lê só `appointments`, então nunca alcançaria essa gente;
 *   4. `v_clientes_a_recuperar` lê `client_cycles` → zero;
 *   5. `/admin/hoje` em R$ 0,00 depois de importar a clientela inteira.
 *
 * E a FAQ da home prometia o contrário com todas as letras: "é ela que faz a lista de quem sumiu
 * nascer cheia no primeiro dia".
 *
 * O último caso deste bloco é o CONTROLE POSITIVO, e ele não é enfeite: um arquivo que só afirma
 * "gravou" passa verde num arnês que não consegue ver a diferença. Importar SEM `serviceId` tem que
 * produzir zero ciclos pelo mesmo caminho — se isso também vier cheio, os outros casos não provam
 * nada.
 */
describe('a base importada entra no Motor de Ciclo', () => {
  const DIAS_ATRAS = 400

  async function servicoComRitmo() {
    const { data } = await svc.from('services').select('id, cycle_days, price_cents').eq('tenant_id', tenantId).gt('cycle_days', 0).limit(1)
    const s = data?.[0]
    if (!s) throw new Error('o onboarding devia ter criado serviços com cycle_days — sem isso o caso não mede nada')
    return s
  }

  function csvDeUmaPessoa(nome: string, telefone: string) {
    const d = new Date()
    d.setDate(d.getDate() - DIAS_ATRAS)
    return ['Nome,Telefone,UltimaVisita', `${nome},${telefone},${d.toISOString().slice(0, 10)}`].join('\n')
  }

  function telefoneNovo() {
    return `1198${String(1000000 + Math.floor(Math.random() * 8999999)).padStart(7, '0')}`
  }

  it(
    'com serviço escolhido: grava last_visit_at, cria o ciclo e a pessoa aparece em v_clientes_a_recuperar',
    async () => {
      const servico = await servicoComRitmo()
      const marca = randomUUID().slice(0, 6)
      const telefone = telefoneNovo()

      const r = await importarClientes(svc, tenantId, csvDeUmaPessoa(`Sumida ${marca}`, telefone), {
        name: 'Nome',
        phone: 'Telefone',
        lastVisit: 'UltimaVisita',
        serviceId: servico.id,
      })

      expect(r.imported).toBe(1)
      expect(r.previsao?.comDataInformada).toBe(1)
      expect(r.previsao?.jaDevendoVoltar, `${DIAS_ATRAS} dias sem voltar tinha que contar como atrasada`).toBe(1)
      expect(r.previsao?.cyclesGravados, 'o ciclo não foi persistido: é o defeito de 2026-09-10 de volta').toBe(1)

      const { data: cliente } = await svc
        .from('clients')
        .select('id, last_visit_at')
        .eq('tenant_id', tenantId)
        .eq('name', `Sumida ${marca}`)
        .maybeSingle()
      expect(cliente?.id, 'o cadastro sumiu').toBeTruthy()
      expect(cliente?.last_visit_at, 'a data importada voltou a ser descartada na escrita de clients').toBeTruthy()

      const { data: ciclo } = await svc
        .from('client_cycles')
        .select('state, last_visit_on, value_at_risk_cents, service_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente!.id)
        .maybeSingle()
      expect(ciclo, 'nenhuma linha em client_cycles — a cadeia quebrou de novo no passo 2').toBeTruthy()
      expect(ciclo?.state, 'quem não vem há mais de um ano não pode estar on_track').not.toBe('on_track')
      expect(ciclo?.service_id).toBe(servico.id)

      // O fim da cadeia, e é o que a tela "Hoje" realmente lê. Passar nos anteriores e falhar aqui
      // significaria ciclo gravado num estado que a view não conta.
      const { data: aRecuperar } = await svc
        .from('v_clientes_a_recuperar')
        .select('client_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente!.id)
      expect(aRecuperar?.length, 'gravou o ciclo mas a pessoa não chega em v_clientes_a_recuperar').toBeGreaterThan(0)
    },
    30_000,
  )

  it(
    'CONTROLE POSITIVO — sem serviço escolhido, nada é persistido (se isto falhar, o caso acima não prova nada)',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const telefone = telefoneNovo()

      const r = await importarClientes(svc, tenantId, csvDeUmaPessoa(`Sem Servico ${marca}`, telefone), {
        name: 'Nome',
        phone: 'Telefone',
        lastVisit: 'UltimaVisita',
      })

      expect(r.imported).toBe(1)
      // A previsão de tela continua existindo: é o comportamento antigo, preservado de propósito.
      expect(r.previsao?.jaDevendoVoltar).toBe(1)
      expect(r.previsao?.cyclesGravados, 'gravou ciclo sem ninguém ter escolhido serviço').toBe(0)

      const { data: cliente } = await svc
        .from('clients')
        .select('id, last_visit_at')
        .eq('tenant_id', tenantId)
        .eq('name', `Sem Servico ${marca}`)
        .maybeSingle()
      // `last_visit_at` é gravado SEMPRE — não depende de serviço, e é o conserto G-01 sozinho.
      expect(cliente?.last_visit_at, 'a data tem que ser gravada mesmo sem serviço escolhido').toBeTruthy()

      const { count } = await svc
        .from('client_cycles')
        .select('client_id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente!.id)
      expect(count, 'o arnês não distingue gravado de não-gravado: as asserções do caso anterior são vazias').toBe(0)
    },
    30_000,
  )
})

/*
 * BL-47 (`.claude/ciclo/autonomous-backlog.md`): `preverEPersistirCiclos` (`ciclo-de-quem-ja-
 * atende.ts`) é a fórmula ÚNICA compartilhada por esta porta (CSV) e pela porta "memória"
 * (`quem-ja-atendo.ts`, describe `'preverEPersistirCiclos grava o dinheiro certo'`). Aquela suíte
 * já prova os TRÊS casos de dinheiro (venda avulsa, assinante zera, pacote zera) — esta cobre só o
 * que falta: a mesma prova, do lado de cá.
 *
 * **Achado ao tentar espelhar os três casos, não só dois:** os casos de "assinante ativo"/"pacote
 * com saldo" são estruturalmente IMPOSSÍVEIS de reproduzir pela porta CSV, e não por falta de
 * teste. `importarClientes` só CRIA cadastro novo — uma linha cujo telefone já existe é PULADA
 * (`'Já existe uma ficha com esse telefone.'`, visto acima), nunca atualizada. Uma assinatura ou
 * pacote com saldo só existe presa a um `client_id` que JÁ tem ficha — e essa ficha, por definição,
 * faria a linha do CSV ser pulada antes de chegar em `preverEPersistirCiclos`. Não é um buraco de
 * cobertura: é uma combinação de estados que o produto não permite acontecer por este caminho. Só
 * o caso de venda avulsa (dinheiro > 0, não cai no default 0) é alcançável aqui, e é o que este
 * bloco prova.
 */
describe('importarClientes grava o dinheiro certo (não só o estado) — BL-47', () => {
  // Cópias locais dos três helpers de 'a base importada entra no Motor de Ciclo': são `function`
  // declarados dentro DAQUELE `describe`, fora do escopo deste — mesmo padrão de
  // `quem-ja-atendo.test.ts`, cujo describe de dinheiro também define o próprio `clienteExistente`
  // em vez de importar de outro describe.
  async function servicoComRitmo() {
    const { data } = await svc.from('services').select('id, cycle_days, price_cents').eq('tenant_id', tenantId).gt('cycle_days', 0).limit(1)
    const s = data?.[0]
    if (!s) throw new Error('o onboarding devia ter criado serviços com cycle_days — sem isso o caso não mede nada')
    return s
  }

  function csvDeUmaPessoa(nome: string, telefone: string) {
    const d = new Date()
    d.setDate(d.getDate() - 400)
    return ['Nome,Telefone,UltimaVisita', `${nome},${telefone},${d.toISOString().slice(0, 10)}`].join('\n')
  }

  function telefoneNovo() {
    return `1198${String(1000000 + Math.floor(Math.random() * 8999999)).padStart(7, '0')}`
  }

  it(
    'value_at_risk_cents e profit_at_risk_cents são gravados de verdade (não ficam 0 por padrão)',
    async () => {
      const servico = await servicoComRitmo()
      const marca = randomUUID().slice(0, 6)
      const telefone = telefoneNovo()

      const r = await importarClientes(svc, tenantId, csvDeUmaPessoa(`Vai Ter Lucro Csv ${marca}`, telefone), {
        name: 'Nome',
        phone: 'Telefone',
        lastVisit: 'UltimaVisita',
        serviceId: servico.id,
      })
      expect(r.previsao?.cyclesGravados).toBe(1)

      const { data: cliente } = await svc.from('clients').select('id').eq('tenant_id', tenantId).eq('name', `Vai Ter Lucro Csv ${marca}`).single()
      const { data: ciclo } = await svc
        .from('client_cycles')
        .select('value_at_risk_cents, profit_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente!.id)
        .single()

      expect(ciclo?.value_at_risk_cents, 'venda avulsa em risco não pode ficar 0 para quem acabou de ser importado').toBeGreaterThan(0)
      // Sem material configurado nem profissional conhecido (comissão 0), lucro esperado = preço —
      // os dois números coincidem, e é isso que prova que a coluna está sendo escrita de verdade,
      // não caindo no default (mesmo raciocínio de quem-ja-atendo.test.ts).
      expect(ciclo?.profit_at_risk_cents).toBe(ciclo?.value_at_risk_cents)
    },
    30_000,
  )
})
