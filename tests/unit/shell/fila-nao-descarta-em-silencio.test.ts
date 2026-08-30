import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Achado da auditoria de 2026-08-28, família "descarta em silêncio".
 *
 * A especificação (§4.2.5) diz, com estas palavras: *"409 marca o item como precisa da sua
 * atenção. Nunca descarta em silêncio."* A metade do `409` estava entregue desde o TICKET-055. A
 * outra metade não: qualquer 4xx definitivo (400, 402, 404, 422) fazia `drenarFilaPendente`
 * chamar `removerMutacao` e emitir um evento `descartada` que o único assinante do projeto usava
 * **apenas para sumir com o card de conflito**. Ninguém era avisado de nada.
 *
 * O caminho inteiro é real e tem uma tela só: `admin/agenda/novo` chama `apiFetch`, que sem rede
 * enfileira e mostra *"Agendamento entrou na fila e será enviado quando a conexão voltar"*. Se a
 * drenagem depois recebesse `404` (serviço apagado) ou `422`, a mutação sumia — e a cliente
 * aparecia para um horário que não existe.
 *
 * O componente é de browser (`useState`, `useEffect`) e este projeto roda o Vitest em `node`, sem
 * jsdom. O que dá para travar aqui é o que de fato faltava: o evento **carregar** a mutação e a
 * tela **ter estado próprio** para ela. A regra que decide quem é descarte virou função pura e
 * tem teste de comportamento em `tests/unit/core/offline-queue.test.ts`.
 */

const CLIENTE = 'src/lib/offline/api-client.ts'
const TELA = 'src/components/shell/resolucao-de-fila.tsx'

function semComentarios(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/[{][/][*][\s\S]*?[*][/][}]/g, ' ')
    .replace(/[/][*][\s\S]*?[*][/]/g, ' ')
    .replace(/^\s*[/][/].*$/gm, ' ')
}

describe('descarte da fila offline não é silencioso', () => {
  const cliente = semComentarios(CLIENTE)
  const tela = semComentarios(TELA)

  it('a leitura não voltou vazia', () => {
    expect(cliente.length, `${CLIENTE} veio vazio`).toBeGreaterThan(1_000)
    expect(tela.length, `${TELA} veio vazio`).toBeGreaterThan(1_000)
    expect(cliente, 'drenarFilaPendente sumiu — este teste precisa ser revisto junto').toContain('drenarFilaPendente')
  })

  it('a classificação do status vem do core, não escrita à mão no adaptador', () => {
    // O adaptador é intestável neste projeto (sem jsdom). Regra de negócio ali dentro é regra
    // sem teste — e essa em particular apaga trabalho da pessoa.
    expect(
      cliente.includes('classificarResposta('),
      'o adaptador voltou a decidir o desfecho por conta própria; a regra vive em @/core/offline/queue',
    ).toBe(true)
    expect(
      cliente.includes('=== 409') || cliente.includes('>= 500'),
      'status escrito à mão de volta no adaptador — foi assim que 401 virou descarte sem ninguém ver',
    ).toBe(false)
  })

  it('o evento de descarte leva a mutação junto', () => {
    // Sem a mutação, o aviso na tela só consegue dizer "alguma coisa falhou".
    // O `}` no fim NÃO é decoração: sem ele, `mutacao: null` — que é o defeito de volta — casa
    // como prefixo e a asserção passa. O teste de mutação flagrou exatamente isso.
    expect(
      cliente.includes("tipo: 'descartada', id, mutacao }"),
      'o evento de descarte voltou a levar só o id (ou um `mutacao: null`) — a tela fica sem o que mostrar',
    ).toBe(true)
    // E ela precisa ser lida ANTES do removerMutacao: depois não há mais o que ler.
    const leitura = cliente.indexOf('const mutacao = fila.find')
    const remocao = cliente.indexOf('await removerMutacao(id)', leitura === -1 ? 0 : leitura)
    expect(leitura, 'não achei a leitura da mutação descartada').toBeGreaterThan(-1)
    expect(remocao, 'a mutação precisa ser lida antes de sair do IndexedDB').toBeGreaterThan(leitura)
  })

  it('a tela tem estado próprio para o descarte — não só apaga o card de conflito', () => {
    expect(
      /setDescartadas\(/.test(tela),
      'a tela voltou a usar o evento `descartada` apenas para filtrar conflitos: o descarte fica mudo',
    ).toBe(true)
    expect(
      /descartadas\.map\(/.test(tela),
      'o estado de descarte existe e não é desenhado em lugar nenhum — pior que não ter',
    ).toBe(true)
  })

  it('a tela não some quando SÓ há descarte', () => {
    // O `return null` antecipado é a forma mais fácil de o aviso nascer morto.
    expect(
      /conflitos\.length === 0 && descartadas\.length === 0/.test(tela),
      'o early-return só olha os conflitos — com a fila só tendo descarte, o componente não renderiza nada',
    ).toBe(true)
  })
})
