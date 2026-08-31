/**
 * O que dizer antes de sair da conta, sabendo que sair APAGA a fila offline deste aparelho.
 *
 * A tela de sair já tinha a proteção certa e o comentário certo: contar o que não subiu e avisar,
 * porque "descartar trabalho de alguém em silêncio é o tipo de coisa que a pessoa só descobre no
 * dia seguinte, quando o cliente aparece para um horário que não existe".
 *
 * Só que a contagem vinha de `listarMutacoes().catch(() => [])`. Esse `catch` transforma "não
 * consegui LER a fila" em "a fila está VAZIA" — e aí o aviso é pulado exatamente na hora em que
 * mais importa. IndexedDB falha de verdade: janela anônima, armazenamento cheio, base corrompida,
 * navegador com dados de site bloqueados. A proteção existia e se desligava sozinha no escuro.
 *
 * Por isso "não sei" é um estado próprio, e não um sinônimo de zero. Diante da dúvida o certo é
 * avisar: o custo de avisar à toa é um toque a mais; o custo de não avisar é a recepcionista
 * perder doze agendamentos sem uma palavra.
 */
export type LeituraDaFila = { ok: true; quantidade: number } | { ok: false }

export type AvisoDeSaida =
  | { tipo: 'pode_sair' }
  | { tipo: 'vai_descartar'; quantidade: number }
  /** A leitura falhou: pode não haver nada, pode haver dez. Ninguém sabe — então pergunta. */
  | { tipo: 'nao_sei' }

export function avisoAntesDeSair(leitura: LeituraDaFila): AvisoDeSaida {
  if (!leitura.ok) return { tipo: 'nao_sei' }
  if (leitura.quantidade > 0) return { tipo: 'vai_descartar', quantidade: leitura.quantidade }
  return { tipo: 'pode_sair' }
}
