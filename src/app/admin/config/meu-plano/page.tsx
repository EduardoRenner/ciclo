import { ArrowRight, Check, Lock, Minus, Share2 } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

import { textoDeParaQueIndicar, textoDoConviteDoCiclo } from '@/core/billing/convite-do-ciclo'
import { lerAssinatura } from '@/core/billing/mercado-pago'
import { NOME_DO_PLANO, ORDEM_DOS_PLANOS, precoDoPlanoPorMes, verificarLimite } from '@/core/billing/planos'
import { comMaiuscula, plural } from '@/core/text/vocabulario'
import { APP_URL } from '@/lib/app-url'
import { linkWhatsAppCompartilhar } from '@/lib/mensagens'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import StatTile from '@/components/ui/stat-tile'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { assuntoDeMudarDePlano, canalDeContato, textoDeMudarDePlano } from '@/lib/contato'
import { CARTOES } from '@/lib/planos-cartoes'
import { contextoDePlano } from '@/server/services/planos'

import AssinarPlano from './assinar-plano'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição. */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Meu plano' }

/**
 * docs/18-MONETIZACAO-PLANO.md Fase M — a tela "Meu plano".
 *
 * Mora em `/admin/config/meu-plano` e **não** em `/admin/config/planos`, que já existe e significa
 * "Fidelidade e assinatura": o salão vendendo plano mensal para a CLIENTE dele. É a mesma colisão
 * que a regra 5.6 do prompt de monetização manda evitar em nome de tabela, e ela vale igual para
 * o espaço de URL — duas telas chamadas "planos" com significados opostos é armadilha para quem
 * chegar depois.
 *
 * `docs/57` PR 1.3 — a cobrança passou a existir. Quando `MERCADOPAGO_ACCESS_TOKEN` está
 * configurado (`cobrancaAutomatica`), cada degrau acima ganha um botão "Assinar" que abre o
 * checkout do Mercado Pago; o webhook (`/api/v1/webhooks/mercado-pago`) grava `tenants.plan` quando
 * o pagamento é autorizado. Sem a credencial, a tela mantém o link de WhatsApp — a regra 5.4
 * continua valendo: não fingir que a integração existe onde ela não está ligada.
 *
 * O que ainda NÃO tem: botão "cancelar" (a Fase K pede o mesmo custo de assinar — hoje é o link do
 * painel do MP), e "próxima cobrança" (o MP tem, mas não vale um GET por render).
 */

function textoDeTeto(limite: number | null, usado: number): string {
  if (limite === null) return `${usado} · sem limite`
  return `${usado} de ${limite}`
}

