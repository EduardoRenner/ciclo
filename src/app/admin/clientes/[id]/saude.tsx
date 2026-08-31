'use client'

import { FileCheck2, ShieldAlert, Lock } from 'lucide-react'
import { useState } from 'react'

import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'

type Props = {
  clientId: string
  saude: { temFicha: boolean; temAlerta: boolean; alerta: string | null }
  // `image_use` some daqui: `fotos.tsx` (TICKET-114) já mostra o estado dele de forma
  // interativa (conceder/revogar), listar de novo aqui seria a mesma informação em dois lugares.
  consentimentos: { kind: string; granted: boolean; grantedAt: string | null }[]
}

const ROTULO_CONSENTIMENTO: Record<string, string> = {
  health_data: 'Dado de saúde',
  image_use: 'Uso de imagem',
  marketing: 'Marketing',
  terms: 'Termos de uso',
}

type Vault = { data?: { respostas?: Record<string, unknown>; alertLabel?: string | null }; error?: { code: string; message: string } }

/**
 * Cofre, fotos e consentimento — os três dados sensíveis de LGPD que já existiam prontos no
 * banco (TICKET-049/052/053) sem tela nenhuma no admin. O conteúdo do cofre só chega ao
 * navegador quando a pessoa pede para abrir: cada abertura é um acesso registrado na trilha
 * (`vault_access_log`), então não cabe pré-carregar.
 */
export default function Saude({ clientId, saude, consentimentos }: Props) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [ficha, setFicha] = useState<Vault['data'] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function abrirCofre() {
    setAberto(true)
    setErro(null)
    if (ficha) return // já abriu nesta sessão de tela — reabrir o Sheet não gera novo acesso.
    setCarregando(true)
    fetch(`/api/v1/clients/${clientId}/vault`)
      .then((r) => r.json() as Promise<Vault>)
      .then((json) => {
        if (json.error?.code === 'MFA_REQUIRED') {
          setErro('Sua conta precisa de verificação em duas etapas ativada para abrir dado de saúde. Ative em Configurações.')
          return
        }
        if (json.error) {
          setErro(json.error.message)
          return
        }
        setFicha(json.data ?? {})
      })
      .catch(() => setErro('Não consegui abrir o cofre agora. Confira a conexão e tente de novo.'))
      .finally(() => setCarregando(false))
  }

  const consentimentosVisiveis = consentimentos.filter((c) => c.kind !== 'image_use')
  if (!saude.temFicha && consentimentosVisiveis.every((c) => !c.granted)) return null

  return (
    <section className="mt-7">
      <SectionHeader icone={<ShieldAlert className="size-3.5" />}>Saúde e LGPD</SectionHeader>
      <div className="grid gap-2">
        {saude.temFicha ? (
          <button type="button" onClick={abrirCofre} className="text-left">
            <Card
              className={
                saude.temAlerta ? 'flex items-center gap-3 border-bad/30 bg-bad/5' : 'flex items-center gap-3'
              }
            >
              <Lock aria-hidden className={saude.temAlerta ? 'size-5 shrink-0 text-bad' : 'size-5 shrink-0 text-txt-3'} />
              <div className="min-w-0 flex-1">
                <p className="text-corpo font-semibold">Ficha de saúde</p>
                <p className={saude.temAlerta ? 'text-secundario text-bad' : 'text-secundario text-txt-2'}>
                  {saude.temAlerta ? (saude.alerta ?? 'Tem alerta cadastrado') : 'Toque para abrir'}
                </p>
              </div>
            </Card>
          </button>
        ) : null}

        {consentimentosVisiveis.some((c) => c.granted) ? (
          <Card className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 size-5 shrink-0 text-txt-3" />
            <div className="min-w-0 flex-1">
              <p className="text-corpo">Termos assinados</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-secundario text-txt-3">
                {consentimentosVisiveis
                  .filter((c) => c.granted)
                  .map((c) => (
                    <span key={c.kind}>{ROTULO_CONSENTIMENTO[c.kind] ?? c.kind}</span>
                  ))}
              </p>
            </div>
          </Card>
        ) : null}
      </div>

      <Sheet aberto={aberto} aoFechar={(a) => !a && setAberto(false)} titulo="Ficha de saúde">
        {carregando ? (
          <p className="text-corpo text-txt-2">Abrindo...</p>
        ) : erro ? (
          <p className="text-corpo text-bad">{erro}</p>
        ) : ficha?.respostas ? (
          <dl className="grid gap-2.5">
            {Object.entries(ficha.respostas).map(([pergunta, resposta]) => (
              <div key={pergunta}>
                <dt className="text-label font-semibold text-txt-3">{pergunta}</dt>
                <dd className="mt-0.5 text-corpo text-txt">{String(resposta)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-corpo text-txt-2">Sem respostas registradas.</p>
        )}
        <p className="mt-4 text-label text-txt-3">Esta abertura foi registrada na trilha de acesso.</p>
      </Sheet>
    </section>
  )
}
