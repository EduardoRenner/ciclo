import { z } from 'zod'

/**
 * Telefone brasileiro em E.164 (`+5511999999999`). Aceita como a pessoa digita —
 * com parêntese, traço, espaço, com ou sem +55 — e devolve normalizado, porque é
 * assim que o banco guarda.
 */
export const TelefoneBR = z
  .string()
  .trim()
  .transform((bruto) => bruto.replace(/\D/g, ''))
  .refine((digitos) => /^(55)?\d{10,11}$/.test(digitos), 'Digite o telefone com DDD, como (11) 99999-9999.')
  .transform((digitos) => `+${digitos.startsWith('55') ? digitos : `55${digitos}`}`)

export const EsquemaCadastro = z.object({
  email: z.email('Digite um e-mail válido.'),
  // O tamanho mínimo real vem de `exigirSenhaForte`, que tem a mensagem certa
  // para cada motivo. Aqui só garantimos que veio string não vazia.
  password: z.string().min(1, 'Escolha uma senha.'),
  fullName: z.string().trim().min(2, 'Digite seu nome.').max(120, 'Nome muito longo.'),
  phone: TelefoneBR,
})

export const EsquemaLogin = z.object({
  email: z.email('Digite um e-mail válido.'),
  password: z.string().min(1, 'Digite sua senha.'),
})

export const EsquemaEsqueciSenha = z.object({
  email: z.email('Digite um e-mail válido.'),
})

export const EsquemaNovaSenha = z.object({
  password: z.string().min(1, 'Escolha uma senha.'),
})

/** As 8 verticais do enum `vertical_pack` (0001), literal — é o que `apply_vertical_pack()` aceita. */
export const VERTICAIS = ['barber', 'nails', 'lashes', 'brows', 'waxing', 'aesthetics', 'tattoo', 'hair'] as const

/**
 * `^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$` (constraint `tenants_slug_format` da 0001),
 * literal — validar aqui o que o banco também vai exigir devolve um erro de
 * campo em pt-BR em vez de estourar como violação de constraint.
 */
const SlugFormatado = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/

export const EsquemaOnboarding = z.object({
  businessName: z.string().trim().min(2, 'Digite o nome do negócio.').max(120, 'Nome muito longo.'),
  vertical: z.enum(VERTICAIS, 'Escolha uma especialidade da lista.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SlugFormatado, 'Use só letras minúsculas, números e hífen, com 5 a 40 caracteres.'),
  timezone: z.string().refine((tz) => {
    try {
      return Boolean(new Intl.DateTimeFormat('pt-BR', { timeZone: tz }))
    } catch {
      return false
    }
  }, 'Fuso horário inválido.'),
})
