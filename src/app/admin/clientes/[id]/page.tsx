import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { podeUsarModulo } from '@/core/billing/planos'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { fichaDoCliente } from '@/server/services/crm'
import { lerConfigFidelidade, listarPlanos } from '@/server/services/fidelidade'
import { gerarTokenIndicacao } from '@/server/services/indicacao'
import { listarModelos } from '@/server/services/mensagens-prontas'
import { contextoDePlano } from '@/server/services/planos'
import { listarProfissionais } from '@/server/services/profissionais'
import { listarServicos } from '@/server/services/servicos'

import Ficha from './ficha'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Cliente" }

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/clientes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [ficha, modelos, negocio, planos, profissionais, servicos, plano] = await Promise.all([
    fichaDoCliente(db, ctx.tenantId, id, ctx.tenant.timezone, {
      // `docs/48` §4.6: o lucro por cliente é dado sensível dentro do salão, e a ficha é aberta
      // por quem atende. Mesma porta do caixa e da comanda.
      podeVerLucro: avaliarPermissao(ctx.papel, 'report:read') !== null,
      /*
        Unidade 10. O rótulo do alerta de saúde ("Alergia a látex") é dado de saúde, e a rota
        `/vault` o protege com permissão + AAL2 + trilha. Esta tela servia o MESMO rótulo com
        nenhuma das três, para qualquer papel com `client:read` — recepção inclusive.

        `vault:own` e não `vault:read` porque é a permissão que a tabela do `rbac` realmente
        concede: `owner` alcança pelo curinga, `professional` pelo literal, e `manager`,
        `reception` e `finance` não têm nada de `vault:` — que é a lista certa.

        O SINAL (`temAlerta`) continua para todo mundo: é o que faz a recepção avisar quem atende.
      */
      podeLerCofre: avaliarPermissao(ctx.papel, 'vault:own') !== null,
    }).catch((erro: unknown) => {
      if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
      throw erro
    }),
    listarModelos(db, ctx.tenantId),
    db.from('tenants').select('name, slug, vertical, settings').eq('id', ctx.tenantId).single(),
    listarPlanos(db, ctx.tenantId),
    listarProfissionais(db, ctx.tenantId),
    listarServicos(db, ctx.tenantId),
    contextoDePlano(db, ctx.tenantId),
  ])

  if (!ficha) notFound()

  /**
   * I-5, `docs/30-INDICACAO-PLANO.md` §6.2c: o link é gerado sempre (é HMAC puro, não bate no
   * banco) — só depende de haver `slug`, que todo tenant tem. Quem decide se o botão funciona é
   * a tela, pelo telefone da cliente (§6.4).
   */
  const linkIndicacao = negocio.data?.slug
    ? `${process.env.NEXT_PUBLIC_APP_URL}/${negocio.data.slug}/agendar?ind=${gerarTokenIndicacao(id)}`
    : null

  return (
    <Ficha
      ficha={ficha}
      timezone={ctx.tenant.timezone}
      modelos={modelos.filter((m) => m.active)}
      nomeDoNegocio={negocio.data?.name ?? ''}
      vertical={negocio.data?.vertical ?? 'barber'}
      planos={planos.filter((p) => p.active)}
      profissionais={profissionais.map((p) => ({ id: p.id, name: p.display_name }))}
      configFidelidade={lerConfigFidelidade(negocio.data?.settings)}
      podeApagarCliente={avaliarPermissao(ctx.papel, 'client:delete') !== null}
      // A MESMA permissão que a rota exige. Duas fontes da mesma verdade seria pior que uma só:
      // a tela some para quem a rota recusaria, em vez de oferecer e falhar no clique.
      podeExportarCliente={avaliarPermissao(ctx.papel, 'client:export') !== null}
      podeLancarPacote={avaliarPermissao(ctx.papel, 'comanda:own') !== null}
      servicos={servicos.map((s) => ({ id: s.id, name: s.name, priceCents: s.price_cents }))}
      linkIndicacao={linkIndicacao}
      // I-9, `docs/30-INDICACAO-PLANO.md` §5.3 gatilho 2: o valor entregue primeiro (a lista de
      // quem ela trouxe já apareceu), a automação oferecida depois. Só faz sentido se o degrau
      // atual não tem `loyalty` — quem já tem não precisa ver a mesma frase de novo.
      mostrarPaywallFidelidade={podeUsarModulo(plano, 'loyalty').estado !== 'liberado'}
      // "Criar orçamento" mandava para um formulário que `POST /api/v1/quotes` recusa sem o módulo
      // `quotes` (Essencial). Aqui a trava é no botão, e não um `BloqueioPlano`: a ficha é uma tela
      // de trabalho com muita coisa acontecendo, e a oferta cheia é a da tela de Orçamentos.
      podeOrcamento={podeUsarModulo(plano, 'quotes').estado === 'liberado'}
    />
  )
}
