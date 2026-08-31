/**
 * Para onde cada ação preparada é executada — e por que isto é uma FUNÇÃO por ação, com
 * validação, em vez de um campo `rota` que a ferramenta devolvesse pronto.
 *
 * A proposta nasce de um objeto que passou pelo modelo. Se a tela aceitasse uma URL vinda de lá,
 * o destino da requisição seria influenciável por texto do usuário (ou por dado de terceiro
 * injetado num campo, que é o achado do `docs/26 §4.3`). Aqui o formato da URL é fixo no código;
 * da proposta vem só o id, e ele é validado como UUID antes de entrar na string. É a mesma ideia
 * da régua do `docs/33 §2.1` aplicada ao transporte: limitar o que a coisa ALCANÇA.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type MontarRota = (dados: Record<string, unknown>) => string | null

const ROTAS: Record<string, MontarRota> = {
  criar_agendamento: () => '/api/v1/appointments',
  concluir_atendimento: (d) => {
    const id = d.appointmentId
    // Id que não é UUID não vira URL: sem isto, `"x/../../outra-coisa"` sairia daqui como rota.
    return typeof id === 'string' && UUID.test(id) ? `/api/v1/appointments/${id}/complete` : null
  },
  cadastrar_cliente: () => '/api/v1/clients',
  adicionar_nota: (d) => {
    const id = d.clientId
    return typeof id === 'string' && UUID.test(id) ? `/api/v1/clients/${id}/notes` : null
  },
}

/** `null` quando a ação é desconhecida ou os dados não formam uma rota válida. */
export function rotaDaAcao(acao: string, dados: Record<string, unknown>): string | null {
  const montar = ROTAS[acao]
  return montar ? montar(dados) : null
}

/** Ações cujo efeito a interface NÃO desfaz — o cartão precisa dizer isso antes do toque. */
const SEM_VOLTA = new Set(['concluir_atendimento'])

export function acaoTemVolta(acao: string): boolean {
  return !SEM_VOLTA.has(acao)
}
