import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Mesmo mecanismo do `confirmacao-token.ts` (TICKET-030), generalizado: HMAC para qualquer link
 * que precise funcionar sem login e sem tabela de token dedicada. `escopo` entra na assinatura
 * para um token de lista de espera nunca ser aceito onde um token de confirmação de agendamento
 * era esperado, mesmo que o id por trás seja parecido.
 *
 * O segredo é parâmetro opcional, não só `process.env` lido direto: testes de arquivos
 * diferentes rodam em threads que compartilham `process.env` no Vitest, então um teste que troca
 * o segredo temporariamente vazava para outro arquivo rodando em paralelo (foi assim que a suíte
 * pegou isso — passava isolado, falhava junto). Sobrescrever por injeção, não mutando env global.
 *
 * ## Por que uma chave própria, e não mais o `CRON_SECRET` (auditoria de segurança S1)
 *
 * Isto assina **quatro** famílias de link entregues ao cliente final por WhatsApp — confirmação
 * de agendamento, avaliação, lista de espera e orçamento (este último com validade de 180 dias).
 * O `CRON_SECRET` é outra coisa: é o *bearer* que o Vercel Cron manda no `Authorization` para
 * provar que a chamada é dele.
 *
 * Misturar os dois significava que um vazamento do segredo de cron não daria só a capacidade de
 * disparar job: daria a de **forjar qualquer link público** — cancelar agendamento alheio,
 * reivindicar vaga de outra pessoa e aprovar orçamento, que vira comanda cobrável. E, mesmo sem
 * vazamento nenhum, rotacionar o `CRON_SECRET` (higiene normal) invalidava em silêncio todo link
 * já enviado: a cliente clicava no "confirme seu horário" de ontem e não funcionava mais.
 *
 * ## A transição, sem quebrar link em circulação
 *
 * `PUBLIC_LINK_SIGNING_KEY` é a chave de **assinatura**. Enquanto ela não existir no ambiente, o
 * `CRON_SECRET` continua valendo — assim o deploy não quebra antes de a variável ser criada.
 * Na **verificação**, as duas são aceitas: token assinado ontem com o segredo antigo continua
 * válido até expirar sozinho. Depois que todo link antigo tiver expirado (o de orçamento é o mais
 * longo, 180 dias), `CRON_SECRET` pode sair de `chavesDeVerificacao`.
 */
function chaveDeAssinatura(segredo?: string): string {
  const valor = segredo ?? process.env.PUBLIC_LINK_SIGNING_KEY ?? process.env.CRON_SECRET
  if (!valor) throw new Error('Sem PUBLIC_LINK_SIGNING_KEY nem CRON_SECRET — não dá para assinar link sem login.')
  return valor
}

/** Assinatura atual primeiro; a antiga só enquanto houver link em circulação. */
function chavesDeVerificacao(segredo?: string): string[] {
  if (segredo) return [segredo]
  const chaves = [process.env.PUBLIC_LINK_SIGNING_KEY, process.env.CRON_SECRET].filter(
    (c): c is string => !!c,
  )
  if (chaves.length === 0) throw new Error('Sem PUBLIC_LINK_SIGNING_KEY nem CRON_SECRET — não dá para verificar link.')
  return chaves
}

export function gerarTokenAssinado(escopo: string, id: string, validadeHoras: number, segredo?: string): string {
  const exp = Date.now() + validadeHoras * 3_600_000
  const payload = `${escopo}.${id}.${exp}`
  const assinatura = createHmac('sha256', chaveDeAssinatura(segredo)).update(payload, 'utf8').digest('hex')
  return Buffer.from(`${payload}.${assinatura}`, 'utf8').toString('base64url')
}

export function verificarTokenAssinado(escopo: string, token: string, segredo?: string): string | null {
  let payload: string
  try {
    payload = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const partes = payload.split('.')
  if (partes.length !== 4) return null
  const [escopoRecebido, id, expTexto, assinaturaRecebida] = partes
  if (escopoRecebido !== escopo) return null

  const exp = Number(expTexto)
  if (!Number.isFinite(exp) || exp < Date.now()) return null

  const a = Buffer.from(assinaturaRecebida!)
  // Toda chave é conferida mesmo depois de uma bater: sair no primeiro acerto faria o tempo de
  // resposta revelar QUAL chave assinou o token — durante a transição, isso diria a quem está
  // sondando se o ambiente já rotacionou ou não.
  let confere = false
  for (const k of chavesDeVerificacao(segredo)) {
    const b = Buffer.from(createHmac('sha256', k).update(`${escopoRecebido}.${id}.${expTexto}`, 'utf8').digest('hex'))
    if (a.length === b.length && timingSafeEqual(a, b)) confere = true
  }
  if (!confere) return null

  return id!
}
