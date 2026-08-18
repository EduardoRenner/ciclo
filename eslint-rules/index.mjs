/**
 * Regras de lint próprias do CICLO. São a versão executável de três das doze
 * regras invioláveis do CLAUDE.md — as que dá para verificar sem rodar o código.
 */

const ARQUIVO_DO_WRAPPER = 'src/server/db/with-tenant.ts'

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
    if (arquivo.endsWith(ARQUIVO_DO_WRAPPER)) return {}

    return {
      Identifier(node) {
        if (!SO_NO_WRAPPER.has(node.name)) return
        // `obj.createServiceClient` sem computed também conta: o alvo é o nome.
        context.report({ node, messageId: 'foraDoWrapper', data: { nome: node.name } })
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
