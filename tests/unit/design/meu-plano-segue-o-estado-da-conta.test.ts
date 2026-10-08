import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Medido no navegador em 03/10: a conta PAUSADA via "Você está no Equipe, R$ 99/mês" (o degrau de
 * LEITURA, que na pausa continua o da cortesia), via "Assinar o Avançado" (que deixou de ser vendido)
 * e não tinha como assinar o Solo nem o Equipe. Os três vinham do mesmo erro: a página lia o degrau,
 * e não o ESTADO da conta.
 *
 * A guarda casa com a CHAMADA da visão e com o que o modelo antigo precisava para existir
 * (`ORDEM_DOS_PLANOS` fatiada, `NOME_DO_PLANO[atual]`), nunca com um nome solto.
 */
const PAGINA = semComentarios(readFileSync('src/app/admin/config/meu-plano/page.tsx', 'utf8'))

describe('"Meu plano" segue o estado da conta, não o degrau de leitura', () => {
  it('a página CHAMA a visão com a situação e o plano que a pessoa paga', () => {
    expect(PAGINA).toMatch(/visaoDoMeuPlano\(\s*plano\.situacao,\s*pago,/)
    expect(PAGINA).toMatch(/const pago = plano\.planoPago/)
  })

  it('o título, o nome e o preço saem da visão', () => {
    expect(PAGINA).toMatch(/descricao=\{nativo \? undefined : visao\.descricao\}/)
    expect(PAGINA).toMatch(/\{visao\.nome\}/)
    expect(PAGINA).toMatch(/visao\.preco !== null/)
  })

  it('as opções de assinatura saem da visão e só mostram o botão quando a faixa comporta a equipe', () => {
    expect(PAGINA).toMatch(/visao\.opcoes\.map\(\(\{ tier, excedeEm \}\)/)
    expect(PAGINA).toMatch(/excedeEm > 0 \?/)
  })

  it('o modelo antigo não volta: nada de degrau "atual" nem de fatiar a ordem dos planos', () => {
    expect(PAGINA, 'voltou a ler o degrau de leitura como se fosse o que a pessoa paga').not.toMatch(/NOME_DO_PLANO\[atual\]/)
    expect(PAGINA, 'voltou a listar "os degraus acima", que inclui o que não se vende').not.toMatch(/ORDEM_DOS_PLANOS/)
    expect(PAGINA, 'o Avançado deixou de ser vendido (docs/87 D2)').not.toMatch(/Avançado/)
  })

  it('o texto de como se muda de plano sabe se a cobrança automática está ligada', () => {
    expect(PAGINA).toMatch(/textoDeMudarDePlano\(pago === 'gratis', canal !== null, cobrancaAutomatica\)/)
  })

  it('o detector enxerga a página: se o arquivo mudou de forma, a guarda grita em vez de passar vazia', () => {
    expect(PAGINA.length).toBeGreaterThan(2000)
    expect(PAGINA).toMatch(/export default async function PaginaMeuPlano/)
  })
})
