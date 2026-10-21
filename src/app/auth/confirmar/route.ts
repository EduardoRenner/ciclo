import { NextResponse } from 'next/server'

import { destinoSeguro } from '@/server/auth/destino'
import {
  CAMINHO_DO_COOKIE_DE_RECUPERACAO,
  COOKIE_DE_RECUPERACAO,
  VALIDADE_DA_RECUPERACAO_S,
  marcaDeRecuperacao,
} from '@/server/auth/marca-de-recuperacao'
import { criarClienteDoUsuario } from '@/server/db/server-client'

import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * APR-026 (achado F-05): recuperar senha e confirmar e-mail funcionando em QUALQUER navegador.
 *
 * O `/auth/callback` troca um código PKCE, e o PKCE só fecha no MESMO navegador que pediu: quem pede
 * a senha nova no computador e abre o e-mail no celular (o caminho mais comum) recebia sempre "esse
 * link não é mais válido". Esta rota recebe o `token_hash` do e-mail e troca por sessão com
 * `verifyOtp`, que não depende de onde o pedido saiu.
 *
 * Os modelos de e-mail que apontam para cá estão em `supabase/templates/`. Em PRODUÇÃO o modelo é
 * configurado no painel do Supabase — até ele mudar, os e-mails seguem caindo no `/auth/callback`,
 * que continua funcionando do jeito antigo.
 */
const TIPOS: ReadonlySet<EmailOtpType> = new Set(['recovery', 'signup', 'email', 'email_change', 'invite', 'magiclink'])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const tipo = url.searchParams.get('type') as EmailOtpType | null
  const destino = destinoSeguro(url.searchParams.get('next') ?? (tipo === 'recovery' ? '/nova-senha' : null))

  if (!tokenHash || !tipo || !TIPOS.has(tipo)) {
    return NextResponse.redirect(new URL('/entrar?erro=link_invalido', url.origin))
  }

  const db = await criarClienteDoUsuario()
  const { data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
  if (error) {
    // Link de CONFIRMAÇÃO já usado quase sempre quer dizer "já confirmou" (o próprio app de e-mail
    // às vezes abre o link antes da pessoa). O caminho dela é entrar com a senha, não pedir outro.
    const motivo = tipo === 'signup' || tipo === 'email' ? 'confirmacao_usada' : 'link_invalido'
    return NextResponse.redirect(new URL(`/entrar?erro=${motivo}`, url.origin))
  }

  const resposta = NextResponse.redirect(new URL(destino, url.origin))
  // A única porta que prova "veio do e-mail de recuperação": o `amr` não prova mais, porque o código
  // do login por número grava o mesmo `otp` (ver `marca-de-recuperacao.ts`).
  if (tipo === 'recovery' && data.user) {
    resposta.cookies.set(COOKIE_DE_RECUPERACAO, marcaDeRecuperacao(data.user.id), {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      path: CAMINHO_DO_COOKIE_DE_RECUPERACAO,
      maxAge: VALIDADE_DA_RECUPERACAO_S,
    })
  }
  return resposta
}
