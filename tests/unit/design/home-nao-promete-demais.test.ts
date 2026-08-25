import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { NOME_DO_PLANO, PLANOS, menorPlanoCom, type ModuloKey } from '@/core/billing/planos'

/**
 * O irmão do `precos-nao-promete-demais`, para a outra página cujo trabalho é prometer.
 *
 * Ele existe por uma causa medida, não por simetria: em 2026-08-24 a auditoria de
 * `docs/20-COPY-PLANO.md` §A.4 achou QUATRO promessas na porta de entrada que o código não cumpre
 * — lembrete automático com o cron desligado, confirmação por WhatsApp sem credencial, caixa
 * anunciada na cara do grátis e um "menos de três minutos" que é meta do `09-PLATAFORMA.md` §13.2
 * e nunca foi medido. Nenhuma delas foi maldade: cada uma entrou numa rodada diferente, soando
 * bem, e ficou. A página de preço tinha teste e não deixou isso acontecer; a home não tinha.
 *
 * A diferença entre uma limpeza que dura e uma que suja de novo é este arquivo (§S.4, C-12).
 */

const HOME = 'src/app/page.tsx'

/**
 * Só o texto que a pessoa lê. Comentário é onde este projeto explica as decisões — inclusive
 * "não escreva X aqui" —, então varrer comentário faria o teste reprovar a própria documentação
 * que o impede de ser burlado.
 */
function copyDaHome(): string {
  const bruto = readFileSync(HOME, 'utf8')
  return bruto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

/** `crons: []` significa que NENHUMA rota agendada roda em produção, por mais que ela exista. */
function temCronLigado(): boolean {
  const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons?: unknown[] }
  return Array.isArray(crons) && crons.length > 0
}

function achar(texto: string, termos: RegExp[]): string[] {
  return termos.filter((t) => t.test(texto)).map((t) => t.source)
}

describe('a home não promete o que o código não faz', () => {
  it('não promete cadência nem envio automático enquanto o cron estiver desligado', () => {
    /*
     * A promessa mais cara que este produto pode fazer, porque a pessoa a confere na primeira
     * semana. As rotas `reminders` e `recompute-cycles` existem desde sempre; o que não existe é
     * alguém chamando elas. Quando o P-0 do `docs/18-MONETIZACAO-PLANO.md` ligar o cron, este
     * teste passa a permitir a cadência sozinho — é assim que ele fica do lado certo do tempo em
     * vez de virar um `skip` que ninguém revisita.
     */
    if (temCronLigado()) return

    const proibidos = [
      /automaticamente/i,
      /toda semana/i,
      /todo dia/i,
      /avisamos/i,
      /enviamos/i,
      /mandamos/i,
      /lembrete autom/i,
      /confirmação autom/i,
    ]
    const achados = achar(copyDaHome(), proibidos)
    expect(
      achados,
      `a home promete envio/cadência automática, mas vercel.json está com crons: [] — nada disso roda. Termos: ${achados.join(', ')}`,
    ).toEqual([])
  })

  it('não descreve o Motor de Ciclo com vocabulário de IA', () => {
    /*
     * `src/core/cycle/compute.ts` diz, no comentário do topo: "determinístico, sem ML". É mediana
     * dos intervalos daquela pessoa, com descarte de exceção e limite de 0,5x a 2,5x. Chamar isso
     * de "aprende" empresta vocabulário de IA a uma conta de mediana — e num público que precisa
     * confiar dado de cliente ao software, ser pego exagerando custa mais que o exagero rende.
     */
    const achados = achar(copyDaHome(), [/aprende/i, /aprendizado/i, /intelig[êe]ncia artificial/i, /machine learning/i])
    expect(
      achados,
      `a home usa vocabulário de IA para um cálculo determinístico (compute.ts: "sem ML"). Termos: ${achados.join(', ')}`,
    ).toEqual([])
  })
})

