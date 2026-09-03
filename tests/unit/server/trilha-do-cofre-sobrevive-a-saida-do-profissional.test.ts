import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A tela "Trilha do cofre" promete *"quem acessou a ficha de saúde de cada cliente"*. Ela resolvia
 * o nome ao LER, juntando `actor_id` com `profiles` — e por isso **perdia o ator quando o
 * profissional saía do salão**: todos os acessos passados dele viravam "Usuário removido", de uma
 * vez e para sempre.
 *
 * Rotatividade de equipe em salão é o caso normal, não a exceção. Ou seja, a trilha de dado de
 * saúde ficava anônima justamente no cenário em que alguém iria consultá-la — quem tocou no
 * prontuário depois que a pessoa não trabalha mais aqui.
 *
 * `vault_access_log.actor_label` existe desde a migration 0001 para isso, e **nunca foi escrito**.
 * Achado em 2026-09-03 varrendo colunas sem leitor nem escritor: a mesma classe de `fee_cents`,
 * `media.consent_id`, `tenants.plan`, `clients.referred_by` e `tenants.trial_ends_at`.
 *
 * **O que esta guarda NÃO pode deixar acontecer, e é o par dela:** o nome da CLIENTE continua
 * derivado, nunca guardado. `trilha-nao-guarda-dado-eliminado` cuida daquele lado, e as duas
 * regras convivem porque tratam de pessoas diferentes — a titular do prontuário, cujo dado a LGPD
 * manda eliminar quando ela pede, e o profissional que acessou, cujo registro é a obrigação que a
 * trilha existe para cumprir.
 */

const ESCRITA = 'src/server/services/cofre-trilha.ts'
const LEITURA = 'src/server/services/trilha-cofre.ts'

const fonteEscrita = semComentarios(readFileSync(ESCRITA, 'utf8'))
const fonteLeitura = semComentarios(readFileSync(LEITURA, 'utf8'))

describe('o leitor deste teste', () => {
  it('leu os dois lados da trilha', () => {
    expect(fonteEscrita.length, `${ESCRITA} veio vazio`).toBeGreaterThan(400)
    expect(fonteLeitura.length, `${LEITURA} veio vazio`).toBeGreaterThan(400)
  })
})

describe('a trilha guarda quem acessou, e não só o id', () => {
  it('a escrita grava `actor_label`', () => {
    expect(
      /actor_label:/.test(fonteEscrita),
      'o acesso ao cofre voltou a ser gravado só com `actor_id`. Quando o profissional sair do ' +
        'salão, todos os acessos dele à ficha de saúde viram "Usuário removido".',
    ).toBe(true)
  })

  it('o rótulo é o nome de quem acessou, buscado no momento do acesso', () => {
    // Casa com a BUSCA, não com o nome do campo: `actor_label: null` fixo satisfaria a asserção
    // acima e não guardaria nada.
    expect(/from\('profiles'\)[\s\S]{0,120}full_name/.test(fonteEscrita), 'o rótulo não vem do nome real').toBe(true)
  })

  it('a busca do rótulo é melhor esforço e nunca impede o registro', () => {
    /*
     * O contrato desta função, escrito no docstring dela: acesso ao cofre nunca pode ficar sem
     * trilha. Se a busca do nome lançasse, um acesso a dado de saúde deixaria de ser registrado —
     * trocaríamos um rótulo bonito pela própria peça de LGPD.
     */
    const iBusca = fonteEscrita.indexOf("from('profiles')")
    const iInsert = fonteEscrita.indexOf("from('vault_access_log').insert")
    expect(iBusca, 'sumiu a busca do nome').toBeGreaterThan(-1)
    expect(iInsert, 'sumiu o insert da trilha').toBeGreaterThan(iBusca)
    // O `error` da busca é ignorado de propósito: só o `data` é lido, com `??` para o caso ausente.
    expect(/rotuloDoAtor = data\?\.full_name \?\? null/.test(fonteEscrita), 'a busca deixou de tolerar falha').toBe(true)
  })
})

describe('a leitura prefere o nome vivo, e só cai no instantâneo quando o perfil sumiu', () => {
  it('a consulta traz o `actor_label`', () => {
    expect(/select\([^)]*actor_label/.test(fonteLeitura), 'a leitura não busca mais o rótulo guardado').toBe(true)
  })

  it('a ordem é: vivo, instantâneo, desistência', () => {
    /*
     * A ordem é a decisão, não um detalhe. O nome vivo primeiro porque identidade é a mesma
     * pessoa: quem mudou de nome aparece pelo nome de hoje. O instantâneo é a rede, não a fonte.
     */
    /*
     * A LINHA inteira, e não uma captura entre parênteses: a primeira versão usava
     * `\(([^)]*)\)` e parava no primeiro `)`, que é o de `nomeDoAtor.get(l.actor_id)` — a captura
     * vinha truncada e a asserção reprovava código correto. Delimitar pelo fim real do elemento é
     * a armadilha nº 4 da tabela do `CLAUDE.md`, aqui na versão "delimitei cedo demais".
     */
    /*
     * `actorName: l.actor_id`, não `actorName:` solto: a declaração do TIPO (`actorName: string`)
     * aparece antes no arquivo, e um `.find` ingênuo pegava ela — a linha vinha sem nenhum dos três
     * termos e a asserção reprovava código correto. É a armadilha nº 1 da tabela do `CLAUDE.md`:
     * casar com algo que o arquivo contém por outro motivo.
     */
    const expr = fonteLeitura.split('\n').find((l) => l.includes('actorName: l.actor_id'))
    expect(expr, 'sumiu a linha que monta o actorName').toBeTruthy()
    const linha = expr!
    expect(linha.indexOf('nomeDoAtor.get'), 'o nome vivo saiu').toBeGreaterThan(-1)
    expect(linha.indexOf('actor_label'), 'o instantâneo não é consultado').toBeGreaterThan(linha.indexOf('nomeDoAtor.get'))
    expect(linha.indexOf('Usuário removido'), 'a desistência vem antes do instantâneo').toBeGreaterThan(
      linha.indexOf('actor_label'),
    )
  })
})

describe('o nome da CLIENTE continua derivado, nunca guardado', () => {
  it('a trilha não grava nome de cliente', () => {
    /*
     * O par da regra. A LGPD manda eliminar o dado da titular quando ela pede, e um instantâneo do
     * nome dela na trilha sobreviveria à eliminação — que é exatamente o defeito que
     * `trilha-nao-guarda-dado-eliminado` existe para impedir. Guardar o ator e NÃO guardar a
     * titular é a assimetria correta, e é fácil alguém "uniformizar" isso sem perceber.
     */
    expect(/client_label|client_name/.test(fonteEscrita), 'a trilha passou a guardar o nome da cliente').toBe(false)
    expect(/'Cliente removida'/.test(fonteLeitura), 'sumiu a derivação do nome da cliente').toBe(true)
  })
})
