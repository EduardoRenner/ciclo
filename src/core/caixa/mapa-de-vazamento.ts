import { NOME_DO_DIA, type DiaOcioso, type Weekday } from '@/core/agenda/ociosidade'

/**
 * docs/84 Aposta B — "onde estou perdendo dinheiro?", em uma lista, com o "Resolver" de cada linha.
 *
 * Esta função não calcula nada novo: cada entrada é um número que outra tela JÁ mostra, vindo da
 * mesma consulta (o lucro parado da Recuperar, a margem do clube, a margem por serviço, o dia
 * ocioso). Um segundo cálculo do mesmo dinheiro é a armadilha de livro-caixa desta base; aqui só
 * se ordena e se diz em uma frase.
 *
 * As duas regras que decidem o que tem R$ e o que não tem (docs/84 §7.1 e o veto de preço):
 * - R$ só onde o dinheiro é MEDIDO: lucro de quem passou da hora (estimativa já rotulada assim na
 *   Recuperar) e prejuízo do clube (custo de servir maior que a mensalidade).
 * - Sem R$ onde seria chute: serviço com margem baixa (o CICLO não sabe qual margem é "certa" para o
 *   salão — dizer quanto se "perde" é sugerir preço por outra porta), dia vazio ("horário vazio não
 *   é dinheiro perdido, ninguém ia vir") e dia fechado procurado (procura não é atendimento). Esses
 *   entram como FATO, que o dono lê e decide.
 *
 * Nada qualifica? Lista vazia — a tela some, nunca um "tudo certo" forçado nem um vilão fabricado.
 */

export type Vazamento = {
  chave: 'recuperar' | 'clube' | 'margem' | 'dia_fechado' | 'dia_parado'
  titulo: string
  /** Só quando o valor é medido. `null` = fato sem R$, de propósito (ver cabeçalho). */
  valorCents: number | null
  fato: string
  href: string
  acao: string
}

export type EntradaDoMapa = {
  recuperar: { pessoas: number; lucroCents: number }
  clube: ReadonlyArray<{ margemCents: number; noPrejuizo: boolean }>
  servicosAbaixoDoPiso: ReadonlyArray<{ nome: string; parcela: 'comissao' | 'material' | 'taxa' }>
  procurasEmDiaFechado: ReadonlyArray<{ weekday: Weekday; procuras: number }>
  diaOcioso: DiaOcioso | null
}

const PARCELA: Record<'comissao' | 'material' | 'taxa', string> = { comissao: 'a comissão', material: 'o material', taxa: 'a taxa da maquininha' }

function listar(nomes: string[]): string {
  const n = nomes.slice(0, 3)
  const resto = nomes.length - n.length
  const base = n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`
  return resto > 0 ? `${base} e mais ${resto}` : base
}

/** "no domingo", "na terça" — domingo e sábado são masculinos, o resto não. */
const noOuNa = (w: Weekday) => (w === 0 || w === 6 ? 'no' : 'na')

/** Mínimo de procuras para um dia fechado virar linha: uma procura solta é acaso, não padrão. */
export const MINIMO_DE_PROCURAS = 3

export function montarMapaDeVazamento(e: EntradaDoMapa): Vazamento[] {
  const linhas: Vazamento[] = []

  if (e.recuperar.pessoas > 0 && e.recuperar.lucroCents > 0) {
    linhas.push({
      chave: 'recuperar',
      // A lista inclui quem está CHEGANDO na data (`due`) — "passou da hora" exagerava a conta.
      titulo: 'Clientes para chamar de volta',
      valorCents: e.recuperar.lucroCents,
      fato: `${e.recuperar.pessoas === 1 ? '1 pessoa; é o que sobraria se ela voltasse' : `${e.recuperar.pessoas} pessoas; é o que sobraria se voltassem`} (estimativa, não promessa).`,
      href: '/admin/recuperar',
      acao: 'Chamar de volta',
    })
  }

  const noPrejuizo = e.clube.filter((a) => a.noPrejuizo && a.margemCents < 0)
  if (noPrejuizo.length > 0) {
    const perda = -noPrejuizo.reduce((s, a) => s + a.margemCents, 0)
    linhas.push({
      chave: 'clube',
      titulo: 'Clube de assinatura no prejuízo',
      valorCents: perda,
      fato: `${noPrejuizo.length === 1 ? '1 assinante custa' : `${noPrejuizo.length} assinantes custam`} mais para atender do que paga${noPrejuizo.length === 1 ? '' : 'm'} neste ciclo.`,
      href: '/admin/config/planos',
      acao: 'Ver o clube',
    })
  }

  if (e.servicosAbaixoDoPiso.length > 0) {
    const s = e.servicosAbaixoDoPiso
    const principal = s[0]!
    linhas.push({
      chave: 'margem',
      titulo: s.length === 1 ? 'Serviço que sobra pouco' : 'Serviços que sobram pouco',
      valorCents: null,
      fato: `${listar(s.map((x) => x.nome))}: sobra menos de 30% do que entra${s.length === 1 ? `, e quem mais come é ${PARCELA[principal.parcela]}` : ''}. Quanto é o certo, só você sabe.`,
      href: '/admin/config/servicos',
      acao: 'Ver os serviços',
    })
  }

  const procurados = e.procurasEmDiaFechado.filter((p) => p.procuras >= MINIMO_DE_PROCURAS).sort((a, b) => b.procuras - a.procuras)
  if (procurados.length > 0) {
    const p = procurados[0]!
    linhas.push({
      chave: 'dia_fechado',
      titulo: `Gente procurando horário ${noOuNa(p.weekday)} ${NOME_DO_DIA[p.weekday]}`,
      valorCents: null,
      fato: `${p.procuras} procuras ${noOuNa(p.weekday)} ${NOME_DO_DIA[p.weekday]} pela página de agendamento nos últimos 30 dias, e o dia está fechado. Procura não é atendimento: é o sinal para você pesar.`,
      href: '/admin/config/horarios',
      acao: 'Ver os horários',
    })
  }

  if (e.diaOcioso) {
    linhas.push({
      chave: 'dia_parado',
      titulo: `O dia mais parado: ${NOME_DO_DIA[e.diaOcioso.weekday]}`,
      valorCents: null,
      fato: `Vazia há ${e.diaOcioso.semanasSeguidasVazias} semanas seguidas. Horário vazio só é dinheiro perdido se alguém queria vir.`,
      href: '/admin/agenda',
      acao: 'Ver a agenda',
    })
  }

  // R$ medido primeiro, do maior para o menor; depois os fatos, na ordem acima.
  return [...linhas.filter((l) => l.valorCents !== null).sort((a, b) => b.valorCents! - a.valorCents!), ...linhas.filter((l) => l.valorCents === null)]
}

