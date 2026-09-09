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

const plugin = {
  rules: {
    'service-client-confinado': clienteDeServicoConfinado,
  },
}

export default plugin
