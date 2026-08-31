/**
 * Só o primeiro nome — decisão de privacidade repetida em mais de um lugar (moldura de indicação
 * em `public-booking.ts`, banner de reconhecimento em `reconhecimento.ts`): quem lê uma página
 * pública sem login nunca precisa do nome completo de outra pessoa.
 */
export function primeiroNome(nomeCompleto: string): string {
  const primeiro = nomeCompleto.trim().split(/\s+/)[0]
  return primeiro || nomeCompleto
}
