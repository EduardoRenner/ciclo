import type { z } from 'zod'

/**
 * O que volta para o MODELO quando os argumentos que ele mandou não passam no Zod.
 *
 * Antes era a frase fixa "Argumentos inválidos para esta ferramenta." — e a frase fixa é um beco
 * sem saída: o modelo não sabe QUAL campo errou nem POR QUÊ, então a correção mais provável é
 * repetir exatamente o mesmo erro. Com `MAX_CHAMADAS_DE_FERRAMENTA = 3`, isso queima as voltas
 * restantes às cegas e o dono recebe "não consegui terminar de responder" numa pergunta que
 * falhou por um traço no lugar errado.
 *
 * Ficou mais provável em 2026-08-30: a limpeza de schema para o Gemini tira `pattern`, `minLength`
 * e afins, então o formato que antes viajava no schema agora só existe na descrição. O Zod no
 * servidor virou a única checagem de verdade — e uma checagem que não explica o que quer é uma
 * checagem que o modelo não consegue obedecer.
 *
 * NUNCA inclui o valor recebido, só o caminho e a mensagem. O valor pode ser nome ou telefone de
 * cliente que o dono ditou, e ele entraria no histórico da conversa e no log do provedor sem
 * nenhum ganho: para consertar a chamada basta saber o campo e a regra.
 */
export function explicarArgumentosInvalidos(erro: z.ZodError): string {
  const partes: string[] = []
  for (const problema of erro.issues.slice(0, 5)) {
    const campo = problema.path.join('.')
    partes.push(campo ? `${campo}: ${problema.message}` : problema.message)
  }
  if (partes.length === 0) return 'Argumentos inválidos para esta ferramenta.'
  return `Argumentos inválidos: ${partes.join('; ')}. Corrija e chame a ferramenta de novo.`
}
