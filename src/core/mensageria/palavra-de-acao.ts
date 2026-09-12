/**
 * Webhook de entrada do WhatsApp — reconhece só duas palavras, e nada além delas.
 *
 * Este não é um assistente que interpreta texto livre: é uma correspondência estrita contra um
 * vocabulário fechado. Cliente que escreve qualquer coisa fora daqui não aciona nada — o texto
 * chega ao servidor, é registrado (`server/services/whatsapp-inbound.ts`), e ninguém adivinha o
 * que ela quis dizer. "Não reconheci" é sempre mais seguro que "acho que entendi".
 *
 * **Por que não usar um regex de prefixo tipo `confirma` seguido de `\w` estrela.** `\w` do JavaScript não casa acento — já foi
 * achado nesta base (`regex-pt-br-w-nao-casa-acento`) que isso deixa "confirmação" fora de um
 * padrão que deveria pegá-la. Aqui o caminho é o oposto: normalizar (minúsculo, sem acento, sem
 * pontuação nas pontas) e comparar contra uma LISTA, nunca um regex de prefixo.
 *
 * **Por que a lista é curta.** "sim"/"ok" pareceriam naturais, mas são genéricos demais — a mesma
 * palavra que confirma um horário confirmaria qualquer outra pergunta que o salão um dia fizesse
 * por esse número. As poucas palavras aqui só têm um significado possível no contexto de agenda.
 */

const CONFIRMAR = new Set(['confirmar', 'confirmo', 'confirmado', 'confirmada'])
const CANCELAR = new Set(['cancelar', 'cancelo', 'cancelado', 'cancelada'])

export type AcaoReconhecida = 'confirmar' | 'cancelar' | null

/** Minúsculo, sem acento, sem pontuação de borda — mas SEM tocar o meio da frase. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacrítico (NFD separa letra de acento)
    .trim()
    .toLowerCase()
    .replace(/^[!.,;:?\s]+|[!.,;:?\s]+$/g, '')
}

/**
 * A mensagem inteira precisa SER a palavra, não conter a palavra. "Confirmar às 15h seria
 * possível?" não é uma confirmação — é uma pergunta que usa a mesma palavra. Reconhecer FRASE
 * inteira, e não substring, é o que impede isso.
 */
export function acaoDoTexto(texto: string): AcaoReconhecida {
  const normalizado = normalizar(texto)
  if (CONFIRMAR.has(normalizado)) return 'confirmar'
  if (CANCELAR.has(normalizado)) return 'cancelar'
  return null
}
