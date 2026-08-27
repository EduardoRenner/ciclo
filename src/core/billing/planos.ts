/**
 * docs/18-MONETIZACAO-PLANO.md §L — o ÚNICO lugar que responde "este tenant pode X?".
 *
 * O plano é explícito sobre o motivo de isto existir concentrado: espalhar a regra por trinta
 * rotas é como ela some. Toda pergunta de permissão comercial passa por aqui, e aqui não há I/O
 * (regra 5 do CLAUDE.md) — quem lê banco é a camada de `server/`, que traz os fatos e pergunta.
 *
 * Os LIMITES numéricos abaixo são [S] no plano (§D.3): não há uso real para calibrá-los, só o
 * `dom-rocha` semeado. Estão aqui porque um limite explícito e errado é mais honesto e mais fácil
 * de corrigir que um limite implícito espalhado. Ver a pendência registrada em docs/DECISOES.md.
 */

export type PlanoTier = 'gratis' | 'essencial' | 'equipe' | 'avancado'

export type Eixo = 'onde' | 'cobranca' | 'inicio' | 'ritmo'

export type ModuloKey =
  | 'agenda'
  | 'cycle_engine'
  | 'public_page'
  | 'clients'
  | 'reminders'
  | 'recurrence'
  | 'quotes'
  | 'routing'
  | 'register'
  | 'stock'
  | 'loyalty'
  | 'club'
  | 'campaigns'
  | 'team'
  | 'health_records'
  | 'documents'
  | 'assistant'

/** Capacidades que não são módulo — são o que o degrau permite fazer com o módulo que já tem. */
export type Capacidade = 'envio_em_lote' | 'remover_selo'

/**
 * Catálogo dos 16 módulos do `09-PLATAFORMA.md` §6, com o rótulo em pt-BR que a interface usa.
 *
 * Vive aqui, e não numa consulta à tabela `modules`, porque a tela de módulos precisa dos rótulos
 * para desenhar e não deveria pagar uma ida ao banco por isso. A tabela `modules` (migration 0041)
 * continua existindo com outro papel: ser o alvo da chave estrangeira de `tenant_modules.modulo`,
 * que é o que impede módulo fantasma por erro de digitação.
 *
 * As duas listas precisam bater. `tests/unit/core/modulos-catalogo.test.ts` lê a migration e
 * compara — duplicação vigiada é segura; duplicação silenciosa é a armadilha da L.6 de novo.
 */
export const CATALOGO: readonly { key: ModuloKey; label: string; sempreLigado: boolean }[] = [
  { key: 'agenda', label: 'Agenda', sempreLigado: true },
  { key: 'cycle_engine', label: 'Motor de Ciclo', sempreLigado: true },
  { key: 'public_page', label: 'Página pública', sempreLigado: false },
  { key: 'clients', label: 'Clientes e CRM', sempreLigado: false },
  { key: 'reminders', label: 'Lembrete e confirmação', sempreLigado: false },
  { key: 'recurrence', label: 'Recorrência', sempreLigado: false },
  { key: 'quotes', label: 'Orçamento', sempreLigado: false },
  { key: 'routing', label: 'Deslocamento e rota', sempreLigado: false },
  { key: 'register', label: 'Comanda e caixa', sempreLigado: false },
  { key: 'stock', label: 'Estoque', sempreLigado: false },
  { key: 'loyalty', label: 'Fidelidade e pontos', sempreLigado: false },
  { key: 'club', label: 'Assinatura e clube', sempreLigado: false },
  { key: 'campaigns', label: 'Campanhas', sempreLigado: false },
  { key: 'team', label: 'Equipe e comissão', sempreLigado: false },
  { key: 'health_records', label: 'Anamnese e dado de saúde', sempreLigado: false },
  { key: 'documents', label: 'Documentos e contratos', sempreLigado: false },
  // docs/26-AGENTE-IA-PLANO.md §6/§10 — liberado para todo tenant desde o grátis, porque agora
  // é medição de uso, não receita. Não `sempreLigado`: o dono precisa poder desligar (§4.4).
  { key: 'assistant', label: 'Assistente', sempreLigado: false },
]

type Definicao = {
  /** null = sem teto. */
  maxProfissionais: number | null
  /** null = sem teto. */
  maxClientes: number | null
  modulos: readonly ModuloKey[]
  capacidades: readonly Capacidade[]
}

