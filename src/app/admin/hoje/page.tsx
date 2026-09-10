import { ExternalLink } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Temporal } from '@js-temporal/polyfill'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'
import { centralDeAcoes } from '@/server/services/crm'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import CentralDeAcoes from './central-de-acoes'
import CompartilharSite from './compartilhar'
import Hoje from './hoje'

/** Saudação pelo horário do salão, não pelo do servidor (que roda em UTC na Vercel). */
function saudacao(timezone: string): string {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date()))
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export const metadata = { title: "Hoje" }

export default async function PaginaHoje() {
  const ctx = await contextoAtual(new Request('https://interno/hoje', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // Vem junto do `select` que revalida o membership — era uma ida de rede serial, e o
  // `timezone` decide o intervalo de tudo que vem depois (`docs/28` §8).
  const timezone = ctx.tenant.timezone
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())
  const desde = mesAtual.toPlainDate({ day: 1 }).toString()
  const ate = mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString()

  const [resumo, acoes, atribuicao, emRisco] = await Promise.all([
    resumoDeHoje(db, ctx.tenantId, timezone),
    /*
      Nunca derruba "Hoje": um resumo de CRM que falhar vira lista vazia, não erro na tela mais
      importante do app. **Mas registra**, e o `CLAUDE.md` é explícito sobre isso na tabela de
      armadilhas: *"o `catch` descarta alguma coisa? Então tem que contar e avisar"*. Sem a linha
      de log, a Central de Ações podia parar de aparecer para sempre — depois de uma mudança de
      schema, por exemplo — e o sintoma seria só uma tela um pouco mais vazia, que ninguém
      reporta.
    */
    centralDeAcoes(db, ctx.tenantId, ctx.papel).catch((erro: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', event: 'central_de_acoes_indisponivel' }), erro)
      return { titulo: '', acoes: [] }
    }),
    /*
      F1 (docs/25-ESTRATEGIA-E-EXECUCAO.md): em dia sem movimento, o herói mostra o que o Motor
      de Ciclo já trouxe este mês em vez de R$ 0,00. Mesmo cálculo de `/admin/recuperar`.

      Este `catch` merece atenção maior que o de cima, e o motivo é o `count: 0` que ele devolve:
      `deveMostrarHeroiDoMotor` só mostra o herói do Motor quando `atribuicaoCount > 0`. Ou seja,
      uma falha transitória aqui não degrada um pedaço lateral da tela — ela reverte exatamente a
      melhoria do F1 e faz a tela voltar a abrir com "R$ 0,00", que é o estado que o `docs/25`
      §2.2 identificou como o pior primeiro contato possível com o produto.

      Continua sem derrubar a tela, de propósito. O que muda é não ser mais silencioso: falha
      medida vira linha de log em vez de um zero com cara de número apurado.
    */
    receitaAtribuidaAoCiclo(db, ctx.tenantId, timezone, desde, ate).catch((erro: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', event: 'atribuicao_do_ciclo_indisponivel' }), erro)
      return { totalCents: 0, count: 0, items: [], mensagensNaJanela: 0 }
    }),
    /*
      A receita em risco AGORA — a manchete da tela quando ainda nao entrou dinheiro hoje e o Motor
      ainda nao tem atribuicao (`escolherHeroi`). Sai de `listarParaRecuperar`, que e a MESMA funcao
      que desenha `/admin/recuperar`: o numero da manchete e o numero da tela de destino tem que ser
      identicos, senao o toque parece levar a outro assunto.

      `limit: 1` porque aqui so interessam os agregados (`totalValueCents`, `count`), que a funcao
      calcula sobre a lista inteira antes de cortar.

      Mesmo `catch` das outras: falha vira zero e linha de log, nunca erro na tela mais importante
      do app. Zero aqui so faz a manchete cair para "Atendido hoje", que e o comportamento anterior.
    */
    listarParaRecuperar(db, ctx.tenantId, { limit: 1 }).catch((erro: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', event: 'receita_em_risco_indisponivel' }), erro)
      return { totalValueCents: 0, totalProfitCents: 0, count: 0, items: [] }
    }),
  ])

  const data = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: timezone,
  }).format(new Date())

  return (
    <>
      {/*
        O nome do salão era o título da tela — informação de peso zero (a pessoa
        sabe onde trabalha) ocupando o lugar mais nobre do app. O título passa a
        ser a saudação, que datava a tela e ancora o "agora"; o nome vira apoio,
        que ainda importa para quem gerencia mais de uma unidade.
      */}
      <PageHeader
        overline={data}
        titulo={saudacao(timezone)}
        descricao={ctx.tenant.name}
        acao={
          ctx.tenant.slug ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/${ctx.tenant.slug}`}
                target="_blank"
                className="flex h-12 items-center gap-1 text-label font-semibold text-acc-2 transition active:scale-[.97]"
              >
                Ver meu site
                <ExternalLink aria-hidden className="size-3.5" />
              </Link>
              <CompartilharSite slug={ctx.tenant.slug} nome={ctx.tenant.name} />
            </div>
          ) : null
        }
      />

      <Hoje resumo={resumo} atribuicao={atribuicao} emRisco={{ totalCents: emRisco.totalValueCents, count: emRisco.count }}>
        <CentralDeAcoes dados={acoes} />
      </Hoje>
    </>
  )
}
