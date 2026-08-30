import { z } from 'zod'

import { semAcento } from '@/core/text/normalizar'
import { AppError } from '@/server/http/errors'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

const COLUNAS =
  'id, name, phone_e164, email, birth_date, notes, tags, source, referred_by, preferences, document, gender, address, emergency_contact, preferred_professional_id, online_booking_blocked, marketing_opt_in, whatsapp_opt_out, visits_count, no_show_count, ltv_cents, last_visit_at, created_at'

export const EsquemaCliente = z.object({
  name: z.string().trim().min(2, 'Digite o nome da cliente.').max(120, 'Nome muito longo.'),
  // D47: cliente sem telefone pode — só não entra em automação.
  phone: z.string().trim().nullish(),
  email: z.email('Digite um e-mail válido.').nullish(),
  birthDate: z.iso.date('Data de nascimento inválida.').nullish(),
  notes: z.string().trim().max(2000, 'Notas muito longas.').nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20, 'No máximo 20 etiquetas.').default([]),
  source: z.string().trim().max(60).nullish(),
  /**
   * O que a pessoa que atende precisa lembrar na hora (número da máquina, como faz a barba,
   * alergia). Livre de propósito: cada vertical pergunta coisa diferente, e o formulário é quem
   * decide os campos — o valor de cada chave é sempre texto para não virar um mini-banco aqui.
   */
  // `.optional()` e não `.default({})`: com default, o tipo de saída exigiria o campo em toda
  // chamada de `criarCliente` (inclusive nas que já existiam). Ausente = coluna fica no default
  // do banco, que já é `{}`.
  preferences: z.record(z.string().trim().min(1).max(40), z.string().trim().max(200)).optional(),
  /** CPF, só para nota fiscal. Guardado como veio; a máscara é da tela, não do banco. */
  document: z.string().trim().max(20).nullish(),
  /** Texto livre, não enum: lista fechada de gênero exclui gente que o salão atende. */
  gender: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(300).nullish(),
  /** Química longa e procedimento estético pedem alguém para acionar se algo der errado. */
  emergencyContact: z.string().trim().max(120).nullish(),
  preferredProfessionalId: z.uuid().nullish(),
  /** Trava de quem já sumiu várias vezes: continua sendo atendido, só não marca sozinho pelo site. */
  onlineBookingBlocked: z.boolean().optional(),
  marketingOptIn: z.boolean().default(false),
})

export const EsquemaClienteParcial = EsquemaCliente.partial()

type Entrada = z.infer<typeof EsquemaCliente>
type EntradaParcial = z.infer<typeof EsquemaClienteParcial>
type Cliente = SupabaseClient<Database>
type ColunasCliente = Database['public']['Tables']['clients']['Update']

/**
 * Telefone e-mail passam por aqui antes de qualquer escrita: normalizar
 * (D49) e gerar o hash de busca. `phone: null` explícito apaga o telefone;
 * `phone` ausente (undefined) não toca na coluna — mesma regra do PATCH
 * parcial de serviços.
 */
function paraColunas(entrada: EntradaParcial): ColunasCliente {
  const colunas: ColunasCliente = {}
  if (entrada.name !== undefined) colunas.name = entrada.name
  if (entrada.email !== undefined) colunas.email = entrada.email ?? null
  if (entrada.birthDate !== undefined) colunas.birth_date = entrada.birthDate ?? null
  if (entrada.notes !== undefined) colunas.notes = entrada.notes ?? null
  if (entrada.tags !== undefined) colunas.tags = entrada.tags
  if (entrada.source !== undefined) colunas.source = entrada.source ?? null
  if (entrada.preferences !== undefined) colunas.preferences = entrada.preferences
  if (entrada.document !== undefined) colunas.document = entrada.document ?? null
  if (entrada.gender !== undefined) colunas.gender = entrada.gender ?? null
  if (entrada.address !== undefined) colunas.address = entrada.address ?? null
  if (entrada.emergencyContact !== undefined) colunas.emergency_contact = entrada.emergencyContact ?? null
  if (entrada.preferredProfessionalId !== undefined) {
    colunas.preferred_professional_id = entrada.preferredProfessionalId ?? null
  }
  if (entrada.onlineBookingBlocked !== undefined) colunas.online_booking_blocked = entrada.onlineBookingBlocked
  if (entrada.marketingOptIn !== undefined) colunas.marketing_opt_in = entrada.marketingOptIn

  if (entrada.phone !== undefined) {
    if (entrada.phone === null || entrada.phone.trim() === '') {
      colunas.phone_e164 = null
      colunas.phone_hash = null
    } else {
      const e164 = normalizarTelefoneBR(entrada.phone)
      if (!e164) throw AppError.validacao({ phone: 'Telefone inválido. Confira o DDD e o número.' })
      colunas.phone_e164 = e164
      colunas.phone_hash = hashTelefone(e164)
    }
  }

  return colunas
}

