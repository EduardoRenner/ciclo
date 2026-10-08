'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

import type { Empresa, Pessoa } from '@/core/advocacia/estrutura-da-familia'

const VINCULOS = [
  ['titular', 'Titular'],
  ['conjuge', 'Cônjuge'],
  ['filho_filha', 'Filho ou filha'],
  ['pai_mae', 'Pai ou mãe'],
  ['irmao_irma', 'Irmão ou irmã'],
  ['neto_neta', 'Neto ou neta'],
  ['socio_socia', 'Sócio ou sócia'],
  ['outro', 'Outro vínculo'],
] as const

const TIPOS_DE_EMPRESA = [
  ['holding_patrimonial', 'Holding patrimonial'],
  ['holding_participacoes', 'Holding de participações'],
  ['holding_mista', 'Holding mista'],
  ['operacional', 'Operacional'],
  ['outra', 'Outra'],
] as const

const TIPOS_DE_ATO = [
  ['constituicao', 'Constituição'],
  ['alteracao_contratual', 'Alteração contratual'],
  ['cessao_quotas', 'Cessão de quotas'],
  ['doacao_quotas', 'Doação de quotas'],
  ['entrada_socio', 'Entrada de sócio'],
  ['saida_socio', 'Saída de sócio'],
  ['aumento_capital', 'Aumento de capital'],
  ['reducao_capital', 'Redução de capital'],
  ['transformacao', 'Transformação'],
  ['incorporacao', 'Incorporação'],
  ['outro', 'Outro'],
] as const

async function enviar(url: string, corpo: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(corpo) })
    if (r.ok) return null
    const json = (await r.json().catch(() => ({}))) as { error?: { message?: string; details?: { fields?: Record<string, string> } } }
    const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
    return campo ?? json.error?.message ?? 'Não consegui salvar. Tente de novo.'
  } catch {
    return 'Não consegui falar com o servidor. Confira a conexão e tente de novo.'
  }
}

type Props = { clienteId: string; pessoas: Pessoa[]; empresas: Empresa[]; hoje: string }

/**
 * docs/101 T2.1/T3.1: cadastrar pessoa, empresa e ato societário. O ato registra o QUADRO NOVO na data
 * do ato; o anterior fica na história (linha do tempo da estrutura). Soma diferente de 100% não é
 * bloqueada: a tela da estrutura avisa e a pessoa decide (o produto nunca corrige sozinho).
 */
