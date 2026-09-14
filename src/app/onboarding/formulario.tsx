'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import SeletorProfissao, { type Profissao } from '@/components/ui/seletor-profissao'
import { APP_HOST } from '@/lib/app-url'
import { lerRascunhoOnboarding, limparRascunhoOnboarding } from '@/lib/rascunho-onboarding'

function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acento (NFD separa a letra do diacrítico)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * docs/09-PLATAFORMA.md P4/§7: até aqui o cadastro só oferecia as 8 verticais de beleza — não
 * existia jeito de uma eletricista ou faxineira se cadastrar, mesmo com o catálogo de 17
 * profissões pronto desde P0/P5. Busca usa `sinonimos` (professions.sinonimos, ex.: "diarista"
 * acha "faxina") — é o motivo de essa coluna existir desde a migration 0022, sem nunca ter sido
 * lida até agora.
 */
export default function FormularioOnboarding({ profissoes }: { profissoes: Profissao[] }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTocado, setSlugTocado] = useState(false)
  const [professionId, setProfessionId] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  /*
   * Ponte com o quiz de `/cadastro` (docs/DECISOES.md 14/09): se a pessoa já respondeu nome do
   * negócio/profissão/endereço lá antes de confirmar o e-mail, o rascunho sobrevive no
   * `localStorage` e chega pré-preenchido aqui — ela só confere e confirma, não repete as três
   * perguntas. Roda em `useEffect`, não direto no `useState` inicial, porque o valor depende de
   * `profissoes` (prop) para validar que o `professionId` salvo ainda existe na lista atual.
   */
  useEffect(() => {
    const rascunho = lerRascunhoOnboarding()
    if (!rascunho) return
    if (profissoes.some((p) => p.id === rascunho.professionId)) {
      setNome(rascunho.businessName)
      setSlug(rascunho.slug)
      setSlugTocado(true)
      setProfessionId(rascunho.professionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aoMudarNome(valor: string) {
    setNome(valor)
    if (!slugTocado) setSlug(slugificar(valor))
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!professionId) {
      setErro('Escolha sua profissão na lista.')
      return
    }
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          businessName: nome,
          professionId,
          slug,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        }),
      })
      const json = (await resposta.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!resposta.ok) {
        /*
          `docs/20` §D.9: era "Não consegui criar seu negócio." — errado pelo mesmo motivo que o H1
          antigo (o negócio dela já existe) e, pior, sem dizer o que fazer. O endereço da página é o
          único dos três campos que pode colidir com o de outra pessoa, então é o único que a pessoa
          consegue consertar sozinha — a regra do CLAUDE.md é que o erro diga isso.
        */
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui criar sua conta. Confira o endereço da página e tente de novo.')
        return
      }
      limparRascunhoOnboarding()
      router.push('/admin/hoje')
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input rotulo="Nome do negócio" value={nome} onChange={(e) => aoMudarNome(e.target.value)} required autoFocus />

      <SeletorProfissao profissoes={profissoes} professionId={professionId} aoEscolher={(id) => setProfessionId(id || null)} />

      <Input
        rotulo="Endereço da sua página"
        prefixo={`${APP_HOST}/`}
        value={slug}
        onChange={(e) => {
          setSlugTocado(true)
          setSlug(slugificar(e.target.value))
        }}
        required
        minLength={5}
        // `pl-*` abre espaço pro prefixo sobreposto (`APP_HOST` + barra). Medido pro host atual
        // (16 caracteres em `tabular`); com o host antigo, de 10, o slug encostava no prefixo.
        classNameCampo="tabular pl-[148px]"
        ajuda="É o link que você manda para agendar."
      />

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente}>
        Colocar minha página no ar
      </Button>
    </form>
  )
}
