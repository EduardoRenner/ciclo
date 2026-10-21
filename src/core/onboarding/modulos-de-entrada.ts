import type { ModuloKey } from '@/core/billing/planos'

/**
 * docs/108-norte (16/10/2026): a conta nova de quem trabalha sozinha na beleza feminina nasce sem o que
 * é de dono com equipe ou de negócio com estoque e orçamento. Medido nos prints da conta de demonstração:
 * a primeira semana dela mostrava "Orçamentos", "Estoque", "Ficha de consumo", "Campanhas" e "Clube"
 * vazios, e cada tela vazia é um "isso não é para mim".
 *
 * É só o ponto de partida. Nada some do produto: a dona religa qualquer um em Configurações → Módulos,
 * e o plano continua sendo o teto (`podeUsarModulo`). Ficam ligados agenda, Motor de Ciclo, clientes,
 * página pública, lembretes, caixa, recorrência e anamnese, que são o dia dela.
 *
 * Por slug da profissão, e não pelo grupo "beleza": barbearia, cabelo e estética costumam ter equipe,
 * estoque e orçamento, e mudar o começo delas não foi decidido.
 */
const PROFISSOES_ENXUTAS: ReadonlySet<string> = new Set(['lashes', 'brows', 'nails', 'waxing'])

// `team` também: a maioria trabalha sozinha, e "Eu e mais gente" na Pergunta 2 religa a equipe
// (`perfil-onboarding.ts`). Sem isto, quem pulava a pergunta via comissão e "de quem depende o que sobra".
const DESLIGADOS_NA_ENTRADA: readonly ModuloKey[] = ['quotes', 'stock', 'campaigns', 'club', 'documents', 'team']

export function modulosDesligadosNaEntrada(slugDaProfissao: string | null | undefined): readonly ModuloKey[] {
  return slugDaProfissao && PROFISSOES_ENXUTAS.has(slugDaProfissao) ? DESLIGADOS_NA_ENTRADA : []
}
