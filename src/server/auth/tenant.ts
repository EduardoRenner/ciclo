import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { cache } from 'react'

import { normalizarPacote, type SlugDoPacote } from '@/core/pacotes'
import { resolverVocabulario, type Vocabulario } from '@/core/text/vocabulario'
import { UUID } from '@/core/text/uuid'
import { exigirSessao, type Sessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { exigirContaQueEscreve } from '@/server/services/planos'

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
  /**
   * O pacote da profissão (docs/101 §3.2, migration 0101): decide a barra, o botão central e o
   * vocabulário extra. Vem do mesmo join que traz o `vocab`, pelo mesmo motivo que o vocabulário
   * vem aqui: quase toda tela do painel precisa, e é uma palavra. Tenant sem profissão escolhida
   * (join nulo) resolve para `base`, que é o produto de hoje.
   */
  pacote: SlugDoPacote
  /**
   * O degrau que a pessoa PAGA (`tenants.plan`), como veio do banco: `normalizarPlano` mora em
   * `server/services/planos` e é quem traduz nomes antigos. E `settings.cortesia`, SÓ essa chave:
   * a faixa do painel (docs/87 §3.1) precisa dizer a data de fim em TODA tela, e uma ida extra ao
   * banco por tela é o que o `docs/28` passou um mês desfazendo. Extrair uma chave de jsonb não
   * muda o argumento acima contra trazer `settings` inteiro.
   */
  plan: string
  cortesia: unknown
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
    .select('tenant_id, role, tenants(name, slug, timezone, vertical, vocab_override, plan, cortesia:settings->cortesia, professions(vocab, pacote))')
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
  plan: string
  cortesia: unknown
  professions: { vocab: unknown; pacote: string } | null
}

function dadosDoTenant(bruto: TenantBruto | null): DadosDoTenant {
  if (!bruto) throw new AppError('TENANT_MISMATCH')
  return {
    name: bruto.name,
    slug: bruto.slug,
    timezone: bruto.timezone,
    vertical: bruto.vertical,
    plan: bruto.plan,
    cortesia: bruto.cortesia,
    // `professions` vem `null` em tenant sem profissao escolhida; `resolverVocabulario` trata
    // ausencia como padrao, entao nao existe caminho em que a tela fique sem palavra.
    vocabulario: resolverVocabulario(bruto.professions?.vocab, bruto.vocab_override),
    // Mesma defesa do vocabulário: join nulo ou valor que o registro não conhece cai em `base`.
    pacote: normalizarPacote(bruto.professions?.pacote),
  }
}

/**
 * C5 (docs/87 D1): a conta pausada lê e exporta tudo, mas não cria nada novo. A trava mora AQUI,
 * na porta por onde toda rota autenticada passa, e não em cada rota: das 93 rotas que escrevem, só
 * 16 passavam por uma trava de plano. `core/billing/pausa.ts` diz, rota por rota, o que a pausa
 * recusa; rota que a tabela não conhece é recusada.
 *
 * Leitura (`GET`) nunca é recusada, e o painel monta o contexto com uma `Request` de `GET`, então
 * nenhuma tela quebra.
 */
function travaDaPausa(req: Request, ctx: Contexto): Contexto {
  exigirContaQueEscreve(req.method, new URL(req.url).pathname, ctx.tenant.plan, ctx.tenant.cortesia)
  return ctx
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
    return travaDaPausa(req, { sessao, tenantId: escolhido.tenant_id, papel: escolhido.role, tenant: dadosDoTenant(escolhido.tenants) })
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

  return travaDaPausa(req, { sessao, tenantId: unico.tenant_id, papel: unico.role, tenant: dadosDoTenant(unico.tenants) })
}

/**
 * `contextoAtual` para toda `page.tsx` sob `/admin` — a versão que NÃO deixa `FORBIDDEN`
 * (conta sem estabelecimento) virar erro na tela.
 *
 * **Por que isto precisava existir, e não bastava o conserto de `admin/layout.tsx` (16/09).** O
 * layout já trata o próprio `FORBIDDEN` e redireciona pro `/onboarding` — mas cada `page.tsx`
 * chama `contextoAtual` de NOVO (a mesma consulta, via `cache()` do React, mas o resultado é
 * tratado ponto a ponto por cada arquivo). Em navegação client-side, o Next.js App Router pode
 * buscar/renderizar o segmento da PÁGINA sem re-executar o LAYOUT que o navegador já tem montado
 * — a página então lançava `FORBIDDEN` sem ninguém tratando, e caía no `admin/error.tsx`. Medido
 * em produção: 1 ocorrência em `/admin/config`, NO DEPLOY que já tinha o conserto do layout
 * (`docs/DECISOES.md`, 16/09). Não era mais o trap de 12 dias — `admin/error.tsx` tem saída real
 * ("Ir para Hoje", navegação de página inteira, força o layout a rodar de novo) — mas era uma
 * tela de erro confusa a mais, evitável.
 *
 * **Por que só `FORBIDDEN` sai daqui, e todo o resto sobe igual antes.** `TENANT_MISMATCH`
 * (cookie de tenant inválido) e a validação de "escolha um estabelecimento" (múltiplos vínculos)
 * não têm nada a ver com onboarding incompleto — redirecionar essas pra `/onboarding` mandaria
 * gente com conta completa pra tela errada. Qualquer erro que não seja `FORBIDDEN` é relançado
 * (`throw erro`), pro `admin/error.tsx` continuar cobrindo rede caída, banco fora do ar, etc. —
 * exatamente como cobria antes desta função existir.
 */
export async function contextoDoPainel(req: Request): Promise<Contexto> {
  return contextoAtual(req).catch((erro: unknown) => {
    if (erro instanceof AppError && erro.code === 'FORBIDDEN') redirect('/onboarding')
    throw erro
  })
}
