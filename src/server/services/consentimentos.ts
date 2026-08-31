import { createHash } from 'node:crypto'

import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type TipoConsentimento = Database['public']['Enums']['consent_type']

/**
 * TICKET-051, "três consentimentos separados". `terms` (termos de uso) fica
 * fora — é aceito no cadastro (TICKET-002/003), não por cliente-a-cliente;
 * misturar os dois fluxos faria um consentimento de saúde reaproveitar o
 * texto/versão do termo de uso, que não tem nada a ver.
 */
export const TIPOS_CONSENTIMENTO_CLIENTE = ['health_data', 'image_use', 'marketing'] as const satisfies readonly TipoConsentimento[]
type TipoConsentimentoCliente = (typeof TIPOS_CONSENTIMENTO_CLIENTE)[number]

export const EsquemaRegistrarConsentimento = z.object({
  kind: z.enum(TIPOS_CONSENTIMENTO_CLIENTE),
  version: z.string().trim().min(1),
  // Texto exibido no momento — nunca gravado por extenso, só o hash (§9).
  text: z.string().min(1),
  granted: z.boolean(),
  // Caminho já existente no bucket privado (TICKET-052 é quem sabe subir o
  // arquivo); este serviço só referencia, não faz upload.
  signatureKey: z.string().trim().min(1).nullish(),
})
type EntradaRegistrarConsentimento = z.infer<typeof EsquemaRegistrarConsentimento>

export function hashTextoConsentimento(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex')
}

export async function registrarConsentimento(
  db: Cliente,
  tenantId: string,
  clientId: string,
  entrada: EntradaRegistrarConsentimento,
  quem: { ip: string | null; userAgent: string | null },
) {
  const { data, error } = await db
    .from('consents')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      kind: entrada.kind,
      version: entrada.version,
      text_hash: hashTextoConsentimento(entrada.text),
      granted: entrada.granted,
      signature_key: entrada.signatureKey ?? null,
      ip: quem.ip,
      user_agent: quem.userAgent,
    })
    .select('*')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

/**
 * Revoga o consentimento ATIVO de um tipo — a linha mais recente com
 * `granted=true` e `revoked_at is null`. Nunca apaga nem sobrescreve
 * `granted`/`text_hash`/`signature_key`: consentimento é histórico, revogar
 * é um evento novo (`revoked_at`), não reescrever o passado.
 *
 * §critério: "revogar imagem esconde a foto do portfólio imediatamente" — a
 * exclusão em si é responsabilidade de quem lista mídia (TICKET-052, que
 * ainda não existe nesta base): a leitura de `media` precisa filtrar por
 * `consents.revoked_at is null` do `consent_id` de cada foto. Registrado
 * aqui para não se perder quando 052 nascer.
 */
export async function revogarConsentimento(db: Cliente, tenantId: string, clientId: string, kind: TipoConsentimentoCliente) {
  const { data, error } = await db
    .from('consents')
    .update({ revoked_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('kind', kind)
    .eq('granted', true)
    .is('revoked_at', null)
    .select('*')
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Não há consentimento ativo desse tipo para revogar.' })
  return data
}

export type StatusConsentimento = {
  /*
   * TICKET-114: sem o `id` da linha, a tela não tem como mandar `consentId` de volta no upload
   * de foto — precisaria adivinhar ou reconsultar. É a linha mais recente (ver `order` abaixo),
   * então o `id` aqui é sempre o consentimento que estaria ATIVO se `granted && !revokedAt`.
   */
  id: string
  kind: TipoConsentimentoCliente
  granted: boolean
  version: string
  grantedAt: string
  revokedAt: string | null
} | null

/** O estado atual (linha mais recente) de cada um dos 3 tipos, para a tela mostrar de uma vez. */
export async function statusConsentimentos(db: Cliente, tenantId: string, clientId: string): Promise<Record<TipoConsentimentoCliente, StatusConsentimento>> {
  const { data, error } = await db
    .from('consents')
    .select('id, kind, granted, version, granted_at, revoked_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('kind', TIPOS_CONSENTIMENTO_CLIENTE)
    .order('granted_at', { ascending: false })
  if (error) throw new AppError('INTERNAL', { cause: error })

  const resultado = { health_data: null, image_use: null, marketing: null } as Record<TipoConsentimentoCliente, StatusConsentimento>
  for (const linha of data ?? []) {
    const kind = linha.kind as TipoConsentimentoCliente
    if (resultado[kind]) continue // já achou a mais recente (ordenado desc); as seguintes são histórico
    resultado[kind] = { id: linha.id, kind, granted: linha.granted, version: linha.version, grantedAt: linha.granted_at, revokedAt: linha.revoked_at }
  }
  return resultado
}
