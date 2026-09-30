/**
 * Regras de lint próprias do CICLO. São a versão executável de três das doze
 * regras invioláveis do CLAUDE.md — as que dá para verificar sem rodar o código.
 */

const ARQUIVO_DO_WRAPPER = 'src/server/db/with-tenant.ts'

/*
  E o arquivo que DECLARA a lista, pela mesma razão que o wrapper é isento: ao passar a olhar
  `Literal`, a regra começou a acusar a própria linha do `Set` abaixo. Guarda que casa com a
  própria definição é a armadilha já registrada três vezes nesta base — aqui na versão mais
  literal possível, já que a definição É o texto procurado.
*/
const ARQUIVO_DA_REGRA = 'eslint-rules/index.mjs'

/** Nomes que só podem aparecer dentro do wrapper de tenant. */
const SO_NO_WRAPPER = new Set(['createServiceClient', 'SUPABASE_SERVICE_ROLE_KEY'])

/**
 * A chave de service_role passa por cima da RLS. Se ela vazar para uma rota de
 * usuário, o isolamento entre tenants deixa de existir — por isso o acesso mora
 * num arquivo só, onde dá para revisar.
 */
const clienteDeServicoConfinado = {
  meta: {
    type: 'problem',
    docs: { description: 'service_role só dentro de src/server/db/with-tenant.ts' },
    schema: [],
    messages: {
      foraDoWrapper:
        '"{{nome}}" só pode aparecer em ' +
        ARQUIVO_DO_WRAPPER +
        '. A chave de service_role passa por cima da RLS; use withTenant().',
    },
  },
  create(context) {
    const arquivo = context.filename.split(String.fromCharCode(92)).join('/')
    if (arquivo.endsWith(ARQUIVO_DO_WRAPPER) || arquivo.endsWith(ARQUIVO_DA_REGRA)) return {}

    return {
      Identifier(node) {
        if (!SO_NO_WRAPPER.has(node.name)) return
        // `obj.createServiceClient` sem computed também conta: o alvo é o nome.
        context.report({ node, messageId: 'foraDoWrapper', data: { nome: node.name } })
      },

      /*
        A regra só visitava `Identifier`, e isso deixava a porta escancarada: em
        `process.env['SUPABASE_SERVICE_ROLE_KEY']` o nome da chave é um **Literal**, não um
        Identifier — o parser nunca chamava o visitante acima e a regra passava verde.

        Não é hipótese de laboratório: trocar `.X` por `['X']` é o que uma pessoa faz sem pensar
        para calar um lint que ela acha exagerado, e é o que um `// eslint-disable` deixaria
        rastro mas isto não deixa. A regra existe para a inviolável nº 2 do CLAUDE.md — se a chave
        de service_role vaza para uma rota de usuário, o isolamento entre tenants acaba —, então a
        forma mais fácil de burlá-la não podia ser a única que ela não enxerga.

        Comparação EXATA com o nome, e não `includes`: as mensagens de erro dos testes de
        integração citam "SUPABASE_SERVICE_ROLE_KEY" no meio de uma frase, e acusá-las seria o
        custo simétrico da guarda cega — detector que reprova o certo manda alguém "consertar"
        código bom. (Ali a regra está desligada por configuração, mas a decisão não pode depender
        disso: `eslint.config.mjs` muda, esta comparação fica.)
      */
      Literal(node) {
        if (typeof node.value !== 'string' || !SO_NO_WRAPPER.has(node.value)) return
        context.report({ node, messageId: 'foraDoWrapper', data: { nome: node.value } })
      },

      /* E a terceira grafia da mesma coisa: process.env[`SUPABASE_SERVICE_ROLE_KEY`]. */
      TemplateElement(node) {
        const texto = node.value?.cooked
        if (typeof texto !== 'string' || !SO_NO_WRAPPER.has(texto)) return
        context.report({ node, messageId: 'foraDoWrapper', data: { nome: texto } })
      },
    }
  },
}

