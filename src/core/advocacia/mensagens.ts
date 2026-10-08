/**
 * A mensagem pronta de WhatsApp do pacote Advocacia (docs/101 D5 e D6, anexo 02 A19). Pura.
 *
 * Duas regras, e as duas são de sigilo, não de estilo:
 *  - o texto vai para a Meta e fica no histórico do navegador e do aparelho do cliente, então NUNCA
 *    leva número de processo, nome de bem, valor, assunto do caso nem nome de parte. Só o que o
 *    escritório escreveu para o cliente ler (`client_title`, o título genérico da pendência);
 *  - nada é enviado sozinho: o produto monta o texto e a pessoa abre o WhatsApp e envia.
 *
 * Sem gênero presumido e sem travessão (guardas `copy-nao-supoe-genero`, `copy-sem-travessao`).
 */

export type PedidoDeMensagem =
  | { tipo: 'cobranca'; primeiroNome: string | null; escritorio: string; casoParaCliente: string; itens: readonly string[] }
  | { tipo: 'andamento'; primeiroNome: string | null; escritorio: string; casoParaCliente: string; frase: string }
  | { tipo: 'confirmar_reuniao'; primeiroNome: string | null; escritorio: string; quando: string }

/** Padrões que NUNCA podem sair num texto de WhatsApp do pacote. Exportado para a guarda e para o teste. */
export const PROIBIDO_NA_MENSAGEM: readonly { nome: string; re: RegExp }[] = [
  // número CNJ (com ou sem máscara): 20 dígitos
  { nome: 'número de processo', re: /(?<!\d)\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}(?!\d)/u },
  { nome: 'valor em reais', re: /R\$\s*\d/u },
  { nome: 'CPF', re: /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/u },
  { nome: 'CNPJ', re: /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/u },
]

/** Os itens que cabem num lembrete: mais que isso vira lista que ninguém lê no celular. */
export const MAX_ITENS_NA_COBRANCA = 5

const saudacao = (nome: string | null) => (nome && nome.trim() ? `Oi, ${nome.trim()}!` : 'Oi!')

export type MensagemMontada = { ok: true; texto: string } | { ok: false; motivo: string }

/**
 * Monta o texto e recusa se algo proibido apareceu (veio de um campo que o escritório preencheu
 * errado, por exemplo um `client_title` com o número do processo). Recusar é melhor que limpar: o
 * escritório vê o motivo e corrige a fonte.
 */
export function montarMensagem(p: PedidoDeMensagem): MensagemMontada {
  let texto: string
  if (p.tipo === 'cobranca') {
    if (p.itens.length === 0) return { ok: false, motivo: 'Nenhuma pendência para cobrar.' }
    const itens = p.itens.slice(0, MAX_ITENS_NA_COBRANCA)
    const resto = p.itens.length - itens.length
    texto = [
      `${saudacao(p.primeiroNome)} Aqui é do ${p.escritorio}.`,
      `Para seguir com ${p.casoParaCliente}, ainda precisamos de:`,
      ...itens.map((i) => `• ${i}`),
      ...(resto > 0 ? [`e mais ${resto} ${resto === 1 ? 'item' : 'itens'}.`] : []),
      'Pode enviar por aqui mesmo. Agradecemos.',
    ].join('\n')
  } else if (p.tipo === 'andamento') {
    texto = `${saudacao(p.primeiroNome)} Aqui é do ${p.escritorio}. Novidade sobre ${p.casoParaCliente}: ${p.frase}`
  } else {
    texto = `${saudacao(p.primeiroNome)} Aqui é do ${p.escritorio}. Confirmamos nossa conversa ${p.quando}? Se precisar mudar, é só responder.`
  }
  const achado = PROIBIDO_NA_MENSAGEM.find((x) => x.re.test(texto))
  if (achado) return { ok: false, motivo: `A mensagem traria ${achado.nome}. Corrija o texto do caso ou da pendência antes de enviar.` }
  return { ok: true, texto }
}
