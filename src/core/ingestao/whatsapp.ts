/**
 * CNV-015 · Conversa exportada do WhatsApp (`.txt`) → quem participa (`docs/103-conversor/00c-…` §6).
 *
 * O dono que só tem a lista no WhatsApp (grupo de clientes, conversas do número do salão) exporta a
 * conversa e manda. O que se aproveita: os AUTORES — o nome como está salvo no celular de quem
 * exportou, ou o número quando não está salvo. A data da última mensagem NÃO vira coluna: conversa não
 * é visita, e uma coluna de datas recentes seria lida pela esteira como "última visita".
 *
 * Formatos (pt-BR): Android `15/08/2026 14:30 - Maria: oi` e iOS `[15/08/2026, 14:30:05] Maria: oi`,
 * com as marcas invisíveis (LRM/RLM, espaço estreito) que o próprio app insere. Mensagem de sistema
 * (sem "Autor:") e linha de continuação de mensagem longa não viram ninguém.
 */

const INVISIVEIS = /[‎‏‪-‮⁦-⁩]/g
const ANDROID = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),? (\d{1,2}:\d{2})(?::\d{2})?(?:\s?[AP]M)? - ([^:]{1,80}?): /i
const IOS = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),? (\d{1,2}:\d{2})(?::\d{2})?(?:\s?[AP]M)?\] ([^:]{1,80}?): /i

const limpar = (linha: string) => linha.replace(INVISIVEIS, '').replace(/ | /g, ' ')

/** Pelo menos metade das linhas que começam com data tem o formato de conversa do WhatsApp. */
export function pareceConversaDoWhatsApp(texto: string): boolean {
  const linhas = texto.split(/\r?\n/).slice(0, 80).map(limpar).filter((l) => /^\[?\d{1,2}\/\d{1,2}\/\d{2,4}/.test(l))
  if (linhas.length < 2) return false
  return linhas.filter((l) => ANDROID.test(l) || IOS.test(l) || /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}/.test(l)).length / linhas.length >= 0.5
}

/** Participantes → grade com cabeçalho conhecido (Nome, Telefone), uma pessoa por autor. */
export function gradeDeConversa(texto: string): { grade: string[][]; mensagens: number; naoReconhecidas: number } {
  const autores = new Map<string, number>()
  let mensagens = 0
  let naoReconhecidas = 0
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = limpar(bruta)
    if (linha.trim() === '') continue
    const m = ANDROID.exec(linha) ?? IOS.exec(linha)
    if (!m) {
      // Começa com data mas não tem "Autor:": mensagem de sistema ("Você criou o grupo…"). Sem data:
      // continuação da mensagem anterior. Nenhuma das duas é uma pessoa; só contamos.
      if (/^\[?\d{1,2}\/\d{1,2}\/\d{2,4}/.test(linha)) naoReconhecidas++
      continue
    }
    mensagens++
    const autor = m[3]!.trim()
    autores.set(autor, (autores.get(autor) ?? 0) + 1)
  }
  const grade: string[][] = [['Nome', 'Telefone']]
  for (const autor of autores.keys()) {
    const soNumero = /^\+?[\d\s()-]{8,}$/.test(autor)
    grade.push(soNumero ? ['', autor] : [autor, ''])
  }
  return { grade, mensagens, naoReconhecidas }
}
