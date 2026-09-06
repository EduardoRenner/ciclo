import { cookies } from 'next/headers'

import { cache } from 'react'

import { resolverVocabulario, type Vocabulario } from '@/core/text/vocabulario'
import { exigirSessao, type Sessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'

import type { Papel } from '@/server/auth/rbac'

/** Nome fixado pelo briefing (`01-ESPEC-TECNICA §2.1`). */
export const COOKIE_TENANT = 'ciclo_tenant'

export type DadosDoTenant = {
  name: string
  slug: string
  timezone: string
  vertical: string | null
  /**
   * As palavras da profissao, JA RESOLVIDAS (docs/DECISOES.md, 2026-09-04): um psicologo le
   * "Sessao" onde a barbearia le "Servico".
   *
   * **Por que aqui e nao junto de `settings`, que este mesmo arquivo exclui de proposito.** O
   * argumento contra `settings` e que ele e JSON que CRESCE por tenant e serve tres telas: cobrar
   * isso de toda requisicao seria trocar uma ida de rede por bytes em todas. Aqui e o oposto nas
   * duas pontas -- o vocabulario e limitado por desenho (as seis chaves de `PADRAO`, cada uma uma
   * palavra) e quase toda tela do painel precisa dele. Resolver na borda tambem evita espalhar a
   * regra de precedencia por todo componente que queira uma palavra.
   */
  vocabulario: Vocabulario
}

export type Contexto = {
  sessao: Sessao
  tenantId: string
  papel: Papel
  /**
   * Os quatro campos do tenant que quase toda tela pede logo depois de resolver o contexto —
   * vêm de carona no `select` que já revalida o membership, em vez de uma segunda ida ao banco
   * (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §8).
   *
   * Dez telas faziam `from('tenants').select(...)` na linha seguinte ao `contextoAtual`, e em
   * cinco delas (`hoje`, `agenda`, `caixa`, `estoque`, `recuperar`) essa ida era **serial e
   * bloqueante**: o `timezone` decide o intervalo das consultas seguintes, então nada podia
   * começar antes dela voltar.
   *
   * `settings` **não** entra aqui de propósito: é JSON que cresce por tenant, e cobrar isso de
   * toda requisição para servir três telas seria trocar uma ida de rede por bytes em todas.
   * Quem precisa de `settings` continua buscando por conta própria.
   */
  tenant: DadosDoTenant
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * A revalidação de membership da FAQ C27 continua acontecendo em toda requisição — o que mudou é
 * que ela acontece **uma vez por requisição**, não uma vez por chamada de `contextoAtual`. Uma
 * rota que resolve contexto no guard e um serviço que resolve de novo lá dentro faziam a mesma
 * consulta duas vezes, em série, no caminho do clique (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §1).
 *
 * A chave do `cache()` é o `userId`, não o `Request` — cada chamada monta um `Request` novo, e
 * cachear por objeto não deduplicaria nada.
 */
const vinculosAtivos = cache(async function vinculosAtivos(userId: string) {
  const db = await criarClienteDoUsuario()
  const { data, error } = await db
    .from('memberships')
    .select('tenant_id, role, tenants(name, slug, timezone, vertical, vocab_override, professions(vocab))')
    .eq('user_id', userId)
    .eq('active', true)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
})

/**
 * O join do PostgREST devolve `null` quando a linha do lado de lá não existe. Não deveria
 * acontecer (`memberships.tenant_id` é FK), mas o tipo gerado admite — e cair aqui com
 * `TENANT_MISMATCH` é o comportamento certo: membership apontando para tenant que sumiu não é
 * um contexto válido para trabalhar.
 */
type TenantBruto = {
  name: string
  slug: string
  timezone: string
  vertical: string | null
  vocab_override: unknown
  professions: { vocab: unknown } | null
}

function dadosDoTenant(bruto: TenantBruto | null): DadosDoTenant {
  if (!bruto) throw new AppError('TENANT_MISMATCH')
  return {
    name: bruto.name,
    slug: bruto.slug,
    timezone: bruto.timezone,
    vertical: bruto.vertical,
    // `professions` vem `null` em tenant sem profissao escolhida; `resolverVocabulario` trata
    // ausencia como padrao, entao nao existe caminho em que a tela fique sem palavra.
    vocabulario: resolverVocabulario(bruto.professions?.vocab, bruto.vocab_override),
  }
}

/**
 * Resolve o tenant ativo e **revalida o membership em toda requisição**
 * (FAQ C27). O header e o cookie dizem qual tenant a pessoa quer; quem responde
 * se ela pode é o banco.
 */
export async function contextoAtual(req: Request): Promise<Contexto> {
  const sessao = await exigirSessao()

  const jar = await cookies()
  const pedido = req.headers.get('x-tenant-id') ?? jar.get(COOKIE_TENANT)?.value ?? null

  // Um valor que nem uuid é não vale uma ida ao banco, e a resposta é a mesma
  // que a de tenant alheio: quem forjou não descobre se o id existe.
  if (pedido !== null && !UUID.test(pedido)) throw new AppError('TENANT_MISMATCH')

  const ativos = await vinculosAtivos(sessao.userId)

  if (pedido !== null) {
    const escolhido = ativos.find((v) => v.tenant_id === pedido)
    // Mesmo erro para "tenant não existe" e "existe mas não é seu": a diferença
    // vira um verificador de quais estabelecimentos existem no CICLO.
    if (!escolhido) throw new AppError('TENANT_MISMATCH')
    return { sessao, tenantId: escolhido.tenant_id, papel: escolhido.role, tenant: dadosDoTenant(escolhido.tenants) }
  }

  if (ativos.length === 0) {
    throw new AppError('FORBIDDEN', {
      message: 'Sua conta ainda não tem um estabelecimento. Termine o cadastro para continuar.',
    })
  }

  const unico = ativos[0]
  if (ativos.length > 1 || !unico) {
    throw AppError.validacao(
      { 'x-tenant-id': 'Escolha em qual estabelecimento você quer trabalhar.' },
      'Você atende em mais de um lugar. Escolha um para continuar.',
    )
  }

  return { sessao, tenantId: unico.tenant_id, papel: unico.role, tenant: dadosDoTenant(unico.tenants) }
}
