import { ArrowRight, CalendarCheck, Link2, Wallet } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { PLANOS } from '@/core/billing/planos'
import { slugDeDemonstracaoNoAr } from '@/server/services/demonstracao'
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
 * **Nenhuma leitura de sessão aqui, e a regra continua valendo.** Quem já está logado é
 * redirecionado para `/admin/hoje` pelo `middleware.ts`, que resolve a sessão em toda requisição de
 * qualquer forma — perguntar de novo aqui dentro é o que marcava esta rota como dinâmica por
 * USUÁRIO (`docs/21-AUDITORIA-FALHA-SILENCIOSA.md` §5.2). Não reintroduza `sessaoAtual()`/
 * `redirect()` aqui sem mover a checagem de volta para o middleware junto.
 *
 * O que esta página faz desde 2026-09-03, e que o parágrafo acima NÃO proíbe: uma consulta sem dado
 * de ninguém, igual para todo visitante, para descobrir qual página de demonstração está no ar. A
 * distinção é a que importa — o §5.2 ataca leitura por usuário, não leitura por requisição. E o
 * layout raiz já é `force-dynamic` desde o conserto do nonce do CSP, então não há estaticidade a
 * perder: a linha antiga deste comentário dizia "página estática de propósito" e tinha deixado de
 * ser verdade antes desta mudança.
 */
/*
  TICKET-UX18: pedido do usuário foi juntar toda a copy da home num texto só e auditar com
  copywriting avançado. A `openGraph.description` tinha ficado para trás das últimas rodadas —
  ninguém a olha rolando a própria página, só aparece na prévia de um link colado no WhatsApp, e é
  exatamente por isso que ela apodrece calada (mesmo raciocínio do cabeçalho de
  `tests/unit/design/seo-nao-apodrece.test.ts`). Duas coisas nela contradiziam o resto da página:

  1. Listava só "barbearia, unhas, cílios, sobrancelha, depilação e estética" — a mesma estreiteza
     de alcance que o `docs/20-COPY-PLANO.md` §D.6 mediu e corrigiu no resto da página (das 8
     profissões que a copy antiga nomeava, nenhuma tem ritmo recorrente; das 9 de fora, cinco têm).
     Quem recebe o link e trabalha com pet, aula ou faxina lia "não é para mim" antes de clicar.
  2. Trazia "Feito para o celular, em português" — o mesmo tricolon que o §D.3 matou do subtítulo
     por ser "verdadeiro e irrelevante: nenhuma das três é motivo para escolher o CICLO em vez de
     outro" (foi para a FAQ, como resposta a objeção, não como argumento de venda).

  A nova frase espelha o subtítulo da dobra (mesma amplitude, "qualquer trabalho que dependa de
  cliente que volta") e nomeia o Motor de Ciclo em vez do tricolon morto — o que preenche o feed
  do WhatsApp já é o diferencial real, não uma lista de profissões que a própria home parou de
  fazer.
*/
/*
  TICKET-UX20: a `description` mencionava "caixa" (recurso do plano Essencial) sem dizer o degrau —
  passava despercebido enquanto a home também descrevia o mesmo recurso no cartão "O dia fechado
  sem calculadora" (removido neste ticket a pedido do usuário). Sem esse cartão, a menção ficou
  sozinha e `home-nao-promete-demais.test.ts` reprovou: mencionar recurso pago sem dizer o plano é
  exatamente o que a guarda existe para pegar. Tirei "e caixa" em vez de adicionar o nome do plano
  aqui — a `description` é a primeira frase que a pessoa lê antes mesmo de abrir o link, e é onde
  "isso é pago" faz menos sentido pesar.
*/
export const metadata: Metadata = {
  title: 'CICLO · a agenda que avisa quem parou de voltar',
  description:
    'Agenda e site de agendamento para quem atende com hora marcada. O CICLO calcula de quanto em quanto tempo cada cliente volta, mostra quem atrasou e te dá a mensagem pronta para chamar.',
  openGraph: {
    title: 'CICLO · a agenda que avisa quem parou de voltar',
    description: 'Para qualquer trabalho que dependa de cliente que volta. O CICLO mostra quem sumiu, há quanto tempo, e quanto vale chamar de volta.',
    type: 'website',
    locale: 'pt_BR',
  },
}

