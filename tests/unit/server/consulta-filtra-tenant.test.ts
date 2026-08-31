import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Auditoria de segurança de 31/08/2026, segunda varredura.
 *
 * **O risco:** `withTenant`/`withNovoTenant` emprestam a chave `service_role`, que **ignora a RLS
 * por completo** — é o próprio comentário do `with-tenant.ts` que diz: "quem usa o cliente precisa
 * filtrar `tenant_id` explicitamente". Ou seja, para toda consulta feita ali dentro, o isolamento
 * entre salões não é garantido pelo banco: é garantido por alguém ter lembrado de escrever
 * `.eq('tenant_id', ...)`. Uma consulta esquecida não dá erro, não quebra teste e não aparece no
 * `pnpm verify` — ela devolve dado de outro salão em silêncio.
 *
 * **O que foi medido:** 15 consultas sem filtro de tenant. Auditei as 15 uma por uma e **nenhuma é
 * explorável hoje** — cada id vem de uma consulta que JÁ filtrou por tenant, de um token HMAC que
 * carrega o tenant no payload, ou de um job de cron que roda para todos os tenants de propósito.
 *
 * **Então por que a guarda existe:** porque essa segurança está inteira **fora da consulta**, e a
 * lista acima é o mapa de quantas vezes ela depende de o próximo desenvolvedor entender o
 * contexto. É a mesma fragilidade do filtro `.or()` com interpolação crua desta mesma auditoria:
 * não estava quebrado, estava apoiado em disciplina. A guarda transforma disciplina em trava.
 *
 * **Como funciona:** consulta nova sem `tenant_id` reprova. Se for legítima (cron global, id já
 * validado), entra nesta lista **com o motivo escrito** — o custo de justificar é o ponto, porque
 * é nesse momento que se pensa se é mesmo seguro.
 */

/** Tabelas que não têm coluna `tenant_id` — filtrar por tenant nelas seria erro, não acerto. */
const SEM_COLUNA_TENANT = new Set([
  'profiles',
  'vertical_packs',
  'professions',
  'profession_services',
  'idempotency_keys',
  'job_queue',
  'webhook_events',
  'rate_limits',
  'cron_heartbeats',
  'modules_catalogo',
  'memberships',
  'tenants',
  'invites',
])

/**
 * Consultas sem filtro de tenant que foram auditadas e justificadas, com a contagem esperada por
 * arquivo+tabela. A CONTAGEM importa: acrescentar uma consulta nova sem filtro no mesmo arquivo
 * muda o número e reprova, mesmo que o arquivo já esteja na lista.
 */
