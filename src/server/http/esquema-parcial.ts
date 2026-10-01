import { z } from 'zod'

type SemPadrao<T> = T extends z.ZodDefault<infer Interno> ? Interno : T

/**
 * O schema de um PATCH: todo campo opcional, e NENHUM padrão.
 *
 * `Esquema.partial()` sobre um schema com `.default(...)` continua PREENCHENDO o padrão quando o
 * campo falta (Zod 4). O corpo `{ suggestedProductId }` de um PATCH de serviço virava
 * `{ suggestedProductId, cycleDays: 21, depositBps: 0, requiresAnamnesis: false, ... }` e o
 * serviço perdia o sinal e o ciclo a cada vez que o dono escolhia o produto sugerido. O mesmo
 * valia para profissional (comissão), produto (custo médio), modelo de mensagem (ativo) e cliente
 * (consentimento de marketing). Padrão é coisa da CRIAÇÃO; edição só muda o que veio.
 *
 * Guarda de comportamento: `tests/unit/server/parcial-nao-inventa-campo.test.ts`.
 */
export function parcialSemPadroes<T extends z.core.$ZodShape>(esquema: z.ZodObject<T>) {
  const campos = Object.fromEntries(
    Object.entries(esquema.shape).map(([nome, campo]) => [nome, campo instanceof z.ZodDefault ? campo.unwrap() : campo]),
  ) as unknown as { [K in keyof T]: SemPadrao<T[K]> }
  return z.object(campos).partial()
}
