import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { formatarPreco, estimativaParaDuracao, type ModeloDePreco } from '@/core/pricing/formatar'

import { semComentarios } from '../../helpers/fonte'

/**
 * `services.pricing_model` tinha quatro valores e **os quatro exigiam um número** (`fixed`,
 * `hourly`, `visit_hourly`, `daily`). Quem não tem preço de tabela — eletricista, faxineira, quem
 * faz obra — só conseguia cadastrar inventando um valor, e a vitrine anunciava esse valor como se
 * fosse preço.
 *
 * A granularidade é o SERVIÇO e não a conta, e isso foi decidido com evidência, não por gosto: o
 * Jobber, que atende as duas naturezas, resolve por serviço (*"you might prefer to use a quote
 * request form when you need to collect information and specifications from your customer before
 * providing an estimate"*). Negócio híbrido é o caso comum — a manicure tem tabela e orça
 * alongamento —, e um modo binário na conta obrigaria essa pessoa a mentir num dos lados.
 * Ver `docs/40-MODOS-DE-COBRANCA-PLANO.md`.
 */

describe('o quinto modelo de preço', () => {
  it('anuncia "Sob orçamento" em vez de um número', () => {
    expect(formatarPreco({ pricingModel: 'quote', priceCents: 0, hourlyRateCents: null, halfDayPriceCents: null })).toBe(
      'Sob orçamento',
    )
  })

  it('não deixa escapar número nem quando o cadastro tem preço velho guardado', () => {
    /*
     * O caso que importa: o serviço foi cadastrado como `fixed` R$ 200, depois virou `quote`. A
     * coluna `price_cents` continua com 200 no banco (a migration não apaga dado). Se o
     * formatador olhasse o valor em vez do modelo, a vitrine anunciaria um preço que a dona
     * decidiu não anunciar mais.
     */
    expect(formatarPreco({ pricingModel: 'quote', priceCents: 20000, hourlyRateCents: null, halfDayPriceCents: null })).toBe(
      'Sob orçamento',
    )
  })

  it('não estima valor para duração nenhuma', () => {
    // `price_cents` é ignorado neste modelo; devolver o conteúdo dele daria um número que ninguém
    // escreveu como preço.
    expect(estimativaParaDuracao({ pricingModel: 'quote', priceCents: 20000, hourlyRateCents: null, halfDayPriceCents: null }, 120)).toBe(0)
  })

  it('os outros quatro continuam anunciando o que anunciavam', () => {
    // O par: "Sob orçamento" não pode virar a resposta de todo mundo por um `switch` mal mexido.
    /*
     * Sem literal com "R$ ": o `Intl.NumberFormat` pt-BR separa o símbolo do número com espaço
     * NÃO-QUEBRÁVEL (U+00A0), que é indistinguível de espaço comum na saída do teste. A primeira
     * versão desta asserção comparava com espaço normal e reprovava código correto, mostrando
     * "Received: R$ 45,00" ao lado de um esperado idêntico aos olhos.
     */
    const casos: Array<[ModeloDePreco, string]> = [
      ['fixed', '45,00'],
      ['hourly', '45,00/hora'],
    ]
    for (const [modelo, esperado] of casos) {
      expect(formatarPreco({ pricingModel: modelo, priceCents: 4500, hourlyRateCents: null, halfDayPriceCents: null })).toContain(
        esperado,
      )
    }
  })
})