const JUSTIFICADAS: { arquivo: string; tabela: string; quantas: number; porque: string }[] = [
  {
    arquivo: 'src/server/services/avaliacoes.ts',
    tabela: 'client_reviews',
    quantas: 1,
    porque: 'busca pelo appointment_id que veio de token HMAC de escopo próprio, já verificado',
  },
  {
    arquivo: 'src/server/services/ciclo.ts',
    tabela: 'services',
    quantas: 1,
    porque: 'serviceId vem de uma combinação montada a partir de linhas já filtradas por tenant',
  },
  {
    arquivo: 'src/server/services/fidelidade.ts',
    tabela: 'clients',
    quantas: 1,
    porque: 'clientId vem do agendamento que concluirAgendamento já conferiu contra o tenant',
  },
  {
    arquivo: 'src/server/services/fidelidade.ts',
    tabela: 'loyalty_entries',
    quantas: 1,
    porque: 'insert de array montado em variável — cada objeto leva tenant_id, que a varredura não enxerga de dentro',
  },
  {
    arquivo: 'src/server/services/health.ts',
    tabela: 'messages',
    quantas: 1,
    porque: 'healthcheck da instância — conta mensagens de TODOS os tenants de propósito, sem ler conteúdo',
  },
  {
    arquivo: 'src/server/services/lembretes.ts',
    tabela: 'appointments',
    quantas: 1,
    porque: 'cron: varre todos os tenants por desenho, é o job que manda lembrete de todo mundo',
  },
  {
    arquivo: 'src/server/services/lembretes.ts',
    tabela: 'messages',
    quantas: 1,
    porque: 'cron: mesma varredura global, para não mandar o mesmo lembrete duas vezes',
  },
  {
    arquivo: 'src/server/services/lista-espera.ts',
    tabela: 'waitlist',
    quantas: 2,
    porque: 'update por id de linha já lida com .eq(tenant_id) logo acima (uma delas do token, que carrega o tenant)',
  },
  {
    arquivo: 'src/server/services/mensageria.ts',
    tabela: 'clients',
    quantas: 1,
    porque: 'clientId sempre vem de fluxo interno (cron/recuperação), nunca do corpo de uma requisição',
  },
  {
    arquivo: 'src/server/services/orcamentos.ts',
    tabela: 'quote_items',
    quantas: 1,
    porque: 'itens do orçamento cujo quoteId já foi conferido contra o tenant',
  },
  {
    arquivo: 'src/server/services/orcamentos.ts',
    tabela: 'quotes',
    quantas: 4,
    porque:
      'ação pública por token HMAC (o token É a autorização, e o tenant sai da própria linha) mais updates por id de linha já lida logo acima',
  },
  {
    arquivo: 'src/server/services/portfolio-upload.ts',
    tabela: 'portfolio_photos',
    quantas: 1,
    porque: 'delete da cópia anterior, cujo id saiu de um select com .eq(tenant_id)',
  },
  {
    arquivo: 'src/server/services/recuperar-receita.ts',
    tabela: 'clients',
    quantas: 1,
    porque: 'só roda depois do gate de client_cycles com .eq(tenant_id) — id de outro tenant cai no continue',
  },
  {
    arquivo: 'src/server/services/recuperar-receita.ts',
    tabela: 'services',
    quantas: 1,
    porque: 'mesmo gate: o client_cycles conferido acima casa tenant_id E service_id, então o par já é do tenant',
  },
  {
    arquivo: 'src/server/services/trilha-cofre.ts',
    tabela: 'clients',
    quantas: 1,
    porque: 'ids colhidos da própria trilha, que já foi lida filtrada por tenant',
  },
]

/**
 * Fim REAL da cadeia `.from(...).select(...).eq(...)`, não uma janela de N caracteres.
 *
 * A primeira versão desta função cortava no primeiro `;` e, se não achasse, usava 900 caracteres.
 * **Este projeto não usa ponto e vírgula** (Prettier com `semi: false`), então o corte nunca
 * acontecia e a janela vazava para a função vizinha — que quase sempre tem `tenant_id` em algum
 * lugar. Resultado: consulta sem filtro acrescentada logo antes de uma função que filtra passava
 * verde. Pego pela mutação B (armadilha nº4 do CLAUDE.md: delimitar pelo fim do elemento, nunca
 * por contagem de caracteres).
 *
 * Anda a cadeia contando parênteses: continua enquanto estiver dentro de um argumento, ou enquanto
 * o próximo caractere significativo for um `.` (chamada encadeada). Para no primeiro ponto em que
 * a cadeia realmente termina.
 */
function fimDaCadeia(codigo: string, inicio: number): number {
  let i = inicio
  let profundidade = 0

  while (i < codigo.length) {
    const c = codigo[i]!
    if (c === '(' || c === '[') profundidade++
    else if (c === ')' || c === ']') {
      profundidade--
      if (profundidade === 0) {
        // Fechou um argumento: a cadeia só continua se o próximo significativo for `.`
        let j = i + 1
        while (j < codigo.length && /\s/.test(codigo[j]!)) j++
        if (codigo[j] === '.') {
          i = j
          continue
        }
        return i + 1
      }
    }
    i++
  }
  return codigo.length
}

