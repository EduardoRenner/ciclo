'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'

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
      <Input rotulo="Nome do negócio" value={nome} onChange={(e) => aoMudarNome(e.target.value)} required autoFocus />

      <Select rotulo="Especialidade" name="vertical" required defaultValue="">
        <option value="" disabled>
          Escolha uma
        </option>
        {VERTICAIS.map((v) => (
          <option key={v.valor} value={v.valor}>
            {v.rotulo}
          </option>
        ))}
      </Select>

      <Input
        rotulo="Endereço da sua página"
        prefixo="ciclo.app/"
        value={slug}
        onChange={(e) => {
          setSlugTocado(true)
          setSlug(slugificar(e.target.value))
        }}
        required
        minLength={5}
        classNameCampo="tabular pl-[92px]"
        ajuda="É o link que você manda para a cliente agendar."
      />

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Criar meu negócio
      </Button>
    </form>
  )
}
