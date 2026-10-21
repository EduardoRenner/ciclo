/**
 * CNV-009 · O que a exportação da conta inteira leva, tabela por tabela, coluna por coluna — e o que
 * NÃO leva, de propósito:
 *   · `clients.preferences` — guarda "alergia" em seis das sete verticais (dado de saúde, regra 9): a
 *     ficha de saúde sai só na exportação por cliente, com verificação em duas etapas e trilha;
 *   · cofre de saúde (`health_records`) — idem;
 *   · colunas internas sem valor fora do CICLO (`phone_hash`, `name_busca`, `risk_features`,
 *     `psp_payload`, `pix_qr`).
 * Nomes técnicos em inglês (como o banco) no dialeto aberto; títulos em português no dialeto Excel.
 */
import type { Coluna } from '@/core/exportacao/csv'

export type ColunaDeRecurso = Coluna & { de: string }

export type Recurso = {
  /** Nome do recurso no `datapackage.json` (minúsculo, sem espaço). */
  nome: string
  titulo: string
  descricao: string
  tabela: string
  /** `true`: só linhas com `deleted_at` nulo (o que foi excluído pela pessoa não sai). */
  semExcluidos: boolean
  colunas: ColunaDeRecurso[]
}

const c = (de: string, nome: string, titulo: string, tipo: Coluna['tipo'], descricao?: string): ColunaDeRecurso => ({ de, nome, titulo, tipo, ...(descricao ? { descricao } : {}) })
const id = c('id', 'id', 'ID', 'string', 'identificador no CICLO; liga as tabelas entre si')

