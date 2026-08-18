import { createHash, randomBytes } from 'node:crypto'

import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

const DIAS_DE_VALIDADE = 7

export const EsquemaConvite = z.object({
  email: z.email('Digite um e-mail válido.'),
  role: z.enum(['owner', 'manager', 'professional', 'reception', 'finance'], 'Escolha um papel válido.'),
  displayName: z.string().trim().min(2).max(120).nullish(),
})

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
 * O envio por WhatsApp/e-mail é do Sprint 2 (nenhum `MessagingProvider`
 * existe ainda): por ora o link volta na resposta para o dono copiar e
 * mandar manualmente. Decisão registrada em `docs/DECISOES.md`.
 */
export async function criarConvite(db: Cliente, tenantId: string, invitedBy: string, entrada: EntradaConvite) {
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + DIAS_DE_VALIDADE * 86_400_000).toISOString()

  const { data, error } = await db
    .from('invites')
    .insert({
      tenant_id: tenantId,
      email: entrada.email,
      role: entrada.role,
      display_name: entrada.displayName ?? null,
      token_hash: hashToken(token),
      invited_by: invitedBy,
      expires_at: expiresAt,
    })
    .select('id, email, role, expires_at')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return { invite: data, token }
}

export async function listarConvites(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('invites')
    .select('id, email, role, display_name, expires_at, accepted_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

const MENSAGEM_CONVITE_INVALIDO = 'Esse convite não existe mais, já foi usado ou venceu.'

/**
 * Aceita pelo usuário já autenticado (precisa ter feito cadastro/login
 * primeiro — não existe ainda o fluxo de assinar direto pelo link sem conta).
 * Roda com o cliente de serviço: quem aceita não tem `has_tenant()` nesse
 * tenant até este momento, então a RLS bloquearia a leitura do próprio convite.
 */
export async function aceitarConvite(
  svc: Cliente,
  params: { userId: string; userEmail: string; token: string },
) {
  const { data: convite, error: erroConvite } = await svc
    .from('invites')
    .select('id, tenant_id, email, role, display_name, expires_at, accepted_at')
    .eq('token_hash', hashToken(params.token))
    .maybeSingle()
  if (erroConvite) throw new AppError('INTERNAL', { cause: erroConvite })

  // Mesma mensagem para "não existe", "já foi aceito" e "venceu": diferenciar
  // ajudaria alguém tentando adivinhar token a saber que chegou perto.
  if (!convite || convite.accepted_at !== null || new Date(convite.expires_at) < new Date()) {
    throw new AppError('NOT_FOUND', { message: MENSAGEM_CONVITE_INVALIDO })
  }

  // O e-mail do convite trava com quem está logado — sem isso, quem chegasse
  // no link (encaminhado, por exemplo) entraria na conta de outra pessoa.
  if (convite.email.toLowerCase() !== params.userEmail.toLowerCase()) {
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
      display_name: convite.display_name ?? params.userEmail,
    })
    if (erroProfissional && erroProfissional.code !== '23505') {
      throw new AppError('INTERNAL', { cause: erroProfissional })
    }
  }

  const { error: erroAceite } = await svc.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', convite.id)
  if (erroAceite) throw new AppError('INTERNAL', { cause: erroAceite })

  return { tenantId: convite.tenant_id, role: convite.role }
}