describe('as duas pontas que precisam aceitar o modelo novo', () => {
  it('o banco aceita `quote` na constraint', () => {
    const sql = readFileSync('supabase/migrations/0059_pricing_model_quote.sql', 'utf8')
    expect(/check \(pricing_model in \([^)]*'quote'\)\)/.test(sql), 'a migration não libera `quote` no banco').toBe(true)
    // Os quatro antigos continuam válidos: uma constraint que só aceita `quote` derrubaria a base
    // inteira, e o teste acima sozinho passaria.
    for (const antigo of ['fixed', 'hourly', 'visit_hourly', 'daily']) {
      expect(sql, `a constraint nova derrubou o modelo '${antigo}'`).toContain(`'${antigo}'`)
    }
  })

  it('o Zod da borda aceita `quote`', () => {
    const fonte = semComentarios(readFileSync('src/server/services/servicos.ts', 'utf8'))
    /*
     * Sem comentário e casando com o `z.enum` de verdade: o arquivo EXPLICA o modelo novo em
     * prosa logo acima da linha, e casar com a explicação faria a guarda passar com o enum antigo.
     * Armadilha nº 1 do `CLAUDE.md`.
     */
    expect(/pricingModel: z\.enum\(\[[^\]]*'quote'\]\)/.test(fonte), 'a rota recusaria um serviço sob orçamento').toBe(true)
  })

  it('a tela de cadastro oferece a opção', () => {
    const fonte = semComentarios(readFileSync('src/app/admin/config/servicos/formulario.tsx', 'utf8'))
    expect(/<option value="quote">/.test(fonte), 'não dá para escolher "Sob orçamento" no painel').toBe(true)
  })

  it('a tela de cadastro esconde o campo de preço, que é obrigatório', () => {
    /*
     * O `MoneyInput` é `required`. Deixar o campo na tela faria a pessoa preencher um número
     * inventado só para o formulário aceitar — é a classe "a tela deixa trabalhar para recusar no
     * envio", já corrigida em outras telas desta base.
     */
    const fonte = semComentarios(readFileSync('src/app/admin/config/servicos/formulario.tsx', 'utf8'))
    expect(/modeloDePreco === 'quote' \? null : \(/.test(fonte), 'o campo de preço obrigatório voltou para o serviço sem preço').toBe(
      true,
    )
  })
})

describe('o preço se lê igual na vitrine e no agendar', () => {
  const VITRINE = 'src/app/(public)/[slug]/secoes.tsx'
  const AGENDAR = 'src/app/(public)/[slug]/agendar/agendar.tsx'

  it('as duas telas usam o mesmo formatador', () => {
    /*
     * O agendar formatava sozinho (`dinheiro.format(priceCents / 100)`) e por isso mostrava
     * "R$ 50" para um serviço que a vitrine do MESMO salão anuncia como "R$ 50/hora" — duas
     * fontes da mesma verdade, e a errada era a do último passo antes de confirmar. Com o modelo
     * novo o desencontro ficaria pior ainda: "Consultar" de um lado, "Sob orçamento" do outro.
     */
    for (const tela of [VITRINE, AGENDAR]) {
      const fonte = semComentarios(readFileSync(tela, 'utf8'))
      expect(/formatarPreco\(\{/.test(fonte), `${tela} voltou a formatar preço por conta própria`).toBe(true)
    }
  })

  it('o agendar não reintroduz a formatação crua do preço do serviço', () => {
    // O outro lado: importar o formatador e continuar imprimindo o número cru ao lado passaria
    // na asserção acima.
    const fonte = semComentarios(readFileSync(AGENDAR, 'utf8'))
    expect(
      /dinheiro\.format\(s\.priceCents/.test(fonte),
      'o preço do serviço voltou a ser formatado cru no agendar, ignorando o modelo de cobrança',
    ).toBe(false)
  })
})

describe('o SEO não inventa preço para quem não tem', () => {
  it('só serviço de preço fechado e maior que zero vira oferta', () => {
    /*
     * `dados-estruturados.ts` já filtrava por `fixed` com preço maior que zero, então o serviço
     * sob orçamento nunca vira `Offer`. Isso é a decisão, não um acaso: emitir `price` no
     * schema.org para um serviço sem preço colocaria um número inventado no resultado de busca do
     * Google, que é onde a mentira custa mais caro. A guarda existe para o filtro não afrouxar.
     */
    const fonte = semComentarios(readFileSync('src/core/seo/dados-estruturados.ts', 'utf8'))
    expect(
      /pricingModel === 'fixed'[\s\S]{0,80}priceCents > 0/.test(fonte),
      'o filtro do schema.org afrouxou: serviço sem preço fechado pode virar Offer com preço inventado',
    ).toBe(true)
  })
})
