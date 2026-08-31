import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import type { ModuloKey } from '@/core/billing/planos'
import { avaliarPermissao, type Papel } from '@/server/auth/rbac'
import { listarAgendamentos } from '@/server/services/agendamentos'
import { listarProdutosAtivos } from '@/server/services/estoque'
import { listarAlertasDeEstoque } from '@/server/services/alertas-estoque'
import { resumoMensal } from '@/server/services/caixa'
import { buscarCliente, listarClientes } from '@/server/services/clientes'
import { listarAgendaDoDia } from '@/server/services/agendamentos'
import { listarOrcamentos } from '@/server/services/orcamentos'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { listarServicos } from '@/server/services/servicos'
import { buscarTicketIdPorAgendamento } from '@/server/services/comanda'
import { listarProfissionais } from '@/server/services/profissionais'
import { resolverPorNome, resolverProfissional, type Candidato } from '@/core/assistente/resolver'
import { semAcento } from '@/core/text/normalizar'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * docs/26-AGENTE-IA-PLANO.md §3 — catálogo de ferramentas da Fase A, só leitura.
 *
 * Toda ferramenta é um chamador do serviço que já existe, com a MESMA sessão e a MESMA RLS que
 * as telas usam — nunca acessa o banco direto e nunca usa `service_role`. `executar()` devolve
 * um objeto simples (sem classe, sem função) que vira o texto que volta ao modelo: é aqui que
 * mora a regra "número nunca vem do modelo" — o número já vem pronto do serviço, o modelo só lê.
 */

type Cliente = SupabaseClient<Database>

export type ContextoFerramenta = {
  db: Cliente
  tenantId: string
  timezone: string
}

export type Ferramenta<T = unknown> = {
  nome: string
  descricao: string
  schema: z.ZodType<T>
  /** Mesmo formato de `exigirPermissao()` — `server/auth/rbac.ts`. */
  permissao: `${string}:${string}`
  modulo: ModuloKey
  executar: (ctx: ContextoFerramenta, args: T) => Promise<unknown>
}

const EsquemaVazio = z.object({})

const EsquemaClienteId = z.object({
  clientId: z.uuid().describe('id do cliente, obtido antes com a ferramenta buscar_cliente'),
})

const EsquemaBusca = z.object({
  termo: z.string().min(2).describe('nome ou telefone (com ou sem formatação) da cliente a procurar'),
})

// `.optional()`: sem isto, o schema vira `"required": ["mes"]` no JSON Schema que o Gemini lê —
// achado 2026-08-30 testando contra a API real (`docs/32/33` §2.4 item 3, aplicado aqui em
// retrospecto): campo obrigatório sem valor natural na pergunta força o MODELO a inventar um
// valor plausível (uma data de outro ano, por exemplo) só para satisfazer o schema. Opcional de
// verdade deixa o modelo omitir o campo quando a pergunta não especifica período, e o `executar`
// abaixo já tem o fallback certo (mês/dia corrente) para quando isso acontece.
const EsquemaMes = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe('mês no formato AAAA-MM; se não informado, usa o mês corrente')
    .optional(),
})

const EsquemaData = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('data no formato AAAA-MM-DD; se não informado, usa hoje')
    .optional(),
})

/** `YYYY-MM` do mês corrente no fuso do tenant, sem depender de `new Date()` no chamador. */
function mesCorrente(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' })
    .format(new Date())
    .replace('/', '-')
}

