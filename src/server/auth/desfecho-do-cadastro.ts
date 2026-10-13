/**
 * APR-025 (achado F-03): o que o cadastro responde para cada recusa do Supabase Auth.
 *
 * A rota transformava TODO 4xx que não fosse 429 em "Quase lá! Mandamos um link". Com senha de 8 ou
 * 9 caracteres (o app aceita 8, o Auth local exigia 10), a tela dizia que o link tinha saído e
 * nenhuma conta era criada — a pessoa esperava um e-mail que não vinha.
 *
 * Duas recusas são diferentes de propósito:
 * - **senha fraca** e **e-mail inválido** dizem o motivo: corrigir é com a pessoa, e não revelam
 *   nada sobre quem tem conta;
 * - **e-mail já cadastrado** responde IGUAL a e-mail novo. A diferença transformaria o cadastro
 *   num verificador de quem tem conta no CICLO.
 */
export type DesfechoDoCadastro = 'aceito' | 'senha_fraca' | 'email_invalido' | 'limite' | 'falha'

export function desfechoDoCadastro(erro: { status?: number; code?: string } | null): DesfechoDoCadastro {
  if (!erro) return 'aceito'
  if (erro.code === 'weak_password') return 'senha_fraca'
  if (erro.code === 'email_address_invalid' || erro.code === 'validation_failed') return 'email_invalido'
  // Já existe: indistinguível do caminho feliz (ver o cabeçalho).
  if (erro.code === 'user_already_exists' || erro.code === 'email_exists') return 'aceito'
  if (erro.status === 429) return 'limite'
  // O resto (cadastro desligado, 5xx, código novo do Auth) é falha nossa: dizer "mandamos o link"
  // deixaria a pessoa esperando um e-mail que não sai.
  return 'falha'
}