/**
 * BL-42 (`.claude/ciclo/autonomous-backlog.md`): `writeAudit` fora do fechamento que
 * `comIdempotencia` protege faz uma repetição com a mesma `Idempotency-Key` (fila offline
 * reenviando, toque duplo) gravar uma linha NOVA em `audit_log` sem repetir a mutação — a ação só
 * aconteceu uma vez, a trilha diz duas ou mais.
 *
 * Até aqui o conserto era rota por rota, com uma lista de nomes crescendo à mão em
 * `tests/unit/design/writeaudit-dentro-do-idempotente.test.ts` (17 de 50 rotas, 2026-09-28). Esta
 * regra torna a checagem automática para QUALQUER chamada de `comIdempotencia` em qualquer
 * arquivo, existente ou futuro — não depende mais de alguém lembrar de acrescentar o nome do
 * arquivo numa lista.
 *
 * `warn`, não `error`, enquanto as rotas restantes não forem revisadas — ver `eslint.config.mjs`.
 * Subir para `error` é o passo final do BL-42, quando `pnpm lint` não acusar nada.
 */
const writeAuditDentroDoIdempotente = {
  meta: {
    type: 'problem',
    docs: { description: 'writeAudit precisa estar dentro do fechamento de comIdempotencia (BL-42)' },
    schema: [],
    messages: {
      foraDoFechamento:
        'writeAudit precisa estar DENTRO do último argumento de comIdempotencia (o fechamento que executa a mutação) — fora dele, uma repetição com a mesma Idempotency-Key grava uma linha de audit_log sem repetir a ação. Mova a chamada de writeAudit para dentro do fechamento e retorne o mesmo valor de antes.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'comIdempotencia') return

        const fechamento = node.arguments.at(-1)
        if (!fechamento) return

        const textoFechamento = sourceCode.getText(fechamento)
        if (textoFechamento.includes('writeAudit(')) return // padrão certo: já está dentro

        /*
         * Nem toda mutação audita — o checklist do CLAUDE.md diz "nas mutações RELEVANTES", não em
         * todas. Reprovar todo comIdempotencia sem writeAudit dentro seria a guarda cega da própria
         * tabela do CLAUDE.md: reprovar código certo ensina a "consertar" o que não está quebrado.
         *
         * O defeito real do BL-42 é mais específico: writeAudit foi MOVIDO para fora do fechamento,
         * não que ele nunca existiu. Então só acusa quando existe uma chamada de writeAudit em
         * algum lugar da MESMA função que não está dentro deste fechamento — sinal de que a rota
         * pretende auditar essa mutação, só que no lugar errado.
         */
        let funcao = node.parent
        while (
          funcao &&
          funcao.type !== 'FunctionDeclaration' &&
          funcao.type !== 'FunctionExpression' &&
          funcao.type !== 'ArrowFunctionExpression' &&
          funcao.type !== 'Program'
        ) {
          funcao = funcao.parent
        }
        if (!funcao) return

        const textoDeFora = sourceCode.getText(funcao).split(textoFechamento).join('')
        if (textoDeFora.includes('writeAudit(')) {
          context.report({ node: fechamento, messageId: 'foraDoFechamento' })
        }
      },
    }
  },
}

/**
 * Regra 3 do CLAUDE.md: "Dinheiro em centavos (bigint, sufixo `_cents`). Percentual em basis
 * points (`_bps`). Nunca float." Na borda (regra 7, "Zod na borda"), isso quer dizer: todo campo
 * `*Cents`/`*Bps` de um schema Zod precisa recusar fração — `z.number().int(...)` ou `z.int(...)`,
 * nunca `z.number()` sozinho, que aceita `19.9` como "19 reais e noventa centavos de centavo".
 *
 * Varredura em 2026-09-28 (auditoria de armadilhas catalogadas, continuação): zero violações no
 * projeto inteiro — todo campo `*Cents`/`*Bps` já usa `.int()` ou `z.int()`. Por isso a regra nasce
 * direto em `"error"` (ver `eslint.config.mjs`), sem o estágio `"warn"` que o BL-42 precisou: não
 * há nada existente para quebrar, só regressão futura para impedir.
 */
const CAMPO_DE_DINHEIRO = /(Cents|Bps)$/

