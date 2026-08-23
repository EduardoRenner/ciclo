import { z } from 'zod'

import { AppError } from '@/server/http/errors'
import { TelefoneBR } from '@/server/auth/schemas'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * `settings jsonb` do tenant já guarda `min_lead_time_minutes`/
 * `max_advance_days`/`slot_granularity_minutes` (lidos por
 * `lerConfiguracoesAgenda`) — o que este módulo escreve mora só no
 * namespace `site`, e todo PATCH faz merge, nunca substitui o objeto
 * inteiro, ou um save de "sobre o negócio" apagaria configuração de agenda
 * sem ninguém perceber.
 */
/**
 * docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T3, §5.1): a cor do site público
 * deixou de vir de `vertical_packs.accent_color` (fixa por profissão, e duas
 * delas eram roxo legado) e passa a ser escolha do dono, guardada aqui. Sem
 * escolha, o site nasce osso — nunca herda cor de outro lugar.
 */
export const EsquemaSite = z.object({
  tagline: z.string().trim().max(140, 'Frase muito longa.').nullish(),
  about: z.string().trim().max(2000, 'Texto muito longo.').nullish(),
  whatsapp: TelefoneBR.nullish(),
  instagram: z
    .string()
    .trim()
    .max(60, 'Muito longo.')
    .transform((s) => s.replace(/^@/, ''))
    .nullish(),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, 'Use uma cor no formato #rrggbb.')
    .nullish(),
})

export type Site = z.infer<typeof EsquemaSite>

const SITE_VAZIO: Site = { tagline: null, about: null, whatsapp: null, instagram: null, accent: null }

/** Nunca lança — `settings` de um tenant antigo pode não ter `site` nenhum, e isso não é erro. */
export function lerSite(settings: unknown): Site {
  const bruto = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).site : null
  const resultado = EsquemaSite.safeParse(bruto ?? {})
  return resultado.success ? resultado.data : SITE_VAZIO
}

export const EsquemaTenant = z.object({
  name: z.string().trim().min(2, 'Digite o nome do negócio.').max(120, 'Nome muito longo.').nullish(),
  phone: TelefoneBR.nullish(),
  address: z.string().trim().max(300, 'Endereço muito longo.').nullish(),
  site: EsquemaSite.nullish(),
})

export type EntradaTenant = z.infer<typeof EsquemaTenant>

const COLUNAS = 'id, name, slug, phone, address, vertical, settings'

/**
 * `address` é `jsonb` sem schema definido em lugar nenhum do código (achado
 * na auditoria) — este módulo trata como texto solto, o suficiente para
 * "rua, número, bairro, cidade". Qualquer outra coisa já gravada ali (nunca
 * aconteceu até aqui) vira `null` em vez de estourar tipo.
 */
function paraEnderecoTexto(bruto: unknown): string | null {
  return typeof bruto === 'string' ? bruto : null
}

export async function lerTenant(db: Cliente, tenantId: string) {
  const { data, error } = await db.from('tenants').select(COLUNAS).eq('id', tenantId).single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { ...data, address: paraEnderecoTexto(data.address), site: lerSite(data.settings) }
}

/**
 * Lê o `settings` atual antes de escrever — é o que garante o merge. Duas
 * idas ao banco (leitura + escrita) em vez de um `jsonb_set` no SQL: a
 * função já existe como serviço puro de aplicação, e o volume de escrita
 * aqui (o dono editando o próprio negócio) não justifica a complexidade de
 * um update atômico no banco.
 */
export async function atualizarTenant(db: Cliente, tenantId: string, entrada: EntradaTenant) {
  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

  const settingsAtual = (atual.settings ?? {}) as Record<string, unknown>
  const novoSite = entrada.site === undefined ? undefined : { ...lerSite(atual.settings), ...entrada.site }

  const colunas: Database['public']['Tables']['tenants']['Update'] = {}
  if (entrada.name !== undefined && entrada.name !== null) colunas.name = entrada.name
  if (entrada.phone !== undefined) colunas.phone = entrada.phone ?? null
  if (entrada.address !== undefined) colunas.address = entrada.address ?? null
  if (novoSite !== undefined) colunas.settings = { ...settingsAtual, site: novoSite }

  const { data, error } = await db.from('tenants').update(colunas).eq('id', tenantId).select(COLUNAS).single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { ...data, address: paraEnderecoTexto(data.address), site: lerSite(data.settings) }
}
