import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios as semComentariosDe } from '../../helpers/fonte'

/**
 * I-2, `docs/30-INDICACAO-PLANO.md`. É a guarda da MESMA classe que `caixa-nao-promete-taxa` e
 * `portfolio-nao-promete-foto` (rodadas 1 e 2 da super auditoria de 2026-08-28): coluna lida por
 * todo mundo e escrita por ninguém.
 *
 * `clients.referred_by` existe desde a migration 0001, com índice próprio (0021).
 * `pontuarAtendimentoConcluido` (`fidelidade.ts`) credita os dois lados na primeira visita
 * concluída de quem foi indicado. A ficha mostra "Veio por indicação de", o CRM mostra "quem esta
 * cliente indicou". E, até esta rodada, o ÚNICO lugar do repositório que escrevia a coluna era
 * `scripts/seed-demo-barbearia.mjs` — o recurso funcionava na demonstração e em tenant nenhum de
 * verdade, e o `docs/27-ESCALA-E-CONVERSAO.md` chegou a registrar "já está construído e
 * funcionando" conferindo contra a demonstração.
 *
 * Esta guarda NÃO é de mão dupla como as outras duas — aqui o escritor é o que deveria SEMPRE
 * existir a partir de agora, e o teste reprova se ele sumir. Casa com a CADEIA de chamadas
 * inteira (token → rota → serviço → escritor), não só com o nome da coluna: a armadilha nº 1 da
 * tabela de guarda cega do CLAUDE.md é casar com o `import` ou com a definição em vez da chamada.
 */

const AGENDAMENTOS = 'src/server/services/agendamentos.ts'
const PUBLIC_BOOKING = 'src/server/services/public-booking.ts'
const INDICACAO = 'src/server/services/indicacao.ts'
const FICHA = 'src/app/admin/clientes/[id]/ficha.tsx'
const CRM = 'src/server/services/crm.ts'
const FIDELIDADE = 'src/server/services/fidelidade.ts'
const SEED_DEMO = 'scripts/seed-demo-barbearia.mjs'
const REVIEWS_ROUTE = 'src/app/api/v1/public/reviews/[token]/route.ts'
const SECOES = 'src/app/(public)/[slug]/secoes.tsx'

function semComentarios(caminho: string): string {
  return semComentariosDe(readFileSync(caminho, 'utf8'))
}

/**
 * O texto inteiro de uma chamada `nome(...)`, do `nome(` até o `)` que fecha na MESMA
 * profundidade — não uma janela de N caracteres (armadilha nº 4 da tabela de guarda cega do
 * CLAUDE.md). A chamada real de `criarAgendamento` passa um objeto de várias linhas como
 * argumento, e uma janela fixa cortava antes de chegar em `referredBy`.
 */
function chamada(fonte: string, nomeDaFuncao: string): string | null {
  const inicio = fonte.indexOf(`${nomeDaFuncao}(`)
  if (inicio === -1) return null
  let profundidade = 0
  let i = inicio + nomeDaFuncao.length
  for (; i < fonte.length; i++) {
    if (fonte[i] === '(') profundidade++
    else if (fonte[i] === ')') {
      profundidade--
      if (profundidade === 0) return fonte.slice(inicio, i + 1)
    }
  }
  return null
}

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

describe('a leitura destes arquivos', () => {
  it('não voltou vazia', () => {
    for (const arquivo of [AGENDAMENTOS, PUBLIC_BOOKING, INDICACAO, FICHA, CRM, FIDELIDADE]) {
      expect(semComentarios(arquivo).length, `${arquivo} veio vazio`).toBeGreaterThan(300)
    }
  })
})

