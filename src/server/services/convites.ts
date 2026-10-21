import { createHash, randomBytes } from 'node:crypto'

import { z } from 'zod'

import { TelefoneBR } from '@/server/auth/schemas'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

const DIAS_DE_VALIDADE = 7

/**
 * docs/112 EXP-K01: o convite pode ir por e-mail OU pelo WhatsApp (número). Quem entra pelo número
 * (docs/110 L1) não tem e-mail, e o convite só por e-mail deixava essa pessoa fora da equipe.
 */
export const EsquemaConvite = z
  .object({
    email: z.email('Digite um e-mail válido.').nullish(),
    telefone: TelefoneBR.nullish(),
    role: z.enum(['owner', 'manager', 'professional', 'reception', 'finance'], 'Escolha um papel válido.'),
    displayName: z.string().trim().min(2).max(120).nullish(),
  })
  .refine((c) => Boolean(c.email || c.telefone), { message: 'Diga o WhatsApp ou o e-mail de quem você está chamando.', path: ['telefone'] })

export const EsquemaAceitarConvite = z.object({
  token: z.string().min(16, 'Link de convite inválido.'),
})

type EntradaConvite = z.infer<typeof EsquemaConvite>
type Cliente = SupabaseClient<Database>

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * FAQ C36: token de 7 dias. O token cru só existe na resposta desta chamada —
 * o banco guarda o hash, o mesmo cuidado de senha, porque um vazamento da
 * tabela `invites` não pode virar convite utilizável.
 *
 * **O link volta na resposta para o dono copiar e mandar — e continua assim por decisão, não por
 * falta de peça.** A redação anterior dizia "nenhum `MessagingProvider` existe ainda", e isso
 * deixou de ser verdade: `src/server/providers/messaging/` tem `whatsapp.ts`, `email.ts`,
 * `push.ts` e `types.ts`, usados por cinco serviços. Conferido em 2026-09-05.
 *
 * O que de fato impede o envio automático hoje é outra coisa, e são duas:
 *
 *   1. **credencial** — `WHATSAPP_ACCESS_TOKEN` e `RESEND_API_KEY` estão vazios, o mesmo bloqueio
 *      que mantém `reminders` fora do `schedule` do `cron.yml`;
 *   2. **decisão de produto** — ligar envio automático é o portão que o `docs/25` F0 descreve
 *      passo a passo, e ele existe para o produto não começar a falar com gente de verdade por
 *      acidente.
 *
 * O caminho que NÃO depende de nenhum dos dois, se um dia valer: link `wa.me` com o texto pronto,
 * que é como o resto do produto já resolve mensagem sem credencial da Meta (ficha da cliente, tela
 * Recuperar). Fica como opção registrada, não como pendência.
 */
export async function criarConvite(db: Cliente, tenantId: string, invitedBy: string, entrada: EntradaConvite) {
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + DIAS_DE_VALIDADE * 86_400_000).toISOString()

  const { data, error } = await db
    .from('invites')
    .insert({
      tenant_id: tenantId,
      email: entrada.email ?? null,
      phone: entrada.telefone ?? null,
      role: entrada.role,
      display_name: entrada.displayName ?? null,
      token_hash: hashToken(token),
      invited_by: invitedBy,
      expires_at: expiresAt,
    })
    .select('id, email, phone, role, expires_at')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return { invite: data, token }
}

