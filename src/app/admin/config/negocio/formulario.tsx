'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { PALETA_PRESET } from '@/core/text/cor'
import { APP_HOST } from '@/lib/app-url'
import { fetchComTentativa } from '@/lib/tentativa'

type Tenant = {
  name: string
  slug: string
  phone: string | null
  address: string | null
  site: { tagline?: string | null; about?: string | null; whatsapp?: string | null; instagram?: string | null; accent?: string | null }
  marcarParaHoje: boolean
  aparecerNaBusca: boolean
}

/** O mesmo osso do app (`--acc` em globals.css) — nunca o roxo antigo. */
const ACENTO_PADRAO = '#f0ebe3'

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
  // `null` = site nasce na cor padrão do CICLO. Só vira um hex quando o dono
  // escolhe de propósito — nunca herda cor de nicho/profissão (era assim que
  // cílios/sobrancelha nasciam roxo, ver docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md).
  const [acento, setAcento] = useState<string | null>(tenant.site.accent ?? null)
  // docs/114 L-04: desligado (padrão) = pelo link só a partir de amanhã; para hoje, a cliente chama no WhatsApp.
  const [marcarParaHoje, setMarcarParaHoje] = useState(tenant.marcarParaHoje)
  // docs/114 L-06: ligado por padrão; desligado, o negócio some da busca da cliente (o link continua valendo).
  const [aparecerNaBusca, setAparecerNaBusca] = useState(tenant.aparecerNaBusca)
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
        accent: acento,
      },
      marcarParaHoje,
      aparecerNaBusca,
    }

    iniciarTransicao(async () => {
      try {
        const r = await fetchComTentativa('/api/v1/tenant', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok) {
          const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }
        mostrarToast({ tom: 'ok', titulo: 'Negócio atualizado' })
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
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
          className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-txt-2 transition hover:bg-surface-3"
        >
          {copiado ? <Check aria-hidden className="size-5 text-ok" /> : <Copy aria-hidden className="size-5" />}
        </button>
        <a
          href={`/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir o site em nova aba"
          className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-txt-2 transition hover:bg-surface-3"
        >
          <ExternalLink aria-hidden className="size-5" />
        </a>
      </Card>

      <form method="post" action={enviar} className="flex flex-col gap-3">
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
            value={`${APP_HOST}/${tenant.slug}`}
            disabled
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-3 px-3 text-corpo tabular text-txt-3"
          />
          <span className="text-label text-txt-3">Não dá pra trocar depois de criado: links já enviados quebrariam.</span>
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

        <div className="flex flex-col gap-2">
          <span className="text-label font-semibold text-txt-2">Cor do seu site</span>
          <div className="flex flex-wrap items-center gap-2">
            {PALETA_PRESET.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => setAcento(p.hex)}
                aria-label={`Usar a cor ${p.nome}`}
                aria-pressed={acento === p.hex}
                title={p.nome}
                style={{ backgroundColor: p.hex }}
                className={
                  'size-12 shrink-0 rounded-full border-2 transition ' +
                  (acento === p.hex ? 'border-txt' : 'border-transparent hover:border-line-2')
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={acento ?? ACENTO_PADRAO}
              onChange={(e) => setAcento(e.target.value)}
              aria-label="Escolher outra cor do site"
              className="size-12 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-1"
            />
            {acento !== null ? (
              <button
                type="button"
                onClick={() => setAcento(null)}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-secundario text-txt-2 transition hover:bg-surface-3"
              >
                Usar a cor padrão
              </button>
            ) : (
              <span className="text-secundario text-txt-3">Cor padrão do CICLO, ou escolha outra ao lado.</span>
            )}
          </div>
        </div>

        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={marcarParaHoje}
            onChange={(e) => setMarcarParaHoje(e.target.checked)}
            className="size-5 shrink-0 rounded border-line-2 bg-surface-2 accent-[var(--acc-2)]"
          />
          <span className="text-corpo text-txt">
            Aceitar horário para hoje pelo link
            <span className="block text-secundario text-txt-2">Desligado, quem marca pelo link escolhe a partir de amanhã e, para hoje, chama no seu WhatsApp.</span>
          </span>
        </label>

        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={aparecerNaBusca}
            onChange={(e) => setAparecerNaBusca(e.target.checked)}
            className="size-5 shrink-0 rounded border-line-2 bg-surface-2 accent-[var(--acc-2)]"
          />
          <span className="text-corpo text-txt">
            Aparecer na busca do CICLO
            <span className="block text-secundario text-txt-2">Quem procura seu serviço na sua cidade acha sua página. Desligado, só quem tem o seu link chega.</span>
          </span>
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
