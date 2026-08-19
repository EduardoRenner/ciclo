'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'

const VERTICAIS: { valor: string; rotulo: string }[] = [
  { valor: 'barber', rotulo: 'Barbearia' },
  { valor: 'nails', rotulo: 'Unhas' },
  { valor: 'lashes', rotulo: 'Cílios' },
  { valor: 'brows', rotulo: 'Sobrancelha' },
  { valor: 'waxing', rotulo: 'Depilação' },
  { valor: 'aesthetics', rotulo: 'Estética' },
  { valor: 'tattoo', rotulo: 'Tatuagem' },
  { valor: 'hair', rotulo: 'Cabelo' },
]

function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acento (NFD separa a letra do diacrítico)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export default function FormularioOnboarding() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTocado, setSlugTocado] = useState(false)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function aoMudarNome(valor: string) {
    setNome(valor)
    if (!slugTocado) setSlug(slugificar(valor))
  }

  async function enviar(formData: FormData) {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          businessName: nome,
          vertical: formData.get('vertical'),
          slug,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        }),
      })
      const json = (await resposta.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!resposta.ok) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui criar seu negócio.')
        return
      }
      router.push('/admin/hoje')
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <form action={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Nome do negócio</span>
        <input
          value={nome}
          onChange={(e) => aoMudarNome(e.target.value)}
          required
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Especialidade</span>
        <select
          name="vertical"
          required
          defaultValue=""
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        >
          <option value="" disabled>
            Escolha uma
          </option>
          {VERTICAIS.map((v) => (
            <option key={v.valor} value={v.valor}>
              {v.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Endereço da sua página (ciclo.app/{slug || '...'})</span>
        <input
          value={slug}
          onChange={(e) => {
            setSlugTocado(true)
            setSlug(slugificar(e.target.value))
          }}
          required
          minLength={5}
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
        />
      </label>
      {erro ? <p className="text-secundario text-bad">{erro}</p> : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Criar meu negócio
      </Button>
    </form>
  )
}
