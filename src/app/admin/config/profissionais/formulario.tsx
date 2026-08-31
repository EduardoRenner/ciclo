'use client'

import { useState, useTransition } from 'react'

import { urlDaVitrine } from '@/core/text/vitrine'
import UploadDeFoto from '@/components/config/upload-de-foto'
import Button from '@/components/ui/button'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

export type ProfissionalEditavel = {
  id: string
  display_name: string
  bio: string | null
  color: string | null
  accepts_online: boolean
  /** Chave da foto no bucket `vitrine`. Escrita só pela rota de upload. */
  photo_key: string | null
}

type Props = {
  aberto: boolean
  aoFechar: () => void
  profissional?: ProfissionalEditavel | null
  aoSalvar: (profissional: ProfissionalEditavel) => void
}

// docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T4): `#a855f7` era o purple-500 cru que
// a Parte II do redesign tirou do resto do produto — aqui continuava sendo o
// PRIMEIRO valor da lista, ou seja, pré-selecionado (`CORES[0]`) em todo
// cadastro novo. Paleta trocada e a pré-seleção removida: sem escolha, o
// profissional nasce sem cor (`null`), nunca roxo por default.
// O nome existe porque o `aria-label` era `Cor #ec4899`: leitor de tela
// anunciando código hexadecimal não diz cor nenhuma a ninguém.
const CORES = [
  { hex: '#ec4899', nome: 'Rosa' },
  { hex: '#f59e0b', nome: 'Âmbar' },
  { hex: '#10b981', nome: 'Verde' },
  { hex: '#60a5fa', nome: 'Azul' },
  { hex: '#f87171', nome: 'Coral' },
  { hex: '#eab308', nome: 'Amarelo' },
]

/**
 * Cadastro de profissional sem convite/login — o "profissional que não usa o
 * app" que o `EmptyState` já mencionava sem ter como fazer. Modelo de
 * comissão fica fora do formulário de propósito (mexe em cálculo de
 * comissão de verdade); a API já tem `default('owner')`/`default(0)`, então
 * omitir os campos aqui não quebra nada.
 */
export default function FormularioProfissional({ aberto, aoFechar, profissional, aoSalvar }: Props) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()

  const [nome, setNome] = useState(profissional?.display_name ?? '')
  const [bio, setBio] = useState(profissional?.bio ?? '')
  // Sem pré-seleção: quem não escolhe fica sem cor, não herda a primeira da
  // lista (era assim que o roxo virava default silencioso — ver CORES acima).
  const [cor, setCor] = useState<string | null>(profissional?.color ?? null)
  const [aceitaOnline, setAceitaOnline] = useState(profissional?.accepts_online ?? true)
  const [erro, setErro] = useState<string | null>(null)

  const editando = !!profissional

  function enviar() {
    setErro(null)
    const corpo = { displayName: nome.trim(), bio: bio.trim() || null, color: cor, acceptsOnline: aceitaOnline }

    iniciarTransicao(async () => {
      try {
        const url = editando ? `/api/v1/professionals/${profissional.id}` : '/api/v1/professionals'
        const r = await fetch(url, {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as {
          data?: ProfissionalEditavel
          error?: { message: string; details?: { fields?: Record<string, string> } }
        }
        if (!r.ok || !json.data) {
          const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui salvar.')
          return
        }

        mostrarToast({ tom: 'ok', titulo: editando ? 'Profissional atualizado' : 'Profissional cadastrado' })
        aoSalvar(json.data)
        aoFechar()
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <Sheet aberto={aberto} aoFechar={(a) => !a && aoFechar()} titulo={editando ? 'Editar profissional' : 'Novo profissional'}>
      <div className="flex flex-col gap-3">
        {/*
          A foto vem primeiro: é o que a cliente vê na hora de escolher com quem marcar. Só ao
          editar — no cadastro a linha ainda não existe para vincular a imagem.
        */}
        <div className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Foto</span>
          <UploadDeFoto
            tipo="professional"
            id={profissional?.id ?? null}
            urlAtual={urlDaVitrine(profissional?.photo_key ?? null)}
            formato="redonda"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Bio (opcional)</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Cor (opcional)</span>
          <div className="flex flex-wrap gap-2">
            {/*
              Medido em 36px, abaixo do mínimo de 44 da WCAG e dos 48 do
              CLAUDE.md. `toque-48` estende a área tocável sem engordar o
              desenho — uma paleta de seis bolas de 48px viraria um quarteirão
              dentro do sheet, e o tamanho visual aqui está certo.
            */}
            {CORES.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.nome}
                aria-pressed={cor === c.hex}
                onClick={() => setCor(c.hex)}
                className="toque-48 size-9 rounded-[var(--radius-pill)] transition"
                style={{
                  backgroundColor: c.hex,
                  outline: cor === c.hex ? `2px solid var(--txt)` : undefined,
                  outlineOffset: 2,
                }}
              />
            ))}
            {cor !== null ? (
              <button
                type="button"
                onClick={() => setCor(null)}
                className="toque-48 flex h-9 items-center rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 text-label text-txt-2 transition hover:bg-surface-3"
              >
                Remover cor
              </button>
            ) : null}
          </div>
        </div>
        {/* `py-1` dava 31px de altura ao alvo — o rótulo é largo, mas baixo demais. */}
        <label className="flex min-h-12 items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={aceitaOnline}
            onChange={(e) => setAceitaOnline(e.target.checked)}
            className="size-5 rounded border-line-2 bg-surface-2"
          />
          <span className="text-corpo text-txt">Aceita agendamento pelo site</span>
        </label>

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button
          type="button"
          largura="cheia"
          carregando={pendente}
          onClick={enviar}
          disabled={!nome.trim()}
          motivoDesabilitado="Digite o nome do profissional para poder salvar."
        >
          {editando ? 'Salvar alterações' : 'Cadastrar profissional'}
        </Button>
      </div>
    </Sheet>
  )
}
