import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { avaliarPermissao } from '@/server/auth/rbac'

/**
 * APR-041 (APR-039, P-02 e P-03): a tela "Time" mostrava Cadastrar, Convidar e Desativar a
 * profissional, recepção e financeiro, e o financeiro preenchia a Agenda/novo inteira para levar 403
 * no fim. A API recusava; a tela prometia.
 */
const LISTA = semComentarios(readFileSync('src/app/admin/config/profissionais/lista.tsx', 'utf8'))
const PAGINA_TIME = semComentarios(readFileSync('src/app/admin/config/profissionais/page.tsx', 'utf8'))
const PAGINA_NOVO = semComentarios(readFileSync('src/app/admin/agenda/novo/page.tsx', 'utf8'))

/** Do `{podeGerenciar ? (` até o fim do bloco: o recorte acha o fechamento pelo parêntese, não por janela. */
function blocoCondicionado(fonte: string, inicio: number): string {
  let prof = 0
  for (let i = fonte.indexOf('(', inicio); i < fonte.length; i++) {
    if (fonte[i] === '(') prof++
    else if (fonte[i] === ')' && --prof === 0) return fonte.slice(inicio, i)
  }
  return ''
}

describe('a tela só oferece o que o papel pode fazer (APR-041)', () => {
  it('controle positivo: a tabela de papéis diz quem gerencia o time e quem marca horário', () => {
    expect(avaliarPermissao('owner', 'professional:update')).not.toBeNull()
    expect(avaliarPermissao('reception', 'professional:update')).toBeNull()
    expect(avaliarPermissao('finance', 'appointment:create')).toBeNull()
    expect(avaliarPermissao('reception', 'appointment:create')).not.toBeNull()
  })

  it('o Time decide no servidor, pela mesma tabela, se o papel gerencia', () => {
    expect(PAGINA_TIME).toMatch(/podeGerenciar=\{avaliarPermissao\(ctx\.papel, 'professional:update'\) !== null\}/)
  })

  it('Cadastrar e Convidar só existem dentro do bloco de quem gerencia', () => {
    const i = LISTA.indexOf('{podeGerenciar ? (')
    expect(i, 'o bloco condicionado sumiu').toBeGreaterThan(-1)
    const bloco = blocoCondicionado(LISTA, i)
    expect(bloco).toContain('Cadastrar')
    expect(bloco).toContain('Convidar')
    // Fora do bloco, só o "Convidar" do vazio — e ele também é condicionado.
    const fora = LISTA.slice(0, i) + LISTA.slice(i + bloco.length)
    expect(fora.match(/>\s*Cadastrar\s*</g) ?? []).toHaveLength(0)
    expect(fora).toMatch(/podeGerenciar \? \(\s*<Button onClick=\{\(\) => setSheetConvite\(true\)\}>/)
  })

  it('Desativar só aparece para quem gerencia', () => {
    expect(LISTA).toMatch(/\{p\.active && podeGerenciar \? \(\s*<Button variante="secondary" onClick=\{\(\) => desativar\(p\.id\)\}/)
  })

  it('Agenda/novo confere se o papel marca horário ANTES de montar o formulário', () => {
    const checagem = PAGINA_NOVO.indexOf("avaliarPermissao(ctx.papel, 'appointment:create') === null")
    expect(checagem).toBeGreaterThan(-1)
    expect(checagem).toBeLessThan(PAGINA_NOVO.indexOf('<FormularioAgendamento'))
  })
})
