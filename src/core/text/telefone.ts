/**
 * `+5511987654321` → `(11) 98765-4321`, o formato que a profissional reconhece de cabeça.
 * Devolve o próprio valor quando não é um celular brasileiro — número estrangeiro importado de
 * planilha aparece cru, e não vazio.
 *
 * Mora em `core/` desde 29/09 (docs/85 MI-2): o Motor de Inteligência fala o telefone e `core/` não
 * importa `@/lib`. `lib/formato.ts` re-exporta daqui — uma fórmula só, para as telas e para a fala.
 */
export function formatarTelefone(e164: string | null): string | null {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164 ?? '')
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

/**
 * APR-208 (docs/98 C-28): o que a pessoa digitou → E.164, sem supor Brasil quando o número já veio
 * com país. O orçamento montava `wa.me/55${digitos}` na mão: "+55 11 9…" virava `5555 11…` e número
 * estrangeiro ganhava um 55 na frente. Regras: 10–11 dígitos = Brasil sem o país; 12–13 começando
 * com 55 = Brasil com o país; `+` na frente = o que veio; fora disso, `null` (o link cai no seletor
 * de contato do WhatsApp, que nunca erra número).
 */
export function telefoneParaE164(digitado: string): string | null {
  const bruto = digitado.trim()
  const digitos = bruto.replace(/[^0-9]/g, '')
  if (bruto.startsWith('+')) return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return `+${digitos}`
  return null
}
