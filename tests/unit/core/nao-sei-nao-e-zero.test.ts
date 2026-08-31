import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { avisoAntesDeSair } from '@/core/offline/aviso-de-saida'

/**
 * Sair da conta APAGA a fila offline deste aparelho. A tela já contava o que não subiu e avisava —
 * proteção deliberada, com comentário explicando que descartar trabalho em silêncio "a pessoa só
 * descobre no dia seguinte, quando o cliente aparece para um horário que não existe".
 *
 * Só que a contagem vinha de `listarMutacoes().catch(() => [])`, e esse `catch` transforma "não
 * consegui LER a fila" em "a fila está VAZIA". A proteção se desligava sozinha exatamente quando
 * mais importava: IndexedDB falha de verdade (janela anônima, armazenamento cheio, base
 * corrompida). Verde, silencioso, e o trabalho ia embora.
 */
describe('"não sei" nunca vira "não tem nada"', () => {
  it('leitura falhou: avisa, não deixa sair calado', () => {
    // ESTE é o caso do defeito. Antes: `[]` → `length === 0` → sai sem dizer nada.
    expect(avisoAntesDeSair({ ok: false })).toEqual({ tipo: 'nao_sei' })
  })

  it('fila vazia de verdade: sai sem atrito', () => {
    expect(avisoAntesDeSair({ ok: true, quantidade: 0 })).toEqual({ tipo: 'pode_sair' })
  })

  it('fila com itens: avisa quantos', () => {
    expect(avisoAntesDeSair({ ok: true, quantidade: 12 })).toEqual({ tipo: 'vai_descartar', quantidade: 12 })
  })

  it('falha e vazio NÃO são o mesmo resultado', () => {
    // A asserção que resume o defeito inteiro numa linha.
    expect(avisoAntesDeSair({ ok: false })).not.toEqual(avisoAntesDeSair({ ok: true, quantidade: 0 }))
  })
})

describe('a tela de sair usa a regra, e não um catch que apaga a dúvida', () => {
  const fonte = readFileSync('src/app/admin/config/sair.tsx', 'utf8')

  it('a decisão de avisar passa por avisoAntesDeSair', () => {
    // Casa com a CHAMADA, não com o import — o nome solto casaria com a linha de `import` e a
    // guarda passaria verde com a regra desligada (armadilha registrada no CLAUDE.md).
    expect(fonte, 'a tela não chama avisoAntesDeSair(').toContain('avisoAntesDeSair(leitura)')
  })

  it('a leitura que decide o aviso não cai em lista vazia no erro', () => {
    // O `.catch(() => [])` da linha de cima (que só decide se TENTA drenar) pode ficar; o que não
    // pode voltar é ele governando a CONTAGEM. Se alguém reescrever assim, esta guarda reprova.
    // Ancorado na CHAMADA (`await drenarFilaPendente(`), nunca no nome solto: a primeira
    // ocorrência de `drenarFilaPendente` é a linha de `import`, e ancorar ali pegaria o arquivo
    // inteiro — inclusive o catch legítimo de cima. Foi o que aconteceu na primeira versão desta
    // guarda, e é a armadilha nº1 da tabela do CLAUDE.md.
    const inicio = fonte.indexOf('await drenarFilaPendente(')
    expect(inicio, 'não achei a chamada de drenarFilaPendente — a guarda perdeu a âncora').toBeGreaterThan(-1)
    const depoisDaDrenagem = fonte.slice(inicio)
    expect(depoisDaDrenagem, 'a contagem voltou a usar catch(() => []) — "não sei" virou zero de novo').not.toContain('listarMutacoes().catch(() => [])')
  })
})