export const RECURSOS: readonly Recurso[] = [
  {
    nome: 'clientes',
    titulo: 'Clientes',
    descricao: 'Cada pessoa atendida pelo negócio.',
    tabela: 'clients',
    semExcluidos: true,
    colunas: [
      id,
      c('name', 'name', 'Nome', 'string'),
      c('phone_e164', 'phone', 'Telefone', 'telefone', 'formato internacional E.164 (+55…)'),
      c('email', 'email', 'E-mail', 'string'),
      c('birth_date', 'birth_date', 'Nascimento', 'date'),
      c('gender', 'gender', 'Gênero', 'string'),
      c('document', 'document', 'Documento', 'string'),
      c('address', 'address', 'Endereço', 'string'),
      c('emergency_contact', 'emergency_contact', 'Contato de emergência', 'string'),
      c('notes', 'notes', 'Observações', 'string'),
      c('tags', 'tags', 'Etiquetas', 'string', 'separadas por | no arquivo aberto'),
      c('source', 'source', 'Origem', 'string'),
      c('referred_by', 'referred_by', 'Indicado por (ID)', 'string'),
      c('last_visit_at', 'last_visit_at', 'Última visita', 'datetime'),
      c('marketing_opt_in', 'marketing_opt_in', 'Aceita novidades', 'boolean'),
      c('whatsapp_opt_out', 'whatsapp_opt_out', 'Pediu para não receber WhatsApp', 'boolean'),
      c('created_at', 'created_at', 'Cadastrado em', 'datetime'),
    ],
  },
  {
    nome: 'servicos',
    titulo: 'Serviços',
    descricao: 'O que o negócio oferece, com preço e duração.',
    tabela: 'services',
    semExcluidos: true,
    colunas: [
      id,
      c('name', 'name', 'Serviço', 'string'),
      c('description', 'description', 'Descrição', 'string'),
      c('duration_min', 'duration_min', 'Duração (min)', 'integer'),
      c('price_cents', 'price_cents', 'Preço (R$)', 'centavos'),
      c('cost_cents', 'cost_cents', 'Custo (R$)', 'centavos'),
      c('cycle_days', 'cycle_days', 'Volta a cada (dias)', 'integer'),
      c('active', 'active', 'Ativo', 'boolean'),
    ],
  },
  {
    nome: 'profissionais',
    titulo: 'Profissionais',
    descricao: 'Quem atende.',
    tabela: 'professionals',
    semExcluidos: true,
    colunas: [id, c('display_name', 'name', 'Nome', 'string'), c('commission_bps', 'commission_bps', 'Comissão (%)', 'integer', 'em pontos-base: 1000 = 10%'), c('active', 'active', 'Ativo', 'boolean')],
  },
  {
    nome: 'agendamentos',
    titulo: 'Agendamentos',
    descricao: 'Todo horário marcado, inclusive os cancelados e as faltas.',
    tabela: 'appointments',
    semExcluidos: false,
    colunas: [
      id,
      c('client_id', 'client_id', 'Cliente (ID)', 'string'),
      c('professional_id', 'professional_id', 'Profissional (ID)', 'string'),
      c('service_id', 'service_id', 'Serviço (ID)', 'string'),
      c('starts_at', 'starts_at', 'Início', 'datetime'),
      c('ends_at', 'ends_at', 'Fim', 'datetime'),
      c('status', 'status', 'Situação', 'string'),
      c('price_cents', 'price_cents', 'Preço (R$)', 'centavos'),
      c('deposit_cents', 'deposit_cents', 'Sinal (R$)', 'centavos'),
      c('origin', 'origin', 'Marcado por', 'string'),
      c('client_note', 'client_note', 'Recado do cliente', 'string'),
      c('internal_note', 'internal_note', 'Anotação interna', 'string'),
      c('cancel_reason', 'cancel_reason', 'Motivo do cancelamento', 'string'),
      c('created_at', 'created_at', 'Marcado em', 'datetime'),
    ],
  },
  {
    nome: 'comandas',
    titulo: 'Comandas',
    descricao: 'O que foi cobrado em cada atendimento.',
    tabela: 'tickets',
    semExcluidos: false,
    colunas: [
      id,
      c('client_id', 'client_id', 'Cliente (ID)', 'string'),
      c('professional_id', 'professional_id', 'Profissional (ID)', 'string'),
      c('appointment_id', 'appointment_id', 'Agendamento (ID)', 'string'),
      c('status', 'status', 'Situação', 'string'),
      c('subtotal_cents', 'subtotal_cents', 'Subtotal (R$)', 'centavos'),
      c('discount_cents', 'discount_cents', 'Desconto (R$)', 'centavos'),
      c('tip_cents', 'tip_cents', 'Gorjeta (R$)', 'centavos'),
      c('total_cents', 'total_cents', 'Total (R$)', 'centavos'),
      c('payment_method', 'payment_method', 'Forma de pagamento', 'string'),
      c('fee_cents', 'fee_cents', 'Taxa da maquininha (R$)', 'centavos'),
      c('commission_cents', 'commission_cents', 'Comissão (R$)', 'centavos'),
      c('closed_at', 'closed_at', 'Fechada em', 'datetime'),
    ],
  },
  {
    nome: 'itens_de_comanda',
    titulo: 'Itens das comandas',
    descricao: 'Cada serviço ou produto lançado numa comanda.',
    tabela: 'ticket_items',
    semExcluidos: false,
    colunas: [
      id,
      c('ticket_id', 'ticket_id', 'Comanda (ID)', 'string'),
      c('service_id', 'service_id', 'Serviço (ID)', 'string'),
      c('product_id', 'product_id', 'Produto (ID)', 'string'),
      c('professional_id', 'professional_id', 'Profissional (ID)', 'string'),
      c('description', 'description', 'Descrição', 'string'),
      c('qty', 'qty', 'Quantidade', 'number'),
      c('unit_price_cents', 'unit_price_cents', 'Preço unitário (R$)', 'centavos'),
      c('discount_cents', 'discount_cents', 'Desconto (R$)', 'centavos'),
      c('total_cents', 'total_cents', 'Total (R$)', 'centavos'),
      c('commission_cents', 'commission_cents', 'Comissão (R$)', 'centavos'),
    ],
  },
  {
    nome: 'pacotes',
    titulo: 'Pacotes',
    descricao: 'Pacotes de sessões vendidos.',
    tabela: 'packages',
    semExcluidos: false,
    colunas: [
      id,
      c('client_id', 'client_id', 'Cliente (ID)', 'string'),
      c('service_id', 'service_id', 'Serviço (ID)', 'string'),
      c('total_sessions', 'total_sessions', 'Sessões', 'integer'),
      c('used_sessions', 'used_sessions', 'Sessões usadas', 'integer'),
      c('paid_cents', 'paid_cents', 'Pago (R$)', 'centavos'),
      c('expires_on', 'expires_on', 'Vence em', 'date'),
      c('created_at', 'created_at', 'Vendido em', 'datetime'),
    ],
  },
  {
    nome: 'usos_de_pacote',
    titulo: 'Sessões de pacote usadas',
    descricao: 'Cada sessão descontada de um pacote.',
    tabela: 'package_uses',
    semExcluidos: false,
    colunas: [id, c('package_id', 'package_id', 'Pacote (ID)', 'string'), c('appointment_id', 'appointment_id', 'Agendamento (ID)', 'string'), c('used_at', 'used_at', 'Usada em', 'datetime')],
  },
  {
    nome: 'carteira',
    titulo: 'Créditos dos clientes',
    descricao: 'Créditos e débitos na carteira de cada cliente.',
    tabela: 'wallet_entries',
    semExcluidos: false,
    colunas: [id, c('client_id', 'client_id', 'Cliente (ID)', 'string'), c('amount_cents', 'amount_cents', 'Valor (R$)', 'centavos'), c('reason', 'reason', 'Motivo', 'string'), c('expires_on', 'expires_on', 'Vence em', 'date'), c('created_at', 'created_at', 'Lançado em', 'datetime')],
  },
  {
    nome: 'fidelidade',
    titulo: 'Pontos de fidelidade',
    descricao: 'Pontos ganhos e trocados.',
    tabela: 'loyalty_entries',
    semExcluidos: false,
    colunas: [id, c('client_id', 'client_id', 'Cliente (ID)', 'string'), c('points', 'points', 'Pontos', 'integer'), c('reason', 'reason', 'Motivo', 'string'), c('created_at', 'created_at', 'Lançado em', 'datetime')],
  },
  {
    nome: 'produtos',
    titulo: 'Produtos',
    descricao: 'Produtos de uso e de revenda, com estoque.',
    tabela: 'products',
    semExcluidos: true,
    colunas: [
      id,
      c('name', 'name', 'Produto', 'string'),
      c('sku', 'sku', 'Código', 'string'),
      c('unit', 'unit', 'Unidade', 'string'),
      c('price_cents', 'price_cents', 'Preço de venda (R$)', 'centavos'),
      c('avg_cost_cents', 'avg_cost_cents', 'Custo médio (R$)', 'centavos'),
      c('stock_qty', 'stock_qty', 'Estoque', 'number'),
      c('is_retail', 'is_retail', 'Revenda', 'boolean'),
      c('active', 'active', 'Ativo', 'boolean'),
    ],
  },
  {
    nome: 'movimentos_de_estoque',
    titulo: 'Movimentos de estoque',
    descricao: 'Entradas, saídas e devoluções de estoque.',
    tabela: 'stock_moves',
    semExcluidos: false,
    colunas: [
      id,
      c('product_id', 'product_id', 'Produto (ID)', 'string'),
      c('kind', 'kind', 'Tipo', 'string'),
      c('qty', 'qty', 'Quantidade', 'number'),
      c('unit_cost_cents', 'unit_cost_cents', 'Custo unitário (R$)', 'centavos'),
      c('source', 'source', 'Origem', 'string'),
      c('note', 'note', 'Anotação', 'string'),
      c('created_at', 'created_at', 'Em', 'datetime'),
    ],
  },
  {
    nome: 'pagamentos',
    titulo: 'Pagamentos',
    descricao: 'Dinheiro registrado fora da comanda (venda de pacote, sinal).',
    tabela: 'payments',
    semExcluidos: false,
    colunas: [
      id,
      c('client_id', 'client_id', 'Cliente (ID)', 'string'),
      c('package_id', 'package_id', 'Pacote (ID)', 'string'),
      c('kind', 'kind', 'Tipo', 'string'),
      c('method', 'method', 'Forma', 'string'),
      c('status', 'status', 'Situação', 'string'),
      c('amount_cents', 'amount_cents', 'Valor (R$)', 'centavos'),
      c('fee_cents', 'fee_cents', 'Taxa (R$)', 'centavos'),
      c('paid_at', 'paid_at', 'Pago em', 'datetime'),
      c('refunded_at', 'refunded_at', 'Desfeito em', 'datetime'),
    ],
  },
]

/** Linha do banco → linha do recurso (nomes técnicos de exportação). */
export function linhaDoRecurso(recurso: Recurso, linha: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(recurso.colunas.map((col) => [col.nome, linha[col.de] ?? null]))
}