/** Traduz o índice único `clients_unique_phone` (0001) em erro de campo. */
function traduzirErro(erro: { code?: string }): never {
  if (erro.code === '23505') {
    throw AppError.validacao({ phone: 'Já existe uma cliente com esse telefone.' })
  }
  throw new AppError('INTERNAL', { cause: erro })
}

export async function listarClientes(
  db: Cliente,
  tenantId: string,
  opcoes: { busca?: string; tag?: string; cursor?: string; limite?: number } = {},
) {
  const limite = Math.min(opcoes.limite ?? 50, 200)

  let consulta = db.from('clients').select(COLUNAS).eq('tenant_id', tenantId).is('deleted_at', null)

  if (opcoes.busca) {
    const termo = opcoes.busca.trim()
    const soDigitos = termo.replace(/\D/g, '')
    const porTelefone = soDigitos.length >= 8 ? normalizarTelefoneBR(soDigitos) : null

    if (porTelefone) {
      // Termo com cara de telefone: busca só pelo hash, exato. Combinar com
      // `ilike` de nome no mesmo `.or()` quebra — parênteses e espaço do
      // telefone digitado ("(11) 98765-4321") colidem com a sintaxe do
      // PostgREST para filtro composto, que usa `(` e `,` como separador.
      consulta = consulta.eq('phone_hash', hashTelefone(porTelefone))
    } else {
      // Nome busca na coluna GERADA `name_busca` (migration 0047), que guarda o nome sem acento
      // e em minúsculas — e o termo digitado passa pela MESMA normalização (`semAcento`, o par
      // em JS de `imutavel_sem_acento` no banco).
      //
      // Medido em produção antes de existir: "Otávio" achava e **"Otavio" não achava nada**;
      // idem "Joao", "Vinicius", "Sergio". `ilike` é case-insensitive mas não accent-insensitive,
      // então metade das buscas falhava — justamente a metade que a pessoa digita de verdade,
      // com pressa, no celular, com a cliente na frente.
      //
      // O índice trigram continua valendo: `clients_name_busca_trgm` é o gêmeo do
      // `clients_name_trgm` sobre a coluna nova, então `%termo%` segue sem varredura completa.
      consulta = consulta.ilike('name_busca', `%${semAcento(termo)}%`)
    }
  }

  if (opcoes.tag) consulta = consulta.contains('tags', [opcoes.tag])
  if (opcoes.cursor) consulta = consulta.lt('id', opcoes.cursor)

  const { data, error } = await consulta.order('id', { ascending: false }).limit(limite)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

export async function criarCliente(db: Cliente, tenantId: string, entrada: Entrada) {
  const colunas = paraColunas(entrada)

  const { data, error } = await db
    .from('clients')
    .insert({ tenant_id: tenantId, name: entrada.name, ...colunas })
    .select(COLUNAS)
    .single()

  if (error) traduzirErro(error)
  return data
}

export async function buscarCliente(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db
    .from('clients')
    .select(COLUNAS)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
  return data
}

export async function atualizarCliente(db: Cliente, tenantId: string, id: string, entrada: EntradaParcial) {
  const colunas = paraColunas(entrada)
  if (Object.keys(colunas).length === 0) throw AppError.validacao({ _corpo: 'Nada para alterar.' })

  const { data, error } = await db
    .from('clients')
    .update(colunas)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select(COLUNAS)
    .maybeSingle()

  if (error) traduzirErro(error)
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
  return data
}

/** D45: soft delete. Some da UI; a anonimização de verdade é o job de LGPD, não este endpoint. */
export async function removerCliente(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
  return { removida: true }
}
