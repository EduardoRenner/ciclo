import { z } from 'zod'

import { withNovoTenant } from '@/server/db/with-tenant'
import { resolverCliente } from '@/server/services/agendamentos'
import { normalizarTelefoneBR } from '@/server/services/telefone'
import { AppError } from '@/server/http/errors'

/**
 * A cliente pedindo orçamento pela página do salão — fase 2 do `docs/40`.
 *
 * A fase 1 fez o serviço dizer "Sob orçamento" na vitrine, e aí a pessoa tocava no card e não
 * acontecia nada de útil: `/orcamento/[token]` só exibe um orçamento que já existe, e quem criava
 * era sempre o profissional, pelo painel. O produto anunciava "sob orçamento" e não tinha por onde
 * pedir um. Para a barbearia isso é indiferente; para o eletricista e a faxineira, que é quem a
 * fase 1 existe para atender, é o caminho inteiro.
 *
 * O pedido nasce com `status = 'requested'` e **sem profissional**: ninguém pegou ainda, e atribuir
 * alguém arbitrariamente criaria dono falso. A `0061` abriu as duas coisas.
 */
export const EsquemaPedidoDeOrcamento = z.object({
  /** O pedido em si. Descrever obra em uma linha não dá, então o limite é generoso. */
  message: z.string().trim().min(10, 'Conte um pouco mais sobre o que você precisa.').max(2000, 'Texto muito longo.'),
  name: z.string().trim().min(2, 'Digite seu nome.'),
  phone: z.string().trim().min(1, 'Digite seu telefone.'),
  /** Opcional: ajuda quem já sabe qual serviço quer, sem travar quem não sabe. */
  serviceId: z.uuid().nullish(),
  /** Eletricista e faxineira orçam no local. Mesmo campo do agendamento, sem geocodificação. */
  address: z.string().trim().max(300, 'Endereço muito longo.').nullish(),
  /*
   * Honeypot, mesma decisão do `EsquemaBookingPublico`: sem limite de tamanho aqui de propósito.
   * Um `max(0)` faria o Zod recusar antes de a rota decidir, e a resposta entregaria "notei o
   * honeypot" para quem está tentando burlar. Responder como sucesso sem gravar é decisão da rota.
   */
  website: z.string().nullish(),
})

export type EntradaDePedido = z.infer<typeof EsquemaPedidoDeOrcamento>

/**
 * Cria o pedido. Devolve só `{ ok: true }` — nada de id nem token: quem pede não tem o que abrir
 * ainda, e devolver identificador de linha para requisição anônima é superfície à toa.
 */
export async function criarPedidoDeOrcamento(slug: string, entrada: EntradaDePedido): Promise<{ ok: true }> {
  const telefone = normalizarTelefoneBR(entrada.phone)
  if (!telefone) throw AppError.validacao({ phone: 'Telefone inválido. Confira o DDD e o número.' })

  return withNovoTenant(async (svc) => {
    const { data: tenant, error } = await svc
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!tenant) throw new AppError('NOT_FOUND', { message: 'Esse endereço não existe.' })

    /*
     * O serviço é conferido contra o catálogo DESTE tenant, e só `quote` entra: aceitar um id
     * qualquer deixaria o pedido apontar para serviço de outro salão, e aceitar serviço de preço
     * fechado transformaria "pedir orçamento" numa segunda porta de agendamento sem horário.
     * Id que não passa vira `null` em silêncio — o campo é opcional e o pedido não pode morrer
     * por causa dele.
     */
    let nomeDoServico: string | null = null
    if (entrada.serviceId) {
      const { data: servico } = await svc
        .from('services')
        .select('name')
        .eq('id', entrada.serviceId)
        .eq('tenant_id', tenant.id)
        .eq('pricing_model', 'quote')
        .eq('active', true)
        .is('deleted_at', null)
        .maybeSingle()
      nomeDoServico = servico?.name ?? null
    }

    // Mesma resolução do agendamento público: reaproveita cliente pelo telefone, cria se for novo.
    const clientId = await resolverCliente(svc, tenant.id, {
      clientDraft: { name: entrada.name, phone: entrada.phone },
    })

    /*
     * O que a pessoa escreveu vai em `message`, que é a coluna que a tela de aprovação já mostra.
     * Endereço e serviço indicado entram no MESMO texto em vez de colunas próprias: `quotes` não
     * tem nenhuma das duas, e criá-las para carregar informação que só é lida por gente seria a
     * nona coluna sem leitor desta base.
     *
     * O serviço vai pelo NOME, não pelo id, e é o que conserta um defeito que o `eslint` pegou:
     * a primeira versão validava o id contra o catálogo e não usava o resultado para nada. A
     * pessoa escolhia e a informação se perdia — validação sem destino.
     */
    const linhas = [entrada.message]
    if (nomeDoServico) linhas.push(`Serviço indicado: ${nomeDoServico}`)
    if (entrada.address) linhas.push(`Endereço: ${entrada.address}`)
    const texto = linhas.join('\n\n')

    const { error: erroInsert } = await svc.from('quotes').insert({
      tenant_id: tenant.id,
      client_id: clientId,
      professional_id: null,
      status: 'requested',
      message: texto,
      // `created_by` fica nulo: não há profissional por trás deste pedido, e é justamente o que
      // distingue "a cliente pediu" de "alguém do salão começou a escrever".
      created_by: null,
    })
    if (erroInsert) throw new AppError('INTERNAL', { cause: erroInsert })

    return { ok: true as const }
  })
}
