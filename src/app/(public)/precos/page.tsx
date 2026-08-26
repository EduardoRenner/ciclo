import { ArrowRight, Check, Minus } from 'lucide-react'
import Link from 'next/link'

import { NOME_DO_PLANO, PLANOS, precoDoPlano } from '@/core/billing/planos'

import { CARTOES } from '@/lib/planos-cartoes'
import MarcaCiclo from '@/components/ui/marca-ciclo'

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
export const metadata = {
  // Sem "CICLO" no título: o `template` do layout raiz já anexa "· CICLO", e repetir cancelaria
  // o template — há teste de design que guarda exatamente isso.
  title: 'Preços',
  description:
    `Comece de graça, para sempre. Planos a partir de ${precoDoPlano('essencial')} por mês para quem quer mandar mensagem para toda a base de uma vez, controlar caixa e trabalhar com equipe.`,
  openGraph: {
    title: 'Preços — CICLO',
    description: `Comece de graça. Planos a partir de ${precoDoPlano('essencial')} por mês, com preço na tela e sem letra miúda.`,
    type: 'website',
    locale: 'pt_BR',
  },
} satisfies Metadata

const PERGUNTAS = [
  {
    pergunta: 'Como eu pago hoje?',
    resposta:
      'Falando com a gente. A cobrança automática ainda não está no ar — preferimos dizer isso a montar um botão que não funciona. Você cria a conta no grátis, usa, e se quiser subir de plano a gente combina direto e ajusta na hora.',
  },
  {
    pergunta: 'O grátis expira?',
    resposta: `Não. É grátis para sempre, com ${PLANOS.gratis.maxClientes} clientes e ${PLANOS.gratis.maxProfissionais} profissional. Não é um teste que vira cobrança sem avisar.`,
  },
  {
    /*
      Esta pergunta existe porque o teto de clientes é SUAVE no código (§L.1: avisa e deixa
      passar), e uma tabela de preço que diz "até 50" sem mais nada promete uma parede que o
      produto não tem. Prometer menos do que se entrega é honesto; prometer um limite que não
      existe é o tipo de letra miúda ao contrário que ninguém perdoa depois.
    */
    pergunta: `E se eu passar de ${PLANOS.gratis.maxClientes} clientes?`,
    resposta:
      'Você continua cadastrando. O CICLO avisa quando você chega perto, mas não trava o cadastro no meio de um atendimento — e nenhuma ficha some. O limite que vale de verdade no Grátis é o de um profissional.',
  },
  {
    pergunta: 'Se eu parar de pagar, perco meus clientes?',
    resposta:
      'Nunca. Sua base, seu histórico e sua agenda continuam inteiros e à vista — você volta para o grátis e o que trava é criar mais, não ver o que já existe. Essa regra não tem exceção.',
  },
  {
    pergunta: 'Tenho três profissionais e quero o Grátis. Dá?',
    resposta:
      'O Grátis vale para um profissional. Os outros dois aparecem para você normalmente se já estiverem cadastrados — nada some —, mas para cadastrar mais é preciso o Equipe.',
  },
  {
    pergunta: 'Posso cancelar quando quiser?',
    resposta:
      'Pode, com o mesmo número de toques que levou para assinar, e sem precisar falar com ninguém para isso. Nos primeiros 7 dias o valor volta integral, como manda o Código de Defesa do Consumidor.',
  },
  {
    pergunta: 'Vocês aumentam o preço depois?',
    resposta:
      'Se um dia aumentar, avisamos com 30 dias de antecedência e quem já é cliente fica no preço antigo por 12 meses.',
  },
]

export default function Precos() {
  const botaoPrimario =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo ' +
    'font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]'
  const botaoSecundario =
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 ' +
    'bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]'

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
      <header className="flex items-center justify-between gap-3 py-5">
        <Link href="/" className="toque-48 flex items-center gap-2">
          <MarcaCiclo className="size-8" />
          <span className="text-label font-semibold uppercase tracking-[0.13em] text-txt-3">CICLO</span>
        </Link>
        <Link
          href="/entrar"
          className="flex h-12 items-center px-1 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
        >
          Entrar
        </Link>
      </header>

      <section className="py-8 sm:py-12">
        <h1 className="text-numero font-bold sm:text-[2.25rem] sm:leading-[1.1]">
          Comece de graça. Pague quando o CICLO já estiver te dando trabalho a menos.
        </h1>
        <p className="mt-4 max-w-[52ch] text-corpo text-txt-2">
          Preço na tela, sem cadastro e sem &ldquo;fale com um consultor&rdquo;. O Motor de Ciclo está em todos os planos,
          inclusive no grátis — o que o pago libera é chamar todo mundo de uma vez, em vez de um por um.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {CARTOES.map((p) => (
          <article
            key={p.tier}
            className={
              'rounded-[var(--radius)] border bg-surface p-5 shadow-elevado ' +
              (p.destaque ? 'border-acc-2 ring-1 ring-acc-2' : 'border-line')
            }
          >
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
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
                  <span>{item.texto}</span>
                </li>
              ))}
              {p.naoInclui?.map((item) => (
                <li key={item} className="flex gap-2 text-secundario text-txt-3">
                  <Minus aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/cadastro" className={`mt-5 ${p.destaque ? botaoPrimario : botaoSecundario}`}>
              {p.tier === 'gratis'
                ? 'Criar minha conta grátis'
                : `Começar no grátis e subir para o ${NOME_DO_PLANO[p.tier]}`}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </article>
        ))}
      </section>

      <section className="py-10">
        <h2 className="mb-4 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Perguntas de dinheiro</h2>
        <dl className="flex flex-col gap-4">
          {PERGUNTAS.map((q) => (
            <div key={q.pergunta} className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-elevado">
              <dt className="text-corpo font-semibold text-txt">{q.pergunta}</dt>
              <dd className="mt-1.5 text-secundario text-txt-2">{q.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-center text-label text-txt-3">
        Preços em reais, por mês.{' '}
        <Link href="/" className="toque-48 font-semibold text-acc-2 underline underline-offset-2">
          Voltar para o início
        </Link>
      </p>
    </main>
  )
}