const HERANCA: Record<PlanoTier, PlanoTier | null> = {
  gratis: null,
  essencial: 'gratis',
  equipe: 'essencial',
  avancado: 'equipe',
}

const PROPRIOS: Record<PlanoTier, Omit<Definicao, 'modulos'> & { modulos: readonly ModuloKey[] }> = {
  gratis: {
    maxProfissionais: 1,
    maxClientes: 50,
    // O Motor de Ciclo está aqui de propósito (§D.2): o grátis MOSTRA quem sumiu e quanto vale.
    // O que ele não dá é a alavanca de mandar para todos de uma vez — e mandar um a um pelo
    // wa.me continua funcionando para sempre, de graça.
    //
    // `assistant` também nasce aqui (docs/26 §10): custo de LLM é ruído (~R$0,40/mês/tenant a
    // 100 perguntas), então travar por plano não defenderia receita nenhuma — só atrapalharia a
    // medição de uso que decide se o assistente continua existindo.
    modulos: ['agenda', 'cycle_engine', 'public_page', 'clients', 'reminders', 'assistant'],
    capacidades: [],
  },
  essencial: {
    maxProfissionais: 1,
    maxClientes: null,
    modulos: ['campaigns', 'register', 'quotes', 'routing'],
    capacidades: ['envio_em_lote', 'remover_selo'],
  },
  equipe: {
    maxProfissionais: 5,
    maxClientes: null,
    modulos: ['team', 'loyalty'],
    capacidades: [],
  },
  avancado: {
    maxProfissionais: null,
    maxClientes: null,
    // Anamnese no degrau mais alto não é gula: é dado de saúde, com custo de conformidade real
    // (LGPD, cifragem, trilha de acesso). Quem precisa disso fatura para pagar.
    modulos: ['stock', 'health_records', 'recurrence', 'club', 'documents'],
    capacidades: [],
  },
}

function resolver(tier: PlanoTier): Definicao {
  const modulos = new Set<ModuloKey>()
  const capacidades = new Set<Capacidade>()
  let atual: PlanoTier | null = tier
  while (atual) {
    for (const m of PROPRIOS[atual].modulos) modulos.add(m)
    for (const c of PROPRIOS[atual].capacidades) capacidades.add(c)
    atual = HERANCA[atual]
  }
  return {
    maxProfissionais: PROPRIOS[tier].maxProfissionais,
    maxClientes: PROPRIOS[tier].maxClientes,
    modulos: [...modulos],
    capacidades: [...capacidades],
  }
}

export const PLANOS: Record<PlanoTier, Definicao> = {
  gratis: resolver('gratis'),
  essencial: resolver('essencial'),
  equipe: resolver('equipe'),
  avancado: resolver('avancado'),
}

export const ORDEM_DOS_PLANOS: readonly PlanoTier[] = ['gratis', 'essencial', 'equipe', 'avancado']

const ORDEM = ORDEM_DOS_PLANOS

/**
 * Nome e preço de cada degrau — a ÚNICA definição no projeto.
 *
 * Estavam duplicados em quatro arquivos (serviço de planos, tela de bloqueio, "Meu plano", tela de
 * módulos) e a tabela de preço em três, mais duas menções em prosa. Consolidado aqui pelo mesmo
 * motivo do catálogo de módulos: preço que existe em cinco lugares é preço que um dia vai divergir
 * em um deles, e o lugar onde ninguém olha é sempre o que fica errado.
 *
 * Em centavos porque é dinheiro (regra 3 do CLAUDE.md), mesmo sendo dinheiro que ainda não é
 * cobrado — a hora de acertar a unidade é antes de existir a primeira cobrança, não depois.
 */
export const NOME_DO_PLANO: Record<PlanoTier, string> = {
  gratis: 'Grátis',
  essencial: 'Essencial',
  equipe: 'Equipe',
  avancado: 'Avançado',
}

export const PRECO_MENSAL_CENTS: Record<PlanoTier, number> = {
  gratis: 0,
  essencial: 4_900,
  equipe: 9_900,
  avancado: 17_900,
}

