import { ArrowRight, CalendarCheck, Link2, Wallet } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { NOME_DO_PLANO, precoDoPlano } from '@/core/billing/planos'
import IconeAnel from '@/components/ui/icone-anel'
import { sessaoAtual } from '@/server/auth/session'

import wordmark from '../../public/marca/ciclo-wordmark-aqua.png'

import type { Metadata } from 'next'

/**
 * A porta de entrada do produto era um splash: marca, uma frase e dois botões.
 * Quem chegasse sem saber o que é o CICLO não tinha como descobrir — nenhuma
 * explicação, nenhum exemplo, nenhuma resposta às perguntas que todo mundo faz
 * antes de criar conta. Esta página é a única do projeto cujo trabalho é
 * convencer; o resto do produto só serve quem já entrou.
 *
 * O preço APARECE aqui, e isso inverteu a decisão antiga desta página ("sem
 * preço de propósito, porque os planos ainda eram decisão comercial em aberto").
 * A decisão saiu no `docs/18-MONETIZACAO-PLANO.md` (Fases D/E/M): preço visível
 * sem cadastro, porque quatro dos treze concorrentes pesquisados escondem os
 * degraus atrás de "fale com um consultor", e num público que lê isso como "vai
 * ser caro" a transparência custa uma linha e compra confiança.
 *
 * O que NÃO mudou, e continua valendo pelo motivo original: sem depoimento, sem
 * logotipo de cliente, sem contador de usuários. Prova social só quando for
 * verdade (`docs/17-MONETIZACAO-PROMPT.md` §5.10), e hoje o número seria pequeno
 * o bastante para a frase depor contra o produto.
 *
 * O que esta página pode e não pode prometer está medido em
 * `docs/20-COPY-PLANO.md` §A.4, e guardado por
 * `tests/unit/design/home-nao-promete-demais.test.ts` — que existe porque estas
 * quatro promessas entraram aqui uma por rodada, cada uma soando bem, e ficaram.
 */
export const metadata: Metadata = {
  title: 'CICLO — a agenda que avisa quem parou de voltar',
  description:
    'Agenda, site de agendamento e caixa para quem atende com hora marcada. O CICLO calcula de quanto em quanto tempo cada cliente volta, mostra quem atrasou e te dá a mensagem pronta para chamar.',
  openGraph: {
    title: 'CICLO — a agenda que avisa quem parou de voltar',
    description: 'Para barbearia, unhas, cílios, sobrancelha, depilação e estética. Feito para o celular, em português.',
    type: 'website',
    locale: 'pt_BR',
  },
}

const RECURSOS = [
  {
    icone: IconeAnel,
    titulo: 'Quem sumiu tem nome',
    texto:
      'O CICLO calcula o ritmo de cada pessoa — quem volta a cada 21 dias, quem volta a cada dois meses — e mostra quem passou do ponto. Com uma estimativa de quanto vale chamar cada uma (o preço do serviço vezes a chance de ela voltar) e o texto pronto para chamar no WhatsApp.',
  },
  {
    icone: Link2,
    titulo: 'Sua página de agendamento',
    texto:
      'Um link para colar na bio do Instagram. Quem for marcar escolhe serviço, profissional e horário sem precisar falar com você, e o horário já entra na sua agenda sem risco de marcar dois no mesmo lugar.',
  },
  {
    icone: Wallet,
    titulo: 'O dia fechado sem calculadora',
    texto:
      `Quanto entrou e quanto sobrou, com o extrato de cada profissional. Por dia e por mês. A partir do plano ${NOME_DO_PLANO.essencial}.`,
  },
]

const PASSOS = [
  {
    titulo: 'Crie a conta e diga o que você faz',
    texto: 'O catálogo da sua profissão já vem pronto: serviços, duração e preço sugerido. Você ajusta o que quiser.',
  },
  {
    titulo: 'Compartilhe seu link',
    texto: 'Sua página fica no ar na hora, com seus serviços, horário de funcionamento e contato.',
  },
  {
    titulo: 'Atenda. O resto o CICLO acompanha',
    texto: 'Cada atendimento concluído alimenta o ciclo daquela pessoa — e é assim que o sistema sabe quem está para voltar.',
  },
]

const PROFISSOES = [
  'Barbearia',
  'Unhas',
  'Cílios',
  'Sobrancelha',
  'Depilação',
  'Estética',
  'Cabelo',
  'Tatuagem',
]

const PERGUNTAS = [
  {
    pergunta: 'Preciso instalar alguma coisa?',
    resposta:
      'Não. Abre no navegador do celular e funciona. Se quiser, dá para adicionar à tela de início e ele passa a abrir como aplicativo, em tela cheia.',
  },
  {
    pergunta: 'E se eu já tiver minha lista de clientes?',
    resposta: 'Dá para importar de uma planilha. Nome e telefone bastam; o histórico vai sendo construído a partir dos atendimentos.',
  },
  {
    pergunta: 'Quem vai marcar precisa baixar app ou criar conta?',
    resposta: 'Não. A pessoa abre seu link, escolhe o serviço e o horário, e o agendamento entra na sua agenda esperando você confirmar.',
  },
  {
    pergunta: 'Funciona para quem trabalha por conta?',
    resposta:
      'Funciona, e é para quem trabalha por conta que ele mais serve: você não tem alguém olhando a agenda por você para lembrar de quem sumiu.',
  },
]

