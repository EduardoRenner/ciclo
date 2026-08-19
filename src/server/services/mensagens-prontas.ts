import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const COLUNAS = 'id, slug, title, body, active, position'

export const EsquemaModelo = z.object({
  title: z.string().trim().min(2, 'Dê um nome ao modelo.').max(80, 'Nome muito longo.'),
  body: z.string().trim().min(5, 'Escreva a mensagem.').max(1000, 'Mensagem muito longa.'),
  active: z.boolean().default(true),
})
export const EsquemaModeloParcial = EsquemaModelo.partial()

type Entrada = z.infer<typeof EsquemaModelo>
type EntradaParcial = z.infer<typeof EsquemaModeloParcial>

/**
 * O ponto de partida de um negócio novo. Não é catálogo global: na primeira vez que a tela
 * abre, estes viram linhas do tenant e passam a ser editáveis — a graça é o dono reescrever
 * com a voz dele, não usar um texto genérico de sistema.
 */
export const MODELOS_PADRAO: { slug: string; title: string; body: string }[] = [
  { slug: 'confirmacao', title: 'Confirmar horário', body: 'Oi {{nome}}! Confirmando seu horário na {{negocio}}: {{servico}} no dia {{data}} às {{hora}}. Posso confirmar?' },
  { slug: 'lembrete', title: 'Lembrete de amanhã', body: 'Oi {{nome}}! Passando pra lembrar do seu horário amanhã, {{data}} às {{hora}}. Te espero na {{negocio}}!' },
  { slug: 'sentimos_falta', title: 'Sumiu — chamar de volta', body: 'Oi {{nome}}, quanto tempo! Faz um tempinho que você não aparece na {{negocio}}. Bora marcar um horário? Me chama que eu encaixo.' },
  { slug: 'aniversario', title: 'Feliz aniversário', body: 'Parabéns, {{nome}}! 🎉 A {{negocio}} te deseja tudo de bom. Passa aqui esse mês que tem um mimo te esperando.' },
  { slug: 'pos_atendimento', title: 'Depois do atendimento', body: 'Obrigado pela visita, {{nome}}! Qualquer ajuste nos primeiros dias é por nossa conta. Qualquer coisa é só chamar.' },
  { slug: 'reagendar', title: 'Preciso remarcar', body: 'Oi {{nome}}, tudo bem? Preciso remarcar seu horário do dia {{data}}. Tenho outros horários livres — qual fica melhor pra você?' },
  { slug: 'promocao', title: 'Promoção da semana', body: 'Oi {{nome}}! Essa semana o {{servico}} está saindo por {{valor}} aqui na {{negocio}}. Quer que eu separe um horário?' },
  { slug: 'indicacao', title: 'Pedir indicação', body: '{{nome}}, obrigado por ser cliente da casa! 🙏 Indicando um amigo, vocês dois ganham desconto no próximo horário.' },
  { slug: 'falta', title: 'Cliente faltou', body: 'Oi {{nome}}, senti sua falta no horário das {{hora}}. Aconteceu alguma coisa? Se quiser eu já remarco.' },
  { slug: 'agradecimento', title: 'Agradecer cliente fiel', body: '{{nome}}, obrigado por confiar na {{negocio}} esse tempo todo! Cliente como você é o que segura essa casa.' },
]

/**
 * Lista os modelos do tenant e, na primeira vez, semeia os padrões. Semear na leitura (e não no
 * onboarding) faz os negócios que já existem ganharem a biblioteca sem migration de dados —
 * e `ignoreDuplicates` segura duas abas abrindo a tela ao mesmo tempo.
 */
export async function listarModelos(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('message_templates')
    .select(COLUNAS)
    .eq('tenant_id', tenantId)
    .order('position')

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (data && data.length > 0) return data

  const { error: erroSeed } = await db
    .from('message_templates')
    .upsert(
      MODELOS_PADRAO.map((m, i) => ({ ...m, tenant_id: tenantId, position: i })),
      { onConflict: 'tenant_id,slug', ignoreDuplicates: true },
    )
  if (erroSeed) throw new AppError('INTERNAL', { cause: erroSeed })

  const { data: recem, error: erroRecem } = await db
    .from('message_templates')
    .select(COLUNAS)
    .eq('tenant_id', tenantId)
    .order('position')
  if (erroRecem) throw new AppError('INTERNAL', { cause: erroRecem })
  return recem ?? []
}

/** `slug` nasce do título só para a linha ter identidade estável; o texto é o que importa. */
function slugDoTitulo(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${base || 'modelo'}_${Math.random().toString(36).slice(2, 7)}`
}

export async function criarModelo(db: Cliente, tenantId: string, entrada: Entrada) {
  const { data: ultimo } = await db
    .from('message_templates')
    .select('position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await db
    .from('message_templates')
    .insert({
      tenant_id: tenantId,
      slug: slugDoTitulo(entrada.title),
      title: entrada.title,
      body: entrada.body,
      active: entrada.active,
      position: (ultimo?.position ?? -1) + 1,
    })
    .select(COLUNAS)
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export async function atualizarModelo(db: Cliente, tenantId: string, id: string, entrada: EntradaParcial) {
  const colunas: Database['public']['Tables']['message_templates']['Update'] = { updated_at: new Date().toISOString() }
  if (entrada.title !== undefined) colunas.title = entrada.title
  if (entrada.body !== undefined) colunas.body = entrada.body
  if (entrada.active !== undefined) colunas.active = entrada.active

  const { data, error } = await db
    .from('message_templates')
    .update(colunas)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(COLUNAS)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse modelo não existe mais.' })
  return data
}

export async function removerModelo(db: Cliente, tenantId: string, id: string) {
  const { error } = await db.from('message_templates').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { id }
}
