import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AUTOMACOES, rodaDeVerdade } from '@/core/automacoes/catalogo'

import { semComentarios } from '../../helpers/fonte'

/**
 * A tela de Automações prometia, no título, o oposto do que ela entrega.
 *
 * Dizia *"O que o CICLO faz sozinho por você"* — e das seis automações do catálogo, a MAIORIA tem
 * teto no nível 1 ou 2, ou seja **não faz nada sozinha, por desenho**. O produto não é omisso
 * nisso: cada teto tem um motivo escrito, e a campanha de recuperação para no nível 2 porque
 * *"um erro que atinge 1 cliente é constrangimento; que atinge 46 é a reputação do salão"*.
 *
 * Ou seja, a tela é em boa parte sobre o que o CICLO **não** faz sozinho e por quê — que é o
 * argumento de confiança mais forte que este produto tem — e a copy vendia o contrário.
 *
 * A guarda amarra a promessa ao catálogo: enquanto a maioria tiver teto, o título não pode
 * prometer autonomia. Se um dia a maioria chegar ao nível 3, ela libera a frase sozinha — é assim
 * que uma guarda fica do lado certo do tempo em vez de virar um `skip` que ninguém revisita.
 */

const PAGINA = 'src/app/admin/config/automacoes/page.tsx'
const FONTE = semComentarios(readFileSync(PAGINA, 'utf8'))

const COM_TETO = AUTOMACOES.filter((a) => a.nivelMaximo < 3)

describe('o leitor deste teste', () => {
  it('vê o catálogo e a tela', () => {
    expect(AUTOMACOES.length).toBeGreaterThanOrEqual(6)
    expect(FONTE.length, `${PAGINA} veio vazio`).toBeGreaterThan(300)
  })

  it('a maioria das automações realmente tem teto — a premissa da guarda', () => {
    // Se isso deixar de valer, a asserção principal precisa mudar junto, e o teste diz isso alto
    // em vez de silenciosamente proteger nada.
    expect(COM_TETO.length).toBeGreaterThan(AUTOMACOES.length / 2)
  })
})

describe('a tela de automações não promete a autonomia que o catálogo nega', () => {
  it('o cabeçalho não diz que o CICLO faz as coisas sozinho', () => {
    if (COM_TETO.length <= AUTOMACOES.length / 2) return

    /*
     * O conceito, não a redação. `[^\s]*` e não `\w*` pela lição já registrada em
     * `promessa-de-canal`: sem a flag `u`, `\w` é `[A-Za-z0-9_]` e não casa `ç`/`ã`, então
     * "automação" e "automático" escapariam de qualquer padrão baseado em `\w`.
     */
    const proibidos = [/faz sozinh[oa]/i, /fazem sozinh/i, /trabalha por voc[êe]/i, /autom[^\s]*\s+(por voc[êe]|para voc[êe])/i]
    const achados = proibidos.filter((p) => p.test(FONTE)).map((p) => p.source)
    expect(
      achados,
      `${PAGINA} promete autonomia, mas ${COM_TETO.length} das ${AUTOMACOES.length} automações têm ` +
        'teto e não agem sozinhas. Termos: ' + achados.join(', '),
    ).toEqual([])
  })

  it('e o cabeçalho não fica mudo: continua explicando a tela', () => {
    // O outro lado da regra. Tirar a promessa e deixar um título vazio seria trocar copy errada
    // por copy inútil — e a guarda passaria igual.
    const descricao = /descricao="([^"]+)"/.exec(FONTE)?.[1] ?? ''
    expect(descricao.length, 'a descrição da tela sumiu').toBeGreaterThan(40)
    expect(/voc[êe]/i.test(descricao), 'a descrição parou de falar com quem usa').toBe(true)
  })
})

describe('o motivo do teto é frase de gente, e aparece inteiro', () => {
  it.each(COM_TETO)('$chave explica por que para antes do 3', (a) => {
    expect(a.motivoDoTeto, `${a.chave} tem teto e não diz por quê — o dono vai achar que é o plano`).toBeTruthy()
  })

  it('todos os motivos começam com maiúscula', () => {
    /*
     * Some na leitura isolada e aparece na tela: o motivo é renderizado depois de "Não vai além
     * daqui: ", e a mistura de caixa produz uma emenda torta em metade dos cartões. Eu mesmo criei
     * essa inconsistência numa rodada anterior, ao reescrever dois motivos para tirar travessão.
     */
    const minusculos = AUTOMACOES.filter((a) => a.motivoDoTeto && /^[a-zà-ú]/.test(a.motivoDoTeto)).map((a) => a.chave)
    expect(minusculos, 'motivo começando em minúscula, colado no prefixo da tela').toEqual([])
  })

  it('nenhum motivo usa travessão', () => {
    // A varredura de copy de 2026-09-03 passou por este arquivo e deixou dois para trás, porque
    // olhou as telas e não o catálogo em `core/`. Copy de produto também mora aqui.
    const comTravessao = AUTOMACOES.filter((a) => a.motivoDoTeto?.includes('—')).map((a) => a.chave)
    expect(comTravessao).toEqual([])
  })
})

describe('o que a automação PROMETE bate com o que ela consegue', () => {
  it('automação que depende de rota agendada e não roda não é vendida como automática', () => {
    /*
     * `rodaDeVerdade()` já existe e é lido pela tela para desenhar o selo de estado real. Esta
     * asserção protege o invariante por trás dele: se `reminders`/`campaigns` continuam fora do
     * `on.schedule`, o produto sabe disso — e o dia em que alguém "simplificar" removendo a função
     * é o dia em que a tela volta a afirmar que algo sai sozinho.
     */
    const dependemDeCron = AUTOMACOES.filter((a) => a.rota !== null)
    expect(dependemDeCron.length, 'nenhuma automação depende de cron — o catálogo mudou de forma').toBeGreaterThan(0)
    for (const a of dependemDeCron) {
      expect(typeof rodaDeVerdade(a), `${a.chave}: rodaDeVerdade parou de responder`).toBe('boolean')
    }
  })
})
