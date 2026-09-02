import { AtSign, CalendarPlus, ChevronRight, Clock, MapPin, MessageCircle, Phone, Star } from 'lucide-react'
import Link from 'next/link'

import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import { formatarPreco } from '@/core/pricing/formatar'
import { apelidoDoInstagram, urlDoInstagram } from '@/core/text/instagram'
import { duracao, formatarTelefone } from '@/lib/formato'

import type { PerfilPublico } from '@/server/services/public-booking'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Dia da semana e hora atuais **no fuso do salão** — a Vercel roda em UTC. */
function agoraNoSalao(timezone: string): { weekday: number; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const achar = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return {
    weekday: Math.max(0, dias.indexOf(achar('weekday'))),
    minutos: Number(achar('hour')) * 60 + Number(achar('minute')),
  }
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

function linkWhatsapp(numero: string, mensagem: string): string {
  const digitos = numero.replace(/\D/g, '')
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`
}

/**
 * Toda seção se esconde sozinha quando não tem dado — a maioria dos tenants
 * existentes tem `settings = '{}'` (nunca preencheram "sobre o negócio"
 * porque a tela não existia até esta rodada), e a página não pode parecer
 * quebrada por causa disso. Só nome + serviços são garantidos.
 */
export default function SecoesPublicas({ perfil }: { perfil: PerfilPublico }) {
  // Pelo apelido normalizado, não pelo campo cru: um valor que não vira apelido não desenha
  // linha nenhuma, e contá-lo aqui abriria o cartão de contato vazio.
  const instagram = apelidoDoInstagram(perfil.instagram)
  const temContato = perfil.phone || perfil.whatsapp || perfil.address || instagram
  const temHorario = perfil.hours.length > 0

  const agora = agoraNoSalao(perfil.timezone)
  const blocosDeHoje = perfil.hours.filter((h) => h.weekday === agora.weekday)
  const blocoAberto = blocosDeHoje.find(
    (h) => agora.minutos >= paraMinutos(h.opensAt) && agora.minutos < paraMinutos(h.closesAt),
  )
  const fechaHoje = blocoAberto?.closesAt.slice(0, 5)
  // Só anuncia "abre hoje às" se ainda vai abrir; depois do expediente a frase seria mentira.
  const abreHoje = blocosDeHoje
    .filter((h) => paraMinutos(h.opensAt) > agora.minutos)
    .sort((a, b) => paraMinutos(a.opensAt) - paraMinutos(b.opensAt))[0]
    ?.opensAt.slice(0, 5)

  return (
    <>
      {/*
        O rosto do negócio abria com um título do tamanho de tela interna sobre
        fundo preto liso — idêntico a qualquer tela do admin. Tinha um brilho
        radial atrás do título; removido (era a mesma assinatura de landing
        gerada da tela sem sessão e do admin — `docs/08-REDESIGN-E-IDENTIDADE.md`
        Parte II §B3). Nome em tamanho de manchete e o sinal que toda cliente
        procura primeiro — está aberto agora? — seguram a hierarquia sem cor.
        A cor do salão (acento por vertical, Parte II §3.8/§E7) entra numa
        rodada futura, de forma pontual — não como glow de fundo.
      */}
      {/*
        A capa é a "rodada futura" que o comentário acima previa, e entra do jeito que ele pede:
        pontual, não como glow. Fica FORA da `section` do nome para poder sangrar de borda a
        borda sem arrastar o padding do miolo junto.

        `loading="eager"` de propósito, contra o padrão: esta é a maior imagem acima da dobra —
        ou seja, o LCP da página. Preguiça aqui atrasa exatamente a métrica que ela existe para
        proteger. `alt=""` porque a capa é decorativa: o nome do salão já está no `h1` logo
        abaixo, e um alt descritivo faria o leitor de tela anunciar o mesmo nome duas vezes.
      */}
      {perfil.coverUrl ? (
        <div className="relative -mx-[var(--gutter)] -mt-2 h-36 overflow-hidden sm:h-44">
          {/*
            `<img>` e não `next/image`, de propósito: a imagem JÁ sobe otimizada — o
            `vitrine-upload.ts` reencoda para WebP q82 e redimensiona no `sharp` antes de gravar,
            então o otimizador do Next reprocessaria o que já está pronto, e otimização de imagem
            é cobrada por origem na Vercel. `width`/`height` explícitos entregam o ganho que
            importa aqui (reserva de espaço, sem salto de layout) sem esse custo. Usar `next/image`
            também exigiria `remotePatterns` para o host do Supabase no `next.config.ts`.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={perfil.coverUrl} alt="" width={1600} height={600} loading="eager" className="size-full object-cover" />
          {/*
            Sem este véu, o nome do salão cai sobre uma foto de brilho imprevisível — que é o
            defeito clássico de capa em página de perfil. O gradiente termina opaco no tom do
            fundo, então a emenda com o resto da página não aparece.
          */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/40 to-bg" />
        </div>
      ) : null}

      <section className="relative -mx-[var(--gutter)] flex flex-col items-center gap-4 overflow-hidden px-[var(--gutter)] pb-8 text-center"
        style={{ paddingTop: perfil.coverUrl ? undefined : '3rem' }}
      >
        {/*
          Sobe sobre a capa quando ela existe (margem negativa), e vira só um selo acima do nome
          quando não existe — sem capa não há o que sobrepor, e a margem negativa comeria o topo.
        */}
        {perfil.logoUrl ? (
          /* Mesmo motivo da capa acima: já é WebP dimensionado no upload. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={perfil.logoUrl}
            alt={`Logo de ${perfil.name}`}
            width={512}
            height={512}
            loading="eager"
            className={`size-20 rounded-full border-2 border-bg bg-surface-2 object-cover shadow-elevado ${perfil.coverUrl ? '-mt-14' : 'mt-12'}`}
          />
        ) : null}
        <h1 className="text-numero font-bold">{perfil.name}</h1>
        {perfil.tagline ? <p className="max-w-sm text-corpo text-txt-2">{perfil.tagline}</p> : null}

        {temHorario ? (
          blocoAberto ? (
            <Badge estado="ok">Aberto agora{fechaHoje ? ` · até ${fechaHoje}` : ''}</Badge>
          ) : (
            <Badge estado="warn">{abreHoje ? `Abre hoje às ${abreHoje}` : 'Fechado agora'}</Badge>
          )
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/${perfil.slug}/agendar`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]"
          >
            <CalendarPlus aria-hidden className="size-4" />
            Agendar horário
          </Link>
          {perfil.whatsapp ? (
            <a
              href={linkWhatsapp(perfil.whatsapp, `Oi! Vim pelo site da ${perfil.name}.`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
            >
              <MessageCircle aria-hidden className="size-4" />
              Falar no WhatsApp
            </a>
          ) : null}
        </div>
      </section>

      {perfil.services.length > 0 ? (
        <section className="py-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Serviços</h2>
          <div className="flex flex-col gap-2">
            {/*
              O card já nascia `pressionavel` — retorno de toque, `hover`, tudo — dentro de uma
              `div` inerte: apertava e não acontecia nada. Quem chega aqui pelo Instagram lê a
              lista de serviços como um cardápio e toca no que quer; o caminho até o agendamento
              não pode ser "role até o fim e ache o botão". Agora o toque leva direto para o
              agendamento com o serviço já escolhido, que é o atalho que Fresha e Booksy usam.
            */}
            {perfil.services.map((s) => (
              <Link key={s.id} href={`/${perfil.slug}/agendar?servico=${s.id}`} className="block">
                <Card pressionavel>
                <div className="flex items-start justify-between gap-3">
                  {/*
                    A foto entra ANTES do nome, em miniatura: escolher "Platinado" por um retângulo
                    de texto é diferente de escolher vendo o resultado. Quem não subiu foto não
                    ganha espaço reservado nem moldura vazia — a linha continua exatamente como era.
                  */}
                  {s.imageUrl ? (
                    /* Já é WebP dimensionado no upload — ver comentário da capa acima. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.imageUrl}
                      alt=""
                      width={800}
                      height={600}
                      loading="lazy"
                      className="size-14 shrink-0 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-corpo font-semibold">{s.name}</p>
                    {s.description ? <p className="mt-0.5 text-secundario text-txt-2">{s.description}</p> : null}
                    <p className="tabular mt-1 text-secundario text-txt-3">{duracao(s.durationMin)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <p className="tabular text-corpo font-semibold text-acc-2">
                      {formatarPreco({
                        pricingModel: s.pricingModel,
                        priceCents: s.priceCents,
                        hourlyRateCents: s.hourlyRateCents,
                        halfDayPriceCents: s.halfDayPriceCents,
                      })}
                    </p>
                    <ChevronRight aria-hidden className="size-4 text-txt-3" />
                  </div>
                </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {perfil.about ? (
        <section className="py-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Sobre</h2>
          <p className="whitespace-pre-line text-corpo text-txt-2">{perfil.about}</p>
        </section>
      ) : null}

      {temHorario ? (
        <section className="py-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
            <Clock aria-hidden className="size-3.5" />
            Horário
          </h2>
          <Card>
            <ul className="flex flex-col gap-1">
              {DIAS.map((nome, weekday) => {
                const blocos = perfil.hours.filter((h) => h.weekday === weekday)
                return (
                  <li
                    key={weekday}
                    className={`flex items-center justify-between text-secundario ${
                      weekday === agora.weekday ? 'font-semibold' : ''
                    }`}
                  >
                    <span className={weekday === agora.weekday ? 'text-acc-2' : 'text-txt-2'}>{nome}</span>
                    <span className="tabular text-txt">
                      {blocos.length === 0 ? 'Fechado' : blocos.map((b) => `${b.opensAt.slice(0, 5)}–${b.closesAt.slice(0, 5)}`).join(', ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ) : null}

      {/*
        docs/35-FOTOS-CONSENTIMENTO-PLANO.md, TICKET-115: "a galeria se enche sozinha conforme o
        salão atende e publica" — cada foto aqui já passou por consentimento `image_use` ativo no
        momento de publicar. Vazio (nenhum salão publicou nada ainda) é o caso comum, sem seção.
      */}
      {perfil.portfolio.length > 0 ? (
        <section className="py-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Trabalhos</h2>
          <div className="grid grid-cols-3 gap-2">
            {perfil.portfolio.map((url, i) => (
              /* Já é WebP dimensionado na publicação (`portfolio-upload.ts`) — mesmo padrão de logo/capa. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={url}
                src={url}
                alt=""
                loading={i < 6 ? 'eager' : 'lazy'}
                className="aspect-square w-full rounded-[var(--radius-sm)] border border-line-2 object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {/*
        docs/09-PLATAFORMA.md §8: a página pública prometia "avaliações" desde
        que o plano foi escrito e nunca entregou — client_reviews só era lido
        no painel. Nota sem texto não ajuda quem decide se agenda, por isso só
        os comentários com texto aparecem; a média conta TODAS as notas, não
        só a amostra exibida (senão a média mentiria pra melhor ou pra pior
        dependendo de qual fatia caiu no limite de 5).
      */}
      {perfil.reviews.count > 0 ? (
        <section className="py-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Avaliações</h2>
          <div className="mb-3 flex items-center gap-2">
            <Star aria-hidden className="size-5 shrink-0 fill-acc-2 text-acc-2" />
            <span className="tabular text-titulo font-bold">{perfil.reviews.average.toFixed(1)}</span>
            <span className="text-secundario text-txt-2">
              · {perfil.reviews.count} {perfil.reviews.count === 1 ? 'avaliação' : 'avaliações'}
            </span>
          </div>
          {perfil.reviews.recentes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {perfil.reviews.recentes.map((r, i) => (
                <Card key={i}>
                  <div className="mb-1.5 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, estrela) => (
                      <Star
                        key={estrela}
                        aria-hidden
                        className={`size-3.5 shrink-0 ${estrela < r.rating ? 'fill-acc-2 text-acc-2' : 'text-line-2'}`}
                      />
                    ))}
                  </div>
                  <p className="text-corpo text-txt">{r.comment}</p>
                </Card>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {temContato ? (
        <section className="py-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Contato</h2>
          <Card className="flex flex-col gap-3">
            {/*
              O endereço era texto morto: quem lê "Rua Augusta, 1442" no celular
              quer traçar a rota, e tinha que selecionar, copiar e abrir o mapa
              na mão. O link universal do Google Maps abre o app instalado no
              aparelho, sem depender de coordenada cadastrada.
            */}
            {perfil.address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(perfil.address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-start gap-2 py-1 text-corpo text-txt"
              >
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-txt-3" />
                <span>
                  {perfil.address}
                  <span className="mt-0.5 block text-secundario text-acc-2">Como chegar</span>
                </span>
              </a>
            ) : null}
            {/*
              Alvo REAL (`min-h-12`), não o `toque-48`. Estas três linhas ficam
              empilhadas com `gap-3` (12px), e o pseudo-elemento do `toque-48`
              tem 48px centrados numa linha de 23px — ou seja, invade ~12px para
              cada lado e ENCOSTA no vizinho. Medido em 2026-08-26: quem tocava
              na metade de baixo do telefone abria o Instagram, porque entre dois
              pseudo-elementos sobrepostos quem ganha é o último na ordem do DOM.
              O telefone ficava com 29px tocáveis dos 48 prometidos.

              `toque-48` continua certo onde é usado no resto do app: em alvo
              isolado, ou em peça de 40px (`Chip`, `Button sm`) que só precisa de
              4px para cada lado. Em lista empilhada de linha curta, ele mente.
            */}
            {perfil.phone ? (
              // 2026-08-30, medido na página pública em produção: o texto visível era o E.164
              // cru (`+5511999990000`) — o `href` continua E.164 de propósito (é o formato certo
              // para `tel:`), mas quem LÊ é a cliente final, e `formatarTelefone` já existia e já
              // era usada nas telas do admin. A vitrine do produto ficou de fora da formatação
              // que o resto do app aplica.
              <a href={`tel:${perfil.phone}`} className="flex min-h-12 items-center gap-2 text-corpo text-txt">
                <Phone aria-hidden className="size-4 shrink-0 text-txt-3" />
                {formatarTelefone(perfil.phone)}
              </a>
            ) : null}
            {/*
              O endereço sai de `urlDoInstagram`, nunca concatenado aqui: tenant cadastrado antes
              de 31/08 pode ter o endereço inteiro colado no campo, e concatenar produzia
              `instagram.com/https://instagram.com/nome`. Ver `core/text/instagram.ts`.
            */}
            {instagram ? (
              <a
                href={urlDoInstagram(perfil.instagram)!}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center gap-2 text-corpo text-txt"
              >
                <AtSign aria-hidden className="size-4 shrink-0 text-txt-3" />
                {instagram}
              </a>
            ) : null}
          </Card>
        </section>
      ) : null}

      {/*
        A assinatura era texto solto. Cada página de salão é a vitrine do
        produto para o próximo salão que a vê — é o único canal de aquisição
        que o CICLO tem de graça, e ele não levava a lugar nenhum.

        Desde o plano de monetização (§D.3) o selo é condicional: sai no primeiro degrau pago, e
        `perfil.mostrarSelo` já vem decidido do servidor. Ele continua discreto de propósito
        (§13.1 do 09-PLATAFORMA): selo feio faz o profissional pagar só para removê-lo e o laço
        fecha uma vez; selo bonito circula e traz gente. O rodapé inteiro desaparece quando o
        plano remove o selo — não fica um rodapé vazio ocupando altura no celular.
      */}
      {perfil.mostrarSelo ? (
        <footer className="py-10 text-center text-label text-txt-3">
          Feito com{' '}
          <Link href="/" className="toque-48 font-semibold text-acc-2 transition hover:brightness-110">
            CICLO
          </Link>
        </footer>
      ) : null}
    </>
  )
}
