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
