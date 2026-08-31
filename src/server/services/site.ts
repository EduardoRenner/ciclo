import { z } from 'zod'

import { apelidoDoInstagram } from '@/core/text/instagram'
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
  /*
   * Guarda o APELIDO, nunca o que foi colado. Antes só o `@` inicial saía, e colar o endereço do
   * perfil — o gesto mais provável de quem tem o Instagram aberto — fazia a página pública montar
   * `instagram.com/https://instagram.com/nome`. Ver `core/text/instagram.ts`.
   */
  instagram: z
    .string()
    .trim()
    .max(120, 'Muito longo.')
    .transform((s) => apelidoDoInstagram(s))
    .nullish(),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, 'Use uma cor no formato #rrggbb.')
    .nullish(),
  /*
   * Logo e capa da página pública. Guardam a CHAVE no bucket `vitrine` (`{tenantId}/{uuid}.webp`),
   * nunca a URL inteira: a origem do Supabase muda de projeto para projeto e já vive em
   * `NEXT_PUBLIC_SUPABASE_URL` — gravar a URL completa criaria uma segunda fonte da verdade que
   * quebra silenciosamente em qualquer restauração de banco em outro projeto. Quem monta o
   * endereço é `urlDaVitrine`, num lugar só.
   *
   * Não são campos de texto livre para o dono: só `fazerUploadDaVitrine` escreve aqui.
   */
  logoKey: z.string().trim().max(200).nullish(),
  coverKey: z.string().trim().max(200).nullish(),
})

export type Site = z.infer<typeof EsquemaSite>

const SITE_VAZIO: Site = {
  tagline: null,
  about: null,
  whatsapp: null,
  instagram: null,
  accent: null,
  logoKey: null,
  coverKey: null,
}

/** Nunca lança — `settings` de um tenant antigo pode não ter `site` nenhum, e isso não é erro. */
export function lerSite(settings: unknown): Site {
  const bruto = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).site : null
  const resultado = EsquemaSite.safeParse(bruto ?? {})
  return resultado.success ? resultado.data : SITE_VAZIO
}

/**
 * F0/item B pendente (`docs/25-ESTRATEGIA-E-EXECUCAO.md` — "interruptor por tenant, antes do
 * passo 4"): o teto diário já limita o volume, mas o dono não tinha nenhum jeito de desligar o
 * envio automático (reminders/campaigns) por conta própria — só desligando WHATSAPP_* inteiro
 * pra TODOS os tenants, o que não existe como controle por tenant. Mesmo namespace de `settings`
 * que `site` já usa, mesmo padrão de merge — não é coluna nova, não é migration.
 */
export const EsquemaMensageria = z.object({
  paused: z.boolean(),
})

export type Mensageria = z.infer<typeof EsquemaMensageria>

const MENSAGERIA_PADRAO: Mensageria = { paused: false }

/** Nunca lança — mesmo raciocínio de `lerSite`: tenant sem essa chave em `settings` nunca esteve pausado. */
export function lerMensageria(settings: unknown): Mensageria {
  const bruto = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).messaging : null
  const resultado = EsquemaMensageria.safeParse(bruto ?? {})
  return resultado.success ? resultado.data : MENSAGERIA_PADRAO
}

export const EsquemaTenant = z.object({
  name: z.string().trim().min(2, 'Digite o nome do negócio.').max(120, 'Nome muito longo.').nullish(),
  phone: TelefoneBR.nullish(),
  address: z.string().trim().max(300, 'Endereço muito longo.').nullish(),
  site: EsquemaSite.nullish(),
  messaging: EsquemaMensageria.nullish(),
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
  return { ...data, address: paraEnderecoTexto(data.address), site: lerSite(data.settings), messaging: lerMensageria(data.settings) }
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
  // Mesmo raciocínio de `novoSite`: sem isso, atualizar SÓ `messaging` (sem tocar `site`) nunca
  // gravaria nada — `novoSite === undefined` deixava `colunas.settings` inteiro de fora.
  const novaMensageria = entrada.messaging === undefined ? undefined : { ...lerMensageria(atual.settings), ...entrada.messaging }

  const colunas: Database['public']['Tables']['tenants']['Update'] = {}
  if (entrada.name !== undefined && entrada.name !== null) colunas.name = entrada.name
  if (entrada.phone !== undefined) colunas.phone = entrada.phone ?? null
  if (entrada.address !== undefined) colunas.address = entrada.address ?? null
  if (novoSite !== undefined || novaMensageria !== undefined) {
    colunas.settings = {
      ...settingsAtual,
      ...(novoSite !== undefined ? { site: novoSite } : {}),
      ...(novaMensageria !== undefined ? { messaging: novaMensageria } : {}),
    }
  }

  const { data, error } = await db.from('tenants').update(colunas).eq('id', tenantId).select(COLUNAS).single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { ...data, address: paraEnderecoTexto(data.address), site: lerSite(data.settings), messaging: lerMensageria(data.settings) }
}
