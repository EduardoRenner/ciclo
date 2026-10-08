import { Briefcase, Lock, Plus } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import Badge from '@/components/ui/badge'
import BloqueioPlano from '@/components/ui/bloqueio-plano'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { hojeNoFuso } from '@/core/advocacia/datas'
import { ROTULO_DO_ESTADO_DO_CASO, seloDoEstado } from '@/core/advocacia/resumo-do-caso'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { listarCasos } from '@/server/advocacia/consulta-casos'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Casos' }

/**
 * docs/101 T2.6: a lista de casos do pacote Advocacia, ordenada pelo que aperta primeiro (o "Próximo
 * passo" atrasado sobe). Caso sigiloso fora do alcance não aparece; aparece só a CONTAGEM ("1 caso
 * restrito"), nunca o título (anexo 04 §5).
 *
 * Tenant de outro pacote recebe 404, e não a tela vazia: para um salão esta rota não existe.
 */
export default async function PaginaCasos({ searchParams }: { searchParams: Promise<{ ver?: string; meus?: string }> }) {
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/casos', { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()

  const db = await criarClienteDoUsuario()
  // O plano é consultado ANTES do formulário (guarda `toda-rota-travada-tem-tela-que-avisa`).
  const plano = await contextoDePlano(db, ctx.tenantId)
  const veredito = podeUsarModulo(plano, 'legal_cases')
  if (veredito.estado === 'bloqueado_pelo_plano' && veredito.precisaDo !== 'gratis') {
    return (
      <BloqueioPlano
        nativo={ehRequisicaoDoAppNativo(hdrs.get('user-agent'))}
        precisaDo={veredito.precisaDo}
        acao="organizar os casos do escritório"
        alternativa={<Link href="/admin/clientes">Ver os clientes</Link>}
      />
    )
  }

  const filtro = await searchParams
  const encerrados = filtro.ver === 'encerrados'
  const meus = filtro.meus === '1'
  const hoje = hojeNoFuso(ctx.tenant.timezone, new Date())
  const { casos: todos, restritos } = await listarCasos(db, ctx.tenantId, { encerrados, hoje })

  let meuProfissional: string | null = null
  if (meus) {
    const p = await db.from('professionals').select('id').eq('tenant_id', ctx.tenantId).eq('user_id', ctx.sessao.userId).maybeSingle()
    meuProfissional = p.data?.id ?? null
  }
  const casos = meus ? todos.filter((c) => c.responsavelId !== null && c.responsavelId === meuProfissional) : todos
  const atrasados = casos.filter((c) => c.proximo?.atrasado).length

  const link = (q: { ver?: string; meus?: boolean }) => {
    const p = new URLSearchParams()
    if (q.ver) p.set('ver', q.ver)
    if (q.meus) p.set('meus', '1')
    const s = p.toString()
    return s ? `/admin/casos?${s}` : '/admin/casos'
  }
  const aba = (ativo: boolean) =>
    `inline-flex h-12 items-center rounded-[var(--radius-pill)] px-4 text-secundario font-semibold ${
      ativo ? 'bg-acc text-on-acc' : 'border border-line-2 bg-surface-2 text-txt-2'
    }`

  return (
    <>
      <PageHeader
        titulo="Casos"
        descricao={
          casos.length === 0
            ? 'Os casos do escritório, com prazos, pendências e documentos.'
            : `${casos.length} ${casos.length === 1 ? 'caso' : 'casos'}${encerrados ? ' encerrados' : ' em andamento'}${
                atrasados > 0 ? ` · ${atrasados} com o próximo passo atrasado` : ''
              }`
        }
        acao={
          <Link href="/admin/casos/novo" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc">
            <Plus aria-hidden className="size-5" />
            Novo caso
          </Link>
        }
      />

      <nav aria-label="Filtrar casos" className="mb-4 flex flex-wrap gap-2">
        <Link href={link({ meus })} aria-current={!encerrados ? 'page' : undefined} className={aba(!encerrados)}>
          Em andamento
        </Link>
        <Link href={link({ ver: 'encerrados', meus })} aria-current={encerrados ? 'page' : undefined} className={aba(encerrados)}>
          Encerrados
        </Link>
        <Link href={link({ ver: encerrados ? 'encerrados' : undefined, meus: !meus })} aria-pressed={meus} className={aba(meus)}>
          Só os meus
        </Link>
      </nav>

      {restritos > 0 ? (
        <p className="mb-3 inline-flex items-center gap-2 text-secundario text-txt-2">
          <Lock aria-hidden className="size-4" />
          {restritos === 1 ? '1 caso restrito à equipe dele' : `${restritos} casos restritos à equipe de cada um`}
        </p>
      ) : null}

      {casos.length === 0 ? (
        <EmptyState
          icone={<Briefcase className="size-7" />}
          titulo={encerrados ? 'Nenhum caso encerrado' : meus ? 'Nenhum caso com você como responsável' : 'Nenhum caso ainda'}
          descricao={encerrados ? 'Quando um caso for concluído ou arquivado, ele aparece aqui.' : 'Todo caso pertence a um cliente e já nasce com as pendências do modelo.'}
          acao={<Link href="/admin/casos/novo">Abrir um caso</Link>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {casos.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/casos/${c.id}`} className="block rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc">
                <Card pressionavel className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-corpo font-semibold">
                        {c.sigiloso ? <Lock aria-label="Sigiloso" className="size-4 shrink-0 text-txt-2" /> : null}
                        <span className="truncate">{c.titulo}</span>
                      </p>
                      <p className="text-secundario text-txt-2">
                        {c.clienteNome}
                        {c.responsavel ? ` · ${c.responsavel}` : ''}
                      </p>
                    </div>
                    <Badge estado={seloDoEstado(c.estado)} className="shrink-0 whitespace-nowrap">
                      {ROTULO_DO_ESTADO_DO_CASO[c.estado]}
                    </Badge>
                  </div>
                  {c.proximo ? (
                    <p className={`text-secundario ${c.proximo.atrasado ? 'text-bad' : 'text-txt'}`}>
                      <span className="font-semibold">Próximo passo: </span>
                      {c.proximo.texto}
                      {c.proximo.de === 'cliente' ? ' · do cliente' : ''}
                      {c.proximo.atrasado ? ' · atrasado' : ''}
                    </p>
                  ) : (
                    <p className="text-secundario text-txt-3">Nada pendente neste caso.</p>
                  )}
                  {c.pendenciasAbertas > 0 ? (
                    <p className="text-label text-txt-3">
                      {c.pendenciasAbertas} {c.pendenciasAbertas === 1 ? 'pendência aberta' : 'pendências abertas'}
                    </p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
