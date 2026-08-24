import { createHash } from 'node:crypto'

import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * A chave é do cliente e `idempotency_keys.key` é chave primária **global**. Sem
 * prefixo, o tenant B poderia mandar uma chave que o tenant A já usou e receber
 * de volta a resposta guardada do A — que é o corpo de um agendamento ou de uma
 * comanda. O prefixo faz a colisão entre tenants deixar de existir.
 */
function chaveArmazenada(tenantId: string, chaveDoCliente: string): string {
  return `${tenantId}:${chaveDoCliente}`
}

/** Identidade do pedido: método, rota e corpo. Payload diferente = pedido diferente. */
function hashDoPedido(metodo: string, endpoint: string, corpo: string): string {
  return createHash('sha256').update(`${metodo}\n${endpoint}\n${corpo}`, 'utf8').digest('hex')
}

/**
 * Executa a mutação **uma vez só** para uma dada `Idempotency-Key`.
 *
 * O caminho feliz da segunda chamada não reexecuta nada: devolve o que ficou
 * guardado. É o que faz a fila offline do PWA (`§4.2`) poder reenviar sem medo —
 * ela drena a fila sem saber se a primeira tentativa chegou ao servidor.
 */
export async function comIdempotencia<T>(
  req: Request,
  { tenantId, endpoint }: { tenantId: string; endpoint: string },
  executar: () => Promise<T>,
): Promise<T> {
  const chave = req.headers.get('idempotency-key')
  if (!chave || !UUID.test(chave)) {
    throw AppError.validacao({
      'idempotency-key': 'Esta operação exige o header Idempotency-Key com um UUID v4.',
    })
  }

  const armazenada = chaveArmazenada(tenantId, chave)
  const hash = hashDoPedido(req.method, endpoint, await req.clone().text())

  return withTenant(tenantId, async (db, tenant) => {
    // Reserva a chave antes de executar. É `insert ... on conflict do nothing`
    // porque duas tentativas simultâneas chegam juntas: quem ganhar a corrida
    // executa, quem perder cai no `select` abaixo. Um `select` antes do `insert`
    // deixaria as duas executarem.
    const reserva = await db
      .from('idempotency_keys')
      .insert({ key: armazenada, tenant_id: tenant, endpoint, request_hash: hash })
      .select('key')
      .maybeSingle()

    const conflitou = reserva.error?.code === '23505'
    if (reserva.error && !conflitou) throw new AppError('INTERNAL', { cause: reserva.error })

    if (conflitou) {
      const { data: anterior, error } = await db
        .from('idempotency_keys')
        .select('request_hash, response_status, response_body')
        .eq('key', armazenada)
        // Redundante depois do prefixo, e de propósito: se o prefixo sumir numa
        // refatoração, o filtro segura o vazamento entre tenants.
        .eq('tenant_id', tenant)
        .maybeSingle()
      if (error) throw new AppError('INTERNAL', { cause: error })

      if (!anterior) throw new AppError('INTERNAL')

      if (anterior.request_hash !== hash) throw new AppError('IDEMPOTENCY_KEY_REUSED')

      if (anterior.response_status === null) {
        // A primeira tentativa ainda está rodando. Não dá para devolver a
        // resposta (não existe) nem executar de novo (viraria duplicata), então
        // o cliente tenta de novo em instantes.
        throw AppError.limiteDeTaxa(2)
      }

      return anterior.response_body as T
    }

    let resultado: T
    try {
      resultado = await executar()
    } catch (erro) {
      // Solta a reserva: a operação não aconteceu, e prender a chave impediria a
      // pessoa de tentar de novo com o mesmo `Idempotency-Key` — que é
      // exatamente o que a fila offline faz.
      const { error: erroSoltar } = await db
        .from('idempotency_keys')
        .delete()
        .eq('key', armazenada)
        .eq('tenant_id', tenant)
      // Não pode estourar aqui: `erro` é a causa real e tem que chegar a quem chamou. Mas soltar
      // a reserva em silêncio é grave — a chave ficaria presa para sempre e a pessoa NUNCA
      // conseguiria repetir a operação com o mesmo `Idempotency-Key`, que é exatamente o que a
      // fila offline faz ao voltar a ter rede. Trava permanente, sem mensagem.
      if (erroSoltar) {
        console.error(
          JSON.stringify({ level: 'error', event: 'idempotencia_reserva_presa', endpoint, tenant_id: tenant }),
          erroSoltar,
        )
      }
      throw erro
    }

    // Aqui pode e deve estourar: sem a resposta gravada, uma repetição com a mesma chave não
    // encontra o resultado e a operação corre de novo — que é precisamente o que a idempotência
    // existe para impedir. Falhar alto é melhor que cobrar duas vezes.
    const { error: erroGravar } = await db
      .from('idempotency_keys')
      .update({ response_status: 200, response_body: (resultado ?? null) as never })
      .eq('key', armazenada)
      .eq('tenant_id', tenant)
    if (erroGravar) throw new AppError('INTERNAL', { cause: erroGravar })

    return resultado
  })
}
