import Image from 'next/image'
import Link from 'next/link'

import { precoDoPlano } from '@/core/billing/planos'
import { canalDeContato } from '@/lib/contato'

import wordmark from '../../../../public/marca/ciclo-wordmark-aqua.png'

const CANAL = canalDeContato('Oi! Tenho uma dúvida sobre os termos de uso do CICLO.')

/**
 * L-7, `docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` — vender assinatura recorrente sem termos é
 * vender sem contrato, e até 2026-08-30 esta página não existia.
 *
 * **A regra que este texto segue, e ela é a mesma da copy do resto do produto:** só afirma o que o
 * código faz HOJE, medido. Nenhuma cláusula descreve funcionalidade futura. Por isso o §5 diz que
 * a cobrança é combinada direto em vez de descrever um fluxo de assinatura automática — ela não
 * existe, e um contrato que promete o que o software não faz é pior que a ausência dele.
 *
 * O aviso do topo é deliberado: este texto foi escrito por quem conhece o sistema, não por
 * advogado. Ele é honesto e serve para operar, mas precisa de revisão jurídica antes do primeiro
 * pagante — está listado no §6 do `docs/31`.
 */
export const metadata = {
  title: 'Termos de uso',
  description: 'As regras de uso do CICLO: o que a gente entrega, o que você garante, como funciona o pagamento e como cancelar.',
}

const ATUALIZADO_EM = '30 de agosto de 2026'

