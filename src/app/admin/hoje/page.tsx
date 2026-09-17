import { ExternalLink } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { after } from 'next/server'
import { Temporal } from '@js-temporal/polyfill'

import PageHeader from '@/components/ui/page-header'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'
import { centralDeAcoes } from '@/server/services/crm'
import { registrarPrimeiraOcorrencia } from '@/server/services/product-events'
import { prestacaoDeContasDoMotor } from '@/server/services/previsao'
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
  const hdrs = await headers()
  const ctx = await contextoAtual(new Request('https://interno/hoje', { headers: hdrs }))
  const db = await criarClienteDoUsuario()
  // T1.5 (docs/64 §0.2): a Central de Ações pode sugerir "plano-perto-do-teto", que aponta pra
  // /precos — dentro do app nativo isso não pode virar link. Ver central-de-acoes.tsx.
  const nativo = ehRequisicaoDoAppNativo(hdrs.get('user-agent'))

  // Vem junto do `select` que revalida o membership — era uma ida de rede serial, e o
  // `timezone` decide o intervalo de tudo que vem depois (`docs/28` §8).
  const timezone = ctx.tenant.timezone
  const mesAtual = Temporal.PlainYearMonth.from(Temporal.Now.zonedDateTimeISO(timezone).toPlainDate())
  const desde = mesAtual.toPlainDate({ day: 1 }).toString()
  const ate = mesAtual.toPlainDate({ day: mesAtual.daysInMonth }).toString()

  const hoje = Temporal.Now.zonedDateTimeISO(timezone).toPlainDate().toString()

  const [resumo, acoes, atribuicao, emRisco, prestacaoDeContas] = await Promise.all([
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
    // docs/45 §1.4: a manchete, não a explicação (essa mora em /admin/recuperar). Mesmo `catch`
    // das outras chamadas — sem amostra suficiente `acertoBps` já vem `null` e o teaser não
    // desenha nada, então uma falha aqui é indistinguível de "ainda sem histórico" para quem olha.
    prestacaoDeContasDoMotor(db, ctx.tenantId, hoje).catch((erro: unknown) => {
      console.warn(JSON.stringify({ level: 'warn', event: 'prestacao_de_contas_indisponivel' }), erro)
      return { conferidas: 0, acertos: 0, acertoBps: null, emAberto: 0, detalhe: { voltouAntes: 0, voltouNaJanela: 0, voltouDepois: 0, naoVoltou: 0 }, erroMedianoDias: null }
    }),
  ])

  // G-05a (docs/60): o segundo evento do funil mínimo — o momento em que o Motor de Ciclo mostra,
  // pela primeira vez, que trouxe dinheiro de volta para este tenant. `registrarPrimeiraOcorrencia`
  // nunca lança e não bloqueia a tela; falha aqui vira log, não erro na tela mais importante do app.
  //
  // `after()`, não `await`: até 2026-09-13 isto era um `await` de verdade — uma ida de rede a mais
  // (SELECT em `product_events`) DEPOIS do `Promise.all` de cima, no caminho crítico de TODA
  // visita a "Hoje" em qualquer tenant que o Motor já tenha trazido dinheiro de volta (a maioria
  // dos ativos). O comentário já prometia "não bloqueia a tela" — só o código não cumpria.
  // `after()` roda depois da resposta ser enviada: a pessoa vê a tela, o evento grava por trás.
  if (atribuicao.count > 0) {
    const contagem = atribuicao.count
    after(() => registrarPrimeiraOcorrencia(db, ctx.tenantId, 'motor_viu_valor', { count: contagem }))
  }

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

      <Hoje
        resumo={resumo}
        atribuicao={atribuicao}
        emRisco={{ totalCents: emRisco.totalValueCents, count: emRisco.count }}
        site={ctx.tenant.slug ? { slug: ctx.tenant.slug, nome: ctx.tenant.name } : null}
        prestacaoDeContas={prestacaoDeContas}
      >
        <CentralDeAcoes dados={acoes} nativo={nativo} />
      </Hoje>
    </>
  )
}
