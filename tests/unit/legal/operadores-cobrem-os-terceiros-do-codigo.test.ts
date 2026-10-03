import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { OPERADORES } from '@/core/legal/operadores'

import { semComentarios } from '../../helpers/fonte'

/**
 * A política de privacidade dizia "os servidores ficam no Brasil" e listava quatro terceiros, e o
 * código falava com outros. Esta guarda amarra a lista (`core/legal/operadores.ts`) ao que o código
 * faz, nos dois sentidos, e à CSP do navegador:
 *
 * 1. todo host externo que o fonte cita é um operador, um link que a PESSOA abre com um clique, ou
 *    não é terceiro (namespace, domínio nosso). Host novo sem classificação reprova no commit que o
 *    escreve, antes de virar dado saindo sem ninguém ter decidido;
 * 2. todo operador tem rastro no fonte (senão a lista descreve uma integração que já foi embora);
 * 3. toda variável de ambiente que liga um operador existe em `.env.example`;
 * 4. as origens que a CSP deixa o navegador chamar são exatamente as declaradas nos operadores.
 *
 * Lê o fonte SEM comentários: comentário explica por que um terceiro NÃO está lá, e casaria com ele.
 */

/** Links que o navegador de quem clica abre. O CICLO não manda dado nenhum para eles. */
const LINKS_QUE_A_PESSOA_ABRE = [
  'api.whatsapp.com',
  'wa.me',
  'instagram.com',
  'www.google.com', // google.com/maps/search?query=<endereço>, só no clique
  'mail.google.com',
  'outlook.live.com',
  'mail.yahoo.com',
  'email.uol.com.br',
  'email.bol.uol.com.br',
  'www.icloud.com',
]

/** Não é terceiro: namespace de formato, domínio nosso, ou marcador de URL relativa. */
const NAO_E_TERCEIRO = ['schema.org', 'www.w3.org', 'seuciclo.com.br', 'interno.invalid', 'relativo.invalid']

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.(ts|tsx)$/.test(nome) && !nome.endsWith('types.gen.ts') ? [caminho] : []
  })
}

const FONTE = arquivos('src').map((caminho) => ({ caminho: caminho.replace(/\\/g, '/'), texto: semComentarios(readFileSync(caminho, 'utf8')) }))

function hostsDoFonte(): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const { caminho, texto } of FONTE) {
    for (const m of texto.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const host = m[1]!.toLowerCase()
      mapa.set(host, [...(mapa.get(host) ?? []), caminho])
    }
  }
  return mapa
}

const HOSTS = hostsDoFonte()
const HOSTS_DOS_OPERADORES = new Set(OPERADORES.flatMap((o) => [...o.hostsDoServidor, ...o.hostsDoNavegador]))

describe('a lista de operadores cobre os terceiros do código', () => {
  it('o detector enxerga o cenário: acha dezenas de hosts e os operadores conhecidos, senão as asserções passariam vazias', () => {
    expect(FONTE.length, 'não li o fonte').toBeGreaterThan(300)
    expect(HOSTS.size).toBeGreaterThan(10)
    for (const h of ['api.mercadopago.com', 'graph.facebook.com', 'api.resend.com']) expect(HOSTS.has(h), `${h} sumiu do fonte: o detector quebrou`).toBe(true)
  })

  it('todo host externo é operador, link da pessoa ou não-terceiro (host novo reprova até alguém classificar)', () => {
    const conhecidos = new Set([...HOSTS_DOS_OPERADORES, ...LINKS_QUE_A_PESSOA_ABRE, ...NAO_E_TERCEIRO])
    const novos = [...HOSTS.entries()].filter(([h]) => !conhecidos.has(h)).map(([h, onde]) => `${h} (${onde[0]})`)
    expect(novos, `host(s) novo(s) sem classificação: ${novos.join('; ')}. É operador (core/legal/operadores.ts), link que a pessoa abre ou não é terceiro?`).toEqual([])
  })

  it('todo host que um operador declara aparece no fonte (a integração não foi embora)', () => {
    for (const o of OPERADORES) {
      for (const h of o.hostsDoServidor) expect(HOSTS.has(h), `${o.id}: ${h} não aparece mais no código`).toBe(true)
    }
  })

  it('todo operador deixa rastro no fonte, ou no arquivo de configuração quando é hospedagem', () => {
    for (const o of OPERADORES) {
      if (o.marcadores.length === 0) {
        expect(o.id, `${o.id} sem marcador no código: só a hospedagem pode estar assim`).toBe('vercel')
        expect(readFileSync('vercel.json', 'utf8'), 'vercel.json sumiu: a região das funções não está mais provada').toMatch(/"regions"\s*:\s*\["gru1"\]/)
        continue
      }
      for (const marcador of o.marcadores) {
        const achou = FONTE.some((f) => f.texto.includes(marcador))
        expect(achou, `${o.id}: nenhum arquivo usa mais "${marcador}". Tire o operador da lista ou confira o marcador`).toBe(true)
      }
    }
  })

  it('toda variável de ambiente de um operador existe em .env.example', () => {
    const exemplo = readFileSync('.env.example', 'utf8')
    for (const o of OPERADORES) {
      for (const chave of o.chavesDeAmbiente) expect(exemplo, `${o.id}: ${chave} não está em .env.example`).toMatch(new RegExp(`^${chave}=`, 'm'))
    }
  })

  it('as origens externas que a CSP deixa o navegador chamar são exatamente as declaradas nos operadores', () => {
    const csp = readFileSync('src/middleware.ts', 'utf8')
    const bloco = csp.slice(csp.indexOf('const csp = `'), csp.indexOf('`', csp.indexOf('const csp = `') + 14))
    expect(bloco.length, 'não achei o bloco da CSP: o formato mudou').toBeGreaterThan(200)
    const naCsp = new Set([...bloco.matchAll(/https:\/\/([a-z0-9.*-]+\.[a-z]{2,})/gi)].map((m) => m[1]!.toLowerCase()))
    const declarados = new Set(OPERADORES.flatMap((o) => o.hostsDoNavegador))
    expect([...naCsp].sort(), 'a CSP libera um host que nenhum operador declara (ou o contrário)').toEqual([...declarados].sort())
  })

  it('ids únicos e todo operador que a política mostra diz o que recebe e onde processa', () => {
    const ids = OPERADORES.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const o of OPERADORES.filter((x) => x.naPolitica)) {
      expect(o.dadoQueRecebe.length, `${o.id} sem dado`).toBeGreaterThan(20)
      expect(o.onde.length, `${o.id} sem lugar`).toBeGreaterThan(5)
    }
  })

  it('o que está fora do Brasil NUNCA aparece como confirmado no código (a política não afirma o que o repositório não prova)', () => {
    for (const o of OPERADORES) {
      if (o.ondeConfirmadoNoCodigo) expect(['supabase', 'vercel']).toContain(o.id)
    }
  })

  it('nenhuma frase tem travessão', () => {
    for (const o of OPERADORES) expect(`${o.papel} ${o.dadoQueRecebe} ${o.onde}`, o.id).not.toMatch(/[—–]/)
  })
})
