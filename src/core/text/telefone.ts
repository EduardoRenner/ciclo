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
