'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Tenant = {
  name: string
  slug: string
  phone: string | null
  address: string | null
  site: { tagline?: string | null; about?: string | null; whatsapp?: string | null; instagram?: string | null }
}

export default function FormularioNegocio({ tenant, urlSite }: { tenant: Tenant; urlSite: string }) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()
  const [copiado, setCopiado] = useState(false)

  const [nome, setNome] = useState(tenant.name)
  const [telefone, setTelefone] = useState(tenant.phone ?? '')
  const [endereco, setEndereco] = useState(tenant.address ?? '')
  const [tagline, setTagline] = useState(tenant.site.tagline ?? '')
  const [sobre, setSobre] = useState(tenant.site.about ?? '')
  const [whatsapp, setWhatsapp] = useState(tenant.site.whatsapp ?? '')
  const [instagram, setInstagram] = useState(tenant.site.instagram ?? '')
  const [erro, setErro] = useState<string | null>(null)

  function copiarLink() {
    navigator.clipboard.writeText(urlSite).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function enviar() {
    setErro(null)
    const corpo = {
      name: nome.trim(),
      phone: telefone.trim() || null,
      address: endereco.trim() || null,
      site: {
        tagline: tagline.trim() || null,
        about: sobre.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
      },
    }

    iniciarTransicao(async () => {
      const r = await fetch('/api/v1/tenant', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(corpo),
      })
      const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui salvar.')
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Negócio atualizado' })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-txt-2">Seu site</p>
          <p className="truncate text-corpo font-semibold text-acc-2">{urlSite}</p>
        </div>
        <button
          type="button"
          onClick={copiarLink}
          aria-label="Copiar link do site"
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-txt-2 transition hover:bg-surface-3"
        >
          {copiado ? <Check aria-hidden className="size-5 text-ok" /> : <Copy aria-hidden className="size-5" />}
        </button>
        <a
          href={`/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir o site em nova aba"
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-txt-2 transition hover:bg-surface-3"
        >
          <ExternalLink aria-hidden className="size-5" />
        </a>
      </Card>

      <form action={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Nome do negócio</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Endereço da página</span>
          <input
            value={`ciclo.app/${tenant.slug}`}
            disabled
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-3 px-3 text-corpo tabular text-txt-3"
          />
          <span className="text-label text-txt-3">Não dá pra trocar depois de criado — links já enviados quebrariam.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Frase de capa (opcional)</span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Ex.: Elevando sua autoestima"
            maxLength={140}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Sobre o negócio (opcional)</span>
          <textarea
            value={sobre}
            onChange={(e) => setSobre(e.target.value)}
            rows={4}
            maxLength={2000}
            className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Endereço (rua, número, bairro, cidade)</span>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Telefone</span>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              inputMode="tel"
              placeholder="(11) 99999-9999"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">WhatsApp</span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              placeholder="(11) 99999-9999"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Instagram (opcional)</span>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@seuusuario"
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button type="submit" largura="cheia" carregando={pendente}>
          Salvar
        </Button>
      </form>
    </div>
  )
}
