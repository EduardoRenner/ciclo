import { headers } from 'next/headers'
import Link from 'next/link'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarServicos } from '@/server/services/servicos'

import FormularioQuemJaAtendo from './formulario'
import PageHeader from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Quem você já atende' }

/**
 * A porta da base para quem NÃO tem planilha — que é a maioria do público do produto.
 *
 * O caminho da importação (`/admin/clientes/importar`) resolve quem já mantém a clientela num CSV.
 * Barbeiro, manicure e depiladora têm a base nos contatos do celular e na memória: para essas
 * pessoas o Motor de Ciclo nascia vazio e ficava vazio por meses, esperando cada cliente voltar duas
 * ou três vezes.
 *
 * Só os serviços com `cycle_days > 0` aparecem: serviço sem ritmo declarado não tem de quanto em
 * quanto tempo prever, e oferecê-lo aqui produziria um ciclo sem sentido.
 */
export default async function PaginaQuemJaAtendo() {
  const ctx = await contextoAtual(new Request('https://interno/clientes/ja-atendo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const servicos = await listarServicos(db, ctx.tenantId)

  const comRitmo = servicos
    .filter((s) => (s.cycle_days ?? 0) > 0)
    .map((s) => ({ id: s.id, nome: s.name, cycleDays: s.cycle_days as number }))

  return (
    <>
      <PageHeader
        titulo="Quem você já atende"
        descricao="Escreva os nomes e diga mais ou menos quando cada pessoa veio pela última vez. Não precisa ser exato."
      />

      {comRitmo.length === 0 ? (
        <p className="text-corpo text-txt-2">
          Antes de trazer sua clientela, confira seus{' '}
          <Link href="/admin/config/servicos" className="font-semibold text-acc-2 underline underline-offset-2">
            serviços e preços
          </Link>
          . É deles que o CICLO tira de quanto em quanto tempo cada pessoa costuma voltar.
        </p>
      ) : (
        <>
          <FormularioQuemJaAtendo servicos={comRitmo} />
          {/*
            A outra porta, no rodapé e não no topo: quem tem planilha é a minoria, e oferecer as duas
            com o mesmo peso faria a maioria parar para escolher um caminho que não é dela.
          */}
          <p className="mt-6 text-secundario text-txt-3">
            Já tem tudo numa planilha?{' '}
            <Link href="/admin/clientes/importar" className="font-semibold text-txt-2 underline underline-offset-2">
              Importe de um arquivo CSV
            </Link>
            .
          </p>
        </>
      )}
    </>
  )
}
