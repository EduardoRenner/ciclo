import { ErroDeInferencia, type AiProvider, type MensagemDoAssistente, type PedidoAoModelo, type RespostaDoModelo } from './types'

// docs/26-AGENTE-IA-PLANO.md §7: Gemini Flash é o provider recomendado — mais barato que
// Claude Haiku e sem a exposição de LGPD do DeepSeek (dados hospedados na China, aviso de
// privacidade fora do padrão brasileiro).
//
// 2026-08-30: `gemini-2.5-flash` passou a devolver 404 ("no longer available to new users") na
// chave criada nesta data — a Generative Language API descontinuou o modelo para chaves novas
// entre a escrita do docs/26 (26/08) e hoje. Testado direto contra a API, latência medida em
// várias chamadas com a ferramenta de exemplo:
//   - `gemini-3.6-flash`: "thinking" por padrão (128 tokens de raciocínio só para dizer "ok"),
//     12,7s numa chamada de ferramenta — estoura qualquer timeout razoável para UI síncrona.
//   - `gemini-3.1-flash-lite`: 1,1–2,9s na mesma chamada, sem precisar de thinkingConfig.
// `gemini-3.1-flash-lite` é a escolha certa aqui: o assistente só ESCOLHE ferramenta e redige a
// frase em volta do valor que ela devolve (regra inegociável §0 item 1) — não resolve problema,
// não precisa do modelo de raciocínio mais caro e mais lento.
//
// Custo recalibrado em docs/26 §7 (2026-08-30): ~R$ 0,0015-0,0070/pergunta, medido/estimado —
// ainda ruído contra R$ 45,57 de líquido/assinante. Número exato por tenant/mês segue [S] até
// existir volume de produção.
const MODELO = 'gemini-3.1-flash-lite'

// Mesma razão de `whatsapp.ts` TIMEOUT_MS: sem isto, um provedor que trava (não erra — só não
// responde) prende o handler da rota até o timeout da função serverless.
//
// 2026-08-30: mesmo o `gemini-3.1-flash-lite` (rápido no caso comum) teve UMA em três chamadas
// de teste travar por completo, sem resposta nenhuma em 20s — é modelo preview, sob "alta
// demanda" (503 medido à parte). 15s dá margem sem deixar a UI travada por tempo grande demais;
// não elimina a falha ocasional, só evita que ela prenda o handler além do necessário. O retry
// que faltava foi adicionado no `perguntar()` abaixo — ver o comentário lá.
const TIMEOUT_MS = 15_000

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
        const functionCall: Record<string, unknown> = { name: m.chamadaFerramenta.nome, args: JSON.parse(m.chamadaFerramenta.argumentos) }
        const part: Record<string, unknown> = { functionCall }
        // Gemini 3.x recusa o turno seguinte com 400 ("missing thought_signature") se a chamada
        // de ferramenta reenviada no histórico não trouxer de volta o token que ele mesmo
        // devolveu na resposta original — descoberto testando o laço de verdade pela primeira
        // vez (a Fase A nunca tinha sido exercitada contra a API real até hoje, 30/08).
        if (m.chamadaFerramenta.assinatura) part.thoughtSignature = m.chamadaFerramenta.assinatura
        parts.push(part)
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

    // `thinkingLevel: 'minimal'` — sem isto, o gemini-3.6-flash "pensa" antes de responder mesmo
    // em pergunta trivial (medido: 128 tokens de raciocínio para dizer "ok", 1,2s vira ~4-8s),
    // o que já estourou o TIMEOUT_MS de 10s numa chamada real com ferramenta. Este produto
    // escolhe QUAL ferramenta chamar, não resolve problema — não precisa de raciocínio profundo.
    const corpo: Record<string, unknown> = { contents, generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' } } }
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

    // Uma segunda tentativa em falha TRANSITÓRIA — a pendência que o comentário do TIMEOUT_MS
    // acima registrou em aberto, e que virou urgente quando o assistente passou a OPERAR o
    // produto (30/08): errar uma pergunta é chato; errar a marcação de um horário é o dono
    // perdendo a confiança na feature. Medido: `gemini-3.1-flash-lite` travou 1 de 3 chamadas
    // num teste, e o 503 "high demand" apareceu à parte.
    //
    // Só timeout e 5xx entram no retry. 4xx NUNCA: `400` (schema errado), `401` (chave),
    // `404` (modelo) não melhoram repetindo — repetir erro de código é gastar o tempo do dono
    // duas vezes para chegar no mesmo lugar. E é UMA tentativa extra, não um laço: com
    // TIMEOUT_MS de 15s, duas já são 30s no pior caso, e `maxDuration` da rota é 60.
    let resposta: Response | undefined
    let ultimoErro: ErroDeInferencia | undefined

    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        // 5xx é o provedor de joelhos, não pedido errado: vale repetir uma vez.
        if (r.status >= 500 && tentativa === 0) {
          ultimoErro = new ErroDeInferencia(`Gemini devolveu ${r.status}.`, 'falha_do_provedor')
          continue
        }
        resposta = r
        break
      } catch (erro) {
        const ehTimeout = erro instanceof DOMException && erro.name === 'TimeoutError'
        ultimoErro = ehTimeout
          ? new ErroDeInferencia('Gemini não respondeu a tempo.', 'timeout')
          : new ErroDeInferencia('Falha de rede ao chamar o Gemini.', 'falha_do_provedor')
        // Na última volta o erro sobe; na primeira, tenta de novo.
      }
    }

    if (!resposta) throw ultimoErro ?? new ErroDeInferencia('Falha ao chamar o Gemini.', 'falha_do_provedor')

    if (!resposta.ok) {
      // O corpo do erro do Gemini traz o motivo real (ex.: "missing thought_signature") — sem
      // isto, todo 4xx vira "Gemini devolveu 400" no log e a causa só se descobre reproduzindo
      // a chamada fora da produção, como foi preciso fazer para achar este mesmo bug.
      const corpoErro = await resposta.text().catch(() => '')
      throw new ErroDeInferencia(`Gemini devolveu ${resposta.status}: ${corpoErro.slice(0, 300)}`, 'falha_do_provedor')
    }

    const json = await resposta.json()
    const parte = json?.candidates?.[0]?.content?.parts?.[0]
    if (!parte) throw new ErroDeInferencia('Gemini devolveu resposta vazia.', 'falha_do_provedor')

    if (parte.functionCall) {
      return {
        tipo: 'chamada_ferramenta',
        nome: parte.functionCall.name,
        argumentos: JSON.stringify(parte.functionCall.args ?? {}),
        assinatura: typeof parte.thoughtSignature === 'string' ? parte.thoughtSignature : undefined,
      }
    }
    if (typeof parte.text === 'string') {
      return { tipo: 'texto', texto: parte.text }
    }
    throw new ErroDeInferencia('Gemini devolveu um formato inesperado.', 'falha_do_provedor')
  }
}
