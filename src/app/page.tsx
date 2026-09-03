import { ArrowRight, CalendarCheck, Link2, Wallet } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { NOME_DO_PLANO, precoDoPlano } from '@/core/billing/planos'
import IconeAnel from '@/components/ui/icone-anel'

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
 *
 * Página **estática** de propósito: nenhuma leitura de `cookies()`/sessão aqui. Quem já está
 * logado é redirecionado para `/admin/hoje` pelo `middleware.ts`, que já resolve a sessão em
 * toda requisição de qualquer forma — perguntar de novo aqui dentro é o que marcava esta rota
 * como dinâmica (`ƒ`) e tirava do CDN a única página cujo trabalho é convencer um visitante
 * anônimo (`docs/21-AUDITORIA-FALHA-SILENCIOSA.md` §5.2). Não reintroduza `sessaoAtual()`/
 * `redirect()` aqui sem mover a checagem de volta para o middleware junto.
 */
export const metadata: Metadata = {
  title: 'CICLO · a agenda que avisa quem parou de voltar',
  description:
    'Agenda, site de agendamento e caixa para quem atende com hora marcada. O CICLO calcula de quanto em quanto tempo cada cliente volta, mostra quem atrasou e te dá a mensagem pronta para chamar.',
  openGraph: {
    title: 'CICLO · a agenda que avisa quem parou de voltar',
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
      'O CICLO calcula o ritmo de cada pessoa (quem volta a cada 21 dias, quem volta a cada dois meses) e mostra quem passou do ponto. Com uma estimativa de quanto vale chamar cada uma (o preço do serviço vezes a chance de ela voltar) e o texto pronto para chamar no WhatsApp.',
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
    texto: 'Cada atendimento concluído alimenta o ciclo daquela pessoa, e é assim que o sistema sabe quem está para voltar.',
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

export default function Home() {
  const botaoPrimario =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo ' +
    'font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]'
  const botaoSecundario =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 ' +
    'px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]'

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
      <header className="flex items-center justify-between gap-3 py-5">
        {/* `priority` herdado do lockup do herói, que saiu: agora esta é a única marca da dobra. */}
        <Image src={wordmark} alt="CICLO" priority className="h-7 w-auto" />
        {/*
          O header desta página tem UM link, e a razão é de conversão, não de gosto (`docs/38` §3).
          Havia dois competindo com o CTA primário na dobra, e um deles ("Preços") aponta para uma
          página que esta mesma dobra já resume, com o número na tela. Todo link de header é uma
          saída, e na única página cujo trabalho é converter, saída é vazamento.

          `/precos` continua a um toque: na linha de preço da dobra, no fecho e no rodapé. A
          informação não saiu; o vazamento saiu. Nas outras telas públicas o header fica como está
          — em `/termos` e `/privacidade` a pessoa lê contrato, não decide compra, e ali o link de
          preço é serviço (L-7 do `docs/31` colocou os dois de propósito).
        */}
        <nav className="flex items-center">
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
          Aqui havia um segundo lockup da marca, justificado como "a declaração de marca que abre o
          argumento da página". Medido a 375 px em 2026-09-03, o resultado era outro: os dois
          logotipos ficavam a **70 px um do outro** (o do header em y=30, este em y=128), ambos na
          primeira dobra, mesmo desenho e mesma cor, um pouco maior que o outro. Não lia como
          ênfase, lia como repetição acidental — e empurrava o argumento da página para baixo.

          Quem abre a página agora é a manchete, que é o que produto maduro faz: a marca fica na
          navegação, o argumento fica no `h1`. O logo do `<header>` continua sendo a âncora de
          marca, igual em todas as telas.
        */}
        <h1 className="text-numero font-bold sm:text-[2.75rem] sm:leading-[1.05] sm:tracking-[-0.02em]">
          A lista de quem devia ter voltado e não voltou.
        </h1>
        {/*
          `docs/20-COPY-PLANO.md` §D.3, variante C — recomendada e até agora não implementada. Não
          é escrita nova: é a PROMOÇÃO da melhor linha que a página já tinha, enterrada no rodapé da
          seção "Feito para". Resolve o alcance (§4.1: a copy nomeava 8 profissões das 17 do
          catálogo, e nenhuma das 8 tem ritmo recorrente) na posição de maior atenção, sem listar
          profissão — que é o que o painel de leitores vetou no §7.4: 17 chips na dobra leem como
          "serve para tudo", e o barbeiro do painel rejeita isso.

          O tricolon que estava aqui ("Em português, feito para o celular, sem treinamento") saiu
          inteiro pelo §D.3: as três informações são verdadeiras e irrelevantes — nenhuma é motivo
          para escolher o CICLO em vez de outro. Migraram para a FAQ, onde são objeção respondida
          em vez de argumento de venda.
        */}
        <p className="mt-4 max-w-[46ch] text-corpo text-txt-2">
          Para qualquer trabalho que dependa de cliente que volta.
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

          Era um link só, sublinhado, ocupando a linha inteira: medido a 375 px, a frase quebrava
          em QUATRO pedaços de 13,5 px, sublinhados, logo abaixo de dois botões de 48 px. A
          informação comercial mais importante da página estava no tratamento tipográfico menos
          importante dela, e sublinhado de duas linhas lê como nota de rodapé, não como preço.

          Agora a frase é texto e só "Ver os planos" é link. O preço ganha o peso da fonte em vez
          de ganhar sublinhado, que é como se destaca número, e o alvo de toque fica no que é
          clicável de fato.
        */}
        <p className="mt-4 text-secundario text-txt-2">
          Grátis para começar. <span className="font-semibold text-txt">{precoDoPlano('essencial')} por mês</span> para
          ir além.{' '}
          <Link href="/precos" className="toque-48 inline-flex font-semibold text-acc-2 underline-offset-4 hover:underline">
            Ver os planos
          </Link>
        </p>

        {/*
          A PEÇA QUE FALTAVA NA PÁGINA, e a única deste redesenho que o `docs/20` não tinha
          previsto. Pesquisa de 2026-09-03 (`docs/38` §2.1): quase toda página de SaaS de alta
          conversão mostra o produto, ou o resultado dele, dentro do primeiro scroll — um print
          real do painel converte melhor que ilustração, porque a pessoa quer ver o que vai assinar
          antes de ler lista de recurso.

          A home descrevia o Motor de Ciclo em prosa e nunca o mostrava. Era o maior buraco de
          conversão da página.

          **Por que isto NÃO viola o §5.10, e a distinção não é semântica.** O `docs/20` §D.4.1 já
          a cravou: demonstração mostra o que o software FAZ; prova social afirma que outra pessoa
          COMPROU. Isto é o primeiro. Os nomes são de exemplo, os números são de exemplo, e a
          legenda diz isso em texto — não em letra miúda. O §D.5 var C exige exatamente esse
          enquadramento para o número: *"ilustração de layout, não afirmação"*.

          Feito em HTML e CSS, sem imagem, de propósito: público 100% celular, e a pesquisa que
          recomenda vídeo/GIF na dobra não paga o custo de latência num produto cujo plano de
          performance (`docs/28`) existe porque o clique já demorava.

          O que a tela mostra é o que `/admin/recuperar` mostra de verdade: quem passou do ponto,
          há quantos dias, e a estimativa de quanto vale chamar. A ordem das colunas é a mesma.
        */}
        <figure className="mt-8 rounded-[var(--radius)] border border-line bg-surface p-4 shadow-elevado sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
              Passaram do ponto de voltar
            </p>
          </div>

          <div className="mt-3 flex items-end gap-5">
            <div>
              <p className="tabular text-numero font-bold leading-none text-txt">23</p>
              <p className="mt-1 text-label text-txt-3">pessoas</p>
            </div>
            <div>
              <p className="tabular text-titulo font-bold leading-none text-acc-2">R$ 1.840</p>
              {/*
                "Estimativa" fica no rótulo, não num asterisco: é a mesma palavra que a tela
                interna usa ("Estimativa, não promessa"), e o §D.5 var C manda mostrar a origem do
                número junto com ele.
              */}
              <p className="mt-1 text-label text-txt-3">estimativa de retorno</p>
            </div>
          </div>

          <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-[var(--radius-sm)] bg-line">
            {[
              { nome: 'Fernanda M.', atraso: '24 dias', valor: 'R$ 90' },
              { nome: 'Juliana R.', atraso: '18 dias', valor: 'R$ 45' },
              { nome: 'Camila S.', atraso: '15 dias', valor: 'R$ 70' },
            ].map((p) => (
              <li key={p.nome} className="flex items-center gap-3 bg-surface-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-secundario font-semibold text-txt">{p.nome}</span>
                <span className="tabular shrink-0 text-label text-txt-3">{p.atraso}</span>
                <span className="tabular shrink-0 text-secundario font-semibold text-txt-2">{p.valor}</span>
              </li>
            ))}
          </ul>

          <figcaption className="mt-3 text-label text-txt-3">
            Exemplo de como a tela fica. Os nomes e os valores são inventados; a conta é a que o
            CICLO faz com os seus atendimentos.
          </figcaption>
        </figure>
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

      {/*
        Termos e privacidade no rodapé da porta de entrada (L-7, `docs/31`): quem vai assinar
        procura os dois aqui antes de criar conta, e o produto processa dado de saúde — política
        que existe mas ninguém acha não cumpre a função que a LGPD pede.
      */}
      <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-10 text-center text-label text-txt-3">
        <Link href="/precos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Preços
        </Link>
        <span aria-hidden>·</span>
        <Link href="/termos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Termos
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacidade" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Privacidade
        </Link>
        <span className="w-full sm:w-auto">
          <span className="mx-2 hidden sm:inline" aria-hidden>
            ·
          </span>
          CICLO · para quem atende com hora marcada
        </span>
      </footer>
    </main>
  )
}
