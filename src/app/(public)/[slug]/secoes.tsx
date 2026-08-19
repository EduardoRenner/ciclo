import { AtSign, MapPin, MessageCircle, Phone } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import { dinheiro, duracao } from '@/lib/formato'

import type { PerfilPublico } from '@/server/services/public-booking'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

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

  return (
    <>
      <section className="flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="text-titulo font-extrabold">{perfil.name}</h1>
        {perfil.tagline ? <p className="max-w-sm text-corpo text-txt-2">{perfil.tagline}</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/${perfil.slug}/agendar`}
            className="rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] px-5 py-3 text-corpo font-semibold text-[#0a0a0f] transition hover:brightness-110 active:scale-[.98]"
          >
            Agendar horário
          </Link>
          {perfil.whatsapp ? (
            <a
              href={linkWhatsapp(perfil.whatsapp, `Oi! Vim pelo site da ${perfil.name}.`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 py-3 text-corpo font-semibold text-txt transition hover:bg-surface-3 active:scale-[.98]"
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
              <Card key={s.id}>
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
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Horário</h2>
          <Card>
            <ul className="flex flex-col gap-1">
              {DIAS.map((nome, weekday) => {
                const blocos = perfil.hours.filter((h) => h.weekday === weekday)
                return (
                  <li key={weekday} className="flex items-center justify-between text-secundario">
                    <span className="text-txt-2">{nome}</span>
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
