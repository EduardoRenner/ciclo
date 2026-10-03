import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { NOME_DO_PLANO, PLANOS, custoPorAtendimento, precoDoPlano } from '@/core/billing/planos'
import { PRELANCAMENTO, ofertaDoCadastro } from '@/core/billing/prelancamento'

import { canalDeContato } from '@/lib/contato'
import { CARTOES } from '@/lib/planos-cartoes'

import wordmark from '../../../../public/marca/ciclo-wordmark-aqua.png'
import wordmarkClaro from '../../../../public/marca/ciclo-wordmark-aqua-claro.png'

import type { Metadata } from 'next'

/**
 * docs/18-MONETIZACAO-PLANO.md — Fases D, E e M.
 *
 * A landing (`/`) dizia "sem preço de propósito: os planos são decisão comercial do Eduardo".
 * A decisão saiu, e esta é a página que a materializa.
 *
 * Preço VISÍVEL SEM CADASTRO é decisão de produto, não de marketing: dos treze concorrentes
 * pesquisados, quatro escondem os degraus de cima atrás de "fale com um consultor". Num público
 * que lê isso como "vai ser caro", transparência custa uma página e compra confiança.
 *
 * O que esta página NÃO faz, e é deliberado (§5.10 do prompt de monetização):
 *   - não diz "mais escolhido" nem "N profissionais já usam" — hoje seriam três, e prova social
 *     inventada é mentira que este público descobre conversando entre si;
 *   - não tem contador regressivo, "só hoje" nem escassez de nenhum tipo;
 *   - não usa confirmshaming em lugar nenhum;
 *   - não promete assinatura automática, porque ela não existe (regra 5.4: não fingir que
 *     integração de pagamento está pronta). Todo mundo começa no grátis e a mudança de degrau é
 *     combinada direto — está escrito na página, sem eufemismo.
 *
 * O destaque visual do Equipe é ancoragem por posição, que é legítima: continua funcionando
 * mesmo que a pessoa saiba exatamente como funciona.
 */
/**
 * ISR: o HTML e igual para todo visitante e so muda em deploy (copy institucional, preco de tabela).
 * `revalidate` da a esta rota um `s-maxage` real na borda do Vercel -- sem ele o prerender ainda
 * revalida na origem a cada request (`age: 0`, TTFB de centenas de ms). Uma hora e conservador;
 * mudanca de preco entra por deploy de qualquer forma.
 */
export const revalidate = 3600

/**
 * `generateMetadata` e não `export const metadata`: a chamada depende da DATA de hoje (`ofertaDoCadastro`),
 * e uma constante no topo do módulo é calculada uma vez por instância. Numa instância quente ela
 * continuaria dizendo "60 dias" depois de o número deixar de ser verdade (docs/87 §3.2).
 */
export async function generateMetadata(): Promise<Metadata> {
  const oferta = ofertaDoCadastro(new Date())
  return {
    // Sem "CICLO" no título: o `template` do layout raiz já anexa "· CICLO", e repetir cancelaria
    // o template — há teste de design que guarda exatamente isso.
    title: 'Preços',
    description: `${oferta.chamada}. Depois, dois planos: ${NOME_DO_PLANO.essencial} a ${precoDoPlano('essencial')} por mês e ${NOME_DO_PLANO.equipe} a ${precoDoPlano('equipe')}, com o produto inteiro nos dois.`,
    openGraph: {
      title: 'Preços · CICLO',
      description: `${oferta.chamada}. Dois planos, com preço na tela e sem letra miúda.`,
      type: 'website',
      locale: 'pt_BR',
    },
  }
}

/*
  A conversa é o único caminho de pagamento que existe hoje, e até 2026-09-03 esta página mandava
  "falar com a gente" sem dizer com quem. `lib/contato.ts` guarda o porquê e os dois estados.
*/
const CANAL = canalDeContato('Oi! Vi os planos do CICLO e quero falar sobre assinar.')

