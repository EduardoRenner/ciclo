import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A escolha do profissional no agendamento público consultava a agenda da pessoa ERRADA.
 *
 * O handler era `setProfessionalId(p.id); buscarDisponibilidade(dia)`, e `buscarDisponibilidade`
 * lê `professionalId` do render corrente — que ainda é o ANTERIOR, porque `setState` não muda a
 * variável já capturada pelo closure. Medido na rede em 05/09/2026, no `dom-rocha`, com três
 * barbeiros:
 *
 * | toque | o que a tela destacava | o que a requisição pedia |
 * |---|---|---|
 * | 1º, em Diego | Diego | **nenhum filtro** (agenda dos três) |
 * | 2º, em Léo | Léo | `professionalId` do **Diego** |
 *
 * Sempre uma escolha atrasada. E não parava na lista: o `book` envia
 * `slotEscolhido.professionalId`, o dono do horário exibido — então dava para escolher o Léo, ver
 * horário de outro, tocar, e a tela de sucesso nomear outra pessoa. O comentário do próprio Chip
 * diz por que isso importa: "a cliente marca com ALGUÉM, não com uma string".
 *
 * O conserto é o mesmo padrão que o arquivo já usava para o serviço (`novoServico`): passar o
 * valor novo explicitamente, em vez de reler o estado. `undefined` mantém a escolha atual, `null`
 * é o "Tanto faz" — por isso o parâmetro não pode ser só `string`.
 *
 * Esta guarda afirma as DUAS pontas da costura, porque conferir uma não prova a outra: quem
 * CHAMA precisa passar o valor, e quem RECEBE precisa usá-lo no lugar do estado. Trocar só um dos
 * lados deixava a suíte verde com o defeito de volta.
 */
const AGENDAR = join('src', 'app', '(public)', '[slug]', 'agendar', 'agendar.tsx')

function fonte(): string {
  return semComentarios(readFileSync(AGENDAR, 'utf8'))
}

/** Argumentos de cada chamada, delimitados pelo parêntese que fecha — nunca por janela. */
function chamadas(src: string, nome: string): { args: string; fim: number }[] {
  const achadas: { args: string; fim: number }[] = []
  const alvo = `${nome}(`
  let i = src.indexOf(alvo)
  while (i !== -1) {
    let profundidade = 0
    let j = i + alvo.length - 1
    for (; j < src.length; j++) {
      if (src[j] === '(') profundidade++
      else if (src[j] === ')') {
        profundidade--
        if (profundidade === 0) break
      }
    }
    achadas.push({ args: src.slice(i + alvo.length, j), fim: j })
    i = src.indexOf(alvo, j)
  }
  return achadas
}

/** Vírgulas do primeiro nível: `f(a, g(b, c))` tem DOIS argumentos, não três. */
function quantosArgumentos(args: string): number {
  if (args.trim() === '') return 0
  let profundidade = 0
  let n = 1
  for (const c of args) {
    if (c === '(' || c === '[' || c === '{') profundidade++
    else if (c === ')' || c === ']' || c === '}') profundidade--
    else if (c === ',' && profundidade === 0) n++
  }
  return n
}

describe('o agendamento consulta a agenda do profissional que a pessoa escolheu', () => {
  it('a guarda ainda enxerga o alvo', () => {
    // Piso afirmado por nome: sem isto, um arquivo renomeado ou reescrito faria as asserções
    // abaixo passarem vazias em vez de gritar.
    //
    // `setProfessionalId` caiu de 3 chamadas para 2 no TICKET-UX08: os dois `onClick` inline dos
    // Chips ("Tanto faz" e cada profissional) viraram um `escolherProfissional(id)` só, para
    // colapsar o passo no mesmo lugar que já escolhe e busca. Consolidar duas chamadas
    // DUPLICADAS numa função só não é o defeito que esta guarda existe para pegar — o defeito é
    // um `setProfessionalId` sem a `busca` correspondente logo depois, e as duas próximas
    // asserções continuam conferindo isso em CADA chamada que sobrou, não um total fixo.
    const src = fonte()
    const trocas = chamadas(src, 'setProfessionalId')
    const buscas = chamadas(src, 'buscarDisponibilidade')
    expect(trocas.length, 'ninguém mais troca o profissional nesta tela').toBeGreaterThanOrEqual(2)
    expect(buscas.length, 'ninguém mais busca disponibilidade nesta tela').toBeGreaterThanOrEqual(4)
  })

  it('quem TROCA o profissional passa o valor novo na mesma ação', () => {
    // A ponta produtora. `setProfessionalId(x)` seguido de uma busca sem terceiro argumento é
    // exatamente o defeito: a busca lê o estado velho do closure.
    const src = fonte()
    for (const troca of chamadas(src, 'setProfessionalId')) {
      const depois = src.slice(troca.fim)
      const proxima = chamadas(depois, 'buscarDisponibilidade')[0]
      if (!proxima) continue
      const trecho = depois.slice(0, proxima.fim)
      // Só cobra quando a busca vem logo na sequência da troca, que é o caso do bug.
      if (trecho.split('\n').length > 6) continue
      expect(
        quantosArgumentos(proxima.args),
        `busca depois de setProfessionalId sem passar o profissional novo: buscarDisponibilidade(${proxima.args})`,
      ).toBe(3)
    }
  })

  it('quem RECEBE aceita o profissional e distingue "sem filtro" de "mantém"', () => {
    // A ponta consumidora. `string` sozinho não serve: `null` (Tanto faz) e `undefined` (mantém
    // o que já está escolhido) são respostas diferentes, e colapsá-las traz o defeito de volta
    // pela porta do "Tanto faz".
    const src = fonte()
    expect(src).toMatch(/novoProfissional\?:\s*string\s*\|\s*null/)
  })

  it('a requisição usa o parâmetro, não o estado do render', () => {
    // O elo que faltava entre as duas pontas: dá para receber `novoProfissional` e continuar
    // montando a URL com `professionalId`. A guarda casa com a LINHA que monta o filtro.
    const src = fonte()
    // Delimitado pelo `;` que fecha a declaração, nunca por janela de caracteres nem por quebra
    // de linha: a atribuição ocupa duas linhas, e a primeira versão desta guarda parou no `\n` e
    // reprovou o conserto certo.
    const filtro = src.match(/const\s+profissionalDoFiltro\s*=[^;]*;/)
    expect(filtro, 'sumiu a variável que decide o filtro').not.toBeNull()
    expect(filtro![0]).toContain('novoProfissional')
    expect(filtro![0]).toContain('professionalId')
    expect(
      src,
      'a URL voltou a ser montada com o estado do render em vez do parâmetro',
    ).not.toMatch(/params\.set\("professionalId",\s*professionalId\)/)
    expect(src).toMatch(/params\.set\("professionalId",\s*profissionalDoFiltro\)/)
  })
})
