import { Cake, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

import AlertBanner from '@/components/ui/alert-banner'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarClientes } from '@/server/services/clientes'
import { painelDaCarteira } from '@/server/services/crm'

import ListaClientes from './lista'

export const dynamic = 'force-dynamic'

export default async function PaginaClientes() {
  const ctx = await contextoAtual(new Request('https://interno/clientes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [clientes, painel] = await Promise.all([listarClientes(db, ctx.tenantId), painelDaCarteira(db, ctx.tenantId)])

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao={`${painel.total} na carteira${
          painel.novosNoMes > 0
            ? ` · ${painel.novosNoMes} ${painel.novosNoMes === 1 ? 'cadastro' : 'cadastros'} esse mês`
            : ''
        }`}
        acao={
          /* Antes só existia caminho para cadastrar quando a lista estava vazia — com um cliente
             que fosse, o botão sumia e não havia mais como registrar ninguém pela tela. */
          <Link
            href="/admin/clientes/nova"
            aria-label="Cadastrar cliente"
            className="grid size-12 place-items-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.94]"
          >
            <UserPlus className="size-5" />
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile rotulo="Ticket médio" valor={dinheiro.format(painel.ticketMedioCents / 100)} />
        <StatTile
          rotulo="Voltam de novo"
          valor={`${Math.round(painel.taxaRetornoBps / 100)}%`}
          progresso={painel.taxaRetornoBps / 10_000}
        />
      </div>

      {/* Atalhos acionáveis: número que não leva a lugar nenhum não muda o dia de ninguém. */}
      {(painel.emRisco > 0 || painel.aniversariantes > 0) && (
        <div className="mb-5 grid gap-2">
          {painel.emRisco > 0 ? (
            <Link href="/admin/recuperar" className="block transition active:scale-[.99]">
              <AlertBanner tom="warn" acao={<span className="text-warn">Recuperar</span>}>
                <span className="font-semibold">{painel.emRisco}</span>{' '}
                {painel.emRisco === 1 ? 'cliente está sumindo' : 'clientes estão sumindo'}
              </AlertBanner>
            </Link>
          ) : null}
          {painel.aniversariantes > 0 ? (
            <Card className="flex items-center gap-3">
              <Cake className="size-5 shrink-0 text-acc-2" />
              <p className="flex-1 text-corpo">
                <span className="font-semibold">{painel.aniversariantes}</span>{' '}
                {painel.aniversariantes === 1 ? 'faz aniversário' : 'fazem aniversário'} esse mês
              </p>
            </Card>
          ) : null}
        </div>
      )}

      <ListaClientes iniciais={clientes} />
    </>
  )
}
