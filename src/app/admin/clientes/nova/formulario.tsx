'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { camposDePreferencia } from '@/lib/preferencias'

/**
 * Faltava a tela mais básica de todas: o vazio da lista de clientes mandava para
 * `/admin/clientes/nova`, que **não existia** — um salão recém-criado clicava em "Cadastrar
 * cliente" e caía num 404, no primeiro minuto de uso. Até aqui só dava para criar cliente
 * importando planilha ou de raspão, ao marcar um horário.
 */
export default function FormularioCliente({ vertical }: { vertical: string }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [salvando, iniciarSalvamento] = useTransition()

  const campos = camposDePreferencia(vertical)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [notas, setNotas] = useState('')
  const [tags, setTags] = useState('')
  const [preferencias, setPreferencias] = useState<Record<string, string>>({})
  const [aceitaMarketing, setAceitaMarketing] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    setErro(null)
    iniciarSalvamento(async () => {
      const r = await fetch('/api/v1/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          name: nome,
          phone: telefone.trim() || null,
          birthDate: nascimento || null,
          notes: notas.trim() || null,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          preferences: Object.fromEntries(Object.entries(preferencias).filter(([, v]) => v.trim() !== '')),
          marketingOptIn: aceitaMarketing,
        }),
      })
      const json = (await r.json()) as {
        data?: { id: string }
        error?: { message: string; details?: { fields?: Record<string, string> } }
      }
      if (!r.ok || !json.data) {
        const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(campo ?? json.error?.message ?? 'Não consegui cadastrar.')
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Cliente cadastrado' })
      // Vai direto para a ficha: quem acabou de cadastrar quase sempre quer marcar o horário.
      router.push(`/admin/clientes/${json.data.id}`)
      router.refresh()
    })
  }

  return (
    <div className="pb-8">
      <header className="flex items-center gap-2 py-5">
        <Link
          href="/admin/clientes"
          aria-label="Voltar para a lista"
          className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-2 transition-colors hover:bg-surface-2 hover:text-txt"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-titulo font-extrabold">Novo cliente</h1>
      </header>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
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
              placeholder="(11) 98765-4321"
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Aniversário</span>
            <input
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
        </div>

        <p className="mt-1 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Como atender</p>
        {campos.map((campo) => (
          <label key={campo.chave} className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">{campo.rotulo}</span>
            <input
              value={preferencias[campo.chave] ?? ''}
              placeholder={campo.dica}
              onChange={(e) => setPreferencias((p) => ({ ...p, [campo.chave]: e.target.value }))}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
        ))}

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Etiquetas (separadas por vírgula)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="fiel, vip"
            className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label font-semibold text-txt-2">Observações</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 py-2 text-corpo text-txt"
          />
        </label>

        {/* Desmarcado por padrão: consentimento de marketing é opt-in de verdade (LGPD), quem
            marca é a pessoa que perguntou ao cliente — nunca o sistema por conveniência. */}
        <label className="flex items-start gap-2 py-1">
          <input
            type="checkbox"
            checked={aceitaMarketing}
            onChange={(e) => setAceitaMarketing(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded border-line-2 bg-surface-2"
          />
          <span className="text-corpo text-txt">
            Autorizou receber promoções e lembretes
            <span className="block text-secundario text-txt-3">Só marque se o cliente disse que pode.</span>
          </span>
        </label>

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button largura="cheia" carregando={salvando} onClick={salvar} disabled={nome.trim().length < 2}
          motivoDesabilitado={nome.trim().length < 2 ? 'Digite o nome do cliente primeiro.' : undefined}>
          Cadastrar cliente
        </Button>
      </div>
    </div>
  )
}