const REAIS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** "R$ 49". Sem centavos: todo preço da tabela é redondo, e "R$ 49,00" pesa à toa numa tela de 390px. */
export function precoDoPlano(tier: PlanoTier): string {
  return REAIS.format(PRECO_MENSAL_CENTS[tier] / 100)
}

/** "R$ 49/mês" — e "R$ 0" no grátis, porque "R$ 0/mês" sugere uma cobrança de zero. */
export function precoDoPlanoPorMes(tier: PlanoTier): string {
  return tier === 'gratis' ? precoDoPlano(tier) : `${precoDoPlano(tier)}/mês`
}

/** O degrau mais barato que libera este módulo, para a tela de bloqueio poder dizer o caminho. */
export function menorPlanoCom(modulo: ModuloKey): PlanoTier | null {
  return ORDEM.find((t) => PLANOS[t].modulos.includes(modulo)) ?? null
}

export function menorPlanoComCapacidade(capacidade: Capacidade): PlanoTier | null {
  return ORDEM.find((t) => PLANOS[t].capacidades.includes(capacidade)) ?? null
}

// ---------------------------------------------------------------------------------------------
// Precedência de três camadas (§D.5). A ordem é a parte fácil de errar: EIXO antes de PLANO.
// Se plano viesse primeiro, um eletricista veria "Fidelidade bloqueada, assine o Equipe" para um
// módulo que ele nunca vai usar — regra 5.2 aplicada ao contrário, que vira ruído e queima a tela
// de bloqueio, a peça de conversão mais importante do produto.
// ---------------------------------------------------------------------------------------------

export type Veredito =
  /** Não faz sentido para este negócio. Some da interface, sem oferta nenhuma. */
  | { estado: 'fora_do_eixo'; eixo: Eixo }
  /** Faz sentido, mas o degrau não libera. Aparece bloqueado, com motivo e caminho. */
  | { estado: 'bloqueado_pelo_plano'; precisaDo: PlanoTier }
  /** Liberado, mas o dono desligou. Aparece desligado e reversível por ele. */
  | { estado: 'desligado_pelo_dono' }
  | { estado: 'liberado' }

export type ContextoDoTenant = {
  plano: PlanoTier
  /** Os quatro eixos da migration 0023. `null` = o tenant ainda não respondeu o onboarding. */
  eixos: Partial<Record<Eixo, string | null>>
  /** `tenant_modules` com origem 'dono'. Ausente = o dono não mexeu, vale o padrão. */
  desligadosPeloDono?: readonly ModuloKey[]
}

/**
 * `exigeEixo` diz qual eixo condiciona o módulo (espelha `modules.eixo` da migration 0041), e
 * `satisfaz` decide se o valor daquele eixo justifica o módulo existir.
 *
 * Mantido como dado, e não como `if` espalhado, porque o catálogo de profissões cresce e a
 * pergunta "este módulo faz sentido aqui?" tem que ter uma resposta só.
 */
const CONDICAO_DE_EIXO: Partial<Record<ModuloKey, { eixo: Eixo; satisfaz: (valor: string) => boolean }>> = {
  routing: { eixo: 'onde', satisfaz: (v) => v === 'vai_ate' || v === 'hibrido' },
  recurrence: { eixo: 'ritmo', satisfaz: (v) => v === 'recorrente' || v === 'sazonal' },
  quotes: { eixo: 'inicio', satisfaz: (v) => v === 'orcamento' },
}

export function podeUsarModulo(ctx: ContextoDoTenant, modulo: ModuloKey): Veredito {
  const condicao = CONDICAO_DE_EIXO[modulo]
  if (condicao) {
    const valor = ctx.eixos[condicao.eixo]
    // Eixo não respondido ainda não esconde nada: onboarding incompleto não é motivo para sumir
    // com funcionalidade. Só um valor CONHECIDO e incompatível esconde.
    if (valor != null && !condicao.satisfaz(valor)) {
      return { estado: 'fora_do_eixo', eixo: condicao.eixo }
    }
  }

  if (!PLANOS[ctx.plano].modulos.includes(modulo)) {
    const precisaDo = menorPlanoCom(modulo)
    // Módulo que nenhum degrau libera é erro de catálogo, não bloqueio comercial — não invente
    // um upgrade que não existe.
    if (!precisaDo) return { estado: 'fora_do_eixo', eixo: 'onde' }
    return { estado: 'bloqueado_pelo_plano', precisaDo }
  }

  // Módulo "sempre ligado" ignora a escolha do dono, e isso é defesa, não teimosia: `definirModulo`
  // recusa desligá-lo, mas `tenant_modules.modulo` não tem restrição que impeça uma linha chegar
  // por outro caminho (seed, correção manual, migration futura). Sem esta guarda, uma linha
  // perdida para `agenda` faria a agenda inteira sumir da interface — o produto desaparecendo por
  // causa de um registro de configuração.
  const sempreLigado = CATALOGO.find((m) => m.key === modulo)?.sempreLigado === true
  if (!sempreLigado && ctx.desligadosPeloDono?.includes(modulo)) return { estado: 'desligado_pelo_dono' }

  return { estado: 'liberado' }
}