describe('clients.referred_by tem escritor de verdade — não só o seed da demonstração', () => {
  it('resolverCliente grava a coluna, no ramo de CRIAÇÃO de cliente', () => {
    const fonte = semComentarios(AGENDAMENTOS)
    // Casa com a chave dentro do `.insert({...})`, não com o nome da coluna solto num comentário
    // ou numa string de outro lugar do arquivo.
    expect(
      /\.insert\(\{[^}]*referred_by:\s*referenciaValida/.test(fonte),
      `${AGENDAMENTOS} não grava mais referred_by no insert de clients — o escritor sumiu`,
    ).toBe(true)
  })

  it('a validação do referenciador confere tenant e "não eliminada" — não aceita qualquer id', () => {
    const fonte = semComentarios(AGENDAMENTOS)
    const bloco = /let referenciaValida[\s\S]{0,600}/.exec(fonte)?.[0] ?? ''
    expect(bloco, 'não achei o bloco de validação do referenciador').not.toBe('')
    expect(bloco, 'a validação não confere mais o tenant do referenciador').toMatch(/eq\('tenant_id', tenantId\)/)
    expect(bloco, 'a validação não confere mais que o referenciador não foi eliminado').toMatch(/is\('deleted_at', null\)/)
  })

  it('criarAgendamento RECEBE o parâmetro e REPASSA pra resolverCliente — não fica pelo caminho', () => {
    const fonte = semComentarios(AGENDAMENTOS)
    const assinatura = /export async function criarAgendamento\(([\s\S]*?)\)\s*\{/.exec(fonte)?.[1] ?? ''
    expect(assinatura, 'criarAgendamento perdeu o parâmetro referredBy').toMatch(/referredBy/)
    expect(
      /resolverCliente\(db,\s*tenantId,\s*entrada,\s*referredBy\)/.test(fonte),
      'criarAgendamento não repassa mais referredBy para resolverCliente — o parâmetro vira letra morta',
    ).toBe(true)
  })

  it('o agendamento público RESOLVE o token de indicação e passa pra criarAgendamento', () => {
    const fonte = semComentarios(PUBLIC_BOOKING)
    expect(fonte, 'public-booking.ts não importa mais verificarTokenIndicacao').toMatch(
      /import\s*\{[^}]*verificarTokenIndicacao[^}]*\}\s*from\s*'@\/server\/services\/indicacao'/,
    )
    expect(
      /verificarTokenIndicacao\(entrada\.ind\)/.test(fonte),
      'a rota parou de chamar verificarTokenIndicacao com o campo `ind` do corpo — o convite deixou de ser lido',
    ).toBe(true)
    const chamadaReal = chamada(fonte, 'criarAgendamento')
    expect(chamadaReal, 'não achei a chamada de criarAgendamento em public-booking.ts').not.toBeNull()
    expect(
      /referredBy/.test(chamadaReal ?? ''),
      'o `referredBy` resolvido não é mais repassado para criarAgendamento na chamada de verdade',
    ).toBe(true)
  })

  it('o token de indicação tem escopo próprio — não reaproveita o de avaliação/confirmação/orçamento', () => {
    const fonte = semComentarios(INDICACAO)
    expect(fonte, `${INDICACAO} não define mais um ESCOPO próprio`).toMatch(/const ESCOPO = '[a-z_]+'/)
    // Casando o VALOR do escopo, não o nome da constante: um escopo igual ao de outro arquivo
    // (avaliacao_atendimento, confirmacao_agendamento, lista_espera) deixaria o token de
    // indicação valer onde um deles é esperado.
    const escopo = /const ESCOPO = '([a-z_]+)'/.exec(fonte)?.[1]
    expect(['avaliacao_atendimento', 'confirmacao_agendamento', 'lista_espera', 'orcamento'], `escopo "${escopo}" colide com outro token assinado`).not.toContain(
      escopo,
    )
  })

  it('a validade do convite é medida em dias (180), como o orçamento — não expira em horas', () => {
    const fonte = semComentarios(INDICACAO)
    expect(/const VALIDADE_HORAS = 24 \* 180/.test(fonte), 'a validade do convite de indicação mudou — confira se ainda é de meses').toBe(true)
  })

  /**
   * Achado durante a própria implementação do I-1: o convite chegou a ser montado como
   * `/{slug}?ind=` (o perfil do tenant). O CTA "Agendar" daquela tela (`secoes.tsx`) linka para
   * `/{slug}/agendar` sem repassar NENHUMA query string — um convite pra raiz perderia o token no
   * primeiro toque, antes de chegar na única tela que lê `?ind=`. O link tem que apontar direto
   * para `/{slug}/agendar`.
   */
  it('o link do convite aponta para /agendar — a única tela que lê ?ind=, não para o perfil', () => {
    const fonte = semComentarios(REVIEWS_ROUTE)
    expect(
      /indicacao\.slug\}\/agendar\?ind=\$\{resultado\.indicacao\.token\}/.test(fonte),
      'o link de indicação não aponta mais para /{slug}/agendar — voltou a apontar para o perfil, ' +
        'ou mudou de forma sem essa guarda ser atualizada junto',
    ).toBe(true)
  })

  it('o CTA "Agendar" do perfil continua sem repassar query string — é isso que torna o link direto obrigatório', () => {
    // Se um dia o perfil passar a repassar `?ind=` para `/agendar`, o link de duas etapas
    // (`/{slug}?ind=` → clique → `/{slug}/agendar`) volta a ser viável, e o teste acima precisa
    // ser revisto — não silenciosamente, por isso este par de testes existe junto.
    const fonte = semComentarios(SECOES)
    expect(fonte, `${SECOES} não tem mais o link fixo pra /agendar — revise as duas guardas juntas`).toMatch(
      /href=\{`\/\$\{perfil\.slug\}\/agendar`\}/,
    )
  })
})

