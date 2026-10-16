import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/98-aprimoramento/11 LOJA-28. A seção 3 de `/privacidade` lista quem recebe dado para operar o serviço.
 * Em 15/10/2026 ela nomeava Mercado Pago, WhatsApp, Resend e Supabase, e faltavam três que o código usa: a
 * Vercel (hospeda tudo), o Sentry (erro técnico, quando o DSN existe) e o Google (o assistente chama o Gemini).
 * A Apple confere a política contra o questionário de privacidade da loja, e a LGPD exige nomear o operador.
 *
 * A guarda pergunta pela REGRA: cada provedor que o código chama, detectado pelo que muda quando ele entra
 * (o endereço da API, a dependência, o arquivo de configuração), tem que estar nomeado na página. Um provedor
 * novo sem linha aqui não reprova; por isso o detector mais amplo (qualquer `https://api.`) vem no fim.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : []
  })
}

const CODIGO = arquivos('src').map((c) => semComentarios(readFileSync(c, 'utf8'))).join('\n')
const PACOTE = readFileSync('package.json', 'utf8')
const PAGINA = semComentarios(readFileSync('src/app/(public)/privacidade/page.tsx', 'utf8'))

/** Quem recebe dado, como o código denuncia a presença dele, e o nome que a página tem que mostrar. */
const PROVEDORES: ReadonlyArray<{ nome: RegExp; presente: boolean; como: string }> = [
  { nome: /Mercado Pago/, presente: CODIGO.includes('https://api.mercadopago.com'), como: 'api.mercadopago.com' },
  { nome: /WhatsApp/, presente: CODIGO.includes('https://graph.facebook.com'), como: 'graph.facebook.com' },
  { nome: /Resend/, presente: CODIGO.includes('https://api.resend.com'), como: 'api.resend.com' },
  { nome: /Google/, presente: CODIGO.includes('https://generativelanguage.googleapis.com'), como: 'generativelanguage.googleapis.com' },
  { nome: /Supabase/, presente: PACOTE.includes('"@supabase/supabase-js"'), como: '@supabase/supabase-js' },
  { nome: /Sentry/, presente: PACOTE.includes('"@sentry/nextjs"'), como: '@sentry/nextjs' },
  { nome: /Vercel/, presente: existsSync('vercel.json'), como: 'vercel.json' },
]

describe('a política de privacidade nomeia quem recebe dado', () => {
  it('o detector achou os provedores que se sabe que existem (piso pelo positivo conhecido)', () => {
    expect(PROVEDORES.filter((p) => p.presente).length).toBe(PROVEDORES.length)
  })

  it.each(PROVEDORES.map((p) => [p.como, p] as const))('quem o código chama por %s aparece na página', (_como, p) => {
    expect(p.presente).toBe(true)
    expect(PAGINA, `a página não nomeia o provedor detectado por ${p.como}`).toMatch(p.nome)
  })

  it('nenhum endereço de API externa novo sem estar na tabela acima', () => {
    const conhecidos = new Set([
      'api.mercadopago.com',
      'graph.facebook.com',
      'api.resend.com',
      // Não é o servidor mandando dado: é um link que abre o WhatsApp da própria pessoa (`agenda/detalhe.tsx`).
      'api.whatsapp.com',
    ])
    const achados = [...new Set([...CODIGO.matchAll(/https:\/\/(api\.[a-z0-9.-]+)/g)].map((m) => m[1]!))]
    const novos = achados.filter((h) => !conhecidos.has(h))
    expect(novos, `API externa sem linha em PROVEDORES (e talvez sem nome na privacidade): ${novos.join(', ')}`).toEqual([])
  })
})
