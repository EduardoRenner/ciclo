import { Cake, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

import { verificarLimite } from '@/core/billing/planos'
import AlertBanner from '@/components/ui/alert-banner'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarClientes } from '@/server/services/clientes'
import { contextoDePlano } from '@/server/services/planos'
import { painelDaCarteira } from '@/server/services/crm'

import ListaClientes from './lista'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Clientes" }

export default async function PaginaClientes() {
  const ctx = await contextoAtual(new Request('https://interno/clientes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [clientes, painel, plano] = await Promise.all([
    listarClientes(db, ctx.tenantId),
    painelDaCarteira(db, ctx.tenantId),
    contextoDePlano(db, ctx.tenantId),
  ])

  /*
   * §L.1: cliente é limite SUAVE. Avisa e deixa passar — travar cadastro no meio de um
   * atendimento é o jeito mais rápido de o salão largar o sistema, e a regra 5.1 (nunca prender
   * dado) já garante que estourar não esconde nem apaga ninguém.
   *
   * `aAdicionar: 0` porque a pergunta aqui é "como está hoje?", não "posso criar mais um?".
   */
  const limiteClientes = verificarLimite(plano, 'clientes', painel.total, 0)
  const acimaDoTeto = limiteClientes.limite !== null && painel.total > limiteClientes.limite

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

      {/*
        O aviso de teto vem ANTES dos atalhos de carteira: é informação sobre a conta, não sobre o
        dia. Aparece só a partir de 80% do teto (`perto`) — antes disso é ruído, e um contador
        permanente de "42/50" no alto da tela de clientes transforma trabalho normal em ansiedade.

        Nada aqui usa urgência inventada nem prazo (§5.10). O texto do caso "acima do teto" diz
        explicitamente que nada foi bloqueado, porque é verdade e porque é a dúvida real de quem lê.
      */}
      {limiteClientes.perto && limiteClientes.limite !== null ? (
        <Link href="/precos" className="mb-4 block transition active:scale-[.99]">
          <AlertBanner
            tom={acimaDoTeto ? 'warn' : 'acento'}
            acao={<span className={acimaDoTeto ? 'text-warn' : 'text-acc-2'}>Ver planos</span>}
          >
            {acimaDoTeto ? (
              <>
                Você tem <span className="font-semibold">{painel.total}</span> clientes, acima dos{' '}
                {limiteClientes.limite} do plano atual. <span className="font-semibold">Nada foi bloqueado</span> —
                cadastrar continua funcionando e nenhuma ficha some.
              </>
            ) : (
              <>
                <span className="font-semibold">{painel.total}</span> de {limiteClientes.limite} clientes do plano
                atual.
              </>
            )}
          </AlertBanner>
        </Link>
      ) : null}

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