describe('a home não inventa prova nem número', () => {
  it('não nomeia o tenant de demonstração como se fosse um cliente', () => {
    /*
     * `scripts/seed-demo-barbearia.mjs` abre dizendo: "Semeia a barbearia de demonstração — um
     * tenant fictício". Linkar para a página dela é demonstração de produto, e é forte: o
     * software roda de verdade do outro lado. NOMEAR o estabelecimento é outra coisa — afirma que
     * existe um cliente que não existe, que é a linha "Prova social inventada" da tabela de
     * proibições do `docs/17-MONETIZACAO-PROMPT.md` §5.10.
     *
     * O href continua livre de propósito: o teste guarda o texto, não o link.
     */
    const achados = achar(copyDaHome(), [/Dom\s+Rocha/i, /Barbearia Dom/i])
    expect(
      achados,
      `a home nomeia o tenant de demonstração, que é fictício — isso é prova social inventada (17 §5.10). Termos: ${achados.join(', ')}`,
    ).toEqual([])
  })

  it('não afirma quanto tempo alguma coisa leva', () => {
    /*
     * "Criar a conta leva menos de três minutos" era a META do `09-PLATAFORMA.md` §13.2, jamais
     * medida: o `scripts/metricas-ativacao.mjs` só tem base semeada e avisa isso em letra
     * garrafal. Meta apresentada como fato é Suposto vestido de Medido, o defeito mais grave do
     * §2.4 do prompt de monetização. Quando houver medição real, o número volta — com a fonte.
     */
    const achados = achar(copyDaHome(), [
      /menos de (um|dois|tr[êe]s|quatro|cinco|\d+)\s*(minuto|hora)/i,
      /leva (um|dois|tr[êe]s|quatro|cinco|\d+)\s*(minuto|hora)/i,
      /em (at[ée] )?\d+\s*(minuto|hora|segundo)/i,
    ])
    expect(
      achados,
      `a home afirma um tempo que ninguém mediu (09 §13.2 é meta, não medição). Termos: ${achados.join(', ')}`,
    ).toEqual([])
  })
})

/**
 * A palavra em prosa que denuncia cada módulo pago. Só entram os que plausivelmente aparecem numa
 * página de venda — o teste não tenta adivinhar o catálogo inteiro, tenta pegar o erro real que já
 * aconteceu: a home vendia "o dia fechado sem calculadora" sem dizer que comanda e caixa são do
 * Essencial, e quem lesse aquilo na seção do grátis pagaria para descobrir depois.
 */
const PROSA_DO_MODULO: readonly { termo: RegExp; modulo: ModuloKey }[] = [
  { termo: /caixa|comanda|fechamento do dia/i, modulo: 'register' },
  { termo: /estoque/i, modulo: 'stock' },
  { termo: /campanha/i, modulo: 'campaigns' },
  { termo: /fidelidade|pontos/i, modulo: 'loyalty' },
  { termo: /comiss[ãa]o/i, modulo: 'team' },
  { termo: /anamnese|ficha de sa[úu]de/i, modulo: 'health_records' },
  { termo: /or[çc]amento/i, modulo: 'quotes' },
]

describe('a home diz o degrau quando anuncia coisa de plano pago', () => {
  it.each(PROSA_DO_MODULO)('se fala de $modulo, nomeia o plano que libera', ({ termo, modulo }) => {
    const copy = copyDaHome()
    if (!termo.test(copy)) return
    if (PLANOS.gratis.modulos.includes(modulo)) return

    const degrau = menorPlanoCom(modulo)
    expect(degrau, `nenhum degrau libera ${modulo} — o catálogo e os planos divergiram`).not.toBeNull()

    /*
     * Duas formas contam, e a segunda é a preferida: o nome do plano deve vir de
     * `NOME_DO_PLANO`, não datilografado. Foi este teste que reprovou a si mesmo na primeira
     * execução — a home dizia "A partir do plano Essencial" na TELA, mas no fonte isso é
     * `${NOME_DO_PLANO.essencial}`, e varredura de código não interpola. Guardar só a string
     * literal empurraria o autor a escrever o nome à mão para o teste passar, que é exatamente o
     * contrário do que o `preco-em-um-lugar-so` pede.
     */
    const citaLiteral = copy.includes(NOME_DO_PLANO[degrau!])
    const citaDoCore = new RegExp(`NOME_DO_PLANO(\.${degrau!}|\[['"\`]${degrau!}['"\`]\])`).test(copy)

    expect(
      citaLiteral || citaDoCore,
      `a home fala de "${modulo}" sem dizer que é do ${NOME_DO_PLANO[degrau!]} — quem ler na seção do grátis vai pagar para descobrir`,
    ).toBe(true)
  })
})
