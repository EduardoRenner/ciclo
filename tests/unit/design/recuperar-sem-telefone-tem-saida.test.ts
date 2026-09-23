import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/82` §7/§11, atualizado em 2026-09-23.
 *
 * Duas gerações desta guarda:
 *
 * 1. (§7) A base trazida de memória chega sem telefone (o campo é opcional de propósito), e o
 *    único botão da linha era "Avisar", que para essa pessoa terminava em "sem telefone
 *    cadastrado". A saída é o `wa.me` sem número, que abre o seletor de contatos do próprio
 *    WhatsApp do dono.
 * 2. (§11, decisão do dono) "Chamar" (o WhatsApp DO PRÓPRIO DONO, grátis, sem credencial) virou o
 *    caminho padrão para TODO mundo, com ou sem telefone — o "Avisar" por linha (que mandava pelo
 *    número pago do CICLO) foi removido. `enviar([item])` não pode voltar a existir: é o sintoma
 *    de a ação de uma pessoa só voltar a custar dinheiro por mensagem.
 */
const fonte = semComentarios(readFileSync(join(__dirname, '..', '..', '..', 'src/app/admin/recuperar/recuperar.tsx'), 'utf8'))

const fonteRota = semComentarios(
  readFileSync(join(__dirname, '..', '..', '..', 'src/app/api/v1/cycle/recover/send/route.ts'), 'utf8'),
)

describe('Recuperar: "Chamar" é o caminho padrão, com ou sem telefone', () => {
  it('o link manual existe e leva o texto de volta, endereçado quando há telefone', () => {
    expect(fonte).toContain('linkWhatsApp(item.phone, textoDeVolta(')
    expect(fonte).toContain('linkWhatsAppCompartilhar(textoDeVolta(')
  })

  it('o envio por item nunca volta a custar dinheiro por mensagem: sem enviar([item]) no arquivo', () => {
    // Mutação: reintroduzir `enviar([item])` em qualquer lugar do arquivo tem que reprovar aqui.
    expect(fonte).not.toContain('enviar([item])')
    // O único chamador de `enviar` continua sendo o botão de lote (pago), com a lista inteira.
    expect(fonte.match(/\benviar\(itensSelecionados\)/g)?.length).toBe(1)
  })

  it('quem pediu para não receber não ganha "Chamar", com ou sem telefone', () => {
    const inicio = fonte.indexOf('item.optOut ? (')
    expect(inicio, 'o ramo de opt-out sumiu do item da lista').toBeGreaterThan(-1)
    const fimDoRamo = fonte.indexOf(') : (', inicio)
    expect(fimDoRamo, 'o ramo alternativo (Chamar) sumiu depois do opt-out').toBeGreaterThan(inicio)
    const ramoOptOut = fonte.slice(inicio, fimDoRamo)
    expect(ramoOptOut).toContain('Pediu para não receber')
    expect(ramoOptOut).not.toContain('linkWhatsApp')

    const ramoChamar = fonte.slice(fimDoRamo, fonte.indexOf(')}', fonte.indexOf('</a>', fimDoRamo)))
    expect(ramoChamar).toContain('anotarChamada(item)')
    expect(ramoChamar).toContain('linkWhatsApp(item.phone')
  })

  it('marcar até UMA cliente e tocar na barra já pede o plano — não só marcar mais de uma', () => {
    // Era `itensSelecionados.length > 1`: sobrava um envio grátis pelo sistema pago escondido
    // atrás do checkbox, driblando o "Chamar" que devia ser o único caminho grátis.
    expect(fonte).toContain('!podeEnviarEmLote && itensSelecionados.length > 0')
    expect(fonte).not.toContain('itensSelecionados.length > 1')
  })

  it('a rota que manda pelo número do CICLO exige o plano sempre, não só a partir de 2 itens', () => {
    expect(fonteRota).toContain("exigirCapacidade(db, ctx.tenantId, 'envio_em_lote')")
    expect(fonteRota).not.toContain('entrada.items.length > 1')
  })
})
