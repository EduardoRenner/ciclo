import { describe, expect, it } from 'vitest'

import { aparecerNaBusca, resultadoDaBusca, normalizarBusca } from '@/core/busca/negocios'

/**
 * docs/114 L-06: a cliente procura por serviço e cidade/bairro e acha quem atende. Só aparece quem
 * pode receber agendamento pelo link (serviço online e horário) e não desligou "aparecer na busca".
 */
describe('normalizarBusca', () => {
  it('ignora acento, caixa e espaço sobrando', () => {
    expect(normalizarBusca('  Cílios  ')).toBe('cilios')
    expect(normalizarBusca('SÃO MIGUEL do Oeste')).toBe('sao miguel do oeste')
  })
})

describe('aparecerNaBusca', () => {
  const pronto = { desligado: false, servicosOnline: 2, temExpediente: true, demonstracao: false, pausado: false }

  it('ligado por padrão para quem tem link, serviço online e horário', () => {
    expect(aparecerNaBusca(pronto)).toBe(true)
  })

  it('some quando falta qualquer peça ou quando a profissional desligou', () => {
    expect(aparecerNaBusca({ ...pronto, desligado: true })).toBe(false)
    expect(aparecerNaBusca({ ...pronto, servicosOnline: 0 })).toBe(false)
    expect(aparecerNaBusca({ ...pronto, temExpediente: false })).toBe(false)
    expect(aparecerNaBusca({ ...pronto, demonstracao: true })).toBe(false)
    expect(aparecerNaBusca({ ...pronto, pausado: true })).toBe(false)
  })
})

describe('resultadoDaBusca', () => {
  const negocio = {
    nome: 'Carol Menezes Cílios e Sobrancelha',
    endereco: 'Rua das Flores, 120, Centro, Maravilha - SC',
    profissao: { nome: 'Cílios', sinonimos: ['lash', 'extensão de cílios'] },
    servicos: [
      { nome: 'Manutenção de cílios', precoCents: 12_000 },
      { nome: 'Design de sobrancelha', precoCents: 6_500 },
      { nome: 'Lash lifting', precoCents: 14_000 },
    ],
  }

  it('acha pelo serviço, sem acento, e o "a partir de" é o menor preço do que combinou', () => {
    expect(resultadoDaBusca(negocio, { termo: 'cilios', cidade: '' })).toEqual({ servico: 'Manutenção de cílios', aPartirDeCents: 12_000 })
  })

  it('serviço com o termo no nome vence ("lash" acha o Lash lifting)', () => {
    expect(resultadoDaBusca(negocio, { termo: 'lash', cidade: '' })).toEqual({ servico: 'Lash lifting', aPartirDeCents: 14_000 })
  })

  it('termo só no sinônimo da profissão mostra o serviço da profissão, não o mais barato do negócio', () => {
    expect(resultadoDaBusca(negocio, { termo: 'extensão', cidade: '' })).toEqual({ servico: 'Manutenção de cílios', aPartirDeCents: 12_000 })
  })

  it('cidade ou bairro casa com o endereço; cidade diferente não aparece', () => {
    expect(resultadoDaBusca(negocio, { termo: 'sobrancelha', cidade: 'maravilha' })).toEqual({ servico: 'Design de sobrancelha', aPartirDeCents: 6_500 })
    expect(resultadoDaBusca(negocio, { termo: '', cidade: 'centro' })).not.toBeNull()
    expect(resultadoDaBusca(negocio, { termo: 'cilios', cidade: 'chapecó' })).toBeNull()
  })

  it('quando nenhum serviço tem o termo no nome, o destaque é um serviço que volta, não a remoção', () => {
    // Medido na busca local por "unhas": vinha "Remoção · a partir de R$ 30,00", o serviço mais barato e sem volta.
    const unhas = {
      nome: 'Unhas da Carol',
      endereco: null,
      profissao: { nome: 'Unhas', sinonimos: ['manicure', 'nail'] },
      servicos: [
        { nome: 'Remoção', precoCents: 3_000, ritmoDias: 365 },
        { nome: 'Pé e mão', precoCents: 7_500, ritmoDias: 14 },
        { nome: 'Esmaltação em gel', precoCents: 9_000, ritmoDias: 21 },
      ],
    }
    expect(resultadoDaBusca(unhas, { termo: 'unhas', cidade: '' })).toEqual({ servico: 'Pé e mão', aPartirDeCents: 7_500 })
    expect(resultadoDaBusca(unhas, { termo: '', cidade: '' })).toEqual({ servico: 'Pé e mão', aPartirDeCents: 7_500 })
    // Mas quem procura a remoção acha a remoção.
    expect(resultadoDaBusca(unhas, { termo: 'remocao', cidade: '' })).toEqual({ servico: 'Remoção', aPartirDeCents: 3_000 })
  })

  it('o serviço de volta do pacote vence, mesmo quando a remoção da conta tem ritmo curto', () => {
    // Medido no banco local: as contas de unhas têm "Remoção" com 21 dias e marcável online (EXP-S09 pendente).
    const unhas = {
      nome: 'Unhas da Carol',
      endereco: null,
      profissao: { nome: 'Unhas', sinonimos: [] },
      servicos: [
        { nome: 'Remoção', precoCents: 3_000, ritmoDias: 21 },
        { nome: 'Manicure simples', precoCents: 4_500, ritmoDias: 14 },
        { nome: 'Pé e mão', precoCents: 7_500, ritmoDias: 14, deVolta: true },
      ],
    }
    expect(resultadoDaBusca(unhas, { termo: 'unhas', cidade: '' })).toEqual({ servico: 'Pé e mão', aPartirDeCents: 7_500 })
  })

  it('termo que nada tem a ver não aparece', () => {
    expect(resultadoDaBusca(negocio, { termo: 'barba', cidade: '' })).toBeNull()
  })

  it('sem termo, aparece com o serviço mais barato', () => {
    expect(resultadoDaBusca(negocio, { termo: '', cidade: '' })).toEqual({ servico: 'Design de sobrancelha', aPartirDeCents: 6_500 })
  })
})
