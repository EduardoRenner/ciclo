import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SLUG_PROFISSAO_GENERICA } from '@/core/profissoes'

import { semComentarios } from '../../helpers/fonte'

/**
 * Item 17 da auditoria de 2026-09-08 — o beco no pior lugar possível.
 *
 * O catálogo tem 17 profissões. A busca do onboarding filtrava por nome e sinônimo e, quando não
 * achava nada, mostrava **"Nenhuma profissão encontrada."** e mais nada. Como
 * `EsquemaOnboarding` exige `professionId: z.uuid()`, não havia como seguir.
 *
 * Massoterapeuta, costureira, confeiteira, podóloga, professor de música — qualquer um fora das 17
 * criava a conta, chegava na PRIMEIRA tela do produto, digitava a própria profissão, lia que ela
 * não existe e parava ali. Depois de já ter entregue e-mail e senha.
 *
 * A `0078` acrescentou "Outra profissão" ao catálogo e a tela passou a oferecê-la quando a busca
 * não acha nada.
 */

const TELA = 'src/app/onboarding/formulario.tsx'
const SERVICO = 'src/server/services/onboarding.ts'
const MIGRATION = 'supabase/migrations/0078_profissao_generica.sql'

const fonteDaTela = semComentarios(readFileSync(TELA, 'utf8'))
const fonteDoServico = semComentarios(readFileSync(SERVICO, 'utf8'))
/* Sem comentário: o cabeçalho da 0078 CITA a frase do beco ao explicar o defeito, e casar com o
   arquivo inteiro acusaria a própria explicação — armadilha já registrada quatro vezes aqui. */
const sql = readFileSync(MIGRATION, 'utf8').replace(/^\s*--.*$/gm, '')

describe('a busca de profissão não termina em parede', () => {
  it('o leitor enxerga a tela — não passa por não ter olhado nada', () => {
    expect(fonteDaTela, 'a tela parou de filtrar profissões').toContain('filtradas')
    expect(fonteDaTela.length).toBeGreaterThan(2000)
  })

  it('o ramo de "não achei nada" oferece a genérica', () => {
    const i = fonteDaTela.indexOf('filtradas.length === 0')
    expect(i, 'sumiu o ramo de busca vazia').toBeGreaterThan(-1)

    /*
      Piso do recorte, pela lição da guarda da Agenda: `indexOf` que devolve -1 não esvazia a
      fatia, ALARGA ela até o fim do arquivo — e a asserção passa casando com algo lá longe.
    */
    const fim = fonteDaTela.indexOf(') : (', i)
    expect(fim, 'o ramo não fecha onde esperado — o recorte iria até o fim do arquivo').toBeGreaterThan(i)
    const ramo = fonteDaTela.slice(i, fim)

    expect(
      /generica/.test(ramo),
      'a busca vazia não oferece a profissão genérica. Sem ela a tela é um beco: `professionId` é ' +
        'obrigatório no esquema da rota, então quem não está nas 17 não tem como seguir.',
    ).toBe(true)
    expect(
      /setProfessionId\(generica\.id\)/.test(ramo),
      'a saída não SELECIONA a genérica — texto que não age é o beco com outra roupa',
    ).toBe(true)
  })

  it('a tela não volta a afirmar a ausência sem oferecer nada', () => {
    const i = fonteDaTela.indexOf('filtradas.length === 0')
    const fim = fonteDaTela.indexOf(') : (', i)
    const ramo = fonteDaTela.slice(i, fim)
    expect(
      /Nenhuma profissão encontrada/.test(ramo),
      'a frase do beco voltou. Dizer que não achou é correto; dizer SÓ isso é que não era.',
    ).toBe(false)
  })
})

describe('a genérica não inventa a resposta dos quatro eixos', () => {
  /*
   * A parte que dói se ninguém olhar. `podeUsarModulo` esconde módulo quando o eixo tem valor
   * CONHECIDO e incompatível, e não esconde nada quando ele é nulo. Os eixos do tenant são
   * gravados UMA vez, no onboarding, e não existe tela para corrigi-los.
   *
   * Então copiar os quatro valores da linha genérica — que são só o que o `not null` da tabela
   * exigiu, não a resposta de ninguém — apagaria `routing`, `recurrence` ou `quotes` da interface
   * de alguém que precisa deles, para sempre. Trocar um beco por outro.
   */
  it('o serviço pula os eixos quando a profissão é a genérica', () => {
    expect(
      fonteDoServico.includes('SLUG_PROFISSAO_GENERICA'),
      'o onboarding parou de distinguir a profissão genérica — ela voltaria a gravar quatro eixos ' +
        'que ninguém respondeu, escondendo módulo sem tela para corrigir',
    ).toBe(true)

    const i = fonteDoServico.indexOf('profession_id: profissao.id')
    expect(i, 'sumiu a gravação de profession_id').toBeGreaterThan(-1)
    const fim = fonteDoServico.indexOf('.select(', i)
    expect(fim, 'o insert do tenant não fecha onde esperado').toBeGreaterThan(i)
    const insert = fonteDoServico.slice(i, fim)

    expect(
      /SLUG_PROFISSAO_GENERICA[\s\S]{0,120}onde: profissao\.onde/.test(insert),
      'os eixos são gravados sem passar pela condição da genérica',
    ).toBe(true)
  })

  it('`profession_id` continua gravado — a escolha não é jogada fora', () => {
    // Saber QUANTOS caíram na genérica é o sinal de qual profissão falta no catálogo. Se o id
    // sumir junto com os eixos, o produto perde a única medida que tem disso.
    expect(fonteDoServico).toContain('profession_id: profissao.id')
  })
})

describe('a migration e o código concordam sobre qual é a linha', () => {
  it('o slug da constante é o slug inserido', () => {
    /*
      A ponte que ninguém veria quebrar. Renomear o slug na migration sem mexer na constante (ou o
      contrário) faz `generica` virar `null` em silêncio: a tela volta a mostrar a frase sem botão
      — o beco de novo, com o teste de cima ainda VERDE, porque ele só lê a fonte da tela.
    */
    expect(sql, `a 0078 não insere o slug '${SLUG_PROFISSAO_GENERICA}'`).toContain(`'${SLUG_PROFISSAO_GENERICA}'`)
  })

  it('a genérica entra sem sinônimo, para não roubar busca legítima', () => {
    /*
      Um sinônimo aqui faria "Outra profissão" aparecer numa busca por "cabelo" e competir com a
      profissão certa: o conserto atrapalhando quem já estava bem servido.

      **A primeira versão desta asserção era cega.** Ela procurava `'{}'` em qualquer lugar do SQL
      — e o `vocab` do mesmo insert também é `'{}'::jsonb`. Enchi os sinônimos de
      `{cabelo,unhas,barbeiro}` na mutação e o teste passou verde, casando com o vocab.

      Agora a asserção é POSICIONAL: o grupo vem imediatamente antes dos sinônimos na lista de
      valores, então casar os dois juntos prende o campo certo.
    */
    expect(sql, 'a 0078 deixou de inserir sinônimos vazios').toContain("'outros', '{}'")
  })

  it('entra ativa e por último na lista', () => {
    expect(sql).toContain('true')
    expect(/\b99\b/.test(sql), 'a genérica saiu do fim da lista — ela é a última opção, não a primeira').toBe(true)
  })
})