export async function listarConvites(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('invites')
    .select('id, email, phone, role, display_name, expires_at, accepted_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

const MENSAGEM_CONVITE_INVALIDO = 'Esse convite não existe mais, já foi usado ou venceu.'

export type PreviaDoConvite = {
  negocio: string
  papel: Database['public']['Enums']['user_role']
  email: string | null
  /** Telefone do convite pelo WhatsApp (EXP-K01), em E.164. */
  telefone: string | null
}

/**
 * APR-023: o que a página `/convite/[token]` mostra antes de a pessoa aceitar. Mesma regra de
 * validade do aceite, e o mesmo silêncio: `null` para "não existe", "já usado" e "venceu" — quem
 * tenta adivinhar token não aprende nada com a diferença. Cliente de serviço pelo mesmo motivo do
 * aceite: quem abre o link ainda não tem vínculo com o negócio.
 */
export async function previaDoConvite(svc: Cliente, token: string): Promise<PreviaDoConvite | null> {
  if (token.length < 16) return null
  const { data, error } = await svc
    .from('invites')
    .select('email, phone, role, expires_at, accepted_at, tenants(name)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data || data.accepted_at !== null || new Date(data.expires_at) < new Date()) return null
  const tenant = data.tenants as { name: string } | null
  return { negocio: tenant?.name ?? 'O negócio', papel: data.role, email: data.email, telefone: data.phone }
}

/**
 * Aceita pelo usuário já autenticado (precisa ter feito cadastro/login
 * primeiro — não existe ainda o fluxo de assinar direto pelo link sem conta).
 * Roda com o cliente de serviço: quem aceita não tem `has_tenant()` nesse
 * tenant até este momento, então a RLS bloquearia a leitura do próprio convite.
 */
export async function aceitarConvite(
  svc: Cliente,
  params: { userId: string; userEmail: string; userPhone?: string | null; token: string },
) {
  const { data: convite, error: erroConvite } = await svc
    .from('invites')
    .select('id, tenant_id, email, phone, role, display_name, expires_at, accepted_at')
    .eq('token_hash', hashToken(params.token))
    .maybeSingle()
  if (erroConvite) throw new AppError('INTERNAL', { cause: erroConvite })

  // Mesma mensagem para "não existe", "já foi aceito" e "venceu": diferenciar
  // ajudaria alguém tentando adivinhar token a saber que chegou perto.
  if (!convite || convite.accepted_at !== null || new Date(convite.expires_at) < new Date()) {
    throw new AppError('NOT_FOUND', { message: MENSAGEM_CONVITE_INVALIDO })
  }

  // O convite trava com quem está logado — sem isso, quem chegasse no link (encaminhado, por
  // exemplo) entraria na conta de outra pessoa. Pelo WhatsApp (EXP-K01), a trava é o número que a
  // pessoa provou com o código no login; por e-mail, o e-mail.
  if (convite.phone) {
    if (!params.userPhone || params.userPhone !== convite.phone) {
      throw new AppError('FORBIDDEN', {
        message: 'Esse convite foi mandado para outro número. Entre com o WhatsApp que recebeu o convite.',
      })
    }
  } else if (!convite.email || convite.email.toLowerCase() !== params.userEmail.toLowerCase()) {
    throw new AppError('FORBIDDEN', {
      message: 'Esse convite foi enviado para outro e-mail. Entre com a conta correta.',
    })
  }

  const { error: erroMembership } = await svc
    .from('memberships')
    .insert({ tenant_id: convite.tenant_id, user_id: params.userId, role: convite.role })
  if (erroMembership) {
    // 23505 = a pessoa já é membro (aceitou um convite anterior, por exemplo).
    // Não é motivo para estourar 500 — o convite continua "consumível" uma vez.
    if (erroMembership.code !== '23505') throw new AppError('INTERNAL', { cause: erroMembership })
  }

  // "professional" é o único papel que a FAQ C36 associa a uma linha em
  // `professionals` — os outros (reception, finance, manager) não aparecem na
  // agenda, então criar um registro ali para eles não teria função nenhuma.
  if (convite.role === 'professional') {
    const { error: erroProfissional } = await svc.from('professionals').insert({
      tenant_id: convite.tenant_id,
      user_id: params.userId,
      // Quem entrou pelo número não tem e-mail (EXP-K01): sem nome no convite, a reserva é neutra.
      display_name: convite.display_name || params.userEmail || 'Sem nome',
    })
    if (erroProfissional && erroProfissional.code !== '23505') {
      throw new AppError('INTERNAL', { cause: erroProfissional })
    }
  }

  const { error: erroAceite } = await svc.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', convite.id)
  if (erroAceite) throw new AppError('INTERNAL', { cause: erroAceite })

  return { tenantId: convite.tenant_id, role: convite.role }
}