/**
 * As perguntas de dinheiro. Função, e não constante: a primeira resposta depende de o Mercado Pago
 * estar ligado (`MERCADOPAGO_ACCESS_TOKEN`) e várias carregam números do programa (`PRELANCAMENTO`)
 * que não podem ser datilografados aqui.
 *
 * Sem "grátis para sempre": o Grátis deixou de ser vendido (docs/87 D1, D2). Quem chega agora tem
 * dias de uso completo sem cartão e depois escolhe um plano; se não escolher, a conta pausa, e a
 * pausa não apaga nada.
 */
function perguntas(cobrancaLigada: boolean) {
  return [
    {
      pergunta: 'Como eu pago?',
      resposta: cobrancaLigada
        ? 'Pelo Mercado Pago, com um toque em Meu plano, dentro do app. Nada é cobrado antes de você escolher um plano, e cancelar leva um toque, no mesmo lugar.'
        : CANAL
          ? 'Conversando. A cobrança automática ainda não está no ar, e preferimos dizer isso a montar um botão que não funciona. Você usa tudo sem pagar, e quando quiser assinar a gente combina direto e ajusta na hora. O botão no fim desta página abre a conversa.'
          : 'A cobrança automática ainda não está no ar, e preferimos dizer isso a montar um botão que não funciona. Você usa tudo sem pagar; a assinatura é combinada caso a caso.',
    },
    {
      pergunta: 'O que acontece quando acabam os dias grátis?',
      resposta: `Nada é cobrado: não pedimos cartão para começar, então não existe cobrança surpresa. Você tem ${PRELANCAMENTO.diasDeGraca} dias a mais com tudo funcionando, e depois a conta pausa: você vê e exporta tudo, mas não cria nada novo, por até ${PRELANCAMENTO.diasDePausa} dias. Escolher um plano reativa na hora.`,
    },
    {
      pergunta: 'Se eu parar de pagar, perco meus clientes?',
      resposta:
        'Nunca. Sua base, seu histórico e sua agenda continuam inteiros e à vista. O que trava é criar mais, não ver o que já existe. Essa regra não tem exceção.',
    },
    {
      pergunta: 'Tenho três profissionais. Qual plano?',
      resposta: `O ${NOME_DO_PLANO.equipe}, que vale até ${PLANOS.equipe.maxProfissionais} profissionais. O ${NOME_DO_PLANO.essencial} é para ${PLANOS.essencial.maxProfissionais}. Os dois têm o produto inteiro; o que muda é o tamanho da equipe. Acima de ${PLANOS.equipe.maxProfissionais}, o plano é combinado à parte.`,
    },
    {
      pergunta: 'Posso cancelar quando quiser?',
      resposta: cobrancaLigada
        ? 'Pode, com um toque em Meu plano, sem multa e sem fidelidade. Nos primeiros 7 dias o valor volta integral, como manda o Código de Defesa do Consumidor.'
        : 'Pode, e cancelar custa os mesmos toques que assinar: os dois são uma conversa, porque a cobrança automática ainda não está no ar. Nos primeiros 7 dias o valor volta integral, como manda o Código de Defesa do Consumidor.',
    },
    {
      pergunta: 'Vocês aumentam o preço depois?',
      resposta:
        'Se um dia aumentar, avisamos com 30 dias de antecedência e quem já é cliente fica no preço antigo por 12 meses.',
    },
    /*
      `docs/53` B-01. Sem citar concorrente e sem número de terceiro — mesma régua do parágrafo da
      vitrine acima, e pelo mesmo motivo: número alheio envelhece na mão dele. O argumento aqui é de
      ESTRUTURA (quem ganha da taxa não pode te mostrar o que ela custa), não uma estatística — por
      isso não precisa de fonte nem data, e não fica desatualizado. Só entra em produção porque a
      conta que ele descreve (`/admin/mes`, TICKET A-01) já existe: prometer o que a tela de hoje não
      mostra é exatamente o que o `docs/50` §5.6 e o `docs/51` §5.4 proíbem.
    */
    {
      pergunta: 'Vocês ganham alguma coisa da minha maquininha?',
      resposta:
        'Não, nada. O CICLO não processa pagamento e não fica com nenhuma parte do que você recebe. Por isso o app pode te dizer, sem conflito de interesse, quanto a taxa da maquininha levou do seu mês; quem vive dessa taxa não pode.',
    },
  ]
}

