'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import { AREAS_DO_CASO, AREAS_SEMPRE_SIGILOSAS, ROTULO_DA_AREA, type AreaDoCaso } from '@/core/advocacia/casos'
import { ROTULO_DO_TIPO_DE_CASO, TIPOS_DE_CASO, type TipoDeCaso } from '@/core/advocacia/checklist'
import { escreverJuridico } from '@/lib/advocacia/escrever'

/** A área mais provável de cada tipo: só sugere, a pessoa troca. */
const AREA_DO_TIPO: Readonly<Record<TipoDeCaso, AreaDoCaso>> = {
  holding: 'holding_planejamento',
  inventario: 'familia_sucessoes',
  planejamento_sucessorio: 'holding_planejamento',
  divorcio_partilha: 'familia_sucessoes',
  contrato: 'empresarial',
  societario: 'empresarial',
  tributario: 'tributario',
  trabalhista: 'trabalhista',
  civel: 'civel',
  outro: 'outro',
}

type Props = {
  clientes: { id: string; nome: string }[]
  equipe: { id: string; nome: string }[]
  clienteInicial: string | null
  responsavelInicial: string | null
}

/**
 * docs/101 T2.1: o formulário de abrir caso. O que o cliente LÊ (`clientTitle`) é campo próprio,
 * separado do título interno, porque é ele que vai na mensagem de WhatsApp e nunca pode levar número
 * de processo nem nome de parte (`core/advocacia/mensagens.ts`).
 */
export default function FormularioNovoCaso({ clientes, equipe, clienteInicial, responsavelInicial }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [clienteId, setClienteId] = useState(clienteInicial ?? '')
  const [tipo, setTipo] = useState<TipoDeCaso>('holding')
  const [area, setArea] = useState<AreaDoCaso>(AREA_DO_TIPO.holding)
  const [titulo, setTitulo] = useState('')
  const [paraCliente, setParaCliente] = useState(ROTULO_DO_TIPO_DE_CASO.holding.paraCliente)
  const [paraClienteMexido, setParaClienteMexido] = useState(false)
  const [sigiloso, setSigiloso] = useState(false)
  const [responsavel, setResponsavel] = useState(responsavelInicial ?? '')
  const [gerar, setGerar] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})

  const sigiloForcado = (AREAS_SEMPRE_SIGILOSAS as readonly string[]).includes(area)

  function trocarTipo(t: TipoDeCaso) {
    setTipo(t)
    setArea(AREA_DO_TIPO[t])
    if (!paraClienteMexido) setParaCliente(ROTULO_DO_TIPO_DE_CASO[t].paraCliente)
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setErros({})
    iniciar(async () => {
      const r = await escreverJuridico<{ id: string }>(
        '/api/v1/legal/cases',
        {
          method: 'POST',
          json: {
            clientId: clienteId,
            kind: tipo,
            area,
            title: titulo,
            clientTitle: paraCliente,
            sensitivity: sigiloso || sigiloForcado ? 'sigiloso' : 'normal',
            gerarChecklist: gerar,
            ...(responsavel ? { responsibleProfessionalId: responsavel } : {}),
          },
        },
        'Não consegui abrir o caso. Tente de novo.',
      )
      if (!r.ok || !r.dados) {
        setErro(r.ok ? 'Não consegui abrir o caso. Tente de novo.' : r.texto)
        setErros(r.ok ? {} : r.campos)
        return
      }
      router.push(`/admin/casos/${r.dados.id}`)
    })
  }

  return (
    <form method="post" onSubmit={enviar} className="flex max-w-xl flex-col gap-4 pb-10" aria-busy={pendente}>
      <Select rotulo="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required erro={erros.clientId}>
        <option value="" disabled>
          Escolha o cliente
        </option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Select>

      <Select rotulo="Tipo de caso" value={tipo} onChange={(e) => trocarTipo(e.target.value as TipoDeCaso)}>
        {TIPOS_DE_CASO.map((t) => (
          <option key={t} value={t}>
            {ROTULO_DO_TIPO_DE_CASO[t].rotulo}
          </option>
        ))}
      </Select>

      <Select rotulo="Área" value={area} onChange={(e) => setArea(e.target.value as AreaDoCaso)}>
        {AREAS_DO_CASO.map((a) => (
          <option key={a} value={a}>
            {ROTULO_DA_AREA[a]}
          </option>
        ))}
      </Select>

      <Input
        rotulo="Título interno"
        ajuda="Só a equipe vê. Ex.: Holding Moreira Alves"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        required
        minLength={2}
        maxLength={200}
        erro={erros.title}
      />

      <Input
        rotulo="O cliente lê"
        ajuda="Vai nas mensagens de WhatsApp. Nunca coloque número de processo, valor ou nome de outra parte."
        value={paraCliente}
        onChange={(e) => {
          setParaCliente(e.target.value)
          setParaClienteMexido(true)
        }}
        required
        minLength={2}
        maxLength={200}
        erro={erros.clientTitle}
      />

      {equipe.length > 0 ? (
        <Select rotulo="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
          <option value="">Ninguém por enquanto</option>
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      ) : null}

      <label className="flex min-h-12 items-start gap-3 text-corpo">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--acc)]"
          checked={sigiloso || sigiloForcado}
          disabled={sigiloForcado}
          onChange={(e) => setSigiloso(e.target.checked)}
        />
        <span>
          Caso sigiloso
          <span className="block text-secundario text-txt-2">
            {sigiloForcado ? 'Esta área é sempre sigilosa.' : 'Só a equipe do caso e a direção veem.'}
          </span>
        </span>
      </label>

      <label className="flex min-h-12 items-start gap-3 text-corpo">
        <input type="checkbox" className="mt-1 size-5 accent-[var(--acc)]" checked={gerar} onChange={(e) => setGerar(e.target.checked)} />
        <span>
          Criar as pendências do modelo
          <span className="block text-secundario text-txt-2">Documentos e etapas do tipo de caso, com datas em dias úteis.</span>
        </span>
      </label>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <Button
        type="submit"
        largura="cheia"
        carregando={pendente}
        disabled={!clienteId || titulo.trim().length < 2 || paraCliente.trim().length < 2}
        motivoDesabilitado="Escolha o cliente e preencha os dois títulos."
      >
        Abrir caso
      </Button>
    </form>
  )
}
