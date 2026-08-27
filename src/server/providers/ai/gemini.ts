import { ErroDeInferencia, type AiProvider, type MensagemDoAssistente, type PedidoAoModelo, type RespostaDoModelo } from './types'

// docs/26-AGENTE-IA-PLANO.md §7: Gemini 2.5 Flash é o provider recomendado — mais barato que
// Claude Haiku (~R$ 0,004/pergunta vs ~R$ 0,027) e sem a exposição de LGPD do DeepSeek (dados
// hospedados na China, aviso de privacidade fora do padrão brasileiro).
const MODELO = 'gemini-2.5-flash'

// Mesma razão de `whatsapp.ts` TIMEOUT_MS: sem isto, um provedor que trava (não erra — só não
// responde) prende o handler da rota até o timeout da função serverless.
const TIMEOUT_MS = 10_000

function config(): { apiKey: string } {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // docs/26 §4.4: sem chave, o assistente não pode existir em silêncio — quem chama
    // (server/services/assistente.ts) trata este throw como "não mostrar o botão", nunca
    // como "responder que não sabe".
    throw new ErroDeInferencia('GEMINI_API_KEY não configurada.', 'sem_credencial')
  }
  return { apiKey }
}

/** Mapeia o histórico interno para o formato `contents`/`role` da API do Gemini. */
function paraConteudoGemini(mensagens: MensagemDoAssistente[]) {
  const contents: Record<string, unknown>[] = []
  let textoSistema: string | undefined

  for (const m of mensagens) {
    if (m.papel === 'sistema') {
      // Gemini não tem mensagem de sistema na lista de `contents` — vai em `systemInstruction`
      // à parte. Concatena se vier mais de uma (não deveria, mas não quebra se vier).
      textoSistema = textoSistema ? `${textoSistema}\n\n${m.texto}` : m.texto
      continue
    }
    if (m.papel === 'usuario') {
      contents.push({ role: 'user', parts: [{ text: m.texto }] })
      continue
    }
    if (m.papel === 'assistente') {
      const parts: Record<string, unknown>[] = []
      if (m.texto) parts.push({ text: m.texto })
      if (m.chamadaFerramenta) {
        parts.push({ functionCall: { name: m.chamadaFerramenta.nome, args: JSON.parse(m.chamadaFerramenta.argumentos) } })
      }
      contents.push({ role: 'model', parts })
      continue
    }
    // papel === 'ferramenta': resultado de execução, devolvido como functionResponse.
    contents.push({
      role: 'user',
      parts: [{ functionResponse: { name: m.nome, response: { conteudo: m.conteudo } } }],
    })
  }

  return { contents, systemInstruction: textoSistema ? { parts: [{ text: textoSistema }] } : undefined }
}

/**
 * Implementação real da Gemini API (`generateContent`). Sem `GEMINI_API_KEY`, toda chamada
 * estoura em `config()` — mesmo padrão de `WhatsAppCloudProvider`.
 */
export class GeminiProvider implements AiProvider {
  async perguntar(pedido: PedidoAoModelo): Promise<RespostaDoModelo> {
    const { apiKey } = config()
    const { contents, systemInstruction } = paraConteudoGemini(pedido.mensagens)

    const corpo: Record<string, unknown> = { contents }
    if (systemInstruction) corpo.systemInstruction = systemInstruction
    if (pedido.ferramentas.length > 0) {
      corpo.tools = [
        {
          functionDeclarations: pedido.ferramentas.map((f) => ({
            name: f.nome,
            description: f.descricao,
            parameters: f.parametros,
          })),
        },
      ]
    }

    let resposta: Response
    try {
      resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'TimeoutError') {
        throw new ErroDeInferencia('Gemini não respondeu a tempo.', 'timeout')
      }
      throw new ErroDeInferencia('Falha de rede ao chamar o Gemini.', 'falha_do_provedor')
    }

    if (!resposta.ok) {
      throw new ErroDeInferencia(`Gemini devolveu ${resposta.status}.`, 'falha_do_provedor')
    }

    const json = await resposta.json()
    const parte = json?.candidates?.[0]?.content?.parts?.[0]
    if (!parte) throw new ErroDeInferencia('Gemini devolveu resposta vazia.', 'falha_do_provedor')

    if (parte.functionCall) {
      return { tipo: 'chamada_ferramenta', nome: parte.functionCall.name, argumentos: JSON.stringify(parte.functionCall.args ?? {}) }
    }
    if (typeof parte.text === 'string') {
      return { tipo: 'texto', texto: parte.text }
    }
    throw new ErroDeInferencia('Gemini devolveu um formato inesperado.', 'falha_do_provedor')
  }
}
