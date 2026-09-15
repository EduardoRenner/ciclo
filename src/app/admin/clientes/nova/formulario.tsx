'use client'

import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { useVocabulario } from '@/components/shell/vocabulario'
import { mensagemDeClienteCadastrado } from '@/core/ciclo/primeiro-cliente'
import { comMaiuscula } from '@/core/text/vocabulario'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import PageHeader from '@/components/ui/page-header'
import PhoneInput from '@/components/ui/phone-input'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { camposDePreferencia } from '@/lib/preferencias'

/**
 * Faltava a tela mais básica de todas: o vazio da lista de clientes mandava para
 * `/admin/clientes/nova`, que **não existia** — um salão recém-criado clicava em "Cadastrar
 * cliente" e caía num 404, no primeiro minuto de uso. Até aqui só dava para criar cliente
 * importando planilha ou de raspão, ao marcar um horário.
 */
export default function FormularioCliente({ vertical, ehPrimeiroCliente = false }: { vertical: string; ehPrimeiroCliente?: boolean }) {
  const vocabulario = useVocabulario()
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
  // Fechado por padrão: cadastro rápido, com a cliente na cadeira, não pode parecer que exige
  // curvatura/espessura/alergia pra continuar. Quem tem a informação abre e preenche; quem não
  // tem segue direto pro nome e telefone, que é o caminho comum.
  const [mostrarComoAtender, setMostrarComoAtender] = useState(false)

  function salvar() {
    setErro(null)
    iniciarSalvamento(async () => {
      try {
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
        mostrarToast({ tom: 'ok', ...mensagemDeClienteCadastrado(ehPrimeiroCliente) })
        // Vai direto para a ficha: quem acabou de cadastrar quase sempre quer marcar o horário.
        router.push(`/admin/clientes/${json.data.id}`)
        router.refresh()
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <div className="pb-8">
      {/* O voltar mora na Topbar desde o redesenho — dois numa tela só confundem. */}
      <PageHeader titulo={`${comMaiuscula(vocabulario.cliente)} novo`} />

      <div className="flex flex-col gap-3">
        <Input rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus autoComplete="name" />

        <div className="grid grid-cols-2 gap-3">
          <PhoneInput valor={telefone} aoMudar={setTelefone} />
          <Input
            rotulo="Aniversário"
            type="date"
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            classNameCampo="tabular"
          />
        </div>

        {campos.length > 0 ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setMostrarComoAtender((v) => !v)}
              aria-expanded={mostrarComoAtender}
              className="toque-48 -mx-2 flex h-11 w-full items-center justify-between px-2 text-left"
            >
              <span className="text-label font-semibold text-txt-2">
                Como atender <span className="font-normal text-txt-3">(opcional)</span>
              </span>
              <ChevronDown aria-hidden className={`size-4 shrink-0 text-txt-3 transition-transform ${mostrarComoAtender ? 'rotate-180' : ''}`} />
            </button>
            {mostrarComoAtender ? (
              <div className="mt-2 flex flex-col gap-3">
                {campos.map((campo) => (
                  <Input
                    key={campo.chave}
                    rotulo={campo.rotulo}
                    value={preferencias[campo.chave] ?? ''}
                    placeholder={campo.dica}
                    onChange={(e) => setPreferencias((p) => ({ ...p, [campo.chave]: e.target.value }))}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <Input
          rotulo="Etiquetas"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="fiel, vip"
          ajuda="Separe por vírgula."
        />

        <Textarea rotulo="Observações" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />

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
