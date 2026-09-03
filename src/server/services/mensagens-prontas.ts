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
 *
 * `docs/09-PLATAFORMA.md` §2 G10: até 2026-08-19, 8 dos 10 modelos assumiam que o cliente vem
 * até o negócio ("Te espero na {{negocio}}", "Passa aqui esse mês", "Obrigado pela visita",
 * "cliente da casa") — errado para quem vai até o cliente (faxineira, eletricista) e pior ainda:
 * eram semeados na PRIMEIRA LEITURA da tela e viravam linha do tenant, então corrigir aqui não
 * consertava quem já tinha recebido. Reescritos para não afirmar ONDE o atendimento acontece —
 * nem "na loja" nem "na sua casa". A variante por eixo 1 (`onde`, `docs/09-PLATAFORMA.md` §4) é
 * P2/P3: quando a leitura de `professions.mensagens` estiver ligada ao onboarding, o pack de
 * cada profissão pode sobrescrever estes com uma frase mais específica. Este array é o piso —
 * nunca deve voltar a presumir localização.
 */
export const MODELOS_PADRAO: { slug: string; title: string; body: string }[] = [
  { slug: 'confirmacao', title: 'Confirmar horário', body: 'Oi {{nome}}! Confirmando: {{servico}} no dia {{data}} às {{hora}}. Posso confirmar?' },
  { slug: 'lembrete', title: 'Lembrete de amanhã', body: 'Oi {{nome}}! Passando pra lembrar do seu horário amanhã, {{data}} às {{hora}}. Até lá!' },
  { slug: 'sentimos_falta', title: 'Sumiu, chamar de volta', body: 'Oi {{nome}}, quanto tempo! Faz um tempinho que a gente não se fala. Bora marcar um horário? Me chama que eu encaixo.' },
  { slug: 'aniversario', title: 'Feliz aniversário', body: 'Parabéns, {{nome}}! 🎉 Te desejo tudo de bom. Esse mês tem um mimo te esperando, me chama pra combinar.' },
  { slug: 'pos_atendimento', title: 'Depois do atendimento', body: 'Que bom te atender, {{nome}}! Qualquer dúvida sobre o que foi feito, é só chamar.' },
  { slug: 'reagendar', title: 'Preciso remarcar', body: 'Oi {{nome}}, tudo bem? Preciso remarcar seu horário do dia {{data}}. Tenho outros horários livres. Qual fica melhor pra você?' },
  { slug: 'promocao', title: 'Promoção da semana', body: 'Oi {{nome}}! Essa semana o {{servico}} está saindo por {{valor}}. Quer que eu separe um horário?' },
  { slug: 'indicacao', title: 'Pedir indicação', body: '{{nome}}, que bom que você confia no meu trabalho! 🙏 Dê um desconto pra uma amiga: ela agenda o primeiro horário por aqui, sem esperar resposta: {{link}}' },
  { slug: 'falta', title: 'Cliente faltou', body: 'Oi {{nome}}, senti sua falta no horário das {{hora}}. Aconteceu alguma coisa? Se quiser eu já remarco.' },
  { slug: 'agradecimento', title: 'Agradecer cliente fiel', body: '{{nome}}, que bom te ter por perto esse tempo todo! Cliente como você é o que faz diferença.' },
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
