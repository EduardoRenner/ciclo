'use client'

import { Link2, Plus, Users } from 'lucide-react'
import { useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'

import FormularioProfissional, { type ProfissionalEditavel } from './formulario'

type Profissional = ProfissionalEditavel & {
  comp_model: string
  active: boolean
  user_id: string | null
}

type Convite = {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
}

const ROTULO_PAPEL: Record<string, string> = {
  owner: 'Dono',
  manager: 'Gerente',
  professional: 'Profissional',
  reception: 'Recepção',
  finance: 'Financeiro',
}

async function postar(url: string, corpo: unknown) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(corpo),
  })
  const json = (await r.json()) as { data?: unknown; error?: { message: string } }
  if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui completar a ação.')
  return json.data
}

export default function ListaProfissionais({
  profissionaisIniciais,
  convitesIniciais,
}: {
  profissionaisIniciais: Profissional[]
  convitesIniciais: Convite[]
}) {
  const [profissionais, setProfissionais] = useState(profissionaisIniciais)
  const [convites, setConvites] = useState(convitesIniciais)
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [sheetConvite, setSheetConvite] = useState(false)
  /*
    O link do convite existia SÓ dentro de `enviarConvite`: era copiado para a área de
    transferência e descartado. Quando `writeText` falha (Safari, PWA, contexto sem foco), o
    convite já está criado no servidor e o link não sobra em lugar nenhum da tela — a lista de
    convites mostra e-mail, papel e validade, nunca o link. Este estado é a saída: guarda o link
    para a pessoa copiar à mão quando o atalho não funcionar.
  */
  const [linkNaoCopiado, setLinkNaoCopiado] = useState<string | null>(null)
  const [editando, setEditando] = useState<Profissional | 'novo' | null>(null)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()

  const visiveis = profissionais.filter((p) => mostrarInativos || p.active)

  function aoSalvarNovo(p: ProfissionalEditavel) {
    setProfissionais((atual) => [...atual, { ...p, comp_model: 'owner', active: true, user_id: null }])
  }

  function aoSalvarEditado(p: ProfissionalEditavel) {
    setProfissionais((atual) => atual.map((x) => (x.id === p.id ? { ...x, ...p } : x)))
  }

  function desativar(id: string) {
    const anterior = profissionais
    setProfissionais((atual) => atual.map((p) => (p.id === id ? { ...p, active: false } : p)))

    iniciarTransicao(async () => {
      try {
        await fetch(`/api/v1/professionals/${id}`, {
          method: 'DELETE',
          headers: { 'idempotency-key': crypto.randomUUID() },
        })
      } catch {
        setProfissionais(anterior)
        mostrarToast({ tom: 'erro', titulo: 'Não consegui desativar', descricao: 'Tente de novo em instantes.' })
      }
    })
  }

  function enviarConvite(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim()
    const role = String(formData.get('role') ?? 'professional')
    const displayName = String(formData.get('displayName') ?? '').trim() || undefined

    iniciarTransicao(async () => {
      try {
        const resultado = (await postar('/api/v1/memberships/invite', { email, role, displayName })) as {
          invite: Convite
          link: string
        }
        setConvites((atual) => [resultado.invite, ...atual])

        // Sem WhatsApp/e-mail automático ainda (Sprint 2): o link vai para a
        // área de transferência para o dono colar onde quiser mandar.
        //
        // O `.catch(() => {})` que existia aqui descartava a falha e o toast anunciava "Link
        // copiado" de qualquer jeito. Quando a cópia falha — Safari, PWA, aba sem foco — o
        // convite já existe no servidor e o link não sobra em lugar nenhum: a lista mostra
        // e-mail, papel e validade, nunca o link. A pessoa ficava sem como mandar o convite que
        // ela acabou de criar, e sem saber disso.
        const copiou = await navigator.clipboard
          .writeText(resultado.link)
          .then(() => true)
          .catch(() => false)

        if (copiou) {
          setSheetConvite(false)
          mostrarToast({ tom: 'ok', titulo: 'Convite criado', descricao: 'Link copiado. É só colar e mandar.' })
          return
        }

        // O Sheet fica ABERTO de propósito: fechar levaria embora a única cópia do link.
        setLinkNaoCopiado(resultado.link)
        mostrarToast({
          tom: 'ok',
          titulo: 'Convite criado',
          descricao: 'Não consegui copiar sozinho. O link está aí na tela para você copiar.',
        })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui convidar', descricao: (erro as Error).message })
      }
    })
  }

  return (
    <div aria-busy={pendente}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Chip ligado={!mostrarInativos} onClick={() => setMostrarInativos(false)}>
            Ativos
          </Chip>
          <Chip ligado={mostrarInativos} onClick={() => setMostrarInativos(true)}>
            Todos
          </Chip>
        </div>
        <div className="flex gap-2">
          <Button variante="secondary" onClick={() => setEditando('novo')}>
            <Plus aria-hidden className="size-4" />
            Cadastrar
          </Button>
          <Button variante="secondary" onClick={() => setSheetConvite(true)}>
            <Link2 aria-hidden className="size-4" />
            Convidar
          </Button>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icone={<Users aria-hidden className="size-6" />}
            titulo="Ninguém no time ainda"
            descricao="Convide alguém ou cadastre um profissional que não usa o app."
            acao={
              <Button onClick={() => setSheetConvite(true)}>
                <Link2 aria-hidden className="size-4" />
                Convidar
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((p) => (
            <li key={p.id}>
              <Card className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setEditando(p)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? 'var(--txt-3)' }} />
                    <span className="truncate text-corpo font-semibold">{p.display_name}</span>
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {!p.active ? <Badge estado="bad">Inativo</Badge> : null}
                    {!p.user_id ? <Badge estado="info">Sem login</Badge> : null}
                  </div>
                </button>
                {p.active ? (
                  <Button variante="secondary" onClick={() => desativar(p.id)} disabled={pendente}>
                    Desativar
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {convites.filter((c) => !c.accepted_at).length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
            Convites pendentes
          </h2>
          <ul className="flex flex-col gap-2">
            {convites
              .filter((c) => !c.accepted_at)
              .map((c) => (
                <li key={c.id}>
                  <Card>
                    <p className="text-corpo font-semibold">{c.email}</p>
                    <p className="mt-0.5 text-secundario text-txt-2">
                      {ROTULO_PAPEL[c.role] ?? c.role} · vence em{' '}
                      {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  </Card>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <Sheet
        aberto={sheetConvite}
        aoFechar={(v) => {
          setSheetConvite(v)
          if (!v) setLinkNaoCopiado(null)
        }}
        titulo="Convidar para o time"
      >
        {/*
          O link que o atalho de cópia não conseguiu levar. Fica DENTRO do Sheet, acima do
          formulário, porque é a única cópia que existe: o convite já está no servidor e a lista
          abaixo não mostra link nenhum. `readOnly` com `onFocus` selecionando tudo é o que
          torna "copiar à mão" um gesto e não uma tarefa.
        */}
        {linkNaoCopiado ? (
          <div className="mb-4 flex flex-col gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-3">
            <p className="text-label font-semibold text-txt-2">Link do convite</p>
            <input
              readOnly
              value={linkNaoCopiado}
              onFocus={(e) => e.currentTarget.select()}
              className="h-12 w-full rounded-[var(--radius-sm)] border border-line-2 bg-surface px-3 text-corpo text-txt"
            />
            <p className="text-label text-txt-3">
              Copie e mande por onde preferir. Ele some desta tela quando você fechar.
            </p>
          </div>
        ) : null}

        <form
          /*
            `onSubmit` e não `action`: no React 19 a action reseta o formulário quando TERMINA,
            inclusive quando falhou. Os três campos daqui são não-controlados (`name=` puro, sem
            `value`/`onChange`), então o reset apagava e-mail, papel e nome a cada tentativa de
            convite que desse errado. É o mesmo conserto já feito nas quatro telas de `(auth)` e
            em `editor-expediente`.
          */
          onSubmit={(e) => {
            e.preventDefault()
            enviarConvite(new FormData(e.currentTarget))
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">E-mail</span>
            <input
              name="email"
              type="email"
              required
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Papel</span>
            <select
              name="role"
              defaultValue="professional"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            >
              {Object.entries(ROTULO_PAPEL)
                .filter(([valor]) => valor !== 'owner')
                .map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Nome (se for profissional)</span>
            <input
              name="displayName"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>

          <Button type="submit" largura="cheia" carregando={pendente}>
            Gerar link de convite
          </Button>
        </form>
      </Sheet>

      {editando === 'novo' ? (
        <FormularioProfissional aberto aoFechar={() => setEditando(null)} aoSalvar={aoSalvarNovo} />
      ) : editando ? (
        <FormularioProfissional aberto profissional={editando} aoFechar={() => setEditando(null)} aoSalvar={aoSalvarEditado} />
      ) : null}
    </div>
  )
}
