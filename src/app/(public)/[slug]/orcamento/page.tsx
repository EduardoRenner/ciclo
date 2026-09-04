import { notFound } from 'next/navigation'

import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { perfilPublico } from '@/server/services/public-booking'

import PedidoDeOrcamento from './pedido'

import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  if (!perfil) return {}
  return {
    title: `Pedir orçamento · ${perfil.name}`,
    description: `Conte o que você precisa e ${perfil.name} responde com um orçamento.`,
  }
}

/**
 * Fase 2 do `docs/40`. A fase 1 fez o serviço dizer "Sob orçamento" na vitrine, e a pessoa tocava
 * no card sem ter por onde pedir um: `/orcamento/[token]` só exibe orçamento que já existe.
 *
 * A rota **não existe** quando o salão não tem serviço sob orçamento — `notFound()` em vez de um
 * formulário que ninguém do outro lado espera receber. Uma barbearia de tabela fechada não deve ter
 * essa porta, e oferecer uma que o dono nunca vai atender é a mesma classe de promessa vazia que a
 * regra do canal de mensagem proíbe.
 */
export default async function PaginaDePedido({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  if (!perfil) notFound()

  const sobOrcamento = perfil.services.filter((s) => s.pricingModel === 'quote')
  if (sobOrcamento.length === 0) notFound()

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-[18px] py-8">
      <header className="mb-6">
        <h1 className="text-titulo font-bold">Pedir orçamento</h1>
        <p className="mt-1 text-corpo text-txt-2">{perfil.name}</p>
      </header>

      {/* Mesmo aviso do agendamento: dá para pedir orçamento numa barbearia que não existe. */}
      {ehDemonstracao(slug) ? (
        <p
          role="status"
          className="mb-6 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-secundario text-txt-2"
        >
          <strong className="font-semibold text-txt">Página de exemplo do CICLO.</strong> Este estabelecimento não existe e
          nenhum pedido enviado aqui será respondido.
        </p>
      ) : null}

      <PedidoDeOrcamento
        slug={slug}
        nomeDoSalao={perfil.name}
        whatsapp={perfil.whatsapp}
        servicos={sobOrcamento.map((s) => ({ id: s.id, name: s.name }))}
        vocabulario={perfil.vocabulario}
      />
    </main>
  )
}
