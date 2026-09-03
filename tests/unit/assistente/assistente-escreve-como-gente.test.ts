import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { MODELOS_PADRAO } from '@/server/services/mensagens-prontas'
import { promptDeSistema } from '@/server/services/assistente'

import { semComentarios } from '../../helpers/fonte'

/**
 * O assistente é a única superfície do produto que escreve texto NOVO a cada resposta. Toda a copy
 * do CICLO pode estar impecável e ele ainda entregar, no meio do painel, o parágrafo que denuncia
 * um modelo: abertura de "Claro! Vou te ajudar com isso", travessão separando cada ideia, negrito
 * em palavra aleatória, emoji, e o "posso ajudar em mais alguma coisa?" no fim.
 *
 * Isso não se conserta editando string, porque a string não existe até a pergunta ser feita. O
 * único lugar onde dá para consertar é o prompt de sistema — e por isso ele precisa de guarda: uma
 * instrução de estilo é a primeira coisa que alguém apaga ao "enxugar o prompt", e a perda não
 * quebra nada, só volta a soar como robô.
 *
 * A guarda casa com o CONCEITO de cada regra, e não com a frase que a escreve: reescrever a
 * instrução com outras palavras continua passando; APAGAR a regra reprova.
 */

const PROMPT = promptDeSistema('2026-09-03')

describe('o prompt de sistema manda escrever como gente', () => {
  it('proíbe o travessão, que é a marca registrada de texto gerado', () => {
    expect(/travess[ãa]o|—/.test(PROMPT), 'o prompt não diz nada sobre travessão').toBe(true)
  })

  it('proíbe a abertura de cortesia antes da resposta', () => {
    // "Claro!", "Com certeza!", "Ótima pergunta" — o modelo gasta a primeira linha sem informação,
    // e é a linha que o dono do salão lê antes de decidir se continua lendo.
    expect(/claro|com certeza|[óo]tima pergunta/i.test(PROMPT), 'nada impede a abertura de cortesia').toBe(true)
    expect(/come[çc]e pela resposta|nunca abra/i.test(PROMPT)).toBe(true)
  })

  it('proíbe enfeite de chat: negrito, marcador e emoji fora de lista', () => {
    expect(/negrito/i.test(PROMPT), 'nada impede negrito').toBe(true)
    expect(/emoji/i.test(PROMPT), 'nada impede emoji').toBe(true)
  })

  it('proíbe o oferecimento de ajuda extra no fim', () => {
    expect(/mais alguma coisa|ajuda extra/i.test(PROMPT), 'nada impede o fecho de atendente').toBe(true)
  })

  it('proíbe narrar o próprio raciocínio e citar ferramenta', () => {
    // O dono do salão não quer saber que houve uma "chamada de ferramenta"; ele quer o número.
    expect(/n[ãa]o explique o que voc[êe] fez|cite o nome das ferramentas/i.test(PROMPT)).toBe(true)
  })

  it('a instrução de estilo é específica, não um "escreva bem"', () => {
    /*
     * Guarda contra a própria regra virar decoração. Uma instrução vaga ("seja natural", "escreva
     * bem") passaria em qualquer asserção de palavra-chave e não muda nada no que o modelo produz
     * — modelo obedece proibição nomeada, não elogio. O bloco tem que ter corpo.
     */
    const i = PROMPT.indexOf('Como escrever')
    expect(i, 'sumiu o bloco de estilo do prompt').toBeGreaterThan(-1)
    const bloco = PROMPT.slice(i)
    expect(bloco.split('\n').filter((l) => l.trim().startsWith('-')).length, 'o bloco de estilo ficou raso').toBeGreaterThanOrEqual(5)
  })

  it('as regras antigas continuam lá — o bloco novo não empurrou nenhuma para fora', () => {
    // O prompt cresceu; a forma mais barata de estragar isso é alguém "reorganizar" e perder uma
    // das regras inegociáveis do `docs/26 §0` no meio do caminho.
    expect(PROMPT).toMatch(/nunca invente/i)
    expect(PROMPT).toMatch(/m[ée]dico|cl[íi]nico/i)
    expect(PROMPT).toMatch(/PREPARA|preparar_agendamento/)
  })
})

describe('a copy que o assistente e o salão mandam prontas', () => {
  it('nenhuma resposta rápida usa travessão', () => {
    /*
     * As respostas rápidas (`docs/26`) são escritas à mão e devolvidas SEM passar pelo modelo, para
     * as perguntas mais comuns. Se elas usarem travessão, o prompt acima fica desmentido pela
     * própria casa: metade das respostas do assistente sai num estilo e metade no outro.
     */
    const fonte = semComentarios(readFileSync('src/server/assistente/respostas-rapidas.ts', 'utf8'))
    const linhas = fonte.split('\n').filter((l) => l.includes('—'))
    expect(linhas.map((l) => l.trim()), 'travessão em resposta do assistente').toEqual([])
  })

  it('nenhum modelo de mensagem pronta usa travessão', () => {
    // Estes textos vão para o WhatsApp do CLIENTE DO SALÃO. É a copy mais exposta do produto, e a
    // que menos pode soar como mensagem gerada: quem fica mal é o salão, não o CICLO.
    const comTravessao = MODELOS_PADRAO.filter((m) => `${m.title} ${m.body}`.includes('—')).map((m) => m.slug)
    expect(comTravessao, 'travessão em mensagem que vai para o cliente do salão').toEqual([])
  })
})
