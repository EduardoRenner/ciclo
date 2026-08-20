import { AtSign, CalendarPlus, Clock, MapPin, MessageCircle, Phone, Star } from 'lucide-react'
import Link from 'next/link'

import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import { dinheiro, duracao } from '@/lib/formato'

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
  const temContato = perfil.phone || perfil.whatsapp || perfil.address || perfil.instagram
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
      <section className="relative -mx-[var(--gutter)] flex flex-col items-center gap-4 overflow-hidden px-[var(--gutter)] pb-8 pt-12 text-center">
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
            {perfil.services.map((s) => (
              <Card key={s.id} pressionavel>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-corpo font-semibold">{s.name}</p>
                    {s.description ? <p className="mt-0.5 text-secundario text-txt-2">{s.description}</p> : null}
                    <p className="tabular mt-1 text-secundario text-txt-3">{duracao(s.durationMin)}</p>
                  </div>
                  <p className="tabular shrink-0 text-corpo font-semibold text-acc-2">
                    {s.priceCents > 0 ? dinheiro.format(s.priceCents / 100) : 'Consultar'}
                  </p>
                </div>
              </Card>
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
            {perfil.address ? (
              <div className="flex items-start gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-txt-3" />
                <span className="text-corpo text-txt">{perfil.address}</span>
              </div>
            ) : null}
            {perfil.phone ? (
              <a href={`tel:${perfil.phone}`} className="flex items-center gap-2 text-corpo text-txt">
                <Phone aria-hidden className="size-4 shrink-0 text-txt-3" />
                {perfil.phone}
              </a>
            ) : null}
            {perfil.instagram ? (
              <a
                href={`https://instagram.com/${perfil.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-corpo text-txt"
              >
                <AtSign aria-hidden className="size-4 shrink-0 text-txt-3" />
                {perfil.instagram}
              </a>
            ) : null}
          </Card>
        </section>
      ) : null}

      <footer className="py-10 text-center text-label text-txt-3">
        Feito com <span className="text-acc-2">CICLO</span>
      </footer>
    </>
  )
}