export default async function Home() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  const botaoPrimario =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo ' +
    'font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]'
  const botaoSecundario =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 ' +
    'px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]'

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
      <header className="flex items-center justify-between gap-3 py-5">
        <Image src={wordmark} alt="CICLO" className="h-7 w-auto" />
        <nav className="flex items-center gap-1">
          <Link
            href="/precos"
            className="flex h-12 items-center px-2 text-corpo font-semibold text-txt-2 transition active:scale-[.97]"
          >
            Preços
          </Link>
          <Link
            href="/entrar"
            className="flex h-12 items-center px-1 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
          >
            Entrar
          </Link>
        </nav>
      </header>

      <section className="animate-in py-10 fade-in slide-in-from-bottom-4 duration-500 sm:py-16">
        {/*
          O lockup completo (símbolo + "Ciclo" escrito) abre a página — é o único
          momento da landing em que a marca aparece sozinha, sem navegação nem
          rótulo ao redor, então ganha destaque cheio. O logo pequeno do
          `<header>` acima continua sendo a referência utilitária de navegação;
          este é a declaração de marca que abre o argumento da página.
        */}
        <Image src={wordmark} alt="CICLO" priority className="mb-6 h-11 w-auto sm:h-12" />
        <h1 className="text-numero font-bold sm:text-[2.75rem] sm:leading-[1.05] sm:tracking-[-0.02em]">
          A agenda que sabe quando cada cliente volta — e traz de volta quem sumiu.
        </h1>
        <p className="mt-4 max-w-[52ch] text-corpo text-txt-2">
          Para quem atende com hora marcada: barbearia, unhas, cílios, sobrancelha, depilação, estética. Em português,
          feito para o celular, sem treinamento.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/cadastro" className={botaoPrimario}>
            Criar minha conta
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          {/*
            O exemplo é a prova: em vez de descrever a página, mostra uma
            funcionando de verdade. É o argumento mais forte que o produto tem e
            ficava escondido atrás do cadastro.

            Duas palavras que NÃO podem voltar aqui (docs/20-COPY-PLANO.md §D.4):
            "salão", porque fecha num botão a porta que o resto da página abre para
            as outras 9 das 17 profissões do catálogo; e o nome do tenant de demo,
            porque `scripts/seed-demo-barbearia.mjs` o descreve como "tenant
            fictício" — apresentá-lo como cliente de exemplo seria exatamente a
            prova social inventada que o 17 §5.10 proíbe. "De exemplo" é o que
            mantém a frase honesta.
          */}
          <Link href="/dom-rocha" className={botaoSecundario}>
            Ver uma página de exemplo
          </Link>
        </div>
        {/*
          O preço aparece já na primeira dobra, em texto, sem precisar de clique. É o oposto do
          que quatro dos treze concorrentes pesquisados fazem, e é de graça fazer diferente.
        */}
        <div className="mt-4">
          <Link href="/precos" className="toque-48 inline-block text-secundario font-semibold text-acc-2 underline underline-offset-4">
            Grátis para começar, {precoDoPlano('essencial')} por mês para ir além — ver os planos
          </Link>
        </div>
      </section>

      <section className="py-8">
        <h2 className="mb-5 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">O que muda no seu dia</h2>
        <div className="flex flex-col gap-3">
          {RECURSOS.map((r) => {
            const Icone = r.icone
            return (
              <article key={r.titulo} className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-elevado">
                <div className="mb-3 flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-acc-soft text-acc-2">
                  <Icone aria-hidden className="size-5" />
                </div>
                <h3 className="text-corpo font-semibold text-txt">{r.titulo}</h3>
                <p className="mt-1.5 text-secundario text-txt-2">{r.texto}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="py-8">
        <h2 className="mb-5 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Como começa</h2>
        <ol className="flex flex-col gap-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3">
              <span
                aria-hidden
                className="tabular grid size-7 shrink-0 place-items-center rounded-[var(--radius-pill)] bg-surface-3 text-label font-bold text-txt-2"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-corpo font-semibold text-txt">{p.titulo}</h3>
                <p className="mt-0.5 text-secundario text-txt-2">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-8">
        <h2 className="mb-4 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Feito para</h2>
        <ul className="flex flex-wrap gap-2">
          {PROFISSOES.map((p) => (
            <li
              key={p}
              className="rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 py-1.5 text-secundario text-txt-2"
            >
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-secundario text-txt-3">E qualquer trabalho que dependa de hora marcada e de cliente que volta.</p>
      </section>

      <section className="py-8">
        <h2 className="mb-5 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Perguntas</h2>
        <div className="flex flex-col gap-2">
          {PERGUNTAS.map((p) => (
            <details key={p.pergunta} className="group rounded-[var(--radius)] border border-line bg-surface px-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-corpo font-semibold text-txt">
                {p.pergunta}
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-txt-3 transition-transform duration-[var(--dur-1)] group-open:rotate-90"
                />
              </summary>
              <p className="pb-4 text-secundario text-txt-2">{p.resposta}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-line bg-surface p-6 text-center shadow-elevado">
        <CalendarCheck aria-hidden className="mx-auto mb-3 size-8 text-acc-2" />
        <h2 className="text-titulo font-bold">Comece pela sua agenda de amanhã</h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-secundario text-txt-2">
          Criar a conta é de graça, e o catálogo da sua profissão já vem preenchido.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/cadastro" className={botaoPrimario}>
            Criar minha conta
          </Link>
          <Link href="/entrar" className={botaoSecundario}>
            Já tenho conta
          </Link>
        </div>
      </section>

      <footer className="pt-10 text-center text-label text-txt-3">
        <Link href="/precos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Preços
        </Link>
        <span className="mx-2" aria-hidden>
          ·
        </span>
        CICLO · para quem atende com hora marcada
      </footer>
    </main>
  )
}