/** Exportada: `assistente.ts` reusa para ancorar o prompt de sistema com a data de hoje. */
export function hojeNoFuso(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

const EsquemaPrepararAgendamento = z.object({
  cliente: z.string().min(2).describe('nome da cliente, como o dono falou — não precisa ser exato'),
  servico: z.string().min(2).describe('nome do serviço, como o dono falou'),
  quando: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .describe('data e hora no formato AAAA-MM-DDTHH:MM, no fuso do salão. Use a data de hoje do prompt para resolver "amanhã", "terça" etc.'),
  profissional: z.string().optional().describe('nome do profissional; omita se o dono não disse'),
  telefone: z
    .string()
    .optional()
    .describe('telefone da cliente, SÓ quando ela ainda não está cadastrada e o dono informou o número'),
})

const EsquemaItemNaComanda = z.object({
  cliente: z.string().min(2).describe('nome da cliente cuja comanda vai receber o item'),
  item: z.string().min(2).describe('nome do serviço ou do produto, como o dono falou'),
  quantidade: z.number().int().positive().max(99).optional().describe('quantas unidades; some se ele não disser'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('dia do atendimento (AAAA-MM-DD); some se for hoje'),
})

const EsquemaNotaNaFicha = z.object({
  cliente: z.string().min(2).describe('nome da cliente, como o dono falou'),
  anotacao: z.string().min(2).max(2000).describe('o texto da anotação, EXATAMENTE como o dono ditou — não resuma, não reescreva, não corrija'),
})

const EsquemaConcluirAtendimento = z.object({
  cliente: z.string().min(2).describe('nome da cliente cujo atendimento terminou'),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('dia do atendimento em AAAA-MM-DD; omita para hoje'),
})

/**
 * Apaga o tipo específico de argumento (`T`) de uma ferramenta concreta para o array
 * heterogêneo abaixo — cada ferramenta continua com o schema/executar fortemente tipados entre
 * si (o Zod garante isso em `safeParse`/`executar`); só a COLEÇÃO precisa ser homogênea, e é só
 * aqui, num lugar só, que a variância se resolve. Preferível a `any` espalhado (regra 8 do
 * CLAUDE.md) porque o "esquecimento de tipo" fica contido nesta função, não em cada ferramenta.
 */
function apagarTipo<T>(f: Ferramenta<T>): Ferramenta {
  return f as Ferramenta
}

export const FERRAMENTAS: Ferramenta[] = [
  apagarTipo({
    nome: 'resumo_de_hoje',
    descricao: 'O que está na agenda de hoje: próxima cliente, faturado até agora, confirmações pendentes e alertas de estoque.',
    schema: EsquemaVazio,
    permissao: 'appointment:read',
    modulo: 'agenda',
    executar: async (ctx) => resumoDeHoje(ctx.db, ctx.tenantId, ctx.timezone),
  }),
  apagarTipo({
    nome: 'clientes_para_recuperar',
    descricao: 'Lista de clientes atrasadas para voltar, ordenada pelo valor em risco — o que o Motor de Ciclo já calculou.',
    schema: EsquemaVazio,
    permissao: 'client:read',
    modulo: 'cycle_engine',
    executar: async (ctx) => listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 20 }),
  }),
  apagarTipo({
    nome: 'buscar_cliente',
    descricao: 'Procura clientes pelo nome ou telefone. Use antes de historico_do_cliente para achar o id.',
    schema: EsquemaBusca,
    permissao: 'client:read',
    modulo: 'clients',
    executar: async (ctx, { termo }) => listarClientes(ctx.db, ctx.tenantId, { busca: termo, limite: 10 }),
  }),
  apagarTipo({
    nome: 'historico_do_cliente',
    descricao: 'Dados cadastrais e os últimos agendamentos de uma cliente específica, pelo id.',
    schema: EsquemaClienteId,
    permissao: 'client:read',
    modulo: 'clients',
    executar: async (ctx, { clientId }) => {
      const [cliente, agendamentos] = await Promise.all([
        buscarCliente(ctx.db, ctx.tenantId, clientId),
        listarAgendamentos(ctx.db, ctx.tenantId, { clientId }),
      ])
      // Só os 10 mais recentes voltam ao modelo — histórico inteiro de anos não cabe no
      // contexto e não muda a resposta de "quando ela veio da última vez".
      return { cliente, ultimosAgendamentos: agendamentos.slice(-10).reverse() }
    },
  }),
  apagarTipo({
    nome: 'faturamento_do_periodo',
    descricao: 'Faturamento, custo de material, taxa, comissão e lucro de um mês (AAAA-MM). Vem direto do fechamento de caixa.',
    schema: EsquemaMes,
    permissao: 'report:read',
    modulo: 'register',
    executar: async (ctx, args: z.infer<typeof EsquemaMes> | Record<string, never>) =>
      resumoMensal(ctx.db, ctx.tenantId, ctx.timezone, 'mes' in args && args.mes ? args.mes : mesCorrente(ctx.timezone)),
  }),
  apagarTipo({
    nome: 'ocupacao_do_dia',
    descricao: 'Quantos agendamentos e qual a taxa de ocupação do expediente em um dia (AAAA-MM-DD) — serve para achar horário vago.',
    schema: EsquemaData,
    permissao: 'appointment:read',
    modulo: 'agenda',
    executar: async (ctx, args: z.infer<typeof EsquemaData> | Record<string, never>) => {
      const data = 'data' in args && args.data ? args.data : hojeNoFuso(ctx.timezone)
      const resumo = await listarAgendaDoDia(ctx.db, ctx.tenantId, data, ctx.timezone)
      // 2026-08-30: `temExpedienteCadastrado: false` é o sinal para o modelo dizer "sem
      // expediente cadastrado" em vez de "0% de ocupação" — a mesma leitura errada que a tela da
      // Agenda tinha (docs/DECISOES.md, mesma data). O nome do campo já carrega a explicação
      // porque é o modelo, não um humano, quem lê este objeto.
      return {
        data,
        quantidadeDeAgendamentos: resumo.appointments.length,
        taxaDeOcupacao: resumo.occupancyRate,
        temExpedienteCadastrado: resumo.temExpediente,
        faturamentoPrevistoCents: resumo.forecastCents,
      }
    },
  }),
  apagarTipo({
    nome: 'orcamentos_parados',
    descricao: 'Orçamentos enviados que ainda não foram aprovados nem recusados pela cliente, com quantos dias estão parados.',
    schema: EsquemaVazio,
    permissao: 'appointment:read',
    modulo: 'quotes',
    executar: async (ctx) => {
      const todos = await listarOrcamentos(ctx.db, ctx.tenantId)
      const hoje = Date.now()
      return todos
        .filter((o) => o.status === 'sent')
        .map((o) => ({ ...o, diasParado: Math.floor((hoje - new Date(o.createdAt).getTime()) / 86_400_000) }))
        .sort((a, b) => b.diasParado - a.diasParado)
    },
  }),
  apagarTipo({
    nome: 'alertas_de_estoque',
    descricao: 'Produtos para recomprar ou perto de vencer.',
    schema: EsquemaVazio,
    permissao: 'inventory:read',
    modulo: 'stock',
    executar: async (ctx) => listarAlertasDeEstoque(ctx.db, ctx.tenantId, hojeNoFuso(ctx.timezone)),
  }),
  apagarTipo({
    nome: 'preparar_agendamento',
    descricao:
      'Prepara um agendamento a partir do que o dono falou (cliente, serviço, dia e hora) e devolve uma PROPOSTA para ele confirmar. NÃO marca nada — quem marca é o dono, tocando em confirmar. Se houver mais de uma cliente ou profissional possível, devolve as opções para você PERGUNTAR qual, nunca escolha por conta própria.',
    schema: EsquemaPrepararAgendamento,
    // MESMA permissão que `POST /api/v1/appointments` exige: o assistente nunca prepara o que o
    // papel não poderia executar depois. Sem isso ele montaria uma proposta que a rota recusa,
    // e o dono levaria o 'não' só no fim, depois de confirmar.
    permissao: 'appointment:create',
    modulo: 'agenda',
    executar: async (ctx, { cliente, servico, quando, profissional, telefone }) => {
      const [clientes, servicos, profissionais] = await Promise.all([
        listarClientes(ctx.db, ctx.tenantId, { busca: cliente, limite: 20 }),
        listarServicos(ctx.db, ctx.tenantId),
        listarProfissionais(ctx.db, ctx.tenantId),
      ])

      const candCliente: Candidato[] = clientes.map((c) => ({ id: c.id, nome: c.name }))
      const candServico: Candidato[] = servicos.map((s) => ({ id: s.id, nome: s.name }))
      const candProf: Candidato[] = profissionais.map((p) => ({ id: p.id, nome: p.display_name }))

      const rc = resolverPorNome(cliente, candCliente)
      // Cliente que ainda não existe não é beco sem saída: `criarAgendamento` aceita
      // `clientDraft` (nome + telefone) e cria junto, reusando pelo telefone se já houver. Sem
      // isto o fluxo mais comum do balcão — "marca pra Fulana, é nova" — travava num "não achei".
      // Mas só com telefone: cadastrar alguém sem contato cria ficha que não serve para chamar
      // de volta, que é o produto inteiro.
      if (rc.tipo === 'nenhum') {
        if (!telefone) return { status: 'nao_achei', oQue: 'cliente', termo: cliente, podeCadastrar: true }
      }
      if (rc.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'cliente', opcoes: rc.opcoes.map((o) => o.nome) }

      const rs = resolverPorNome(servico, candServico)
      if (rs.tipo === 'nenhum') {
        return { status: 'nao_achei', oQue: 'servico', termo: servico, servicosDisponiveis: candServico.map((s) => s.nome) }
      }
      if (rs.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'servico', opcoes: rs.opcoes.map((o) => o.nome) }

      const rp = resolverProfissional(profissional, candProf)
      if (rp.tipo === 'nenhum') return { status: 'nao_achei', oQue: 'profissional', termo: profissional }
      if (rp.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'profissional', opcoes: rp.opcoes.map((o) => o.nome) }

      const servicoEscolhido = servicos.find((s) => s.id === rs.item.id)!

      // A PROPOSTA, não a execução. `precoCents` e `duracaoMin` vêm do catálogo, nunca do modelo
      // (regra inegociável nº1 do docs/26 §0) — o modelo só lê o que já está resolvido aqui.
      return {
        status: 'proposta',
        acao: 'criar_agendamento',
        // `dados` é o corpo que a tela vai mandar para `POST /api/v1/appointments` quando o dono
        // confirmar. O assistente NUNCA chama essa rota: ele devolve o que preencher.
        dados: {
          // Cliente existente vai por id; cliente nova vai como rascunho, e o SERVIÇO decide o
          // resto (reusa pelo telefone se já houver alguém com aquele número — `criarAgendamento`
          // já faz isso, e refazer a regra aqui criaria uma segunda verdade sobre "quem é essa
          // pessoa"). Um dos dois é obrigatório: o `.refine` do esquema recusa vazio.
          ...(rc.tipo === 'achou'
            ? { clientId: rc.item.id }
            : { clientDraft: { name: cliente, phone: telefone! } }),
          serviceId: rs.item.id,
          professionalId: rp.item.id,
          // `startsAt` COM offset, que é o que `EsquemaCriarAgendamento` exige — e convertido
          // AQUI, no servidor, com o fuso do salão. Mandar a hora local para a tela converter
          // usaria o fuso do APARELHO: uma dona viajando, ou um celular com fuso errado, marcaria
          // no horário errado. É a armadilha do `CLAUDE.md` ("nunca aritmética em horário local"),
          // e `Temporal` resolve inclusive o dia de mudança de horário de verão.
          startsAt: Temporal.PlainDateTime.from(quando)
            .toZonedDateTime(ctx.timezone)
            .toInstant()
            .toString(),
        },
        // O resumo é o que aparece no cartão de confirmação. Em português, com tudo resolvido —
        // o dono confirma lendo nome de gente e preço, não UUID (pesquisa da Anthropic sobre
        // fadiga de aprovação: confirmação que não dá para julgar vira clique automático).
        resumo: {
          cliente: rc.tipo === 'achou' ? rc.item.nome : cliente,
          // O cartão precisa dizer que vai CADASTRAR alguém, não só marcar: é uma segunda coisa
          // acontecendo no mesmo toque, e esconder isso seria a confirmação mentir por omissão.
          clienteNova: rc.tipo === 'achou' ? undefined : telefone,
          servico: rs.item.nome,
          profissional: rp.item.nome,
          quando,
          precoCents: servicoEscolhido.price_cents,
          duracaoMin: servicoEscolhido.duration_min,
        },
      }
    },
  }),
  apagarTipo({
    nome: 'preparar_conclusao_de_atendimento',
    descricao:
      'Prepara a conclusão de um atendimento que já aconteceu (a cliente chegou e foi atendida) e devolve uma PROPOSTA para o dono confirmar. NÃO conclui nada. Concluir abre a comanda e credita os pontos da cliente, e NÃO tem como desfazer depois.',
    schema: EsquemaConcluirAtendimento,
    // Mesma permissão que `POST /api/v1/appointments/[id]/complete` exige.
    permissao: 'appointment:update',
    modulo: 'agenda',
    executar: async (ctx, { cliente, data }) => {
      const dia = data ?? hojeNoFuso(ctx.timezone)
      const agenda = await listarAgendaDoDia(ctx.db, ctx.tenantId, dia, ctx.timezone)

      // Só o que a máquina de estados deixa concluir (`core/scheduling/state.ts`: arrived → done).
      // Filtrar ANTES de resolver o nome evita propor uma conclusão que a rota recusaria.
      const concluiveis = agenda.appointments.filter((a) => a.status === 'arrived')
      if (concluiveis.length === 0) {
        const daCliente = agenda.appointments.filter((a) => semAcento(a.clients?.name ?? '').includes(semAcento(cliente)))
        return {
          status: 'nao_da',
          motivo: 'nenhum_atendimento_em_andamento',
          dia,
          // Diz em que estado ela está: "confirmado" precisa de "Chegou" antes de concluir.
          situacaoDaCliente: daCliente.map((a) => ({ cliente: a.clients?.name, status: a.status })),
        }
      }

      const candidatos: Candidato[] = concluiveis.map((a) => ({ id: a.id, nome: a.clients?.name ?? 'Cliente' }))
      const rc = resolverPorNome(cliente, candidatos)
      if (rc.tipo === 'nenhum') return { status: 'nao_achei', oQue: 'atendimento', termo: cliente, dia }
      if (rc.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'atendimento', opcoes: rc.opcoes.map((o) => o.nome) }

      const escolhido = concluiveis.find((a) => a.id === rc.item.id)!

      return {
        status: 'proposta',
        acao: 'concluir_atendimento',
        dados: { appointmentId: escolhido.id },
        resumo: {
          cliente: rc.item.nome,
          servico: escolhido.services?.name ?? 'Serviço',
          quando: escolhido.starts_at,
          precoCents: escolhido.price_cents,
        },
      }
    },
  }),
  apagarTipo({
    nome: 'preparar_item_na_comanda',
    descricao:
      'Prepara o lançamento de um serviço ou produto EXTRA na comanda de um atendimento já concluído, e devolve uma PROPOSTA para o dono confirmar. NAO lanca nada. Use quando o dono disser que a cliente levou um produto ou fez algo a mais. NUNCA informe preco: o preco sai do catalogo sozinho.',
    schema: EsquemaItemNaComanda,
    // Mesma permissão que `POST /api/v1/tickets/[id]/items` exige.
    permissao: 'comanda:own',
    modulo: 'register',
    executar: async (ctx, { cliente, item, quantidade, data }) => {
      const dia = data ?? hojeNoFuso(ctx.timezone)
      const [agenda, servicos, produtos] = await Promise.all([
        listarAgendaDoDia(ctx.db, ctx.tenantId, dia, ctx.timezone),
        listarServicos(ctx.db, ctx.tenantId),
        listarProdutosAtivos(ctx.db, ctx.tenantId),
      ])

      // Comanda só existe depois que o atendimento foi concluído — é `concluirAgendamento` que a
      // abre. Filtrar por `done` antes de resolver o nome evita propor lançamento numa comanda
      // que ainda não nasceu, que a rota recusaria com 404.
      const concluidos = agenda.appointments.filter((a) => a.status === 'done')
      if (concluidos.length === 0) {
        return { status: 'nao_da', motivo: 'nenhuma_comanda_aberta', dia }
      }

      const rc = resolverPorNome(cliente, concluidos.map((a) => ({ id: a.id, nome: a.clients?.name ?? 'Cliente' })))
      if (rc.tipo === 'nenhum') return { status: 'nao_achei', oQue: 'comanda', termo: cliente, dia }
      if (rc.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'comanda', opcoes: rc.opcoes.map((o) => o.nome) }

      const atendimento = concluidos.find((a) => a.id === rc.item.id)!
      const ticketId = await buscarTicketIdPorAgendamento(ctx.db, ctx.tenantId, atendimento.id)
      if (!ticketId) return { status: 'nao_da', motivo: 'comanda_nao_encontrada', cliente: rc.item.nome }

      // Serviço e produto vivem em catálogos separados, e a rota exige um OU outro, nunca os dois.
      // Procura nos dois e recusa o empate ENTRE eles: um "hidratação" que é serviço e produto ao
      // mesmo tempo tem que virar pergunta, não um chute com consequência em estoque.
      const porServico = resolverPorNome(item, servicos.map((x) => ({ id: x.id, nome: x.name })))
      const porProduto = resolverPorNome(item, produtos.map((x) => ({ id: x.id, nome: x.name })))
      if (porServico.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'servico', opcoes: porServico.opcoes.map((o) => o.nome) }
      if (porProduto.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'produto', opcoes: porProduto.opcoes.map((o) => o.nome) }
      if (porServico.tipo === 'achou' && porProduto.tipo === 'achou') {
        return { status: 'qual_delas', oQue: 'item', opcoes: [`${porServico.item.nome} (serviço)`, `${porProduto.item.nome} (produto)`] }
      }
      if (porServico.tipo === 'nenhum' && porProduto.tipo === 'nenhum') {
        return { status: 'nao_achei', oQue: 'item', termo: item }
      }

      const ehServico = porServico.tipo === 'achou'
      const escolhido = ehServico ? porServico.item : (porProduto as { item: Candidato }).item
      const qty = quantidade ?? 1

      /*
       * O preço NÃO vai no corpo, e isso é a trava central desta ferramenta. `unitPriceCents` é
       * opcional em `EsquemaItemComanda`: omitido, `adicionarItemComanda` lê o preço do catálogo
       * na hora. Aceitar preço aqui seria deixar o modelo produzir um número que vira dinheiro
       * cobrado da cliente — o oposto da regra "número nunca vem do modelo". Por isso
       * `EsquemaItemNaComanda` não tem campo de preço nenhum: não há o que preencher errado.
       */
      const dados: Record<string, unknown> = {
        ticketId,
        professionalId: atendimento.professional_id,
        qty,
        ...(ehServico ? { serviceId: escolhido.id } : { productId: escolhido.id }),
      }

      const precoCatalogo = ehServico
        ? servicos.find((x) => x.id === escolhido.id)?.price_cents
        : produtos.find((x) => x.id === escolhido.id)?.price_cents

      return {
        status: 'proposta',
        acao: 'adicionar_item_comanda',
        dados,
        resumo: {
          Cliente: rc.item.nome,
          Item: `${escolhido.nome}${ehServico ? ' (serviço)' : ' (produto)'}`,
          Quantidade: qty,
          // Só para o dono CONFERIR. Não volta como entrada: quem cobra é o catálogo.
          precoCents: precoCatalogo,
        },
      }
    },
  }),
  apagarTipo({
    nome: 'preparar_nota_na_ficha',
    descricao:
      'Prepara uma anotação na ficha de uma cliente e devolve uma PROPOSTA para o dono confirmar. NÃO salva nada. Use quando o dono quiser registrar algo sobre a cliente (preferência, alergia declarada, o que conversaram). Copie a anotação PALAVRA POR PALAVRA como ele ditou.',
    schema: EsquemaNotaNaFicha,
    // A MESMA permissão que `POST /api/v1/clients/[id]/notes` exige. Se fosse mais frouxa, o
    // assistente prepararia o que o papel não pode executar — o dono confirmaria para receber 403.
    permissao: 'client:update',
    modulo: 'clients',
    executar: async (ctx, { cliente, anotacao }) => {
      const clientes = await listarClientes(ctx.db, ctx.tenantId, { busca: cliente, limite: 20 })
      const cand: Candidato[] = clientes.map((c) => ({ id: c.id, nome: c.name }))

      const rc = resolverPorNome(cliente, cand)
      // Nota é aditiva, mas na ficha ERRADA ela é pior que nenhuma: vira informação falsa sobre
      // uma pessoa que ninguém vai desconfiar depois. Empatou, pergunta — nunca desempata sozinho.
      if (rc.tipo === 'nenhum') return { status: 'nao_achei', oQue: 'cliente', termo: cliente }
      if (rc.tipo === 'ambiguo') return { status: 'qual_delas', oQue: 'cliente', opcoes: rc.opcoes.map((o) => o.nome) }

      return {
        status: 'proposta',
        acao: 'adicionar_nota',
        // Corpo exato de `EsquemaNota`. `clientId` sai daqui só para montar a rota, e é validado
        // como UUID de novo em `core/assistente/acoes.ts` antes de virar URL.
        dados: { clientId: rc.item.id, body: anotacao },
        resumo: { Cliente: rc.item.nome, Anotação: anotacao },
      }
    },
  }),
]

/**
 * JSON Schema no formato que o Gemini aceita: sem `$schema` nem `additionalProperties`, que a
 * API rejeita. `z.toJSONSchema` (Zod 4 nativo, sem dependência nova) gera o resto certo.
 */
export function paraJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- os dois só existem para SAIR do objeto (`resto`); nunca lidos.
  const { $schema, additionalProperties, ...resto } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>
  return resto
}

/**
 * Ferramentas visíveis para um papel, já filtradas por permissão — o modelo nunca vê a que não
 * pode chamar. Reusa `avaliarPermissao()` de `rbac.ts`: mesma tabela de papéis que as rotas
 * usam, não uma segunda cópia da regra.
 */
export function ferramentasPermitidas(papel: Papel): Ferramenta[] {
  return FERRAMENTAS.filter((f) => avaliarPermissao(papel, f.permissao) !== null)
}
