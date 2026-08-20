'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

export type Profissao = { id: string; nome: string; grupo: string; sinonimos: string[] }

function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acento (NFD separa a letra do diacrítico)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Mesmo tratamento de acento/caixa de `slugificar`, sem virar slug — é só pra comparar texto de busca. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
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
  const [buscaProfissao, setBuscaProfissao] = useState('')
  const [professionId, setProfessionId] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function aoMudarNome(valor: string) {
    setNome(valor)
    if (!slugTocado) setSlug(slugificar(valor))
  }

  const profissaoEscolhida = profissoes.find((p) => p.id === professionId) ?? null

  const filtradas = useMemo(() => {
    const termo = normalizar(buscaProfissao)
    if (!termo) return profissoes
    return profissoes.filter((p) => normalizar(p.nome).includes(termo) || p.sinonimos.some((s) => normalizar(s).includes(termo)))
  }, [buscaProfissao, profissoes])

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
    <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input rotulo="Nome do negócio" value={nome} onChange={(e) => aoMudarNome(e.target.value)} required autoFocus />

      {profissaoEscolhida ? (
        <button
          type="button"
          onClick={() => setProfessionId(null)}
          className="flex h-12 items-center justify-between rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 text-left text-corpo font-semibold text-txt"
        >
          {profissaoEscolhida.nome}
          <span className="text-secundario font-normal text-txt-3">Trocar</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            rotulo="Sua profissão"
            value={buscaProfissao}
            onChange={(e) => setBuscaProfissao(e.target.value)}
            placeholder="Ex.: barbeiro, diarista, personal…"
          />
          <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-[var(--radius-sm)] border border-line-2 p-1">
            {filtradas.length === 0 ? (
              <p className="p-3 text-secundario text-txt-3">Nenhuma profissão encontrada.</p>
            ) : (
              filtradas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfessionId(p.id)}
                  // `shrink-0`: sem isso o flexbox comprimia os 17 itens pra caber nos 220px do
                  // contêiner em vez de deixar o `overflow-y-auto` rolar — alvo de toque de
                  // 44px virava 23px na prática (medido ao vivo, mesmo defeito recorrente da
                  // família, §4.2 do DESIGN-E-INTERFACE.md, causa raiz diferente das outras).
                  className="flex h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-3 text-left text-corpo text-txt transition-colors hover:bg-surface-2"
                >
                  {p.nome}
                </button>
              ))
            )}
          </div>
        </div>
      )}

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
