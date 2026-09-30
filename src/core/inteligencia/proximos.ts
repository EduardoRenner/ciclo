import type { Entendimento, Intencao } from '@/core/inteligencia/entender'
import type { Etapa, Foco } from '@/core/inteligencia/planejar'

/**
 * MI-3 (docs/85 §2.4) — o próximo passo em botão, para a conversa andar sem digitar.
 *
 * Cada botão é uma PERGUNTA que o Motor já sabe responder, e só aparece se a ferramenta dela está
 * liberada para este papel/plano (mesmo filtro do resto). No "qual delas?", os botões são as
 * próprias opções — tocar "Juliana Castro" manda "Juliana Castro", e o contexto (MI-4) faz o resto.
 *
 * Veto de preço: depois de simular preço NÃO há botão "e se for R$ X?". Escolher o valor seria
 * sugerir preço, só que em forma de botão.
 */

export type Sugestao = { rotulo: string; pergunta: string }

type Candidata = Sugestao & { precisa: string }

const MAXIMO = 3

/** A pergunta de cada intenção quando o Motor precisa oferecê-la (empate, "não entendi"). */
const PERGUNTA: Partial<Record<Intencao, Candidata>> = {
  faturamento: { rotulo: 'Quanto entrou no mês', pergunta: 'quanto faturei este mês?', precisa: 'faturamento_do_periodo' },
  sobra: { rotulo: 'Quanto sobrou no mês', pergunta: 'quanto sobrou este mês?', precisa: 'faturamento_do_periodo' },
  quem_sumiu: { rotulo: 'Quem sumiu', pergunta: 'quem sumiu?', precisa: 'clientes_para_recuperar' },
  agenda_de_hoje: { rotulo: 'Como está o dia', pergunta: 'como está o meu dia?', precisa: 'resumo_de_hoje' },
  ocupacao: { rotulo: 'Horário vago amanhã', pergunta: 'tem horário vago amanhã?', precisa: 'ocupacao_do_dia' },
  orcamentos: { rotulo: 'Orçamentos parados', pergunta: 'tem orçamento sem resposta?', precisa: 'orcamentos_parados' },
  estoque: { rotulo: 'O que está acabando', pergunta: 'o que está acabando no estoque?', precisa: 'alertas_de_estoque' },
}

const PADRAO: Candidata[] = [PERGUNTA.quem_sumiu!, PERGUNTA.agenda_de_hoje!, PERGUNTA.ocupacao!, PERGUNTA.faturamento!]

export function proximosPassos(o: {
  ent: Entendimento
  etapas: ReadonlyArray<Etapa>
  foco?: Foco
  disponiveis: ReadonlySet<string>
  pendente?: { opcoes: ReadonlyArray<{ nome: string }> } | null
  /** Nome da pessoa da ficha aberta, quando a resposta foi sobre alguém. */
  nomeDaPessoa?: string | null
  mesCorrente?: boolean
  diaPedido?: 'hoje' | 'amanha' | 'outro' | null
}): Sugestao[] {
  // "Qual delas?": as opções são os botões. Não passam pelo filtro de ferramenta: a chamada que
  // elas completam é a mesma que acabou de rodar.
  if (o.pendente && o.pendente.opcoes.length > 0) {
    return o.pendente.opcoes.slice(0, MAXIMO + 1).map((x) => ({ rotulo: x.nome, pergunta: x.nome }))
  }

  const c: Candidata[] = []
  const ultima = o.etapas[o.etapas.length - 1]?.chamada.nome

  if (o.ent.tipo === 'nao_entendi') c.push(...PADRAO)
  else if (o.ent.tipo === 'ambiguo') c.push(...o.ent.opcoes.flatMap((i) => (PERGUNTA[i] ? [PERGUNTA[i]!] : [])))
  else {
    switch (ultima) {
      case 'faturamento_do_periodo':
        c.push({ rotulo: 'Por quê?', pergunta: 'por quê?', precisa: 'explicar_variacao' })
        if (o.mesCorrente) c.push({ rotulo: 'E o mês passado?', pergunta: 'e no mês passado?', precisa: 'faturamento_do_periodo' })
        if (o.mesCorrente && o.ent.intencao === 'faturamento') c.push(PERGUNTA.sobra!)
        if (o.mesCorrente && o.ent.intencao === 'sobra') c.push(PERGUNTA.faturamento!)
        break
      case 'explicar_variacao':
      case 'clientes_para_recuperar':
        if (o.foco === 'quem_primeiro') c.push({ rotulo: 'Quanto dá para recuperar', pergunta: 'quanto dá para recuperar?', precisa: 'clientes_para_recuperar' })
        else c.push({ rotulo: 'Quem eu chamo primeiro', pergunta: 'quem eu chamo primeiro?', precisa: 'clientes_para_recuperar' })
        break
      case 'resumo_de_hoje':
        if (o.foco !== 'confirmacoes') c.push({ rotulo: 'Quem falta confirmar', pergunta: 'quem eu preciso confirmar hoje?', precisa: 'resumo_de_hoje' })
        c.push(PERGUNTA.ocupacao!)
        break
      case 'ocupacao_do_dia':
        if (o.diaPedido === 'hoje') c.push({ rotulo: 'E amanhã?', pergunta: 'e amanhã?', precisa: 'ocupacao_do_dia' })
        if (o.diaPedido === 'amanha') c.push({ rotulo: 'E depois de amanhã?', pergunta: 'e depois de amanhã?', precisa: 'ocupacao_do_dia' })
        break
      case 'historico_do_cliente':
        if (o.nomeDaPessoa) {
          if (o.foco !== 'quanto_deixou') c.push({ rotulo: 'Quanto já gastou', pergunta: `quanto ${o.nomeDaPessoa} já gastou comigo?`, precisa: 'historico_do_cliente' })
          if (o.foco !== 'telefone') c.push({ rotulo: 'Qual o telefone', pergunta: `qual o telefone de ${o.nomeDaPessoa}?`, precisa: 'historico_do_cliente' })
          if (o.foco !== 'costume') c.push({ rotulo: 'Que dia costuma vir', pergunta: `que dia ${o.nomeDaPessoa} costuma vir?`, precisa: 'historico_do_cliente' })
        }
        break
      // simular_preco: sem botão de outro preço — veto (ver cabeçalho).
    }
  }

  const vistas = new Set<string>()
  return c
    .filter((x) => o.disponiveis.has(x.precisa) && !vistas.has(x.pergunta) && vistas.add(x.pergunta))
    .slice(0, MAXIMO)
    .map(({ rotulo, pergunta }) => ({ rotulo, pergunta }))
}
