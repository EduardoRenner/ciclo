import { z } from 'zod'

import { SLUGS_RESERVADOS } from '@/core/tenants/slugs-reservados'

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

/**
 * docs/114 L-03 (decisão do Vitor, 21/10): a conta nasce com nome, WhatsApp e senha. Sem e-mail, nem
 * opcional: o número é o login.
 */
export const EsquemaCadastro = z.object({
  // O tamanho mínimo real vem de `exigirSenhaForte`, que tem a mensagem certa
  // para cada motivo. Aqui só garantimos que veio string não vazia.
  password: z.string().min(1, 'Escolha uma senha.'),
  fullName: z.string().trim().min(2, 'Digite seu nome.').max(120, 'Nome muito longo.'),
  phone: TelefoneBR,
})

/** Login por número, passo 1 (docs/119). */
export const EsquemaPedirCodigo = z.object({
  telefone: TelefoneBR,
  // docs/119: o código só vai para número cadastrado, então não cria conta nova e não pede nome.
  nome: z.string().trim().max(80).optional(),
})

/** Login por número, passo 2. */
export const EsquemaEntrarComCodigo = z.object({
  telefone: TelefoneBR,
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'O código tem 6 números.'),
})

/**
 * docs/114 L-03: entra com o WhatsApp e a senha. O mesmo campo aceita o e-mail de quem criou a conta
 * antes de 21/10, para essas contas continuarem entrando sem um campo de e-mail na tela.
 */
export const EsquemaLogin = z.object({
  identificador: z
    .string()
    .trim()
    .min(1, 'Digite seu WhatsApp.')
    .transform((bruto, ctx): { email: string } | { phone: string } => {
      if (bruto.includes('@')) {
        const email = z.email().safeParse(bruto)
        if (email.success) return { email: email.data.toLowerCase() }
      } else {
        const telefone = TelefoneBR.safeParse(bruto)
        if (telefone.success) return { phone: telefone.data }
      }
      ctx.addIssue({ code: 'custom', message: 'Digite o WhatsApp com DDD, como (11) 99999-9999.' })
      return z.NEVER
    }),
  password: z.string().min(1, 'Digite sua senha.'),
})

export const EsquemaEsqueciSenha = z.object({
  email: z.email('Digite um e-mail válido.'),
})

export const EsquemaNovaSenha = z.object({
  password: z.string().min(1, 'Escolha uma senha.'),
})


/**
 * `^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$` (constraint `tenants_slug_format` da 0001),
 * literal — validar aqui o que o banco também vai exigir devolve um erro de
 * campo em pt-BR em vez de estourar como violação de constraint.
 */
const SlugFormatado = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/

/**
 * A lista mora em `core/tenants/slugs-reservados.ts` desde 2026-09-03, e não aqui, por duas razões:
 * ela ganhou um SEGUNDO leitor (o boundary de erro da raiz, que é componente de cliente e não pode
 * importar este módulo), e estava incompleta — faltavam seis segmentos que existem como pasta.
 * A guarda que compara a lista com as rotas de verdade também vive junto dela.
 */

/** TOTP: sempre 6 dígitos, o app autenticador não gera outra coisa. */
export const EsquemaCodigoMfa = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Digite os 6 números do app autenticador.'),
})

export const EsquemaVerificarMfa = EsquemaCodigoMfa.extend({
  factorId: z.uuid('Fator inválido.'),
})

export const EsquemaOnboarding = z.object({
  businessName: z.string().trim().min(2, 'Digite o nome do negócio.').max(120, 'Nome muito longo.'),
  // docs/09-PLATAFORMA.md P4: profissão vem do catálogo (professions, 17 linhas), não mais do
  // enum de 8 verticais de beleza — a rota resolve `vertical` a partir dela (schemas.ts não
  // sabe de banco, então a tradução profession→vertical mora na rota, não aqui).
  professionId: z.uuid('Escolha uma profissão da lista.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SlugFormatado, 'Use só letras minúsculas, números e hífen, com 5 a 40 caracteres.')
    .refine((s) => !SLUGS_RESERVADOS.has(s), 'Esse endereço é reservado. Escolha outro.'),
  timezone: z.string().refine((tz) => {
    try {
      return Boolean(new Intl.DateTimeFormat('pt-BR', { timeZone: tz }))
    } catch {
      return false
    }
  }, 'Fuso horário inválido.'),
})
