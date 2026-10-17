import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-015 (achado C-38): depois de vender pacote ou lançar crédito, os avisos mandavam usar "na
 * comanda" — e a comanda não sabe do pacote nem do crédito. A pessoa cobrava o atendimento E o
 * pacote. Enquanto a comanda não chamar a rota de uso do pacote (épico APR-016/017), os textos da
 * ficha não podem prometer a comanda, e o caminho que eles descrevem tem que existir.
 */
const FICHA = 'src/app/admin/clientes/[id]/pacotes-carteira.tsx'
const COMANDA = 'src/app/admin/comanda/[id]/comanda.tsx'

/** Só o que é TEXTO: strings e template literals. Nome de permissão (`comanda:own`) em comentário já saiu. */
function textos(fonte: string): string[] {
  return [...fonte.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
}

const PROMESSA = /\bna comanda\b|\bcomanda dela\b|\bconsumidas? na comanda\b/i
const CHAMA_USO_DE_PACOTE = /\/api\/v1\/packages\/\$\{[^}]+\}\/use/

describe('aviso de pacote não promete a comanda (APR-015)', () => {
  it('controle positivo: o detector acha a promessa antiga e ignora o nome da permissão', () => {
    expect(textos(`mostrarToast({ descricao: 'As sessões já podem ser usadas na comanda.' })`).some((t) => PROMESSA.test(t))).toBe(true)
    expect(textos(`descricao="Sessões pagas na frente, consumidas na comanda."`).some((t) => PROMESSA.test(t))).toBe(true)
    expect(textos(`exigirPermissao(ctx.papel, 'comanda:own')`).some((t) => PROMESSA.test(t))).toBe(false)
  })

  it('a ficha tem textos para varrer (não passa vazia)', () => {
    expect(textos(semComentarios(readFileSync(FICHA, 'utf8'))).length).toBeGreaterThan(10)
  })

  it('enquanto a comanda não usa o pacote, nenhum texto da ficha promete a comanda', () => {
    const comandaUsaPacote = CHAMA_USO_DE_PACOTE.test(readFileSync(COMANDA, 'utf8'))
    if (comandaUsaPacote) return // o épico ligou: a promessa passa a ser verdade
    const promessas = textos(semComentarios(readFileSync(FICHA, 'utf8'))).filter((t) => PROMESSA.test(t))
    expect(promessas).toEqual([])
  })

  it('o caminho que o aviso descreve existe: a ficha chama a rota de uso do pacote', () => {
    expect(semComentarios(readFileSync(FICHA, 'utf8'))).toMatch(CHAMA_USO_DE_PACOTE)
  })
})
