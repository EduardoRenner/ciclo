import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'

/**
 * A prova de que a sessão veio do link "Esqueci minha senha", e não de outro login.
 *
 * Até o login por número (docs/110 L1), o `amr` bastava: só o link de recuperação gravava `otp`.
 * Medido no Auth local em 20/10/2026, o código do WhatsApp grava o MESMO `{"method":"otp"}`. Sem
 * esta marca, quem entra pelo número passaria pela trava do `password/reset` e trocaria a senha de
 * uma conta de e-mail sem nunca abrir o e-mail.
 *
 * A marca nasce em um lugar só, `auth/confirmar` com `type=recovery`, vale 15 minutos, é presa ao
 * usuário e vive num cookie `httpOnly` que só a rota de troca de senha recebe.
 */
export const COOKIE_DE_RECUPERACAO = 'ciclo_recuperacao'
export const CAMINHO_DO_COOKIE_DE_RECUPERACAO = '/api/v1/auth/password'
export const VALIDADE_DA_RECUPERACAO_S = 15 * 60

const ESCOPO = 'recuperacao-de-senha'

export function marcaDeRecuperacao(userId: string): string {
  return gerarTokenAssinado(ESCOPO, userId, VALIDADE_DA_RECUPERACAO_S / 3600)
}

export function marcaDeRecuperacaoConfere(valor: string | undefined, userId: string): boolean {
  if (!valor) return false
  return verificarTokenAssinado(ESCOPO, valor) === userId
}