describe('as leituras de referred_by continuam de pé — sem elas o escritor não serve pra nada', () => {
  it('o CRM continua mostrando quem indicou e quem foi indicado', () => {
    const fonte = semComentarios(CRM)
    expect(fonte).toMatch(/eq\('referred_by', clientId\)/)
    expect(fonte).toMatch(/cliente\.referred_by/)
  })

  it('a ficha continua mostrando "Veio por indicação de"', () => {
    const fonte = semComentarios(FICHA)
    expect(fonte).toMatch(/Veio por indicação de/)
  })

  it('a fidelidade continua creditando os dois lados na primeira visita', () => {
    /*
     * 31/08: a condição era `cliente?.referred_by && cliente.visits_count === 0`. O segundo termo
     * saiu porque estava ERRADO — `visits_count` só muda no cron diário, então continuava `0` na
     * segunda conclusão da mesma cliente e pagava o bônus de novo (TICKET-063).
     *
     * O que esta guarda protege continua igual: a fidelidade ainda LÊ `referred_by` e ainda decide
     * creditar a partir dele. Só o segundo termo virou uma pergunta ao livro-razão.
     */
    const fonte = semComentarios(FIDELIDADE)
    expect(fonte, 'a fidelidade parou de ler referred_by — o escritor perde o leitor').toMatch(
      /cliente\?\.referred_by/,
    )
    expect(fonte, 'a decisão de creditar indicação sumiu').toContain('deveCreditarIndicacao(')
  })
})

describe('a demonstração não é mais o único caminho', () => {
  it('o seed continua existindo — ele não é o problema, é só não deveria ser o ÚNICO', () => {
    const fonte = readFileSync(SEED_DEMO, 'utf8')
    expect(fonte).toMatch(/referred_by/)
  })

  it('existe pelo menos mais um escritor fora de scripts/', () => {
    // Varre TODO src/ atrás de `referred_by:` como chave de objeto (insert/update) — não como
    // string em comentário ou rótulo de coluna solto.
    const escritores = arquivos('src')
      .filter((f) => !f.endsWith('types.gen.ts'))
      .filter((f) => /(^|[\s{,(])referred_by\s*:/.test(semComentarios(f)))
    expect(escritores.length, 'nenhum arquivo de src/ escreve referred_by — voltamos a depender só do seed').toBeGreaterThan(0)
  })
})
