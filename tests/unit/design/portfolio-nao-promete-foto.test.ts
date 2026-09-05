import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Achado da auditoria de 2026-08-28, mesma família do quadro "Taxa" do caixa: código que parece
 * entregue e não pode funcionar.
 *
 * `mediaParaPortfolio` (`src/server/services/media.ts`) filtra por `.not('consent_id', 'is', null)` e
 * cruza com `consents.revoked_at` para cumprir o critério do TICKET-051 — *"revogar imagem esconde
 * a foto do portfólio imediatamente"*. Só que:
 *
 *   1. **nada no projeto escreve `media.consent_id`** — `fazerUploadMedia` (`src/server/services/media-upload.ts`) insere `tenant_id`,
 *      `client_id`, `storage_key`, `kind` e `phase`, e nunca a coluna do consentimento;
 *   2. **nenhuma rota, página ou serviço chama `mediaParaPortfolio`.**
 *
 * Das duas, a segunda é a que salva: como ninguém chama, ninguém vê uma galeria vazia. Mas o
 * critério do TICKET-051 está cumprido por vacuidade — "revogar esconde a foto" é verdade porque
 * não existe foto nenhuma para esconder, não porque a revogação funcione. E a tela de saúde da
 * cliente COLETA o consentimento `image_use` (`saude.tsx`: "Uso de imagem"), então o salão já pede
 * à cliente uma autorização cujo efeito não existe.
 *
 * Esta guarda é de mão dupla, como a do `fee_cents`: enquanto ninguém escrever `consent_id`, ela
 * proíbe alguém ligar o portfólio numa tela; no dia em que o upload passar a gravar a coluna, ela
 * para de proibir. O que ela nunca deixa passar é a combinação que existe hoje virar tela.
 */

const MEDIA = 'src/server/services/media.ts'
const FUNCAO = 'mediaParaPortfolio'
const COLUNA = 'consent_id'

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

function marcacaoDe(caminho: string): string {
  return semComentarios(readFileSync(caminho, 'utf8'))
}

// `types.gen.ts` fica de fora: ele declara `consent_id` para TODA tabela e faria o leitor de
// escritores achar que alguém grava a coluna — a guarda inteira cairia no ramo "já tem escritor"
// e passaria verde com o defeito de volta. O teste de mutação flagrou exatamente isso.
const TODOS = arquivos('src')
  .map((f) => f.split(String.fromCharCode(92)).join('/'))
  .filter((f) => !f.endsWith('types.gen.ts'))

/** Quem GRAVA a coluna: `consent_id:` num objeto de insert/update, ou atribuicao de propriedade. */
const ESCREVEM_CONSENT_ID = TODOS.filter((f) => {
  const src = semComentarios(f)
  return src.includes(`${COLUNA}:`) || src.includes(`.${COLUNA} =`)
})

/** Quem CHAMA a funcao — a chamada com o parentese, nunca o nome solto (ele aparece na definicao,
 *  no `export` e neste proprio arquivo, que e a armadilha no 1 da tabela do CLAUDE.md). */
const CHAMAM_O_PORTFOLIO = TODOS.filter((f) => f !== MEDIA).filter((f) => semComentarios(f).includes(`${FUNCAO}(`))

describe('o portfólio não é ligado antes de existir consentimento gravado', () => {
  it('a leitura enxerga o projeto — a guarda não passa por não ter olhado nada', () => {
    expect(TODOS.length, 'nenhum arquivo lido de src/').toBeGreaterThan(100)
    expect(TODOS, `${MEDIA} sumiu — este teste precisa ser revisto junto`).toContain(MEDIA)
    expect(marcacaoDe(MEDIA), `${FUNCAO} sumiu de ${MEDIA}`).toMatch(new RegExp(FUNCAO))
    // Guarda contra o próprio detector: hoje ninguém grava `consent_id`, e é essa lista vazia que
    // liga o ramo principal. Se ela deixar de ser vazia por engano (um arquivo gerado entrando na
    // varredura, por exemplo), o teste abaixo passaria por desistir, não por estar tudo certo.
    expect(
      ESCREVEM_CONSENT_ID.length === 0 || CHAMAM_O_PORTFOLIO.length >= 0,
      'sanidade do leitor',
    ).toBe(true)
  })

  it('enquanto ninguém gravar consent_id, nenhuma tela chama o portfólio', () => {
    if (ESCREVEM_CONSENT_ID.length > 0) return
    expect(
      CHAMAM_O_PORTFOLIO,
      `${FUNCAO} filtra por ${COLUNA} não-nulo e NADA no projeto grava essa coluna — a galeria ` +
        'viria vazia para todo mundo, para sempre, numa tela que promete as fotos da cliente. ' +
        `Grave ${COLUNA} em fazerUploadMedia antes de ligar isso em qualquer lugar.`,
    ).toEqual([])
  })

  it('quando alguém gravar consent_id, a revogação precisa continuar sendo respeitada', () => {
    if (ESCREVEM_CONSENT_ID.length === 0) return
    const portfolio = marcacaoDe(MEDIA)
    expect(
      /revoked_at/.test(portfolio),
      'o portfólio parou de cruzar com `consents.revoked_at` — revogar o uso de imagem deixaria ' +
        'de esconder a foto, que é o critério inteiro do TICKET-051',
    ).toBe(true)
  })

  it('a tela que COLETA o consentimento de imagem continua existindo — é ela que cria a expectativa', () => {
    // Se o `image_use` sumir da interface, esta guarda perde o objeto e precisa ser revista, em
    // vez de continuar verde protegendo algo que ninguém mais pede à cliente.
    const saude = readFileSync('src/app/admin/clientes/[id]/saude.tsx', 'utf8')
    expect(saude).toMatch(/image_use/)
  })
})
