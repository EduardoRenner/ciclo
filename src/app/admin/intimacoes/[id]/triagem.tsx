'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type Sugestao = { venceEm: string; internoEm: string | null; memoria: Record<string, unknown>; regra: string }

type Props = {
  intimacao: { id: string; texto: string | null; status: string; sugestao: Sugestao | null; semSugestao: string | null }
  casos: { id: string; rotulo: string }[]
  casoInicial: string | null
}

const data = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const texto = (v: unknown) => (typeof v === 'string' ? v : null)

/**
 * A memória de cálculo em linhas legíveis, no formato que `sugerirPrazo` grava (`core/advocacia/
 * prazo-sugestao.ts`). Só as chaves conhecidas: o resto do JSON não vira tela.
 */
function linhasDaMemoria(m: Record<string, unknown>): string[] {
  const linhas: string[] = []
  const dias = typeof m.dias_lidos === 'number' ? m.dias_lidos : null
  if (dias !== null) linhas.push(`Regra: ${dias} dias ${m.unidade === 'corridos' ? 'corridos' : 'úteis'}${m.em_dobro === true ? ', em dobro' : ''}`)
  if (texto(m.disponibilizado_em)) linhas.push(`Disponibilizada em ${data(texto(m.disponibilizado_em)!)}`)
  if (texto(m.publicado_em)) linhas.push(`Considerada publicada em ${data(texto(m.publicado_em)!)}`)
  if (texto(m.inicio_em)) linhas.push(`Contagem começa em ${data(texto(m.inicio_em)!)}`)
  if (Array.isArray(m.pulados) && m.pulados.length > 0) {
    const pulados = m.pulados.filter((p): p is string => typeof p === 'string').map((p) => `${data(p.slice(0, 10))}${p.length > 11 ? ` (${p.slice(11)})` : ''}`)
    linhas.push(`Dias que não contaram: ${pulados.join(', ')}`)
  }
  if (texto(m.vence_em)) linhas.push(`Último dia: ${data(texto(m.vence_em)!)}`)
  if (texto(m.trecho)) linhas.push(`Trecho lido: “${texto(m.trecho)}”`)
  return linhas
}

type Acao = 'criar_prazo' | 'sem_prazo' | 'descartar'

/**
 * docs/101 T4.5: a triagem. A data do prazo NASCE VAZIA mesmo com sugestão (anexo 06 §5.1: "o sistema
 * sugere e explica; quem confirma é a pessoa"): "Usar a sugestão" preenche, e só então "Confirmar prazo"
 * grava. Sem sugestão, a frase 18 do anexo 04 pede a data.
 */
