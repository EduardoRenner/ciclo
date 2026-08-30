/**
 * docs/26-AGENTE-IA-PLANO.md §2 — espelha `providers/messaging/types.ts` de propósito: mesma
 * forma (interface fina + implementação separada por provedor), mesma razão (trocar de provedor
 * vira reescrever um arquivo, não o produto).
 *
 * O provider de IA NUNCA decide números nem acessa o banco — ele só recebe um prompt e uma lista
 * de ferramentas disponíveis, e devolve texto ou uma chamada de ferramenta. Quem executa a
 * ferramenta e quem confere permissão é `server/services/assistente.ts`, nunca este arquivo.
 */

/** Descrição de uma ferramenta no formato que o modelo lê para decidir se e quando chamá-la. */
export type DescricaoFerramenta = {
  nome: string
  descricao: string
  /** JSON Schema dos parâmetros — mesmo formato que Zod-to-JSON-Schema produz. */
  parametros: Record<string, unknown>
}

export type MensagemDoAssistente =
  | { papel: 'sistema'; texto: string }
  | { papel: 'usuario'; texto: string }
  /**
   * Resposta anterior do modelo, quando o laço já chamou uma ferramenta antes (docs/26 §2).
   * `assinatura`: token opaco que ALGUNS provedores (Gemini 3.x) exigem de volta, inalterado,
   * junto da chamada de ferramenta reenviada no histórico — sem ele o Gemini 3 recusa o próximo
   * turno com 400 ("missing thought_signature"). Provedor que não usa isso ignora o campo.
   */
  | { papel: 'assistente'; texto: string | null; chamadaFerramenta?: { nome: string; argumentos: string; assinatura?: string } }
  /** Resultado de uma ferramenta já executada, devolvido ao modelo no próximo turno do laço. */
  | { papel: 'ferramenta'; nome: string; conteudo: string }

export type RespostaDoModelo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'chamada_ferramenta'; nome: string; argumentos: string; assinatura?: string }

export type PedidoAoModelo = {
  mensagens: MensagemDoAssistente[]
  ferramentas: DescricaoFerramenta[]
}

export interface AiProvider {
  /**
   * Uma rodada do laço: manda o histórico + ferramentas disponíveis, recebe texto OU uma
   * chamada de ferramenta (nunca os dois). Lança em timeout ou erro do provedor — quem chama
   * decide o que fazer (docs/26 §4.4: sem chave/erro, o botão do assistente não aparece,
   * nunca degrada em silêncio).
   */
  perguntar(pedido: PedidoAoModelo): Promise<RespostaDoModelo>
}

/** Erro específico de falha do provedor de IA — mesmo desenho de `ErroDeEnvio` em messaging/types.ts. */
export class ErroDeInferencia extends Error {
  readonly motivo: 'sem_credencial' | 'timeout' | 'falha_do_provedor'
  constructor(message: string, motivo: 'sem_credencial' | 'timeout' | 'falha_do_provedor') {
    super(message)
    this.name = 'ErroDeInferencia'
    this.motivo = motivo
  }
}