export default function CadastroDaEstrutura({ clienteId, pessoas, empresas, hoje }: Props) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [aberto, setAberto] = useState<'pessoa' | 'empresa' | 'ato' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pessoa, setPessoa] = useState({ fullName: '', relationship: 'conjuge' })
  const [empresa, setEmpresa] = useState({ legalName: '', kind: 'holding_patrimonial' })
  const [ato, setAto] = useState({ empresaId: empresas[0]?.id ?? '', kind: 'alteracao_contratual', effectiveOn: hoje })
  const [quadro, setQuadro] = useState<{ dono: string; percent: string }[]>([{ dono: '', percent: '' }])

  const donos = [
    ...pessoas.map((p) => ({ chave: `person:${p.id}`, nome: p.nome })),
    ...empresas.filter((e) => e.id !== ato.empresaId).map((e) => ({ chave: `entity:${e.id}`, nome: e.nome })),
  ]
  const soma = quadro.reduce((s, l) => s + (Number(l.percent.replace(',', '.')) || 0), 0)

  function salvar(url: string, corpo: unknown, feito: string) {
    setErro(null)
    iniciar(async () => {
      const falha = await enviar(url, corpo)
      if (falha) return setErro(falha)
      mostrarToast({ tom: 'ok', titulo: feito })
      setAberto(null)
      setPessoa({ fullName: '', relationship: 'conjuge' })
      setEmpresa({ legalName: '', kind: 'holding_patrimonial' })
      setQuadro([{ dono: '', percent: '' }])
      router.refresh()
    })
  }

  const botao = (qual: 'pessoa' | 'empresa' | 'ato', rotulo: string) => (
    <Button tamanho="sm" variante={aberto === qual ? 'primary' : 'secondary'} onClick={() => (setAberto(aberto === qual ? null : qual), setErro(null))}>
      <Plus aria-hidden className="size-4" />
      {rotulo}
    </Button>
  )

  return (
    <div className="flex flex-col gap-3" aria-busy={pendente}>
      <div className="flex flex-wrap gap-2">
        {botao('pessoa', 'Pessoa')}
        {botao('empresa', 'Empresa')}
        {empresas.length > 0 && donos.length > 0 ? botao('ato', 'Ato societário') : null}
      </div>

      {aberto === 'pessoa' ? (
        <Card className="flex flex-col gap-3 p-3">
          <Input rotulo="Nome completo" value={pessoa.fullName} onChange={(e) => setPessoa({ ...pessoa, fullName: e.target.value })} maxLength={160} />
          <Select rotulo="Vínculo com o cliente" value={pessoa.relationship} onChange={(e) => setPessoa({ ...pessoa, relationship: e.target.value })}>
            {VINCULOS.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
          <Button
            tamanho="sm"
            className="self-start"
            carregando={pendente}
            disabled={pessoa.fullName.trim().length < 2}
            motivoDesabilitado="Escreva o nome."
            onClick={() => salvar('/api/v1/legal/persons', { clientId: clienteId, ...pessoa }, 'Pessoa cadastrada')}
          >
            Salvar pessoa
          </Button>
        </Card>
      ) : null}

      {aberto === 'empresa' ? (
        <Card className="flex flex-col gap-3 p-3">
          <Input rotulo="Razão social" value={empresa.legalName} onChange={(e) => setEmpresa({ ...empresa, legalName: e.target.value })} maxLength={200} />
          <Select rotulo="Tipo" value={empresa.kind} onChange={(e) => setEmpresa({ ...empresa, kind: e.target.value })}>
            {TIPOS_DE_EMPRESA.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
          <Button
            tamanho="sm"
            className="self-start"
            carregando={pendente}
            disabled={empresa.legalName.trim().length < 2}
            motivoDesabilitado="Escreva a razão social."
            onClick={() => salvar('/api/v1/legal/entities', { clientId: clienteId, ...empresa }, 'Empresa cadastrada')}
          >
            Salvar empresa
          </Button>
        </Card>
      ) : null}

      {aberto === 'ato' ? (
        <Card className="flex flex-col gap-3 p-3">
          <Select rotulo="Empresa" value={ato.empresaId} onChange={(e) => setAto({ ...ato, empresaId: e.target.value })}>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select rotulo="Ato" value={ato.kind} onChange={(e) => setAto({ ...ato, kind: e.target.value })}>
              {TIPOS_DE_ATO.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
            <Input rotulo="Data do ato" type="date" value={ato.effectiveOn} onChange={(e) => setAto({ ...ato, effectiveOn: e.target.value })} />
          </div>
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-label font-semibold text-txt-2">Quadro depois do ato (substitui o atual)</legend>
            {quadro.map((l, i) => (
              <div key={i} className="flex items-end gap-2">
                <Select
                  rotulo={`Sócio ${i + 1}`}
                  className="min-w-0 flex-1"
                  value={l.dono}
                  onChange={(e) => setQuadro(quadro.map((x, j) => (j === i ? { ...x, dono: e.target.value } : x)))}
                >
                  <option value="">Escolha</option>
                  {donos.map((d) => (
                    <option key={d.chave} value={d.chave}>
                      {d.nome}
                    </option>
                  ))}
                </Select>
                <Input
                  rotulo="%"
                  className="w-24"
                  inputMode="decimal"
                  value={l.percent}
                  onChange={(e) => setQuadro(quadro.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))}
                />
                {quadro.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Tirar o sócio ${i + 1}`}
                    className="mb-1 inline-flex size-12 items-center justify-center rounded-[var(--radius-sm)] text-txt-2"
                    onClick={() => setQuadro(quadro.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}
            <Button tamanho="sm" variante="ghost" className="self-start" onClick={() => setQuadro([...quadro, { dono: '', percent: '' }])}>
              <Plus aria-hidden className="size-4" />
              Sócio
            </Button>
            <p className={`text-secundario ${Math.abs(soma - 100) > 0.0001 ? 'text-warn' : 'text-txt-2'}`}>
              Soma: {soma.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%{Math.abs(soma - 100) > 0.0001 ? ' (diferente de 100%: dá para salvar, e a estrutura vai avisar)' : ''}
            </p>
          </fieldset>
          <Button
            tamanho="sm"
            className="self-start"
            carregando={pendente}
            disabled={!ato.empresaId || quadro.some((l) => !l.dono || !(Number(l.percent.replace(',', '.')) > 0))}
            motivoDesabilitado="Escolha cada sócio e o percentual dele."
            onClick={() =>
              salvar(
                `/api/v1/legal/entities/${ato.empresaId}/changes`,
                {
                  effectiveOn: ato.effectiveOn,
                  kind: ato.kind,
                  substituirQuadro: true,
                  novoQuadro: quadro.map((l) => ({ dono: l.dono, percent: Number(l.percent.replace(',', '.')) })),
                },
                'Ato registrado',
              )
            }
          >
            Registrar ato
          </Button>
        </Card>
      ) : null}

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
