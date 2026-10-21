import { RITMO_SEM_VOLTA } from '@/core/ciclo/proxima-volta'

/**
 * docs/114 L-06: a busca da cliente por serviço e cidade/bairro. Funções puras: o servidor lê os
 * negócios e estas decidem quem aparece e o que mostrar.
 */

/**
 * Chave da busca da cliente (`/buscar` e o atalho na porta "Sou cliente"). Ligada a pedido do Vitor (docs/114
 * L-06), contra o veto de 2026-09-05 de não listar estabelecimentos: desligar aqui some com a página e o atalho.
 */
export const BUSCA_ABERTA = true

/** Sem acento, minúscula, espaço único: "Cílios" e "cilios" são a mesma busca. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Aparece quem pode receber agendamento pelo link agora (serviço aberto para marcar online e
 * horário de atendimento) e não desligou "Aparecer na busca" (ligado por padrão). Demonstração e
 * negócio pausado nunca aparecem.
 */
export function aparecerNaBusca(n: {
  desligado: boolean
  servicosOnline: number
  temExpediente: boolean
  demonstracao: boolean
  pausado: boolean
}): boolean {
  return !n.desligado && n.servicosOnline > 0 && n.temExpediente && !n.demonstracao && !n.pausado
}

type NegocioNaBusca = {
  nome: string
  endereco: string | null
  profissao: { nome: string; sinonimos: string[] } | null
  /** `ritmoDias` (ciclo do serviço) separa o que volta do que não volta, como a remoção. */
  servicos: { nome: string; precoCents: number; ritmoDias?: number; deVolta?: boolean }[]
}

/**
 * O que o cartão do resultado mostra, ou `null` se o negócio não combina. O serviço que casa com o
 * termo vence; se o termo casa só com a profissão (ou um sinônimo dela, como "lash"), mostra o serviço
 * da profissão; sem termo, o mais barato. "A partir de" é o menor preço do que combinou. Quando o
 * destaque não vem do nome do serviço, ele é um serviço que volta: "Remoção · a partir de R$ 30" como
 * cartão de quem procura unhas (medido na busca local) diz o contrário do que o negócio faz.
 */
export function resultadoDaBusca(
  negocio: NegocioNaBusca,
  busca: { termo: string; cidade: string },
): { servico: string; aPartirDeCents: number } | null {
  const termo = normalizarBusca(busca.termo)
  const cidade = normalizarBusca(busca.cidade)
  if (cidade && !normalizarBusca(negocio.endereco ?? '').includes(cidade)) return null

  const servicos = [...negocio.servicos].sort((a, b) => a.precoCents - b.precoCents)
  if (servicos.length === 0) return null
  const resultado = (s: { nome: string; precoCents: number }) => ({ servico: s.nome, aPartirDeCents: s.precoCents })
  // O destaque quando o termo não está no nome de serviço nenhum: o mais barato entre os que voltam.
  // O serviço de volta do pacote da profissão (`SERVICO_DE_VOLTA`) primeiro; o ritmo não basta, porque
  // contas antigas têm a remoção com 21 dias e marcável online (EXP-S09 pendente).
  const destaque = servicos.find((s) => s.deVolta) ?? servicos.find((s) => (s.ritmoDias ?? 0) < RITMO_SEM_VOLTA) ?? servicos[0]!
  if (!termo) return resultado(destaque)

  const pelosServicos = servicos.find((s) => normalizarBusca(s.nome).includes(termo))
  if (pelosServicos) return resultado(pelosServicos)

  const profissao = negocio.profissao
  const nomesDaProfissao = profissao ? [profissao.nome, ...profissao.sinonimos].map(normalizarBusca) : []
  if (nomesDaProfissao.some((n) => n.includes(termo) || termo.includes(n))) {
    const daProfissao = servicos.find((s) => normalizarBusca(s.nome).includes(normalizarBusca(profissao!.nome)))
    return resultado(daProfissao ?? destaque)
  }

  if (normalizarBusca(negocio.nome).includes(termo)) return resultado(destaque)
  return null
}