const dinheiroEmCentavosInteiros = {
  meta: {
    type: 'problem',
    docs: { description: 'campo *Cents/*Bps de um schema Zod precisa ser inteiro (regra 3 do CLAUDE.md)' },
    schema: [],
    messages: {
      faltaInt:
        '"{{campo}}" termina em Cents/Bps mas o schema aceita fração — dinheiro é sempre inteiro em centavos, percentual sempre inteiro em basis points, nunca float (regra 3 do CLAUDE.md). Use z.number().int(...) ou z.int(...).',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode
    return {
      Property(node) {
        if (node.computed) return
        const nome = node.key.type === 'Identifier' ? node.key.name : node.key.type === 'Literal' && typeof node.key.value === 'string' ? node.key.value : null
        if (!nome || !CAMPO_DE_DINHEIRO.test(nome)) return

        const texto = sourceCode.getText(node.value)
        // Só se aplica a schemas Zod de verdade — uma referência a variável (`priceCents: valor`)
        // não dá pra verificar aqui, e reprová-la seria adivinhar, não conferir.
        if (!/^z\s*\.\s*\w/.test(texto)) return
        // `z.int(...)` já é inteiro por natureza — não precisa de `.int()` extra.
        if (/^z\s*\.\s*int\s*\(/.test(texto)) return
        // `z.number()` com `.int()` em qualquer ponto da cadeia (ordem não importa) está certo.
        if (/^z\s*\.\s*number\s*\(/.test(texto) && /\.\s*int\s*\(/.test(texto)) return
        // Qualquer outra raiz Zod (`z.string()`, `z.boolean()`, …) não é campo numérico — fora do escopo.
        if (!/^z\s*\.\s*number\s*\(/.test(texto)) return

        context.report({ node: node.value, messageId: 'faltaInt', data: { campo: nome } })
      },
    }
  },
}

/**
 * Regra 11 do CLAUDE.md: "Nunca delete agendamento, movimento de estoque ou registro de
 * auditoria. Use estado/compensação." A `0081` (migration) já trava `DELETE` nessas tabelas por
 * RLS para quem usa o cliente do usuário — mas `service_role` (`withTenant`/`withNovoTenant`, o
 * cliente que a maioria do código de servidor usa) **ignora RLS por desenho** (`BYPASSRLS`,
 * confirmado nesta sessão) — então a mesma linha de código que o teste de RLS prova bloqueada para
 * o cliente do usuário passaria DIRETO se alguém a escrevesse num caminho de `service_role`. A
 * proteção do banco é real, mas porosa; esta regra fecha exatamente essa porta, no código-fonte,
 * antes de chegar ao banco.
 *
 * `appointments`/`stock_moves`/`audit_log` são as três nomeadas na regra; `cycle_predictions` e
 * `package_uses` entram porque a própria migration `0081`/`tests/rls/append-only-nao-se-apaga.
 * test.ts` já os trata com o mesmo princípio (append-only por desenho, desfazer é compensação).
 *
 * Varredura em 2026-09-28: zero ocorrências de `.from('<tabela protegida>').delete(` no projeto
 * inteiro — nasce direto em `"error"`.
 */
const TABELAS_SEM_DELETE = new Set(['appointments', 'stock_moves', 'audit_log', 'cycle_predictions', 'package_uses'])

const semDeleteEmTabelaAppendOnly = {
  meta: {
    type: 'problem',
    docs: { description: 'nunca DELETE em agendamento/movimento de estoque/auditoria — use estado ou compensação (regra 11 do CLAUDE.md)' },
    schema: [],
    messages: {
      deleteProibido:
        '`.delete()` em "{{tabela}}" é proibido (regra 11 do CLAUDE.md: nunca delete agendamento, movimento de estoque ou registro de auditoria). RLS bloqueia isto para o cliente do usuário, mas NÃO para service_role — use um campo de estado (ex. `canceled_at`) ou um movimento compensatório, nunca apague a linha.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || node.callee.property.type !== 'Identifier' || node.callee.property.name !== 'delete') return

        const alvo = node.callee.object
        if (alvo.type !== 'CallExpression' || alvo.callee.type !== 'MemberExpression' || alvo.callee.property.type !== 'Identifier' || alvo.callee.property.name !== 'from') return

        const tabela = alvo.arguments[0]
        if (!tabela || tabela.type !== 'Literal' || typeof tabela.value !== 'string') return
        if (!TABELAS_SEM_DELETE.has(tabela.value)) return

        context.report({ node, messageId: 'deleteProibido', data: { tabela: tabela.value } })
      },
    }
  },
}

const plugin = {
  rules: {
    'service-client-confinado': clienteDeServicoConfinado,
    'writeaudit-dentro-do-idempotente': writeAuditDentroDoIdempotente,
    'dinheiro-em-centavos-inteiros': dinheiroEmCentavosInteiros,
    'sem-delete-em-tabela-append-only': semDeleteEmTabelaAppendOnly,
  },
}

export default plugin
