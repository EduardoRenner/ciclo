/**
 * APR-217 (docs/98 F-06): o Supabase recusa senha curta com 422 e uma frase em inglês; a tela
 * traduzia para "Algo deu errado do nosso lado" — culpa nossa, quando o que faltou foi um caractere.
 * Aqui a frase vira instrução em português; o que não se reconhece volta `null` e segue o caminho
 * genérico.
 */
export const SENHA_MINIMA = 8

export function traduzirErroDeSenha(mensagem: string | null | undefined): string | null {
  const m = (mensagem ?? '').toLowerCase()
  if (!m) return null
  if (/at least \d+ characters|too short|password is too weak|weak password/.test(m)) {
    return `Essa senha é curta demais: use pelo menos ${SENHA_MINIMA} caracteres.`
  }
  if (/should be different from the old password|same password/.test(m)) return 'Essa senha é igual à anterior. Escolha outra.'
  if (/same_password/.test(m)) return 'Essa senha é igual à anterior. Escolha outra.'
  return null
}
