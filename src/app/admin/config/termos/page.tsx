import { headers } from 'next/headers'
import Link from 'next/link'

import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { linhasDaTelaDeAceite } from '@/core/legal/aceite'
import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { aceitesPendentes } from '@/server/services/aceite-legal'

import AceitarVersaoNova from './aceitar'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Termos e privacidade' }

/**
 * docs/86 J8: onde o dono vê o que mudou nos termos e na política e aceita a versão nova. A conta
 * continua funcionando enquanto isso (minuta dos Termos, item 5): não é um muro.
 *
 * Só o dono aceita (`tenant:update`), a mesma permissão da rota. Quem não é dono vê o que mudou e uma
 * frase dizendo quem aceita, em vez de um botão que devolveria erro.
 */
export default async function PaginaDeTermos() {
  const ctx = await contextoDoPainel(new Request('https://interno/config/termos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const pendentes = await aceitesPendentes(db, ctx.tenantId)
  const podeAceitar = avaliarPermissao(ctx.papel, 'tenant:update') !== null
  const linhas = linhasDaTelaDeAceite(pendentes)

  return (
    <>
      <PageHeader
        titulo="Termos e privacidade"
        descricao={
          pendentes.length > 0
            ? 'Atualizamos o que está abaixo. Sua conta continua funcionando enquanto você lê.'
            : 'Você está em dia com as versões em vigor.'
        }
      />
      <div className="flex flex-col gap-3">
        {linhas.map((l) => (
          <Card key={l.documento}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-corpo font-semibold text-txt">{l.nome}</p>
              <p className="text-label text-txt-3">Versão de {l.dataDaVersao}</p>
            </div>
            <p className="mt-2 text-secundario text-txt-2">{l.resumo}</p>
            <p className="mt-2 text-secundario font-semibold text-txt">
              {l.pendente ? 'Falta aceitar esta versão.' : 'Você já aceitou esta versão.'}
            </p>
            <Link
              href={`/${l.documento}`}
              target="_blank"
              rel="noopener noreferrer"
              className="toque-48 -mx-2 mt-1 inline-flex items-center px-2 text-label font-semibold text-acc-2 underline underline-offset-2"
            >
              Ler {l.nome.toLowerCase()}
            </Link>
          </Card>
        ))}
      </div>
      {pendentes.length > 0 ? (
        podeAceitar ? (
          <AceitarVersaoNova />
        ) : (
          <Card className="mt-4">
            <p className="text-secundario text-txt-2">
              Quem aceita em nome do negócio é o dono da conta. Avise o dono para ler e aceitar.
            </p>
          </Card>
        )
      ) : null}
    </>
  )
}
