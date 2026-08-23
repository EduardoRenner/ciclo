import { describe, expect, it } from 'vitest'

import { ipDe } from '@/server/http/ip'

/**
 * Achado S6 da auditoria de 2026-08-23: `ipDe` lia o **primeiro** elemento de `X-Forwarded-For`,
 * que é exatamente o valor que o cliente injeta quando o proxy acrescenta o IP real ao final.
 * Trocar o header a cada requisição daria um balde novo no limitador toda vez — e, com o S4
 * corrigido para contar no Postgres, seria a última coisa entre um script e a agenda inteira.
 */

function req(headers: Record<string, string>): Request {
  return new Request('https://ciclo-umber.vercel.app/api/v1/public/x/book', { headers })
}

describe('ipDe', () => {
  it('prefere o header da borda da Vercel a qualquer coisa que o cliente mande', () => {
    expect(
      ipDe(req({ 'x-vercel-forwarded-for': '203.0.113.9', 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2' })),
    ).toBe('203.0.113.9')
  })

  it('cai para x-real-ip quando não há header da Vercel', () => {
    expect(ipDe(req({ 'x-real-ip': '198.51.100.4', 'x-forwarded-for': '1.1.1.1' }))).toBe('198.51.100.4')
  })

  it('numa cadeia de XFF pega o ÚLTIMO, que é o que o proxy anexou', () => {
    // O primeiro valor é forjado pelo cliente; o último foi posto pela infraestrutura.
    expect(ipDe(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('IP forjado sozinho no XFF não vira balde novo a cada tentativa — este é o S6', () => {
    // Sem proxy anexando nada, um cliente que inventa o header ainda controla o valor. O que o
    // teste trava é a ORDEM: na Vercel, onde a borda carimba, o forjado nunca ganha.
    const forjado1 = ipDe(req({ 'x-forwarded-for': 'aleatorio-1', 'x-vercel-forwarded-for': '203.0.113.7' }))
    const forjado2 = ipDe(req({ 'x-forwarded-for': 'aleatorio-2', 'x-vercel-forwarded-for': '203.0.113.7' }))
    expect(forjado1).toBe(forjado2)
  })

  it('XFF com um valor só devolve esse valor', () => {
    expect(ipDe(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('sem header nenhum cai num balde único, que é mais restritivo e nunca mais permissivo', () => {
    expect(ipDe(req({}))).toBe('sem-ip')
  })

  it('header vazio ou só com vírgulas não vira chave em branco', () => {
    expect(ipDe(req({ 'x-forwarded-for': '  ,  ' }))).toBe('sem-ip')
    expect(ipDe(req({ 'x-real-ip': '   ' }))).toBe('sem-ip')
  })
})
