import { headers } from 'next/headers'
import Link from 'next/link'

import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { servicoPadraoDaBase } from '@/core/cycle/servico-padrao-da-base'
import { listarServicos } from '@/server/services/servicos'

import FormularioQuemJaAtendo from './formulario'
import PageHeader from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Quem você já atende' }

/**
 * A porta da base para quem NÃO tem planilha — que é a maioria do público do produto — e também a
 * manutenção de quem já está na ficha e voltou de novo.
 *
 * O caminho da importação (`/admin/clientes/importar`) resolve quem já mantém a clientela num CSV.
 * Barbeiro, manicure e depiladora têm a base nos contatos do celular e na memória: para essas
 * pessoas o Motor de Ciclo nascia vazio e ficava vazio por meses, esperando cada cliente voltar duas
 * ou três vezes.
 *
 * A busca de "já é sua cliente" (dentro de `FormularioQuemJaAtendo`) é o que sustenta o salão que
 * continua operando noutro sistema e usa o CICLO só como camada de recuperação: sem ela, o Motor
 * nascia uma vez com o cadastro inicial e nunca mais era alimentado, porque marcar "voltou" exigia
 * reabrir a ficha inteira ou lançar um atendimento de verdade na agenda.
 *
 * Só os serviços com `cycle_days > 0` aparecem: serviço sem ritmo declarado não tem de quanto em
 * quanto tempo prever, e oferecê-lo aqui produziria um ciclo sem sentido.
 */
export default async function PaginaQuemJaAtendo() {
  const ctx = await contextoDoPainel(new Request('https://interno/clientes/ja-atendo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  // As três leituras são independentes: juntas, uma ida de rede em vez de três em série.
  const [servicos, recentes, clientes] = await Promise.all([
    listarServicos(db, ctx.tenantId),
    // Os 1000 atendimentos mais recentes bastam para saber qual serviço é o grosso da casa — é um
    // padrão de formulário, não um relatório. Sem histórico, cai no ritmo do meio.
    db
      .from('appointments')
      .select('service_id')
      .eq('tenant_id', ctx.tenantId)
      // Só atendimento feito: cancelado, falta e horário futuro não dizem qual é o grosso da casa.
      .eq('status', 'done')
      .order('starts_at', { ascending: false })
      .limit(1000),
    db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId).is('deleted_at', null),
  ])

  // Falha de leitura aqui só piora o PADRÃO do formulário (volta a ser o do meio, e a busca aparece),
  // nunca impede trazer a base — por isso não derruba a tela.
  const atendimentos = new Map<string, number>()
  for (const a of recentes.data ?? []) atendimentos.set(a.service_id, (atendimentos.get(a.service_id) ?? 0) + 1)
  const temClientes = clientes.error ? true : (clientes.count ?? 0) > 0

  const comRitmo = servicos
    .filter((s) => (s.cycle_days ?? 0) > 0)
    .map((s) => ({ id: s.id, nome: s.name, cycleDays: s.cycle_days as number }))
  const servicoPadrao = servicoPadraoDaBase(comRitmo.map((s) => ({ id: s.id, cycleDays: s.cycleDays, atendimentos: atendimentos.get(s.id) ?? 0 })))

  return (
    <>
      <PageHeader
        titulo="Quem você já atende"
        descricao={
          temClientes
            ? 'Busque quem já tem ficha e voltou, ou escreva o nome de quem é novo. Não precisa ser exato na data.'
            : 'Escreva o nome de quem você atende e mais ou menos quando veio pela última vez. Não precisa ser exato.'
        }
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
          <FormularioQuemJaAtendo servicos={comRitmo} servicoPadrao={servicoPadrao} temClientes={temClientes} />
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
