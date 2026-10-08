import { describe, expect, it } from 'vitest'

import { transicionar } from '@/core/advocacia/checklist'
import { acoesDaTela, linkDoWhatsApp, montarFila, type ItemDaFila } from '@/core/advocacia/fila-de-pendencias'

const HOJE = '2026-10-08'

function item(p: Partial<ItemDaFila> & Pick<ItemDaFila, 'id'>): ItemDaFila {
  return {
    rowVersion: 1,
    titulo: `Item ${p.id}`,
    estado: 'pendente',
    quemDeve: 'cliente',
    venceEm: null,
    rodadaDesde: '2026-10-01',
    rodada: 1,
    motivoDaDevolucao: null,
    casoId: 'caso-1',
    casoParaCliente: 'o planejamento da família',
    casoTitulo: 'Holding Silva',
    clienteId: 'cli-1',
    clienteNome: 'Ana Souza',
    clienteTelefone: '+5551999990000',
    ...p,
  }
}

describe('montarFila', () => {
  it('agrupa por cliente e põe primeiro quem tem item atrasado', () => {
    const fila = montarFila(
      [
        item({ id: 'a', clienteId: 'cli-1', clienteNome: 'Ana Souza', rodadaDesde: '2026-09-01' }),
        item({ id: 'b', clienteId: 'cli-2', clienteNome: 'Bruno Lima', venceEm: '2026-10-05', rodadaDesde: '2026-10-07' }),
        item({ id: 'c', clienteId: 'cli-1', clienteNome: 'Ana Souza', rodadaDesde: '2026-10-06' }),
      ],
      HOJE,
      'Escritório Modelo',
    )
    expect(fila.map((g) => g.clienteNome)).toEqual(['Bruno Lima', 'Ana Souza'])
    expect(fila[0]!.atrasados).toBe(1)
    expect(fila[1]!.itens.map((i) => i.id)).toEqual(['a', 'c'])
    expect(fila[1]!.diasEmAberto).toBe(37)
  })

  it('recebida fora do prazo não conta como atrasada: a bola já está com a equipe', () => {
    const [g] = montarFila([item({ id: 'a', estado: 'recebido', venceEm: '2026-10-01' }), item({ id: 'b', venceEm: '2026-10-01' })], HOJE, 'X')
    expect(g!.itens.find((i) => i.id === 'a')!.atrasado).toBe(false)
    expect(g!.itens.find((i) => i.id === 'b')!.atrasado).toBe(true)
    expect(g!.atrasados).toBe(1)
  })

  it('concluído e cancelado não entram na fila', () => {
    const fila = montarFila([item({ id: 'a', estado: 'concluido' }), item({ id: 'b', estado: 'cancelado' })], HOJE, 'X')
    expect(fila).toEqual([])
  })

  it('a cobrança leva só o que está com o cliente, pelo primeiro nome, no telefone dele', () => {
    const [g] = montarFila(
      [
        item({ id: 'a', titulo: 'RG e CPF dos sócios' }),
        item({ id: 'b', titulo: 'Conferir minuta', quemDeve: 'equipe' }),
        item({ id: 'c', titulo: 'Contrato social', estado: 'recebido' }),
      ],
      HOJE,
      'Escritório Modelo',
    )
    expect(g!.cobranca).not.toBeNull()
    const c = g!.cobranca as { texto: string; link: string }
    expect(c.texto).toContain('Oi, Ana!')
    expect(c.texto).toContain('• RG e CPF dos sócios')
    expect(c.texto).not.toContain('Conferir minuta')
    expect(c.texto).not.toContain('Contrato social')
    expect(c.link.startsWith('https://wa.me/5551999990000?text=')).toBe(true)
  })

  it('cliente com dois casos: a mensagem não nomeia nenhum dos dois', () => {
    const [g] = montarFila(
      [item({ id: 'a', casoId: 'c1', casoParaCliente: 'o inventário' }), item({ id: 'b', casoId: 'c2', casoParaCliente: 'a holding' })],
      HOJE,
      'X',
    )
    const c = g!.cobranca as { texto: string }
    expect(c.texto).toContain('os seus atendimentos')
    expect(c.texto).not.toContain('inventário')
  })

  it('título com número de processo vira erro explicado, nunca link', () => {
    const [g] = montarFila([item({ id: 'a', titulo: 'Cópia do 0001234-56.2026.8.21.0001' })], HOJE, 'X')
    expect(g!.cobranca).toMatchObject({ erro: expect.stringContaining('número de processo') })
  })

  it('só itens da equipe: nada a cobrar', () => {
    const [g] = montarFila([item({ id: 'a', quemDeve: 'equipe' })], HOJE, 'X')
    expect(g!.cobranca).toBeNull()
  })
})

describe('linkDoWhatsApp', () => {
  it('sem telefone válido abre o seletor de contato', () => {
    expect(linkDoWhatsApp(null, 'oi')).toBe('https://wa.me/?text=oi')
    expect(linkDoWhatsApp('51 9999', 'oi')).toBe('https://wa.me/?text=oi')
  })
})

describe('acoesDaTela', () => {
  it('nenhum botão que o servidor recusaria, em nenhum estado', () => {
    for (const estado of ['rascunho', 'pendente', 'devolvido', 'recebido', 'em_conferencia', 'concluido', 'cancelado'] as const) {
      for (const quem of ['cliente', 'equipe'] as const) {
        for (const a of acoesDaTela(estado, quem)) {
          expect(transicionar({ estado, rodada: 1 }, a, 'motivo longo').ok, `${estado}/${quem}/${a}`).toBe(true)
        }
      }
    }
  })

  it('o caminho de cada estado', () => {
    expect(acoesDaTela('rascunho', 'cliente')).toEqual(['aprovar'])
    expect(acoesDaTela('pendente', 'cliente')).toEqual(['receber'])
    expect(acoesDaTela('pendente', 'equipe')).toEqual(['concluir'])
    expect(acoesDaTela('recebido', 'cliente')).toEqual(['concluir', 'devolver'])
    expect(acoesDaTela('devolvido', 'cliente')).toEqual(['receber'])
  })
})
