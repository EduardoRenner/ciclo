import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O pedido foi "login só com número e nome". Sem conferir um código, isso abre a conta de qualquer
 * pessoa para quem souber o número dela: a agenda da profissional ou a ficha da cliente
 * (docs/110 §2.1). Esta guarda segura as três regras que impedem isso de voltar sem ninguém notar:
 *
 * 1. a rota de entrar só cria sessão por `verifyOtp`, e confere o código ANTES de ler qualquer dado;
 * 2. a rota de pedir código não abre sessão nem responde diferente para quem tem conta;
 * 3. o hook que manda a mensagem paga confere a assinatura ANTES de ler o corpo.
 */

const ENTRAR = semComentarios(readFileSync('src/app/api/v1/auth/codigo/entrar/route.ts', 'utf8'))
const PEDIR = semComentarios(readFileSync('src/app/api/v1/auth/codigo/route.ts', 'utf8'))
const SERVICO = semComentarios(readFileSync('src/server/services/codigo-de-acesso.ts', 'utf8'))
const HOOK = semComentarios(readFileSync('src/app/api/v1/auth/codigo/hook/route.ts', 'utf8'))

/** Jeitos de abrir sessão sem o código que a pessoa recebeu. */
const OUTRAS_PORTAS = /\.(signInWithPassword|signInAnonymously|setSession|signInWithIdToken|exchangeCodeForSession)\(|generateLink\(/

function posicao(fonte: string, padrao: RegExp, nome: string): number {
  const i = fonte.search(padrao)
  if (i < 0) throw new Error(`não achei ${nome}; a guarda ficou cega`)
  return i
}

describe('login por número sempre pede o código', () => {
  it('a rota de entrar abre a sessão pelo código, e por nenhum outro caminho', () => {
    expect(ENTRAR).toMatch(/\.auth\.verifyOtp\(\s*\{[^}]*token:\s*codigo/)
    expect(ENTRAR).not.toMatch(OUTRAS_PORTAS)
  })

  it('o código é conferido antes de ler negócio ou perfil', () => {
    const verifica = posicao(ENTRAR, /\.auth\.verifyOtp\(/, 'a chamada de verifyOtp')
    const recusa = posicao(ENTRAR, /if \(error \|\| !data\.session/, 'a recusa quando o código não confere')
    const leitura = posicao(ENTRAR, /\.from\('memberships'\)/, 'a leitura de memberships')
    expect(verifica).toBeLessThan(recusa)
    expect(recusa).toBeLessThan(leitura)
  })

  it('a rota de pedir código não abre sessão e responde igual com ou sem conta', () => {
    expect(PEDIR).toMatch(/\.auth\.signInWithOtp\(/)
    expect(PEDIR).not.toMatch(/verifyOtp\(/)
    expect(PEDIR).not.toMatch(OUTRAS_PORTAS)
    expect(PEDIR, 'a rota tem que passar pela regra neutra do serviço').toMatch(/return pedirCodigoDeAcesso\(\{/)
    expect(PEDIR, 'a consulta de cadastro tem que estar ligada').toMatch(/temCadastro: \(\) => numeroTemCadastro\(telefone,/)
    expect(SERVICO).not.toMatch(OUTRAS_PORTAS)
    expect([...SERVICO.matchAll(/\breturn\b/g)].length, 'um único retorno de sucesso').toBe(1)
    expect(SERVICO).toMatch(/return \{ enviado: true \}/)
  })

  it('docs/119: só número cadastrado recebe código, e o limite conta antes de olhar o cadastro', () => {
    const limite = posicao(SERVICO, /await d\.limitarPorNumero\(\)/, 'o limite por número')
    const porta = posicao(SERVICO, /if \(await d\.temCadastro\(\)\) \{/, 'o if do cadastro')
    const envio = posicao(SERVICO, /await d\.enviar\(/, 'a chamada do envio')
    expect(limite).toBeLessThan(porta)
    expect(porta).toBeLessThan(envio)
    // O envio mora dentro do bloco do `if`: o primeiro `}` depois da porta vem depois do envio.
    expect(SERVICO.indexOf('}', porta + 30)).toBeGreaterThan(envio)
    expect(SERVICO.match(/d\.enviar\(/g)?.length, 'nenhum outro envio fora da porta').toBe(1)
  })

  it('o hook confere a assinatura antes de ler o corpo', () => {
    const confere = posicao(HOOK, /assinaturaDoHookConfere\(/, 'a chamada da conferência de assinatura')
    const recusa = posicao(HOOK, /if \(!confere\) return/, 'a recusa sem assinatura')
    const leitura = posicao(HOOK, /JSON\.parse\(corpo\)/, 'a leitura do corpo')
    expect(confere).toBeLessThan(recusa)
    expect(recusa).toBeLessThan(leitura)
  })
})