export function podeUsarCapacidade(ctx: ContextoDoTenant, capacidade: Capacidade): Veredito {
  if (PLANOS[ctx.plano].capacidades.includes(capacidade)) return { estado: 'liberado' }
  const precisaDo = menorPlanoComCapacidade(capacidade)
  if (!precisaDo) return { estado: 'fora_do_eixo', eixo: 'onde' }
  return { estado: 'bloqueado_pelo_plano', precisaDo }
}

// ---------------------------------------------------------------------------------------------
// Limites (§L.1). Duro RECUSA; suave AVISA e deixa passar.
// A distinção não é estilística: travar cadastro de cliente no meio de um atendimento é a forma
// mais rápida de o salão abandonar o sistema — mesma lógica da armadilha de estoque no CLAUDE.md.
// ---------------------------------------------------------------------------------------------

export type Recurso = 'profissionais' | 'clientes'

export type Severidade = 'duro' | 'suave'

const SEVERIDADE: Record<Recurso, Severidade> = {
  profissionais: 'duro',
  clientes: 'suave',
}

export type ResultadoDeLimite = {
  dentro: boolean
  /** null = sem teto neste degrau. */
  limite: number | null
  restante: number | null
  severidade: Severidade
  /** Verdadeiro a partir de 80% do teto — o gancho do aviso antes de doer. */
  perto: boolean
  /** O degrau que resolve, quando existe um acima que amplia o teto. */
  precisaDo: PlanoTier | null
}

function tetoDe(tier: PlanoTier, recurso: Recurso): number | null {
  return recurso === 'profissionais' ? PLANOS[tier].maxProfissionais : PLANOS[tier].maxClientes
}

function menorPlanoQueComporta(recurso: Recurso, quantidade: number): PlanoTier | null {
  return ORDEM.find((t) => {
    const teto = tetoDe(t, recurso)
    return teto === null || teto >= quantidade
  }) ?? null
}

/**
 * @param usoAtual quantos já existem HOJE
 * @param aAdicionar quantos a operação quer criar (1 no caso normal, N numa importação de CSV)
 */
export function verificarLimite(
  ctx: ContextoDoTenant,
  recurso: Recurso,
  usoAtual: number,
  aAdicionar = 1,
): ResultadoDeLimite {
  const limite = tetoDe(ctx.plano, recurso)
  const severidade = SEVERIDADE[recurso]
  const total = usoAtual + aAdicionar

  if (limite === null) {
    return { dentro: true, limite: null, restante: null, severidade, perto: false, precisaDo: null }
  }

  const dentro = total <= limite
  const restante = Math.max(0, limite - usoAtual)
  return {
    dentro,
    limite,
    restante,
    severidade,
    perto: usoAtual >= Math.floor(limite * 0.8),
    precisaDo: dentro ? null : menorPlanoQueComporta(recurso, total),
  }
}

/**
 * Regra 5.1, inviolável: cair de degrau NUNCA apaga nem esconde dado. Quem está acima do teto do
 * degrau novo continua com tudo à vista — o que trava é CRIAR mais. Esta função existe para que
 * essa distinção tenha um nome e um teste, em vez de virar um `if` esquecido numa rota.
 */
export function podeCriar(ctx: ContextoDoTenant, recurso: Recurso, usoAtual: number, aAdicionar = 1): boolean {
  const r = verificarLimite(ctx, recurso, usoAtual, aAdicionar)
  return r.severidade === 'suave' ? true : r.dentro
}
