const CHAVE = 'ciclo:onboarding-rascunho'
/** Se a pessoa demorar mais que isso pra confirmar o e-mail, prefiro perguntar de novo a
 *  arriscar preencher com dado velho (profissão que ela nem lembra ter escolhido). */
const VALIDADE_MS = 24 * 60 * 60 * 1000

export type RascunhoOnboarding = {
  businessName: string
  professionId: string
  slug: string
  criadoEm: number
}

/**
 * Ponte entre o quiz de `/cadastro` (que ainda não tem sessão, então não pode chamar
 * `/api/v1/onboarding`) e `/onboarding` (que só existe depois do clique no e-mail de
 * confirmação — possivelmente outra aba, outro dispositivo). `localStorage` é best-effort de
 * propósito: se não sobreviver (dispositivo diferente, aba anônima), `/onboarding` volta a
 * pedir as três respostas normalmente — nunca trava a pessoa.
 */
export function salvarRascunhoOnboarding(dado: Omit<RascunhoOnboarding, 'criadoEm'>): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...dado, criadoEm: Date.now() }))
  } catch {
    // Storage indisponível (aba anônima, cota cheia) — sem problema, é só conveniência.
  }
}

export function lerRascunhoOnboarding(): RascunhoOnboarding | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const dado = JSON.parse(bruto) as RascunhoOnboarding
    if (Date.now() - dado.criadoEm > VALIDADE_MS) {
      localStorage.removeItem(CHAVE)
      return null
    }
    return dado
  } catch {
    return null
  }
}

export function limparRascunhoOnboarding(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // Idem.
  }
}
