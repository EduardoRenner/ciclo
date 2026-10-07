import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ACESSO_ABERTO } from '@/core/billing/acesso-aberto'
import { faixaDaConta } from '@/core/billing/faixa-da-conta'
import { visaoDoMeuPlano } from '@/core/billing/meu-plano'
import { cortesiaDoCadastro, fimDaGraca, ofertaDoCadastro, situacaoDaConta, situacaoEmVigor } from '@/core/billing/prelancamento'

import { semComentarios } from '../../helpers/fonte'

/**
 * Acesso aberto (2026-10-07): toda conta usa tudo, sem pagar e sem pausa. Estes testes NÃO mockam a
 * chave: exercitam o parâmetro `aberto`, e o padrão contra a constante real, para valerem nos dois
 * valores dela. As regras do programa de cortesia têm os próprios testes, com a chave desligada.
 */
const cadastro = new Date('2026-12-01T15:00:00Z')
const cortesia = cortesiaDoCadastro(cadastro)
const pausada = new Date(fimDaGraca(cortesia).getTime() + 3 * 24 * 3600 * 1000)

describe('situacaoEmVigor', () => {
  it('controle: sem a chave, esta conta ESTARIA pausada (o cenário foi montado)', () => {
    expect(situacaoDaConta('gratis', cortesia, pausada).estado).toBe('pausada')
    expect(situacaoEmVigor('gratis', cortesia, pausada, false).estado).toBe('pausada')
  })

  it('com a chave: o degrau mais alto, escrita liberada, mesmo no dia em que o programa pausaria', () => {
    const s = situacaoEmVigor('gratis', cortesia, pausada, true)
    expect(s.estado).toBe('aberto')
    expect(s.plano).toBe('avancado')
    expect(s.planoDeLeitura).toBe('avancado')
    expect(s.podeEscrever).toBe(true)
  })

  it('vale para conta sem cortesia e para conta que paga: ninguém fica abaixo do aberto', () => {
    for (const plano of ['gratis', 'essencial', 'equipe'] as const) {
      expect(situacaoEmVigor(plano, null, pausada, true)).toMatchObject({ estado: 'aberto', plano: 'avancado', podeEscrever: true })
    }
  })

  it('o padrão segue a constante real', () => {
    const esperado = ACESSO_ABERTO ? 'aberto' : situacaoDaConta('gratis', cortesia, pausada).estado
    expect(situacaoEmVigor('gratis', cortesia, pausada).estado).toBe(esperado)
  })
})

describe('o que a pessoa lê no acesso aberto', () => {
  const aberta = situacaoEmVigor('gratis', cortesia, pausada, true)

  it('sem faixa de cortesia, de graça ou de pausa, mesmo com a cortesia gravada', () => {
    expect(faixaDaConta(aberta, pausada)).toBeNull()
  })

  it('"Meu plano" diz que está liberado, sem preço e sem escolher plano', () => {
    const v = visaoDoMeuPlano(aberta, 'gratis', 1)
    expect(v.nome).toBe('Acesso aberto')
    expect(v.preco).toBeNull()
    expect(v.opcoes).toEqual([])
    expect(v.explicacao).toMatch(/sem cartão e sem prazo/)
    expect(v.explicacao).toMatch(/avisa com antecedência antes de qualquer cobrança/)
    for (const texto of [v.descricao, v.explicacao ?? '']) expect(texto).not.toMatch(/[—–]/)
  })

  it('a oferta do cadastro não fala de data nem de prazo que não existe', () => {
    const o = ofertaDoCadastro(cadastro, true)
    expect(o).toEqual({ aberto: true, longa: false, chamada: 'Tudo liberado, sem cartão', fim: '', ateQuandoALongaVale: '' })
    // Controle: desligada, volta a ser a oferta com data.
    expect(ofertaDoCadastro(cadastro, false).aberto).toBe(false)
    expect(ofertaDoCadastro(cadastro, false).fim).not.toBe('')
  })
})

describe('ninguém consulta a regra do programa sem passar pela chave', () => {
  function fontes(pasta: string): string[] {
    return readdirSync(pasta).flatMap((nome) => {
      const caminho = join(pasta, nome)
      if (statSync(caminho).isDirectory()) return fontes(caminho)
      return /\.(ts|tsx)$/.test(nome) ? [caminho] : []
    })
  }
  const FONTES = fontes('src').map((arquivo) => ({ arquivo, fonte: semComentarios(readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n')) }))

  it('o leitor achou quem usa situacaoEmVigor (controle contra varredura vazia)', () => {
    expect(FONTES.filter((f) => /\bsituacaoEmVigor\(/.test(f.fonte)).length).toBeGreaterThanOrEqual(3)
  })

  it('fora de prelancamento.ts, ninguém chama situacaoDaConta do núcleo de cobrança (a chamada, não o nome)', () => {
    const chamam = FONTES.filter(
      (f) =>
        !f.arquivo.endsWith('prelancamento.ts') &&
        /import[^;]*\bsituacaoDaConta\b[^;]*from '[^']*billing\/prelancamento'/.test(f.fonte) &&
        /\bsituacaoDaConta\(/.test(f.fonte),
    ).map((f) => f.arquivo)
    expect(chamam, 'Chame situacaoEmVigor: situacaoDaConta ignora o acesso aberto.').toEqual([])
  })
})