function consultasSemFiltroDeTenant(): { arquivo: string; tabela: string; linha: number }[] {
  const arquivos = execSync('git ls-files "src/server/**/*.ts"', { encoding: 'utf8' }).split('\n').filter(Boolean)
  const achados: { arquivo: string; tabela: string; linha: number }[] = []

  for (const arquivo of arquivos) {
    const codigo = semComentarios(readFileSync(arquivo, 'utf8'))
    // `.storage.from('bucket')` é Storage, não tabela — não tem tenant_id para filtrar.
    const re = /(?<!\.storage)\.from\(\s*['"](\w+)['"]\s*\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(codigo)) !== null) {
      const tabela = m[1]!
      if (SEM_COLUNA_TENANT.has(tabela)) continue

      const trecho = codigo.slice(m.index, fimDaCadeia(codigo, m.index))

      if (!trecho.includes('tenant_id')) {
        achados.push({ arquivo, tabela, linha: codigo.slice(0, m.index).split('\n').length })
      }
    }
  }
  return achados
}

const ACHADOS = consultasSemFiltroDeTenant()

describe('o leitor desta guarda', () => {
  it('enxerga o código do servidor — senão passa vazia', () => {
    const total = execSync('git ls-files "src/server/**/*.ts"', { encoding: 'utf8' }).split('\n').filter(Boolean)
    expect(total.length, 'nenhum arquivo de servidor encontrado').toBeGreaterThan(40)
  })

  it('não confunde bucket de Storage com tabela', () => {
    // `.storage.from('vitrine')` não tem tenant_id — contá-lo encheria a lista de falso positivo,
    // e lista com ruído é lista que ninguém lê.
    expect(ACHADOS.some((a) => a.tabela === 'vitrine' || a.tabela === 'media')).toBe(false)
  })

  it('delimita pelo fim da cadeia, não por janela de caracteres', () => {
    /*
     * O teste do próprio leitor. Este projeto não usa `;`, então qualquer corte por "primeiro
     * ponto e vírgula" nunca dispara e a janela vaza para o código vizinho — foi exatamente
     * assim que a primeira versão desta guarda nasceu cega.
     *
     * Aqui a cadeia SEM filtro termina antes da função de baixo, que TEM `tenant_id`. Se o
     * delimitador voltar a vazar, este caso passa a enxergar o `tenant_id` do vizinho e a
     * asserção quebra.
     */
    const fonte = [
      "const a = db.from('quotes').select('total_cents').eq('id', quoteId)",
      "const b = db.from('quotes').select('x').eq('tenant_id', t)",
    ].join('\n')

    const inicio = fonte.indexOf(".from('quotes')")
    const cadeia = fonte.slice(inicio, fimDaCadeia(fonte, inicio))

    expect(cadeia, 'a cadeia vazou para a linha de baixo').not.toContain('tenant_id')
    expect(cadeia, 'a cadeia foi cortada curta demais').toContain("eq('id', quoteId)")
  })
})

describe('consulta sob service_role filtra por tenant', () => {
  it('nenhuma consulta sem filtro de tenant fora da lista auditada', () => {
    const naLista = new Map(JUSTIFICADAS.map((j) => [`${j.arquivo}::${j.tabela}`, j.quantas]))

    const contagem = new Map<string, number>()
    for (const a of ACHADOS) {
      const chave = `${a.arquivo}::${a.tabela}`
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
    }

    const novas: string[] = []
    for (const [chave, quantas] of contagem) {
      const esperado = naLista.get(chave)
      if (esperado === undefined) {
        novas.push(`${chave} (${quantas}x) — consulta NOVA sem filtro de tenant`)
      } else if (quantas > esperado) {
        novas.push(`${chave} — eram ${esperado}, agora são ${quantas}: apareceu consulta nova sem filtro`)
      }
    }

    expect(
      novas,
      'Consulta sob `service_role` sem `.eq("tenant_id", ...)`. A RLS NÃO protege aqui — a chave de ' +
        'serviço a ignora, e o isolamento entre salões passa a depender só deste filtro. Se a consulta ' +
        'for mesmo segura (id já validado contra o tenant, token que carrega o tenant, cron global), ' +
        'acrescente em JUSTIFICADAS com o motivo escrito.',
    ).toEqual([])
  })

  it('a lista não guarda justificativa que já não vale — entrada obsoleta some', () => {
    // Guarda contra a própria lista: entrada que sobra depois de a consulta ganhar filtro vira
    // permissão pendurada, e a próxima consulta sem filtro naquele arquivo entra de carona.
    const encontrados = new Set(ACHADOS.map((a) => `${a.arquivo}::${a.tabela}`))
    const obsoletas = JUSTIFICADAS.filter((j) => !encontrados.has(`${j.arquivo}::${j.tabela}`)).map(
      (j) => `${j.arquivo}::${j.tabela}`,
    )
    expect(obsoletas, 'entrada de JUSTIFICADAS que não corresponde a nenhuma consulta real — remova').toEqual([])
  })

  it('toda justificativa tem motivo escrito, não só o caminho', () => {
    const semMotivo = JUSTIFICADAS.filter((j) => j.porque.trim().length < 30).map((j) => j.arquivo)
    expect(semMotivo, 'justificativa vazia ou genérica demais — o custo de explicar é o ponto da lista').toEqual([])
  })
})
