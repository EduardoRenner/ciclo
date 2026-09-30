import { Temporal } from '@js-temporal/polyfill'

import { entender, type Entendimento } from '@/core/inteligencia/entender'
import { contextoParaDepois, lembrar, lerContexto } from '@/core/inteligencia/lembrar'
import { sinalSemResposta } from '@/core/inteligencia/medir'
import { proximosPassos } from '@/core/inteligencia/proximos'
import { continuar, focoDaPergunta, FORA_DO_ALCANCE, planejar, type Etapa, type Passo } from '@/core/inteligencia/planejar'
import { diaNoFuso } from '@/core/tempo/dia'

import type { AiProvider, PedidoAoModelo, RespostaDoModelo } from './types'

/**
 * MI-2 (docs/85 §4.2) — o Motor de Inteligência no lugar do Gemini, pela MESMA interface.
 *
 * Tudo o que importa continua onde estava: o laço (`executarLaco`), o filtro de ferramentas por
 * papel e plano, a segunda checagem antes de executar, a auditoria e as propostas com botão. Este
 * arquivo só troca QUEM decide a próxima jogada: em vez de mandar o histórico para um modelo e
 * esperar texto ou chamada de ferramenta, ele entende a pergunta por regra (`entender`), decide a
 * ferramenta (`planejar`) e, com o resultado no histórico, fala (`continuar` → `falar`).
 *
 * Sem rede, sem token, sem chave: não há `ErroDeInferencia` de credencial nem de timeout para
 * lançar. A mesma pergunta, no mesmo dia, dá a mesma resposta — e dá para testar sem banco.
 *
 * O que sai daqui NUNCA vai para terceiro: nome de cliente, anotação e número ficam no servidor
 * do CICLO. É a primeira vez que o assistente não depende de mandar dado do salão para fora.
 */
export class MotorDeConversa implements AiProvider {
  constructor(private readonly timezone: string) {}

  async perguntar(pedido: PedidoAoModelo): Promise<RespostaDoModelo> {
    return responder(pedido, this.timezone, Temporal.PlainDate.from(diaNoFuso(this.timezone)))
  }
}

/** O que os botões precisam saber da resposta que acabou de sair (MI-3). */
function dadosDosBotoes(ent: Entendimento, etapas: ReadonlyArray<Etapa>, hoje: Temporal.PlainDate) {
  const ultima = etapas[etapas.length - 1]
  let nomeDaPessoa: string | null = null
  if (ultima?.chamada.nome === 'historico_do_cliente') {
    try {
      const nome = (JSON.parse(ultima.resultado) as { cliente?: { name?: unknown } }).cliente?.name
      nomeDaPessoa = typeof nome === 'string' ? nome : null
    } catch {
      /* resultado ilegível: sem botão com nome */
    }
  }
  const p = ent.tipo === 'intencao' ? ent.entidades.periodo : undefined
  const mesDeHoje = `${hoje.year}-${String(hoje.month).padStart(2, '0')}`
  const data = typeof ultima?.chamada.argumentos.data === 'string' ? ultima.chamada.argumentos.data : null
  return {
    nomeDaPessoa,
    mesCorrente: !p || (p.tipo === 'mes' && p.mes === mesDeHoje),
    diaPedido: data === null ? null : data === hoje.toString() ? ('hoje' as const) : data === hoje.add({ days: 1 }).toString() ? ('amanha' as const) : ('outro' as const),
  }
}

/** Exportada para teste: a mesma decisão, com "hoje" fixo. */
export function responder(pedido: PedidoAoModelo, timezone: string, hoje: Temporal.PlainDate): RespostaDoModelo {
  const { mensagens, ferramentas } = pedido

  let iPergunta = -1
  for (let i = mensagens.length - 1; i >= 0; i--) {
    if (mensagens[i]!.papel === 'usuario') {
      iPergunta = i
      break
    }
  }
  const pergunta = iPergunta >= 0 ? (mensagens[iPergunta] as { texto: string }).texto : ''

  // O que já aconteceu nesta pergunta: pares chamada → resultado, na ordem.
  const etapas: Etapa[] = []
  for (let i = iPergunta + 1; i < mensagens.length; i++) {
    const m = mensagens[i]!
    if (m.papel !== 'assistente' || !m.chamadaFerramenta) continue
    const r = mensagens[i + 1]
    if (r?.papel !== 'ferramenta') continue
    let argumentos: Record<string, unknown> = {}
    try {
      argumentos = JSON.parse(m.chamadaFerramenta.argumentos || '{}') as Record<string, unknown>
    } catch {
      /* argumentos ilegíveis: a etapa conta, sem eles */
    }
    etapas.push({ chamada: { nome: m.chamadaFerramenta.nome, argumentos }, resultado: r.conteudo })
  }

  // MI-4: a pergunta nova, somada ao que a anterior deixou ("e no mês passado?", "a Juliana").
  const { ent, chamadaDireta, foco: focoHerdado } = lembrar(entender(pergunta, hoje), lerContexto(pedido.contexto), pergunta)
  const foco = focoHerdado ?? focoDaPergunta(ent, pergunta)
  const ctx = { texto: pergunta, hoje, timezone, disponiveis: new Set(ferramentas.map((f) => f.nome)), foco }
  const passo: Passo =
    etapas.length > 0
      ? continuar(ent, etapas, ctx)
      : chamadaDireta && ctx.disponiveis.has(chamadaDireta.nome)
        ? { tipo: 'ferramenta', chamada: chamadaDireta }
        : planejar(ent, ctx)

  if (passo.tipo === 'texto') {
    const contexto = contextoParaDepois(ent, etapas, foco)
    // Só no primeiro turno: depois de consultar, houve resposta — boa ou "não achei", mas houve.
    const sinal = etapas.length === 0 ? sinalSemResposta(ent, pergunta, passo.texto === FORA_DO_ALCANCE) : null
    const sugestoes = proximosPassos({
      ent,
      etapas,
      foco,
      disponiveis: ctx.disponiveis,
      pendente: contexto?.pendente ?? null,
      ...dadosDosBotoes(ent, etapas, hoje),
    })
    return {
      tipo: 'texto',
      texto: passo.texto,
      ...(contexto ? { contexto } : {}),
      ...(sinal ? { sinal } : {}),
      ...(sugestoes.length > 0 ? { sugestoes } : {}),
    }
  }
  // Na última volta do laço o pedido não oferece ferramenta nenhuma; pedir uma ali seria ignorada.
  // `continuar` já devolve texto quando a ferramenta não está disponível — isto é só a rede.
  if (!ctx.disponiveis.has(passo.chamada.nome)) return { tipo: 'texto', texto: 'Não consegui terminar de responder. Tente perguntar de outro jeito.' }
  return { tipo: 'chamada_ferramenta', nome: passo.chamada.nome, argumentos: JSON.stringify(passo.chamada.argumentos) }
}