/** Ids dos dois `<symbol>` da lista de planos — a definição e cada `<use>` leem daqui. */
const ID_INCLUI = 'precos-inclui'
const ID_NAO_INCLUI = 'precos-nao-inclui'

export default function Precos() {
  const oferta = ofertaDoCadastro(new Date())
  const cobrancaLigada = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)
  const botaoPrimario =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo ' +
    'font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]'
  const botaoSecundario =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 ' +
    'bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]'

  return (
    // `data-theme="light"` (2026-09-21) — mesmo conserto de `app/page.tsx`/`tela-publica.tsx`. Ver
    // `tema-alcanca-o-body.test.ts` para o porquê do `color`/`background` explícitos no wrapper.
    <div data-theme="light" style={{ '--tabbar-h': '0px', '--sidebar-w': '0px', color: 'var(--txt)', background: 'var(--bg)' } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
      <header className="flex items-center justify-between gap-3 py-5">
        <Link href="/" className="toque-48 flex items-center">
          <Image src={wordmark} alt="CICLO" sizes="70px" className="marca-no-escuro h-7 w-auto" />
          <Image src={wordmarkClaro} alt="" aria-hidden sizes="70px" className="marca-no-claro h-7 w-auto" />
        </Link>
        <Link
          href="/entrar"
          className="flex h-12 items-center px-1 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
        >
          Entrar
        </Link>
      </header>

      <section className="py-8 sm:py-12">
        {/*
          docs/87 §3.2: o H1 diz o que a pessoa ganha ao criar a conta HOJE, e `ofertaDoCadastro` é a
          mesma função que concede a cortesia no cadastro, então o texto e o que ela recebe não têm
          como divergir. O número (60) só é dito enquanto for verdade; depois vira a data.

          Sem contador regressivo, sem "só hoje" e sem escassez: a data de fim é fixa e real, e é dita
          uma vez. A frase que a antecedia ("o grátis já mostra quem parou de voltar") era a razão de
          o Grátis existir; agora a razão é a mesma, com dias contados: o Motor de Ciclo inteiro, com a
          base da própria pessoa, antes de qualquer cobrança.
        */}
        <h1 className="text-numero font-bold sm:text-[2.25rem] sm:leading-[1.1]">
          {oferta.chamada[0]?.toUpperCase()}
          {oferta.chamada.slice(1)}. Depois, dois planos.
        </h1>
        <p className="mt-4 max-w-[52ch] text-corpo text-txt-2">
          Preço na tela, sem cadastro e sem &ldquo;fale com um consultor&rdquo;. Os dois planos têm o produto inteiro,
          com o Motor de Ciclo e tudo o que ele pede. O que muda é o tamanho da equipe: {NOME_DO_PLANO.essencial} para{' '}
          {PLANOS.essencial.maxProfissionais} profissional, {NOME_DO_PLANO.equipe} até {PLANOS.equipe.maxProfissionais}.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {/*
          Os dois ícones desta lista aparecem 24 vezes somadas — 19 `Check` e 5 `Minus` —, e o
          lucide inlina o SVG inteiro em cada uma. Medido no HTML de produção de `/precos`:
          7.161 B de 52.197, **14% da página só de ícone repetido**. Mesmo conserto das estrelas
          da página do salão: um `<symbol>` e 24 `<use>`.

          `fill="none"` fica em cada `<svg>` que usa, nunca no `<symbol>` — dentro do símbolo o
          atributo ganha da classe do elemento externo na cascata, e foi assim que a primeira
          versão daquele conserto renderizou 25 estrelas vazadas.
        */}
        <svg aria-hidden focusable="false" className="absolute size-0" width="0" height="0">
          <symbol id={ID_INCLUI} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </symbol>
          <symbol id={ID_NAO_INCLUI} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
          </symbol>
        </svg>

        {CARTOES.map((p) => (
          <article
            key={p.tier}
            className={
              'rounded-[var(--radius)] border bg-surface p-5 shadow-elevado ' +
              (p.destaque ? 'border-acc-2 ring-1 ring-acc-2' : 'border-line')
            }
          >
            {/*
              O destaque do Equipe era só um anel de cor. Quem enxerga via um cartão diferente e
              não sabia por quê; quem usa leitor de tela não via nada — `ring` não tem semântica, e
              a única diferença entre este cartão e os outros ficava invisível.

              O rótulo é em primeira pessoa de propósito. "Mais escolhido" e "N profissionais já
              usam" continuam proibidos (§5.10: prova social inventada é mentira que este público
              descobre conversando entre si); "nossa recomendação" é uma opinião de quem faz o
              produto, e opinião assumida é verdade verificável.
            */}
            {p.destaque ? (
              <p className="mb-3 inline-flex rounded-[var(--radius-pill)] bg-acc-soft px-2.5 py-1 text-label font-semibold text-acc-2">
                Nossa recomendação
              </p>
            ) : null}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-corpo font-semibold text-txt">{NOME_DO_PLANO[p.tier]}</h2>
              <p className="tabular text-numero font-bold text-txt">{precoDoPlano(p.tier)}</p>
            </div>
            <p className="mt-0.5 text-secundario text-txt-3">{p.chamada}</p>
            {p.porDia ? <p className="mt-1 text-label text-txt-3">{p.porDia}</p> : null}

            <p className="mt-4 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt-2">
              <span className="font-semibold text-txt">Para quem: </span>
              {p.paraQuem}
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {p.inclui.map((item) => (
                <li key={item.texto} className="flex gap-2 text-secundario text-txt-2">
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0 text-ok">
                    <use href={`#${ID_INCLUI}`} />
                  </svg>
                  <span>{item.texto}</span>
                </li>
              ))}
              {p.naoInclui?.map((item) => (
                <li key={item} className="flex gap-2 text-secundario text-txt-3">
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0">
                    <use href={`#${ID_NAO_INCLUI}`} />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/cadastro" className={`mt-5 ${p.destaque ? botaoPrimario : botaoSecundario}`}>
              Começar sem cartão
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </article>
        ))}
      </section>

      {/*
        Item C do `docs/43-POSICIONAMENTO-10X.md` — eixo 3, economia de escala.

        A tabela de planos responde "quanto custa". Ela não responde a pergunta que separa o CICLO
        do modelo dominante do nicho: **quanto custa quando eu crescer.** No preço fixo o custo por
        atendimento cai sozinho; numa comissão ele é constante por definição, então a conta do salão
        cresce junto com o sucesso dele. Esse argumento fica mais forte com o tempo sem ninguém
        escrever nada novo, e é o único eixo da pesquisa em que a vantagem é aritmética, não opinião.

        **Sem citar concorrente e sem número de terceiro.** A pesquisa do `43` tem as taxas
        medidas, mas publicar preço alheio numa página nossa é afirmação que envelhece na mão deles
        e que ninguém aqui pode reconferir depois. A conta abaixo usa só o nosso próprio preço, que
        sai de `core/billing/planos` — e a comparação é de ESTRUTURA, que não envelhece.

        O parágrafo final é o que faz a comparação ser honesta em vez de propaganda: quem cobra
        comissão entrega uma coisa que o CICLO não entrega. Dizer isso na nossa própria página de
        preço custa pouco e é a diferença entre argumento e omissão — e ainda deixa o veto do §5.2
        (nunca construir vitrine de tenants) visível para quem compra, não só para quem programa.
      */}
      <section className="py-10">
        <h2 className="text-titulo font-bold">O preço não sobe quando você cresce</h2>
        <p className="mt-3 max-w-[52ch] text-corpo text-txt-2">
          Existe plataforma de agendamento que fica com uma porcentagem do cliente novo que ela te manda. Faz
          sentido para quem cobra, e tem um efeito que só aparece depois: <strong className="font-semibold text-txt">quanto
          melhor o seu mês, maior a conta</strong>.
        </p>
        <p className="mt-3 max-w-[52ch] text-corpo text-txt-2">
          No CICLO o plano é fixo e não existe taxa por agendamento. Então o custo de cada atendimento cai sozinho
          conforme você atende mais:
        </p>

        <table className="mt-5 w-full border-collapse text-corpo">
          <caption className="sr-only">
            Custo por atendimento no plano {NOME_DO_PLANO.essencial}, conforme o número de atendimentos no mês
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 text-left text-label font-semibold uppercase tracking-[0.08em] text-txt-3">
                Atendimentos no mês
              </th>
              <th scope="col" className="py-2 text-right text-label font-semibold uppercase tracking-[0.08em] text-txt-3">
                Custo de cada um
              </th>
            </tr>
          </thead>
          <tbody>
            {[60, 150, 300].map((quantos) => (
              <tr key={quantos} className="border-b border-line">
                <th scope="row" className="py-3 text-left font-normal text-txt-2">{quantos}</th>
                <td className="py-3 text-right font-semibold tabular-nums text-txt">{custoPorAtendimento('essencial', quantos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-label text-txt-3">
          {NOME_DO_PLANO.essencial}, {precoDoPlano('essencial')} por mês, dividido pelos atendimentos do mês. Nada mais entra na conta.
        </p>

        <p className="mt-5 max-w-[52ch] text-secundario text-txt-2">
          A parte honesta: quem cobra comissão costuma cobrar sobre o cliente que a <em>própria plataforma</em> trouxe,
          de uma vitrine onde a sua clientela também vê os seus concorrentes. O CICLO não tem vitrine e não traz cliente
          de lugar nenhum &mdash; sua página é do seu negócio e só dele, e quem chega nela chegou por você. Se o que você
          procura é alugar a clientela de um marketplace, o CICLO não é isso.
        </p>
      </section>

      <section className="py-10">
        <h2 className="mb-4 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Perguntas de dinheiro</h2>
        <dl className="flex flex-col gap-4">
          {perguntas(cobrancaLigada).map((q) => (
            <div key={q.pergunta} className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-elevado">
              <dt className="text-corpo font-semibold text-txt">{q.pergunta}</dt>
              <dd className="mt-1.5 text-secundario text-txt-2">{q.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        Depois das perguntas de dinheiro, e não antes: quem chegou até aqui já leu o que queria
        saber, e é neste ponto que a dúvida vira "com quem eu falo". O botão fica secundário de
        propósito — o CTA da página continua sendo criar a conta sem cartão, nos cartões acima.
      */}
      {CANAL ? (
        <section className="rounded-[var(--radius)] border border-line bg-surface p-6 text-center shadow-elevado">
          <h2 className="text-titulo font-bold">Ficou alguma dúvida de dinheiro?</h2>
          <p className="mx-auto mt-2 max-w-[42ch] text-secundario text-txt-2">
            Fala com a gente antes de decidir. Quem responde é quem faz o CICLO, e não tem script.
          </p>
          <a
            href={CANAL.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`mx-auto mt-5 max-w-[20rem] ${botaoSecundario}`}
          >
            {CANAL.rotulo}
          </a>
        </section>
      ) : null}

      <p className="mt-8 text-center text-label text-txt-3">Preços em reais, por mês.</p>

      {/* L-7 (`docs/31`): quem está lendo preço é quem vai assinar — os termos e a política têm
          que estar a um toque daqui, não escondidos só na porta de entrada. */}
      <footer className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-label text-txt-3">
        <Link href="/termos" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
          Termos
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacidade" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
          Privacidade
        </Link>
        <span aria-hidden>·</span>
        <Link href="/" className="toque-48 -mx-2 px-2 font-semibold text-acc-2 underline underline-offset-2">
          Voltar para o início
        </Link>
      </footer>
      </main>
    </div>
  )
}
