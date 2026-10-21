import { z } from 'zod'

/**
 * A placa e a ficha do veículo (`docs/106-automotivo` AUT-102, `docs/105-ciclo/C-028`).
 *
 * A placa é a espinha da oficina (StarkOS): é por ela que o balcão acha o carro. Dois jeitos de errar:
 * - digitação: "abc-1234", "ABC 1C34", "abc1c34 " têm de virar a mesma coisa;
 * - a conversão para o Mercosul: a placa antiga ABC1234 virou ABC1C34 (o 5º caractere, um dígito, vira a
 *   letra de mesma posição: 0→A, 1→B … 9→J). O mesmo carro pode chegar com qualquer das duas.
 * A CHAVE do veículo (`subjects.identifier`) é sempre a forma Mercosul; a placa como foi digitada fica
 * em `attributes.placa_exibida`, para a tela mostrar o que está no carro.
 */

const ANTIGA = /^[A-Z]{3}[0-9]{4}$/
const MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/
const LETRA_DO_DIGITO = 'ABCDEFGHIJ'

export type Placa = { exibida: string; chave: string; formato: 'antiga' | 'mercosul' }

/** `null` quando o texto não é placa brasileira (antiga ou Mercosul): a tela pede de novo, não inventa. */
export function normalizarPlaca(texto: string): Placa | null {
  const limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (ANTIGA.test(limpo)) {
    const chave = `${limpo.slice(0, 4)}${LETRA_DO_DIGITO[Number(limpo[4])]}${limpo.slice(5)}`
    return { exibida: `${limpo.slice(0, 3)}-${limpo.slice(3)}`, chave, formato: 'antiga' }
  }
  if (MERCOSUL.test(limpo)) return { exibida: limpo, chave: limpo, formato: 'mercosul' }
  return null
}

/** A mesma placa em qualquer formato e com qualquer pontuação? */
export function mesmaPlaca(a: string, b: string): boolean {
  const pa = normalizarPlaca(a)
  const pb = normalizarPlaca(b)
  return pa !== null && pb !== null && pa.chave === pb.chave
}

const ANO_MAIS_NOVO = new Date().getUTCFullYear() + 1

/** A ficha do veículo, gravada em `subjects.attributes` (AUT-102). Validada na borda antes do banco. */
export const EsquemaFichaDoVeiculo = z
  .object({
    placa_exibida: z.string().max(10).optional(),
    marca: z.string().trim().min(1).max(40),
    modelo: z.string().trim().min(1).max(60),
    ano: z.number().int().min(1950).max(ANO_MAIS_NOVO),
    combustivel: z.enum(['flex', 'gasolina', 'etanol', 'diesel', 'eletrico', 'hibrido', 'gnv']).optional(),
    cambio: z.enum(['manual', 'automatico', 'cvt', 'automatizado']).optional(),
    motor: z.string().trim().max(20).optional(),
  })
  .strict()

export type FichaDoVeiculo = z.infer<typeof EsquemaFichaDoVeiculo>