export default function Triagem({ intimacao, casos, casoInicial }: Props) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [caso, setCaso] = useState(casoInicial ?? '')
  const [fatal, setFatal] = useState('')
  const [interno, setInterno] = useState('')
  const [titulo, setTitulo] = useState('Manifestação')
  const [motivo, setMotivo] = useState('')
  const [modo, setModo] = useState<'prazo' | 'sem_prazo' | 'descartar'>('prazo')
  const [erro, setErro] = useState<string | null>(null)
  const decidida = ['prazo_criado', 'sem_prazo', 'descartada'].includes(intimacao.status)
  const s = intimacao.sugestao

  function decidir(acao: Acao) {
    setErro(null)
    iniciar(async () => {
      try {
        const corpo =
          acao === 'criar_prazo'
            ? { acao, caseId: caso, dueOn: fatal, ...(interno ? { internalDueOn: interno } : {}), title: titulo }
            : { acao, motivo, ...(caso ? { caseId: caso } : {}) }
        const r = await fetch(`/api/v1/legal/intimations/${intimacao.id}/decide`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(corpo),
        })
        const json = (await r.json()) as { data?: { status: string; confirmado?: boolean }; error?: { message: string } }
        if (!r.ok || !json.data) {
          setErro(json.error?.message ?? 'Não consegui registrar a decisão. Tente de novo.')
          return
        }
        mostrarToast({
          tom: 'ok',
          titulo:
            acao === 'criar_prazo'
              ? json.data.confirmado === false
                ? 'Prazo criado. Falta a confirmação da advocacia.'
                : 'Prazo confirmado'
              : acao === 'sem_prazo'
                ? 'Registrado: não gera prazo'
                : 'Intimação descartada',
        })
        router.push('/admin/hoje')
        router.refresh()
      } catch {
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5 pb-10" aria-busy={pendente}>
      <Card className="p-4">
        <p className="whitespace-pre-line text-corpo leading-relaxed text-txt">{intimacao.texto ?? 'Texto indisponível para o seu perfil.'}</p>
        <p className="mt-3 flex items-center gap-1.5 text-label text-txt-3">
          <Lock aria-hidden className="size-3.5" />A abertura do texto fica registrada na trilha.
        </p>
      </Card>

      {decidida ? (
        <p role="status" className="text-corpo font-semibold">
          Esta intimação já foi decidida.
        </p>
      ) : (
        <>
          <Select rotulo="Caso" value={caso} onChange={(e) => setCaso(e.target.value)}>
            <option value="">Nenhum caso (não é do escritório ou ainda não existe)</option>
            {casos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </Select>

          <div role="tablist" aria-label="Decisão" className="flex flex-wrap gap-2">
            {(
              [
                ['prazo', 'Gera prazo'],
                ['sem_prazo', 'Não gera prazo'],
                ['descartar', 'Descartar'],
              ] as const
            ).map(([m, rotulo]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={modo === m}
                onClick={() => setModo(m)}
                className={`inline-flex h-12 items-center rounded-[var(--radius-pill)] px-4 text-secundario font-semibold ${
                  modo === m ? 'bg-acc text-on-acc' : 'border border-line-2 bg-surface-2 text-txt-2'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {modo === 'prazo' ? (
            <section className="flex flex-col gap-4" aria-label="Prazo">
              {s ? (
                <Card className="border-warn/40 p-4">
                  <p className="text-label font-semibold uppercase tracking-wide text-warn">Sugestão a confirmar</p>
                  <p className="mt-1 text-corpo font-semibold">
                    Fatal {data(s.venceEm)}
                    {s.internoEm ? ` · fazer até ${data(s.internoEm)}` : ''}
                  </p>
                  <ul className="mt-2 flex flex-col gap-0.5 text-secundario text-txt-2">
                    {linhasDaMemoria(s.memoria).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-label text-txt-3">Regra de contagem ainda não confirmada pela direção: confira e digite a data.</p>
                  <Button
                    tamanho="sm"
                    variante="secondary"
                    className="mt-3"
                    onClick={() => {
                      setFatal(s.venceEm)
                      setInterno(s.internoEm ?? '')
                    }}
                  >
                    Usar a sugestão
                  </Button>
                </Card>
              ) : (
                <p className="text-secundario text-txt-2">{intimacao.semSugestao ?? 'Não consegui ler o prazo com segurança.'} Informe a data.</p>
              )}
              <Input rotulo="O que fazer" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input rotulo="Prazo fatal" type="date" value={fatal} onChange={(e) => setFatal(e.target.value)} required />
                <Input rotulo="Fazer até (interno)" type="date" value={interno} onChange={(e) => setInterno(e.target.value)} ajuda="Opcional. Antes do fatal." />
              </div>
              <Button
                largura="cheia"
                carregando={pendente}
                disabled={!caso || !fatal}
                motivoDesabilitado={!caso ? 'Escolha o caso desta intimação.' : 'Digite a data do prazo fatal.'}
                onClick={() => decidir('criar_prazo')}
              >
                Confirmar prazo
              </Button>
            </section>
          ) : (
            <section className="flex flex-col gap-4" aria-label="Motivo">
              <Textarea
                rotulo={modo === 'sem_prazo' ? 'Por que não gera prazo' : 'Por que descartar'}
                ajuda="Fica no histórico da intimação."
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={500}
              />
              <Button
                largura="cheia"
                variante={modo === 'descartar' ? 'danger' : 'primary'}
                carregando={pendente}
                disabled={motivo.trim().length < 5}
                motivoDesabilitado="Escreva o motivo com pelo menos 5 letras."
                onClick={() => decidir(modo === 'sem_prazo' ? 'sem_prazo' : 'descartar')}
              >
                {modo === 'sem_prazo' ? 'Registrar sem prazo' : 'Descartar intimação'}
              </Button>
            </section>
          )}

          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
