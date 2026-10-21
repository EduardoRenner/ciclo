import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CICLO_COBRANCA } from '@/core/billing/cobranca'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/114 L-01: o CICLO é grátis no lançamento (decisão do Vitor, 21/10). Pagamento, planos e
 * "assinar" saem da tela atrás da chave `CICLO_COBRANCA`, desligada. O código de cobrança fica (não
 * se apaga): ligar a chave devolve tudo como era.
 *
 * Com a chave desligada, `/precos` é o destino de mais de dez links do app; em vez de caçar cada um,
 * a página vira "grátis no lançamento" antes de ler qualquer preço. "Meu plano" sai das
 * Configurações e as rotas de assinar e cancelar respondem 404.
 */
const fonte = (arquivo: string) => semComentarios(readFileSync(arquivo, 'utf8'))

/** O corpo da função a partir da assinatura dela, para conferir a ORDEM: a chave antes do resto. */
function corpoDe(texto: string, assinatura: string): string {
  const i = texto.indexOf(assinatura)
  expect(i, `não achei "${assinatura}": a guarda ficou cega`).toBeGreaterThan(-1)
  return texto.slice(i)
}

describe('lançamento grátis (docs/114 L-01)', () => {
  it('a chave da cobrança está desligada', () => {
    expect(CICLO_COBRANCA).toBe(false)
  })

  it('/precos vira "grátis no lançamento" antes de ler qualquer preço', () => {
    const corpo = corpoDe(fonte('src/app/(public)/precos/page.tsx'), 'export default function Precos(')
    const chave = corpo.indexOf('if (!CICLO_COBRANCA) return')
    expect(chave, 'a página de preços não confere a chave').toBeGreaterThan(-1)
    for (const leitura of ['ofertaDoCadastro(', 'PLANOS', 'precoDoPlano(']) {
      const i = corpo.indexOf(leitura)
      if (i !== -1) expect(chave, `${leitura} vem antes da chave`).toBeLessThan(i)
    }
  })

  it('a página grátis não mostra valor nenhum', () => {
    const texto = fonte('src/app/(public)/precos/page.tsx')
    const inicio = texto.indexOf('function PrecosGratis(')
    expect(inicio, 'não achei a página grátis').toBeGreaterThan(-1)
    const fim = texto.indexOf('\n}\n', inicio)
    expect(fim).toBeGreaterThan(inicio)
    expect(texto.slice(inicio, fim)).not.toMatch(/R\$|por m[eê]s|plano|assin/i)
  })

  it('"Meu plano" confere a chave antes de montar a tela, e sai das Configurações', () => {
    const corpo = corpoDe(fonte('src/app/admin/config/meu-plano/page.tsx'), 'export default async function PaginaMeuPlano(')
    expect(corpo.indexOf('if (!CICLO_COBRANCA)'), 'Meu plano não confere a chave').toBeGreaterThan(-1)
    expect(fonte('src/app/admin/config/page.tsx')).toMatch(/CICLO_COBRANCA \? <ItemDeConfig item=\{CONTA\.meuPlano\}/)
  })

  it.each(['src/app/api/v1/billing/assinar/route.ts', 'src/app/api/v1/billing/cancelar/route.ts'])(
    '%s responde 404 com a chave desligada',
    (arquivo) => {
      expect(fonte(arquivo)).toMatch(/if \(!CICLO_COBRANCA\) throw new AppError\('NOT_FOUND'\)/)
    },
  )
})