/*
  TICKET-UX20: pedido do usuário foi resumir esta copy pro essencial e tirar a menção a plano
  pago, "pro cliente nem saber que as coisas são pagas". As duas entradas que sobraram foram
  cortadas para a frase mais forte de cada uma, tirando a segunda metade explicativa (o "porquê"
  que já mora nos comentários e nos docs citados).

  TICKET-UX21: pedido de volta foi trazer o terceiro cartão ("O dia fechado sem calculadora"), só
  sem a frase do plano — diferente do UX20, que tinha cortado o cartão inteiro. A frase que sobra
  ("Quanto entrou e quanto sobrou, com o extrato de cada profissional. Por dia e por mês.") NÃO
  cita nenhum recurso pago pelo nome (nem `caixa`, nem `comanda`, nem `fechamento do dia`, as
  palavras que `home-nao-promete-demais.test.ts` varre em "a home diz o degrau quando anuncia
  coisa de plano pago") — é OUTCOME, não mecanismo: qualquer dono lê "quanto entrou e quanto
  sobrou" sem saber que por trás disso tem um módulo chamado `register`. Isso é diferente de
  ESCONDER que o recurso é pago depois de NOMEAR o recurso, que foi o problema real do UX20 (a
  versão anterior desta frase dizia "com o extrato de cada profissional" E "A partir do plano
  Essencial" ao mesmo tempo — cortar só a segunda metade teria deixado a primeira sem lastro). Sem
  a palavra que aciona a guarda, não há lacuna pra ela pegar.
*/
const RECURSOS = [
  {
    icone: IconeAnel,
    titulo: 'Quem sumiu tem nome',
    texto:
      'O ritmo é de cada pessoa, não uma média do salão. A lista chama primeiro quem vale mais chamar, com o texto pronto pro WhatsApp.',
  },
  {
    icone: Link2,
    titulo: 'Sua página, sua clientela',
    texto:
      'Um link para colar na bio. Quem for marcar abre no navegador, sem baixar aplicativo e sem esbarrar em nenhum concorrente pelo caminho.',
  },
  {
    icone: Wallet,
    titulo: 'O dia fechado sem calculadora',
    texto: 'Quanto entrou e quanto sobrou, com o extrato de cada profissional. Por dia e por mês.',
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

/**
 * `docs/20-COPY-PLANO.md` §D.6 — as 17 do catálogo, agrupadas, com beleza primeiro. Recomendado em
 * 24/08 e até hoje não implementado: a página listava 8 soltas.
 *
 * **O problema que isso conserta (§6 do sumário do 20):** das 8 que a copy nomeava, **nenhuma** tem
 * ritmo recorrente no catálogo; das 9 que ficavam de fora, **cinco** têm. A página era muda
 * justamente para quem vive de cliente que volta, que é o público do Motor de Ciclo.
 *
 * **Beleza primeiro não é ordem alfabética nem acaso:** é onde o esforço de venda está (`docs/18`
 * §B.2, Decidido), e o olho lê o primeiro grupo como "é disto que ele é". O agrupamento faz o
 * trabalho que 17 chips soltos não fariam — chip solto em fila de 17 lê como "serve para tudo", que
 * é o que o barbeiro do painel de leitores rejeitou (§7.4).
 *
 * Os nomes saem de `supabase/migrations/0022_professions_catalog.sql` e `0026_catalogo_profundo.sql`
 * (17 linhas em `professions`), conferidos no arquivo. Não é lista inventada para a página.
 */
const GRUPOS_DE_PROFISSAO: readonly { grupo: string; itens: readonly string[] }[] = [
  { grupo: 'Beleza', itens: ['Barbearia', 'Cabelo', 'Unhas', 'Cílios', 'Sobrancelhas', 'Depilação', 'Estética', 'Tatuagem'] },
  { grupo: 'Casa', itens: ['Faxina e diarista', 'Eletricista', 'Encanador', 'Jardineiro'] },
  { grupo: 'Saúde, aula e treino', itens: ['Psicólogo', 'Professor particular', 'Personal trainer'] },
  { grupo: 'Pet e eventos', itens: ['Banho e tosa', 'Fotógrafo'] },
]

/**
 * `docs/20-COPY-PLANO.md` §D.10 — a FAQ tem trabalho de conversão, não de suporte: cada linha aqui
 * é uma objeção que impede o cadastro, e a ordem é a da força da objeção.
 *
 * "Funciona para quem trabalha por conta?" SUBIU para primeira: o §D.10 a chama de "a melhor
 * aplicação de identidade do produto", e identidade responde antes de detalhe técnico.
 *
 * Duas perguntas NOVAS, e as duas saíram do painel de leitores:
 *   - "já uso outro sistema" foi a objeção nº 1 de quem já paga por algo (§7.3, dona de salão), e a
 *     copy inteira era muda sobre isso;
 *   - "em quanto tempo a lista fica útil" é a expectativa que ninguém estava gerenciando (§D.7 B),
 *     e a falta dela é causa provável de churn precoce (§R.1).
 */
const PERGUNTAS = [
  {
    /*
      A frase é a do §C.4 do `docs/20`, e a tabela dele é explícita sobre por que ela é assim:
      *"quem atende sozinho" não resolve → "quem trabalha por conta"* — porque escolher um gênero
      não é melhor que trocar de gênero, é o mesmo erro virado para o outro lado. Eu tinha
      reescrito para "sozinho" nesta rodada e a decisão da casa me desmentiu.
    */
    pergunta: 'Funciona para quem trabalha por conta?',
    resposta:
      'Funciona, e é para quem trabalha por conta que ele mais serve: você não tem alguém olhando a agenda por você para lembrar de quem sumiu.',
  },
  {
    /*
      A resposta mudou depois de eu MEDIR o importador, e o achado é melhor que o registrado no
      §D.10. O documento supôs "nome, telefone, e-mail e etiquetas; histórico não". O importador
      aceita também a coluna de ÚLTIMA VISITA (`importacao-clientes.ts`: `lastVisit` chega até
      `calcularPrevisao`, que roda `computeCycle` em cada data e devolve quantas pessoas já estão
      devendo voltar). Ou seja: com a data na planilha, a lista nasce cheia no primeiro dia, em vez
      de esperar duas ou três voltas.

      Isso é o argumento mais forte que o produto tem para quem já tem base, e não estava escrito
      em lugar nenhum da página.
    */
    pergunta: 'Eu já tenho minha lista de clientes. Dá para trazer?',
    resposta:
      'Dá, de uma planilha: nome, telefone, e-mail e etiquetas. E se a sua planilha tiver a data da última visita, traga essa coluna também: é ela que faz a lista de quem sumiu nascer cheia no primeiro dia, em vez de você esperar as pessoas voltarem para o CICLO ter o que calcular.',
  },
  {
    pergunta: 'Em quanto tempo a lista de quem sumiu fica útil?',
    resposta:
      'Se você importar a data da última visita, já na primeira tela. Sem essa data, o CICLO precisa ver cada pessoa voltar duas ou três vezes para saber o ritmo dela. Até lá a lista começa vazia e vai enchendo conforme você atende.',
  },
  {
    /*
      A resposta era "Não." e a mecânica do link. Estava certa e desperdiçava a pergunta: esta é a
      queixa nº 1 dos donos sobre o líder do nicho (`docs/43` §2), e a resposta tratava como
      objeção a neutralizar o que é a diferença estrutural do produto. A segunda frase é a metade
      que não estava escrita em lugar nenhum — e é conferível no repositório, não promessa: não
      existe rota que liste tenants para o público, e `pagina-do-negocio-e-so-dele.test.ts` reprova
      se passar a existir.
    */
    pergunta: 'Quem vai marcar precisa baixar app ou criar conta?',
    resposta:
      'Não. A pessoa abre seu link, escolhe o serviço e o horário, e o agendamento entra na sua agenda esperando você confirmar. E a página é do seu negócio e só dele: ninguém vai parar numa lista com os seus concorrentes no caminho de marcar com você.',
  },
  {
    /* Absorve o "sem treinamento" e o "feito para o celular" que saíram do subtítulo pelo §D.3. */
    pergunta: 'Preciso instalar alguma coisa?',
    resposta:
      'Não. Abre no navegador do celular e funciona, sem treinamento e sem manual. Se quiser, dá para adicionar à tela de início e ele passa a abrir como aplicativo, em tela cheia.',
  },
]

export default async function Home() {
  /*
    A única leitura de banco desta página, e ela é barata de propósito: um `in` numa lista fechada
    de slugs, com índice, devolvendo uma coluna. Ver `server/services/demonstracao.ts` para o
    defeito de produção que a motivou.

    Isto NÃO reintroduz a leitura de sessão que o `docs/21` §5.2 mandou tirar daqui — aquela era
    `cookies()`, que marca a rota como dinâmica por requisição de USUÁRIO. Esta é uma consulta sem
    dado de ninguém, igual para todo visitante. E o layout raiz já é `force-dynamic` desde o
    conserto do nonce do CSP, então a rota não perde estaticidade que ainda tivesse.
  */
  const slugDeExemplo = await slugDeDemonstracaoNoAr()

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
        <Image src={wordmark} alt="CICLO" sizes="70px" priority className="h-7 w-auto" />
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
        {/*
          TICKET-UX16: pedido do usuário foi que a PRIMEIRA coisa lida cause curiosidade e o
          sentimento de "quero isso", em vez de abrir com a afirmação pronta. Uma pergunta faz o
          trabalho que a afirmação antiga não fazia, ela obriga o dono a responder mentalmente
          ANTES de ler o resto: a maioria não sabe o número, e a peça logo abaixo (agora um print
          de verdade, não mais maquete) responde com um valor real em segundos. Continua sendo o
          Motor de Ciclo, o eixo 1 do posicionamento (`docs/43` §4), só que perguntado em vez de
          afirmado.
        */}
        <h1 className="text-numero font-bold sm:text-[2.75rem] sm:leading-[1.05] sm:tracking-[-0.02em]">
          Quantos clientes pararam de voltar sem você notar?
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
        {/*
          A segunda frase é o item A do `docs/43-POSICIONAMENTO-10X.md` — e ela chega aqui pelo
          caminho longo de propósito.

          O `43` §4 mediu que a resposta à queixa nº 1 do mercado inteiro estava na QUARTA de cinco
          perguntas do FAQ, no rodapé, tratada como objeção a neutralizar ("Não. A pessoa abre seu
          link..."). É a única diferença ESTRUTURAL entre o CICLO e os dois líderes do nicho, escrita
          como nota de rodapé — e a metade mais forte dela, o cliente não ver a concorrência, não
          estava escrita em lugar nenhum.

          **Por que aqui e não no `h1`.** O `h1` é o Motor de Ciclo, que é o eixo 1 (tecnologia
          10x). Trocar um diferencial por outro não é ganho. O subtítulo responde "para quem serve"
          e sobrava linha: medido a 375 px, a frase nova leva o subtítulo de 46 px para 70 px e o
          bloco de preço de y=503 para y=526, com a dobra em 812 — ninguém sai da primeira tela.

          **Concreto, não slogan.** A frase de marca do `43` §5.4 é "Seu cliente é seu", e ela não
          entrou assim: para quem nunca usou app de marketplace, ela não quer dizer nada. O §D.3 do
          `docs/20` já tinha estabelecido esse princípio ao matar o tricolon abstrato da dobra. O
          que entra é o fato verificável; o slogan é o resumo dele para quem já entendeu.
        */}
        <p className="mt-4 max-w-[46ch] text-corpo text-txt-2">
          Para qualquer trabalho que dependa de cliente que volta. Quem for marcar abre no navegador: sem baixar app
          e sem ver seus concorrentes.
        </p>
        {/*
          TICKET-UX17: pedido do usuário foi uma auditoria de copywriting na página inteira. Dois
          microtextos de botão mudaram por um motivo específico, não geral: o preço saiu da dobra
          neste mesmo ticket anterior (UX16), e sem ele em lugar nenhum acima do botão, "grátis" na
          PRÓPRIA ação remove a última hesitação (quanto custa?) no exato instante da decisão, sem
          reintroduzir um número que assusta. Não repeti no botão do fecho (`Comece de graça...`) —
          ali "grátis" já aparece duas vezes no título e no parágrafo acima, e um terceiro "grátis"
          no botão seria redundância, não reforço.
        */}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/cadastro" className={botaoPrimario}>
            Criar minha conta grátis
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

            **O destino deixou de ser literal em 2026-09-03, e o motivo foi medido em produção:**
            `href="/dom-rocha"` respondia **404** no ar. A demonstração migrou para os seis tenants
            `demo-*` e este link ficou apontando para o antigo — ou seja, a prova de produto da
            landing levava a "Página não encontrada", que é a leitura oposta da que o botão existe
            para produzir. Trocar um literal por outro consertaria hoje e repetiria a fragilidade:
            nenhuma varredura de código pega isso, porque o defeito mora na distância entre o código
            e o banco. Quem responde é o servidor, a cada requisição.

            Sem nenhuma demonstração no ar, o botão SOME. Um argumento a menos é pior que um
            argumento; um link para 404 é pior que os dois.
          */}
          {slugDeExemplo ? (
            // `?ver=dono` abre a vitrine já na aba "O que você vê": é a prova do Motor de Ciclo,
            // o próprio argumento do `h1` acima, e demo clicável sem cadastro converte mais que
            // descrição em prosa (medido em SaaS: motor de busca "interactive demo conversion").
            // A rota aceita o parâmetro em `[slug]/agendar/page.tsx`; sem ele, abre em "cliente"
            // como sempre abriu — link direto e sem cadastro continua funcionando do jeito antigo.
            //
            // TICKET-UX17: "Ver uma página de exemplo" descrevia o link; "Ver funcionando, sem
            // cadastro" descreve o RESULTADO de clicar (o produto rodando de verdade) e remove a
            // objeção que mais atrapalha um botão secundário — "isso vai me pedir e-mail?" — antes
            // de a pessoa precisar perguntar.
            <Link href={`/${slugDeExemplo}/agendar?ver=dono`} className={botaoSecundario}>
              Ver funcionando, sem cadastro
            </Link>
          ) : null}
        </div>
        {/*
          TICKET-UX16: pedido direto do usuário foi tirar o preço do topo, "para não assustar" —
          reverte a decisão anterior (comentário removido dizia "o preço aparece já na primeira
          dobra... é de graça fazer diferente"). A transparência de preço continua existindo, só
          que depois de a pessoa já ter visto o produto funcionando: no fecho da página ("Comece de
          graça, e sem cartão", mais abaixo) e a um toque em qualquer momento pelo rodapé. Ninguém
          perde a informação; ela só para de ser a segunda coisa que a pessoa lê, antes de entender
          o que o produto faz.
        */}

        {/*
          TICKET-UX20: pedido do usuário foi tirar o print da dobra ("tira esse print"). Saiu a
          peça inteira (o print real de TICKET-UX16-19 e o mockup que era o último recurso dela) —
          nenhuma substituiu, de propósito: a home continua com o `h1` fazendo a pergunta e os dois
          CTAs respondendo com ação, sem precisar de uma terceira peça no primeiro scroll. O print
          real segue existindo na vitrine (`?ver=dono`), que é onde `painel-do-dono-exemplo.tsx`
          mostra as três telas de verdade sem o limite de espaço da dobra.
        */}
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
        <div className="flex flex-col gap-4">
          {GRUPOS_DE_PROFISSAO.map((g) => (
            <div key={g.grupo}>
              <p className="mb-2 text-label font-semibold text-txt-2">{g.grupo}</p>
              <ul className="flex flex-wrap gap-2">
                {g.itens.map((p) => (
                  <li
                    key={p}
                    className="rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 py-1.5 text-secundario text-txt-2"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/*
          O fecho desta seção SUBIU para o subtítulo da dobra (§D.3), que é onde ele resolve o
          alcance na posição de maior atenção. Fica sem substituto de propósito: a linha tentadora
          era "Não achou a sua? O catálogo cresce com quem pede", e o §D.6 a cortou por não ser
          verdade — o onboarding não tem campo "Outro"; quem procura profissão que não existe vê
          "Nenhuma profissão encontrada" e o produto não registra nada.
        */}
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
        {/*
          `docs/20-COPY-PLANO.md` §D.7, variante C — recomendada e não implementada. O motivo veio
          do painel de leitores: a objeção "e se eu não puder pagar depois?" apareceu em DUAS
          personas de margem apertada, e a melhor resposta do produto estava enterrada na `/precos`.
          Trazê-la para o fecho é, nas palavras do §D.7, "a maior movimentação de conversão barata
          que este documento encontrou".

          Mecanismo: aversão à perda invertida. Em vez de ameaçar com o que ela perde se não agir,
          remove o risco de agir — que é a única forma honesta de usar aversão à perda aqui, e
          passa no teste do §5.10 (continua funcionando mesmo se a pessoa souber como funciona).

          O número do teto vem de `PLANOS.gratis`, nunca datilografado: é a regra do
          `preco-em-um-lugar-so` aplicada a limite em vez de a preço.
        */}
        <CalendarCheck aria-hidden className="mx-auto mb-3 size-8 text-acc-2" />
        <h2 className="text-titulo font-bold">Comece de graça, e sem cartão</h2>
        <p className="mx-auto mt-2 max-w-[44ch] text-secundario text-txt-2">
          Grátis para sempre com {PLANOS.gratis.maxProfissionais} profissional. A base é sua: se um dia você parar de
          pagar, nada some.
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
        <Link href="/precos" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
          Preços
        </Link>
        <span aria-hidden>·</span>
        <Link href="/termos" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
          Termos
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacidade" className="toque-48 -mx-2 px-2 font-semibold text-txt-2 underline underline-offset-2">
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
