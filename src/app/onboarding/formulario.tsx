'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import { SLUG_PROFISSAO_GENERICA } from '@/core/profissoes'
import { semAcento } from '@/core/text/normalizar'
import { APP_HOST } from '@/lib/app-url'

export type Profissao = { id: string; slug: string; nome: string; grupo: string; sinonimos: string[] }

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
  const [buscaProfissao, setBuscaProfissao] = useState('')
  const [professionId, setProfessionId] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function aoMudarNome(valor: string) {
    setNome(valor)
    if (!slugTocado) setSlug(slugificar(valor))
  }

  const profissaoEscolhida = profissoes.find((p) => p.id === professionId) ?? null

  /*
    A saída para quem não está nas 17. `?? null` e renderização condicional porque a linha vem do
    banco: se a `0078` não tiver sido aplicada, a tela mostra a frase sem oferecer um botão que
    levaria a um `professionId` inexistente — a rota recusaria com "Escolha uma profissão da lista",
    que é justamente o beco de novo, agora com um clique a mais.
  */
  const generica = profissoes.find((p) => p.slug === SLUG_PROFISSAO_GENERICA) ?? null

  const filtradas = useMemo(() => {
    const termo = semAcento(buscaProfissao)
    if (!termo) return profissoes
    return profissoes.filter((p) => semAcento(p.nome).includes(termo) || p.sinonimos.some((s) => semAcento(s).includes(termo)))
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
        /*
          `docs/20` §D.9: era "Não consegui criar seu negócio." — errado pelo mesmo motivo que o H1
          antigo (o negócio dela já existe) e, pior, sem dizer o que fazer. O endereço da página é o
          único dos três campos que pode colidir com o de outra pessoa, então é o único que a pessoa
          consegue consertar sozinha — a regra do CLAUDE.md é que o erro diga isso.
        */
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui criar sua conta. Confira o endereço da página e tente de novo.')
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
              /*
                O beco que o item 17 da auditoria achou. Aqui ficava só
                "Nenhuma profissão encontrada." — ponto final, na PRIMEIRA tela depois de criar a
                conta, com `professionId` obrigatório no esquema da rota. Quem não estivesse nas 17
                não tinha o que fazer, depois de já ter dado e-mail e senha.

                Tela vazia sem saída é beco sem saída: a mesma régua do `EmptyState`, que exige ação.
              */
              <div className="flex flex-col gap-2 p-3">
                <p className="text-secundario text-txt-3">
                  Não achamos “{buscaProfissao.trim()}” na lista.
                </p>
                {generica ? (
                  <button
                    type="button"
                    onClick={() => setProfessionId(generica.id)}
                    className="toque-48 flex h-11 shrink-0 items-center rounded-[var(--radius-sm)] bg-surface-2 px-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3"
                  >
                    Seguir como {generica.nome}
                  </button>
                ) : null}
                <p className="text-label text-txt-3">
                  A profissão só escolhe o ponto de partida. Seus serviços e horários você
                  configura do seu jeito depois.
                </p>
              </div>
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
                  //
                  // `toque-48` (L-12, 30/08): os 44px do `h-11` passam no mínimo da WCAG mas ficam
                  // abaixo do piso de 48px da casa, e esta é a PRIMEIRA tela de quem acabou de
                  // criar conta. A conta fecha exata: item de 44px + `gap-1` de 4px dá passo de
                  // 48px, e a área do `toque-48` é centrada — ela cresce 2px para cada lado e
                  // encosta no meio do vão, sem roubar o toque do vizinho de cima nem do de baixo.
                  className="toque-48 flex h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-3 text-left text-corpo text-txt transition-colors hover:bg-surface-2"
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