export default async function PaginaMeuPlano() {
  const ctx = await contextoAtual(new Request('https://interno/meu-plano', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [plano, profissionais, clientes, tenantRow] = await Promise.all([
    contextoDePlano(db, ctx.tenantId),
    db
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('active', true)
      .is('deleted_at', null),
    db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId).is('deleted_at', null),
    db.from('tenants').select('settings').eq('id', ctx.tenantId).single(),
  ])

  const cobrancaAutomatica = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)
  const assinatura = lerAssinatura(tenantRow.data?.settings)

  const usoProf = profissionais.count ?? 0
  const usoCli = clientes.count ?? 0

  // `aAdicionar: 0` — a pergunta aqui é "como está hoje", não "cabe mais um".
  const limProf = verificarLimite(plano, 'profissionais', usoProf, 0)
  const limCli = verificarLimite(plano, 'clientes', usoCli, 0)

  const atual = plano.plano
  const indiceAtual = ORDEM_DOS_PLANOS.indexOf(atual)
  const acima = ORDEM_DOS_PLANOS.slice(indiceAtual + 1)

  // A porta que faltava. Enquanto não há cobrança automática, mudar de plano é uma conversa — e
  // até 2026-09-03 esta tela mandava "falar com a gente" sem oferecer com quem. Ver `lib/contato.ts`.
  const canal = canalDeContato(assuntoDeMudarDePlano(NOME_DO_PLANO[atual]))

  return (
    <>
      <PageHeader titulo="Meu plano" descricao={`Você está no ${NOME_DO_PLANO[atual]}.`} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-corpo font-semibold text-txt">{NOME_DO_PLANO[atual]}</p>
          <p className="tabular text-stat font-bold text-txt">{precoDoPlanoPorMes(atual)}</p>
        </div>
        {/*
          A frase mais importante da tela, e a que responde a pergunta que a pessoa realmente tem
          quando abre "Meu plano" num produto que ainda não cobra. Dizer isso em texto simples é
          mais honesto — e menos assustador — que um botão de cobrança que não funciona.
        */}
        <p className="mt-2 text-secundario text-txt-2">{textoDeMudarDePlano(atual === 'gratis', canal !== null)}</p>
        {canal ? (
          <a
            href={canal.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
          >
            {canal.rotulo}
            <ArrowRight aria-hidden className="size-4" />
          </a>
        ) : null}
      </Card>

      {assinatura?.status === 'paused' ? (
        <Card className="mb-5 flex gap-3 border-warn">
          <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-warn" />
          <p className="text-secundario text-txt-2">
            <span className="font-semibold text-txt">Seu pagamento não passou.</span>{' '}
            {assinatura.graca_ate
              ? `Você continua no ${NOME_DO_PLANO[atual]} até ${new Date(assinatura.graca_ate).toLocaleDateString('pt-BR')}. Depois disso, cai para o Grátis — sem perder nada, só limitando o que dá para criar.`
              : `O Mercado Pago está tentando de novo. Se não resolver, o plano cai para o Grátis.`}
          </p>
        </Card>
      ) : null}

      <SectionHeader>O que você está usando</SectionHeader>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatTile
          rotulo="Profissionais"
          valor={textoDeTeto(limProf.limite, usoProf)}
          {...(limProf.limite !== null ? { progresso: usoProf / limProf.limite } : {})}
          apoio={
            limProf.limite !== null && usoProf > limProf.limite ? (
              <span className="text-warn">Acima do teto, e nada foi removido</span>
            ) : null
          }
        />
        <StatTile
          rotulo={comMaiuscula(plural(ctx.tenant.vocabulario.cliente))}
          valor={textoDeTeto(limCli.limite, usoCli)}
          {...(limCli.limite !== null ? { progresso: usoCli / limCli.limite } : {})}
          apoio={
            limCli.limite !== null && usoCli > limCli.limite ? (
              <span className="text-warn">Acima do teto, e cadastrar continua liberado</span>
            ) : null
          }
        />
      </div>

      {/*
        A promessa que mais importa e que nunca tem exceção (regra 5.1 do plano, decidida no
        09-PLATAFORMA §13). Fica na tela do plano de propósito: é aqui que a dúvida "se eu parar de
        pagar, perco tudo?" aparece.
      */}
      <Card className="mb-6 flex gap-3">
        <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-acc-2" />
        <p className="text-secundario text-txt-2">
          <span className="font-semibold text-txt">Seu dado nunca fica preso.</span> Cair de plano limita o que dá para
          fazer. Nunca esconde nem apaga cliente, histórico ou agendamento. Se você passar de um teto, o que existe
          continua à vista; o que trava é criar mais.
        </p>
      </Card>

      {acima.length > 0 ? (
        <>
          <SectionHeader>Se precisar de mais</SectionHeader>
          <div className="flex flex-col gap-3">
            {acima.map((tier) => (
              <Card key={tier}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-corpo font-semibold text-txt">{NOME_DO_PLANO[tier]}</p>
                  <p className="tabular text-corpo font-bold text-txt">{precoDoPlanoPorMes(tier)}</p>
                </div>
                {/*
                  A MESMA lista da página pública de preço. O que ela leu antes de pagar e o que
                  vê aqui dentro precisam ser a mesma frase — e, de quebra, esta tela herda o
                  teste que impede a página de preço de prometer o que o código não libera.
                */}
                <ul className="mt-3 flex flex-col gap-1.5">
                  {(CARTOES.find((c) => c.tier === tier)?.inclui ?? []).map((item) => (
                    <li key={item.texto} className="flex gap-2 text-secundario text-txt-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
                      <span>{item.texto}</span>
                    </li>
                  ))}
                </ul>
                {/*
                  Cada degrau leva o próprio pedido, com o nome do plano já escrito na mensagem.
                  Sem isto a seção era um folheto: listava o que o assinante ganharia e não dava
                  como pedir. O botão nomeia o plano em vez de dizer "fazer upgrade" — quem toca
                  aqui já escolheu, e o texto que sai no WhatsApp poupa a pessoa de explicar.
                */}
                {cobrancaAutomatica ? (
                  <AssinarPlano tier={tier} />
                ) : (
                  (() => {
                    const pedido = canalDeContato(
                      `Oi! Uso o CICLO no ${NOME_DO_PLANO[atual]} e quero passar para o ${NOME_DO_PLANO[tier]}.`,
                    )
                    return pedido ? (
                      <a
                        href={pedido.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
                      >
                        Quero o {NOME_DO_PLANO[tier]}
                        <ArrowRight aria-hidden className="size-4" />
                      </a>
                    ) : null
                  })()
                )}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="flex gap-3">
          <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-txt-3" />
          <p className="text-secundario text-txt-2">
            Você já está no plano mais completo. Não há mais nada para liberar.
          </p>
        </Card>
      )}

      {/*
        `docs/30-INDICACAO-PLANO.md` §3: o laço B2C (a cliente do salão indica outra cliente) está
        de ponta a ponta desde 30/08. O B2B — o dono indicar outro dono — não tinha NADA, e a trava
        de "≥ 20 pagantes" do `docs/18` Fase H nunca justificou isso: ela protege a RECOMPENSA
        (crédito, proração, antifraude), não o convite. Ver `core/billing/convite-do-ciclo.ts`.

        Mora nesta tela, e não no Hoje, porque aqui é "Sua conta no CICLO" — o único lugar do
        produto que fala do CICLO como fornecedor dele. No Hoje disputaria espaço com o herói do
        Motor de Ciclo, que é o trabalho dele, não o nosso.
      */}
      <SectionHeader>Indicar o CICLO</SectionHeader>
      <Card className="mb-6">
        <p className="text-secundario text-txt-2">{textoDeParaQueIndicar()}</p>
        <a
          href={linkWhatsAppCompartilhar(
            textoDoConviteDoCiclo({ nomeDoNegocio: ctx.tenant.name ?? '', url: APP_URL }),
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
        >
          <Share2 aria-hidden className="size-4" />
          Mandar para um colega
        </a>
      </Card>

      <p className="py-8 text-center text-label text-txt-3">
        <Link href="/precos" className="toque-48 -mx-2 px-2 font-semibold text-acc-2 underline underline-offset-2">
          Ver a tabela de preços completa
        </Link>
      </p>
    </>
  )
}
