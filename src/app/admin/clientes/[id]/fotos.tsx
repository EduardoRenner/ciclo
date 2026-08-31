'use client'

import { Camera, Globe, ImagePlus, ShieldCheck, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

type Foto = { id: string; phase: string | null; createdAt: string; publicada: boolean }
type Fase = 'before' | 'after' | 'reference'

const ROTULO_FASE: Record<Fase, string> = { before: 'Antes', after: 'Depois', reference: 'Referência' }
const FASES: Fase[] = ['before', 'after', 'reference']

/**
 * `docs/35-FOTOS-CONSENTIMENTO-PLANO.md`, TICKET-114. Versão datada — mudar o texto no futuro
 * sobe a versão, e `registrarConsentimento` grava o hash de exatamente o que a pessoa leu naquele
 * momento (nunca o texto por extenso), então uma mudança de copy não reescreve consentimento
 * antigo.
 */
const VERSAO_CONSENTIMENTO_IMAGEM = '2026-08-31'
const TEXTO_CONSENTIMENTO_IMAGEM =
  'Autorizo o uso das minhas fotos de antes/depois para registro do atendimento e, se o negócio decidir mostrar, para divulgação (site, redes sociais). Posso retirar esta autorização a qualquer momento.'

type Props = {
  clientId: string
  fotos: Foto[]
  /** `null` = nunca respondeu; `false` = respondeu e negou/revogou; `true` = ativo agora. */
  consentimentoImagemConcedido: boolean
  /** Só existe quando `consentimentoImagemConcedido` — é o que viaja no upload pra vincular a foto. */
  consentId: string | null
}

/**
 * TICKET-051/052 tinham banco, RLS e serviço prontos e nenhuma tela — a ficha só mostrava "N
 * fotos de antes/depois" sem abrir nada (`saude.tsx`). Este componente é a primeira tela real:
 * subir, ver, excluir. "Publicar no site" fica de fora de propósito (TICKET-115, plano §35).
 */
export default function Fotos({ clientId, fotos: fotosIniciais, consentimentoImagemConcedido, consentId: consentIdInicial }: Props) {
  const mostrarToast = useToast()
  const entrada = useRef<HTMLInputElement>(null)

  const [fotos, setFotos] = useState(fotosIniciais)
  const [concedido, setConcedido] = useState(consentimentoImagemConcedido)
  const [consentId, setConsentId] = useState(consentIdInicial)
  const [fase, setFase] = useState<Fase | null>(null)
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null)
  const [visualizando, setVisualizando] = useState<{ id: string; url: string } | null>(null)
  const [carregandoId, setCarregandoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function subir(arquivo: File, comConsentId: string | null) {
    setCarregando(true)
    try {
      const form = new FormData()
      form.append('file', arquivo)
      if (fase) form.append('phase', fase)
      if (comConsentId) form.append('consentId', comConsentId)

      const r = await fetch(`/api/v1/clients/${clientId}/media`, { method: 'POST', body: form })
      // A rota devolve a linha CRUA de `media` (snake_case, sem `publicada` — esse campo só existe
      // no join de `listarMediaDoCliente`). Nunca confiar essa forma como se fosse `Foto`: uma
      // foto recém-subida nunca está publicada, então o valor é conhecido sem round-trip nenhum.
      const json = (await r.json()) as { data?: { id: string; phase: string | null; created_at: string }; error?: { message: string } }
      if (!r.ok || !json.data) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui subir a foto', descricao: json.error?.message ?? 'Tente outra imagem.' })
        return
      }
      setFotos((atuais) => [{ id: json.data!.id, phase: json.data!.phase, createdAt: json.data!.created_at, publicada: false }, ...atuais])
      mostrarToast({ tom: 'ok', titulo: 'Foto adicionada' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  async function concederEEnviar() {
    if (!arquivoPendente) return
    setCarregando(true)
    try {
      const r = await fetch(`/api/v1/clients/${clientId}/consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ kind: 'image_use', version: VERSAO_CONSENTIMENTO_IMAGEM, text: TEXTO_CONSENTIMENTO_IMAGEM, granted: true }),
      })
      const json = (await r.json()) as { data?: { id: string }; error?: { message: string } }
      if (!r.ok || !json.data) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui registrar o consentimento', descricao: json.error?.message ?? 'Tente de novo.' })
        return
      }
      setConcedido(true)
      setConsentId(json.data.id)
      const arquivo = arquivoPendente
      setArquivoPendente(null)
      await subir(arquivo, json.data.id)
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  async function revogar() {
    setCarregando(true)
    try {
      const r = await fetch(`/api/v1/clients/${clientId}/consents/image_use`, {
        method: 'DELETE',
        headers: { 'idempotency-key': crypto.randomUUID() },
      })
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui revogar', descricao: 'Tente de novo.' })
        return
      }
      setConcedido(false)
      setConsentId(null)
      mostrarToast({ tom: 'ok', titulo: 'Consentimento de uso de imagem revogado' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  async function abrir(foto: Foto) {
    setCarregandoId(foto.id)
    try {
      const r = await fetch(`/api/v1/media/${foto.id}/url`)
      const json = (await r.json()) as { data?: { url: string }; error?: { message: string } }
      if (!r.ok || !json.data) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui abrir a foto', descricao: json.error?.message ?? 'Tente de novo.' })
        return
      }
      setVisualizando({ id: foto.id, url: json.data.url })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregandoId(null)
    }
  }

  async function publicar(id: string) {
    setCarregando(true)
    try {
      const r = await fetch(`/api/v1/media/${id}/publish`, { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } })
      const json = (await r.json()) as { error?: { message: string } }
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui publicar', descricao: json.error?.message ?? 'Tente de novo.' })
        return
      }
      setFotos((atuais) => atuais.map((f) => (f.id === id ? { ...f, publicada: true } : f)))
      mostrarToast({ tom: 'ok', titulo: 'Foto publicada no site' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  async function despublicar(id: string) {
    setCarregando(true)
    try {
      const r = await fetch(`/api/v1/media/${id}/publish`, { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } })
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui tirar do site', descricao: 'Tente de novo.' })
        return
      }
      setFotos((atuais) => atuais.map((f) => (f.id === id ? { ...f, publicada: false } : f)))
      mostrarToast({ tom: 'ok', titulo: 'Foto tirada do site' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  async function excluir(id: string) {
    setCarregando(true)
    try {
      const r = await fetch(`/api/v1/media/${id}`, { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } })
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui excluir', descricao: 'Tente de novo.' })
        return
      }
      setFotos((atuais) => atuais.filter((f) => f.id !== id))
      setVisualizando(null)
      mostrarToast({ tom: 'ok', titulo: 'Foto excluída' })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira sua conexão e tente de novo.' })
    } finally {
      setCarregando(false)
    }
  }

  function arquivoEscolhido(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    // Limpa o valor pra escolher o MESMO arquivo de novo (depois de um erro) disparar `change` outra vez.
    e.target.value = ''
    if (!arquivo) return
    // Sem consentimento ativo, a foto não sobe até a pessoa decidir — nunca envia e pergunta depois.
    if (!concedido) {
      setArquivoPendente(arquivo)
      return
    }
    void subir(arquivo, consentId)
  }

  return (
    <section className="mt-7">
      <SectionHeader icone={<Camera className="size-3.5" />}>Fotos de antes/depois</SectionHeader>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FASES.map((f) => (
            <Chip key={f} ligado={fase === f} onClick={() => setFase((atual) => (atual === f ? null : f))}>
              {ROTULO_FASE[f]}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={carregando}
            className="toque-48 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-4 text-label font-semibold text-txt-2 transition hover:bg-surface-3 hover:text-txt disabled:opacity-60"
          >
            <ImagePlus aria-hidden className="size-3.5" />
            Adicionar foto
          </button>
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={arquivoEscolhido}
          />
        </div>

        {!concedido ? (
          <p className="text-secundario text-txt-3">
            Sem autorização de uso de imagem ativa. Ao escolher uma foto, a tela pede a autorização antes de enviar.
          </p>
        ) : (
          <button type="button" onClick={revogar} disabled={carregando} className="self-start text-secundario text-txt-3 underline decoration-line-2 underline-offset-2 hover:text-txt-2 disabled:opacity-60">
            Autorização de uso de imagem ativa · revogar
          </button>
        )}

        {fotos.length === 0 ? (
          <Card className="text-secundario text-txt-3">Nenhuma foto ainda.</Card>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => abrir(f)}
                disabled={carregandoId === f.id}
                className="toque-48 relative flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-txt-3 transition hover:bg-surface-3 disabled:opacity-60"
              >
                {f.publicada ? (
                  <Globe aria-hidden className="absolute right-1.5 top-1.5 size-3.5 text-acc-2" />
                ) : null}
                <Camera aria-hidden className="size-5" />
                {f.phase ? <span className="text-label">{ROTULO_FASE[f.phase as Fase] ?? f.phase}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pede autorização antes de subir a primeira foto — nunca envia e pergunta depois. */}
      <Sheet
        aberto={arquivoPendente !== null}
        aoFechar={(aberto) => !aberto && setArquivoPendente(null)}
        titulo="Autorizar uso de imagem"
        descricao="Necessário antes da primeira foto desta cliente."
      >
        <div className="flex flex-col gap-4">
          <p className="text-corpo text-txt-2">{TEXTO_CONSENTIMENTO_IMAGEM}</p>
          <div className="flex gap-2">
            <Button largura="cheia" carregando={carregando} onClick={concederEEnviar}>
              <ShieldCheck aria-hidden className="size-4" />
              Autorizar e enviar foto
            </Button>
            <Button variante="secondary" onClick={() => setArquivoPendente(null)} disabled={carregando}>
              Cancelar
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        aberto={visualizando !== null}
        aoFechar={(aberto) => !aberto && setVisualizando(null)}
        titulo="Foto"
      >
        {visualizando ? (
          <div className="flex flex-col gap-4">
            {/* URL assinada de 5 min, vinda de `urlAssinadaMedia` — sempre nova, nunca cacheada entre aberturas. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visualizando.url} alt="" className="w-full rounded-[var(--radius-sm)] object-contain" />
            {fotos.find((f) => f.id === visualizando.id)?.publicada ? (
              <Button variante="secondary" onClick={() => despublicar(visualizando.id)} carregando={carregando}>
                <Globe aria-hidden className="size-4" />
                Publicada no site · tirar do ar
              </Button>
            ) : (
              <Button
                variante="secondary"
                onClick={() => publicar(visualizando.id)}
                carregando={carregando}
                disabled={!concedido}
                motivoDesabilitado="Conceda a autorização de uso de imagem desta cliente antes de publicar."
              >
                <Globe aria-hidden className="size-4" />
                Publicar no site
              </Button>
            )}
            <Button variante="secondary" onClick={() => excluir(visualizando.id)} carregando={carregando}>
              <Trash2 aria-hidden className="size-4" />
              Excluir foto
            </Button>
          </div>
        ) : null}
      </Sheet>
    </section>
  )
}