export default function Termos() {
  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="CICLO, início">
          <Image src={wordmark} alt="CICLO" sizes="70px" className="h-7 w-auto" />
        </Link>
        <Link
          href="/entrar"
          className="flex h-12 items-center px-1 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
        >
          Entrar
        </Link>
      </header>

      <h1 className="mt-6 text-titulo font-bold">Termos de uso</h1>
      <p className="mt-1 text-secundario text-txt-3">Atualizado em {ATUALIZADO_EM}</p>

      <div className="mt-8 flex flex-col gap-7 text-corpo text-txt-2 [&_h2]:text-corpo [&_h2]:font-semibold [&_h2]:text-txt [&_p]:mt-2 [&_li]:mt-1.5">
        <section>
          <h2>1. Quem somos e o que é o CICLO</h2>
          <p>
            O CICLO é um sistema de agenda e gestão para quem atende com hora marcada: barbearia,
            unhas, cílios, estética e profissões parecidas. Ele é oferecido pela internet, por
            assinatura, e você acessa pelo navegador do celular ou do computador.
          </p>
          <p>
            Ao criar uma conta, você concorda com estes termos. Se não concordar, não use o
            serviço.
          </p>
        </section>

        <section>
          <h2>2. Sua conta</h2>
          <p>
            Você é responsável pelo que acontece na sua conta e por manter sua senha em segredo.
            Se desconfiar que alguém entrou sem sua autorização, troque a senha e fale com a gente.
          </p>
          <p>
            Você precisa ter 18 anos ou mais para criar uma conta, e as informações que você
            cadastrar precisam ser verdadeiras.
          </p>
        </section>

        <section>
          <h2>3. Os dados dos seus clientes são seus</h2>
          <p>
            Tudo que você cadastra no CICLO (clientes, agendamentos, histórico, valores) continua
            sendo seu. A gente guarda e processa esses dados para fazer o sistema funcionar para
            você, e não usamos a sua base para nada mais: não vendemos, não cedemos e não usamos
            para anunciar nada a ninguém.
          </p>
          <p>
            Em relação aos dados dos seus clientes, quem decide o que coletar e por quê é{' '}
            <strong className="font-semibold text-txt">você</strong>; a gente só processa o que
            você mandou guardar. Isso significa que cabe a você ter a autorização das pessoas que
            você cadastra. Os detalhes estão na{' '}
            <Link href="/privacidade" className="font-semibold text-acc-2 underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section>
          <h2>4. O que você não pode fazer</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>Usar o CICLO para mandar mensagem para quem não quer receber, ou para spam.</li>
            <li>Cadastrar dados de pessoas sem autorização delas.</li>
            <li>Tentar invadir, sobrecarregar ou copiar o sistema.</li>
            <li>Revender o acesso à sua conta para outra pessoa ou negócio.</li>
            <li>Usar o serviço para qualquer coisa ilegal.</li>
          </ul>
        </section>

        <section>
          <h2>5. Planos e pagamento</h2>
          <p>
            O plano Grátis é gratuito e não pede cartão. Os planos pagos começam em{' '}
            {precoDoPlano('essencial')} por mês, e os valores de cada degrau estão na{' '}
            <Link href="/precos" className="font-semibold text-acc-2 underline underline-offset-2">
              página de preços
            </Link>
            .
          </p>
          <p>
            <strong className="font-semibold text-txt">A cobrança automática ainda não está no ar.</strong>{' '}
            Hoje, se você quiser um plano pago, a gente combina direto e o pagamento é feito por
            fora do sistema. Quando existir assinatura automática, você será avisado antes de
            qualquer cobrança começar.
          </p>
          <p>
            Se o preço de um plano mudar, a gente avisa com pelo menos 30 dias de antecedência, e
            a mudança nunca vale para um período já pago.
          </p>
        </section>

        <section>
          <h2>6. Cancelar</h2>
          <p>
            Você pode parar de usar quando quiser, sem multa e sem fidelidade. Se estiver num plano
            pago, é só avisar. Você continua com o acesso até o fim do período já pago e depois a
            conta volta para o Grátis.
          </p>
          <p>
            <strong className="font-semibold text-txt">Cair de plano nunca apaga nem esconde seus dados.</strong>{' '}
            Se você tiver mais clientes do que o limite do Grátis, todos continuam lá e visíveis;
            o que o plano pago libera é criar mais e usar os recursos de cada degrau.
          </p>
          <p>
            Se quiser apagar a conta de vez, peça e a gente apaga. Você também pode levar seus
            dados embora: cada ficha de cliente tem exportação dentro do próprio sistema.
          </p>
        </section>

        <section>
          <h2>7. Disponibilidade e limites</h2>
          <p>
            A gente cuida para o CICLO ficar no ar, mas não promete funcionamento sem nenhuma
            interrupção: atualização, manutenção e problema de serviço de terceiros acontecem.
          </p>
          <p>
            O CICLO é uma ferramenta de apoio: as decisões do seu negócio continuam sendo suas. A
            gente não se responsabiliza por lucro que você deixou de ter, nem por decisão tomada
            com base no que o sistema mostrou.
          </p>
          <p>
            A gente pode suspender uma conta que esteja quebrando o item 4, e avisa o motivo quando
            fizer isso.
          </p>
        </section>

        <section>
          <h2>8. Mudanças nestes termos</h2>
          <p>
            Se estes termos mudarem, a data no topo muda junto e a gente avisa dentro do sistema.
            Continuar usando depois disso significa que você concorda com a versão nova.
          </p>
        </section>

        <section>
          <h2>9. Lei e foro</h2>
          <p>
            Estes termos seguem a lei brasileira. Qualquer discussão que não der para resolver
            conversando fica no foro do domicílio do assinante, como manda o Código de Defesa do
            Consumidor.
          </p>
        </section>

        <section>
          <h2>10. Falar com a gente</h2>
          {/*
            Dizia "pelo mesmo canal em que você contratou". Não existe esse canal: todo mundo entra
            sozinho pelo cadastro do Grátis, então a cláusula mandava o assinante para um lugar que
            nunca houve. Cláusula de contato num contrato precisa nomear o contato. `lib/contato.ts`.
          */}
          <p>
            Dúvida sobre estes termos, sobre cobrança ou sobre seus dados:{' '}
            {CANAL ? (
              <a href={CANAL.href} target="_blank" rel="noopener noreferrer">
                fale com a gente por aqui
              </a>
            ) : (
              'responda o e-mail que você recebeu ao criar a conta'
            )}
            . A gente responde.
          </p>
        </section>
      </div>

      <footer className="pt-10 text-center text-label text-txt-3">
        <Link href="/privacidade" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Política de Privacidade
        </Link>
        <span className="mx-2" aria-hidden>
          ·
        </span>
        <Link href="/precos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Preços
        </Link>
      </footer>
    </main>
  )
}
