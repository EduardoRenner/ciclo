import { deBytea } from '@/server/crypto/bytea'
import { decryptVault } from '@/server/crypto/vault'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ExportacaoDados = {
  client: Record<string, unknown>
  healthRecord: { formKey: string; answers: Record<string, unknown> } | null
  consents: Record<string, unknown>[]
  appointments: Record<string, unknown>[]
  packages: Record<string, unknown>[]
  media: { id: string; phase: string | null; createdAt: string }[]
}

/**
 * TICKET-054, §2.7 `GET .../data-export`: "direito de acesso/portabilidade".
 * Junta tudo num objeto só — inclusive a resposta decifrada do cofre, porque
 * é DA titular; ela tem direito ao próprio dado de saúde, diferente de
 * `abrirFicha()` (uso interno da profissional). Mesmo assim grava
 * `vault_access_log`, porque decifrar é decifrar, não importa quem pediu.
 */
export async function exportarDadosDoCliente(
  db: Cliente,
  tenantId: string,
  clientId: string,
  quem: { actorId: string | null; ip: string | null; userAgent: string | null },
): Promise<ExportacaoDados> {
  const { data: cliente, error: erroCliente } = await db.from('clients').select('*').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle()
  if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
  if (!cliente) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })

  const [saude, consentimentos, agendamentos, pacotes, media] = await Promise.all([
    db.from('health_records').select('ciphertext, iv, auth_tag').eq('tenant_id', tenantId).eq('client_id', clientId).maybeSingle(),
    db.from('consents').select('kind, version, granted, granted_at, revoked_at').eq('tenant_id', tenantId).eq('client_id', clientId).order('granted_at', { ascending: false }),
    db.from('appointments').select('starts_at, status, service_id, price_cents').eq('tenant_id', tenantId).eq('client_id', clientId).order('starts_at', { ascending: false }),
    db.from('packages').select('service_id, total_sessions, used_sessions, paid_cents, expires_on').eq('tenant_id', tenantId).eq('client_id', clientId),
    db.from('media').select('id, phase, created_at').eq('tenant_id', tenantId).eq('client_id', clientId).is('deleted_at', null),
  ])
  if (saude.error) throw new AppError('INTERNAL', { cause: saude.error })
  if (consentimentos.error) throw new AppError('INTERNAL', { cause: consentimentos.error })
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })
  if (pacotes.error) throw new AppError('INTERNAL', { cause: pacotes.error })
  if (media.error) throw new AppError('INTERNAL', { cause: media.error })

  let healthRecord: ExportacaoDados['healthRecord'] = null
  if (saude.data) {
    const conteudo = (await decryptVault(db, tenantId, {
      ciphertext: deBytea(saude.data.ciphertext),
      iv: deBytea(saude.data.iv),
      tag: deBytea(saude.data.auth_tag),
    })) as { formKey: string; answers: Record<string, unknown> }
    healthRecord = conteudo

    await db.from('vault_access_log').insert({
      tenant_id: tenantId,
      client_id: clientId,
      actor_id: quem.actorId,
      action: 'export',
      ip: quem.ip,
      user_agent: quem.userAgent,
    })
  }

  return {
    client: cliente,
    healthRecord,
    consents: consentimentos.data ?? [],
    appointments: agendamentos.data ?? [],
    packages: pacotes.data ?? [],
    media: (media.data ?? []).map((m) => ({ id: m.id, phase: m.phase, createdAt: m.created_at })),
  }
}

export type ResultadoEliminacao = { anonymized: true; healthRecordsRemoved: number; mediaRemoved: number }

/**
 * `POST .../erase 🔐`, §critério: "apaga cofre e mídia de verdade e preserva
 * o registro fiscal sem vínculo pessoal".
 *
 * Estágio único aqui (o "3 estágios" do backlog — pedido, carência de 30
 * dias, purga final — vira o job `lgpd_retention` diário, que ainda não
 * existe nesta base; registrado em `docs/DECISOES.md`): o cofre e a mídia
 * somem **de verdade** e **agora** (não têm valor nenhum guardado "por
 * garantia" — são exatamente o dado que a lei manda eliminar). O registro
 * financeiro (`tickets`/`appointments`) não é tocado aqui: a FK pra
 * `clients` continua apontando pro mesmo `id`, só que a linha de `clients`
 * não carrega mais nome/telefone/e-mail — o vínculo técnico sobrevive
 * (obrigação fiscal, §retenção), o vínculo PESSOAL não.
 */
export async function eliminarCliente(db: Cliente, tenantId: string, clientId: string): Promise<ResultadoEliminacao> {
  const { data: cliente, error: erroCliente } = await db.from('clients').select('id, anonymized_at').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle()
  if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
  if (!cliente) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
  if (cliente.anonymized_at) throw AppError.validacao({ clientId: 'Essa cliente já foi eliminada.' })

  const [{ data: mediaParaApagar, error: erroListarMedia }] = await Promise.all([
    db.from('media').select('id, storage_key').eq('tenant_id', tenantId).eq('client_id', clientId),
  ])
  if (erroListarMedia) throw new AppError('INTERNAL', { cause: erroListarMedia })

  if (mediaParaApagar && mediaParaApagar.length > 0) {
    const { error: erroStorage } = await db.storage.from('media').remove(mediaParaApagar.map((m) => m.storage_key))
    // Arquivo já não estar lá não pode travar a eliminação — o objetivo é o
    // dado sumir; se já sumiu, ótimo, segue o fluxo.
    if (erroStorage) console.error(JSON.stringify({ level: 'error', event: 'erase_storage_falhou', tenantId, clientId }), erroStorage)
  }

  const { error: erroMedia } = await db.from('media').delete().eq('tenant_id', tenantId).eq('client_id', clientId)
  if (erroMedia) throw new AppError('INTERNAL', { cause: erroMedia })

  const { data: saudeApagada, error: erroSaude } = await db.from('health_records').delete().eq('tenant_id', tenantId).eq('client_id', clientId).select('id')
  if (erroSaude) throw new AppError('INTERNAL', { cause: erroSaude })

  const agora = new Date().toISOString()
  const { error: erroAnon } = await db
    .from('clients')
    .update({
      name: 'Cliente eliminada',
      phone_e164: null,
      phone_hash: null,
      email: null,
      birth_date: null,
      notes: null,
      tags: [],
      source: null,
      anonymized_at: agora,
      deleted_at: agora,
    })
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
  if (erroAnon) throw new AppError('INTERNAL', { cause: erroAnon })

  return { anonymized: true, healthRecordsRemoved: saudeApagada?.length ?? 0, mediaRemoved: mediaParaApagar?.length ?? 0 }
}
