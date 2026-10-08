'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Select from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { escreverJuridico } from '@/lib/advocacia/escrever'

async function salvar(corpo: unknown): Promise<string | null> {
  const r = await escreverJuridico('/api/v1/tenant/advocacia', { method: 'PATCH', json: corpo })
  return r.ok ? null : r.texto
}

const PAPEL: Record<string, string> = { advogado: 'Advocacia', estagio: 'Estágio' }

type Pessoa = { id: string; nome: string; papel: string | null; oab: string | null; uf: string | null }

/** Uma linha por pessoa. Só a direção edita (a política de `professionals` é de dono). */
export function EquipeDoEscritorio({ pessoas, podeEditar, semOab }: { pessoas: Pessoa[]; podeEditar: boolean; semOab: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {pessoas.map((p) => (
        <li key={p.id}>
          <LinhaDaEquipe pessoa={p} podeEditar={podeEditar} semOab={semOab.includes(p.id)} />
        </li>
      ))}
    </ul>
  )
}

function LinhaDaEquipe({ pessoa, podeEditar, semOab }: { pessoa: Pessoa; podeEditar: boolean; semOab: boolean }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [papel, setPapel] = useState(pessoa.papel ?? '')
  const [oab, setOab] = useState(pessoa.oab ?? '')
  const [uf, setUf] = useState(pessoa.uf ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const mudou = papel !== (pessoa.papel ?? '') || oab !== (pessoa.oab ?? '') || uf !== (pessoa.uf ?? '')

  if (!podeEditar) {
    return (
      <Card className="p-3 text-secundario">
        <p className="font-semibold text-txt">{pessoa.nome}</p>
        <p className="text-txt-2">
          {pessoa.papel ? PAPEL[pessoa.papel] : 'Sem papel jurídico'}
          {pessoa.oab ? ` · OAB ${pessoa.oab}/${pessoa.uf ?? ''}` : ''}
        </p>
      </Card>
    )
  }

  return (
    <Card className={`flex flex-col gap-3 p-3 ${semOab ? 'border-warn/50' : ''}`}>
      <p className="text-corpo font-semibold">{pessoa.nome}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select rotulo="Papel" value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="">Sem papel jurídico</option>
          <option value="advogado">Advocacia</option>
          <option value="estagio">Estágio</option>
        </Select>
        <Input rotulo="Número da OAB" inputMode="numeric" value={oab} onChange={(e) => setOab(e.target.value.replace(/\D/g, ''))} maxLength={7} />
        <Input rotulo="UF" value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
      </div>
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button
        tamanho="sm"
        variante="secondary"
        className="self-start"
        carregando={pendente}
        disabled={!mudou}
        motivoDesabilitado="Nada mudou nesta pessoa."
        onClick={() =>
          iniciar(async () => {
            setErro(null)
            const falha = await salvar({
              equipe: { professionalId: pessoa.id, oabNumero: oab || null, oabUf: uf || null, papel: papel === '' ? null : papel },
            })
            if (falha) return setErro(falha)
            mostrarToast({ tom: 'ok', titulo: `${pessoa.nome}: salvo` })
            router.refresh()
          })
        }
      >
        Salvar
      </Button>
    </Card>
  )
}

type Regra = { id: string; rotulo: string; fonte: string; jaValidada: boolean }

/**
 * As regras que destravam a data preenchida. A direção marca o que conferiu; a regra que já vem validada
 * na origem aparece marcada e travada, para a pessoa saber que ela também está valendo.
 */
export function RegrasDeContagem({ regras, confirmadas, podeEditar }: { regras: Regra[]; confirmadas: string[]; podeEditar: boolean }) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, iniciar] = useTransition()
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set(confirmadas))
  const [erro, setErro] = useState<string | null>(null)
  const mudou = marcadas.size !== confirmadas.length || confirmadas.some((c) => !marcadas.has(c))

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-secundario text-txt-2">
        Enquanto uma regra não estiver confirmada, a sugestão de prazo mostra a conta mas não preenche a data: quem tria digita.
      </p>
      <ul className="flex flex-col gap-2">
        {regras.map((r) => (
          <li key={r.id}>
            <label className="flex min-h-12 items-start gap-3 text-corpo">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--acc)]"
                checked={r.jaValidada || marcadas.has(r.id)}
                disabled={r.jaValidada || !podeEditar}
                onChange={(e) =>
                  setMarcadas((atual) => {
                    const novo = new Set(atual)
                    if (e.target.checked) novo.add(r.id)
                    else novo.delete(r.id)
                    return novo
                  })
                }
              />
              <span>
                {r.rotulo.charAt(0).toUpperCase() + r.rotulo.slice(1)}
                <span className="block text-label text-txt-3">
                  {r.fonte}
                  {r.jaValidada ? ' · validada na origem' : ''}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {!podeEditar ? <p className="text-label text-txt-3">Só a direção confirma as regras.</p> : null}
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      {podeEditar ? (
        <Button
          tamanho="sm"
          className="self-start"
          carregando={pendente}
          disabled={!mudou}
          motivoDesabilitado="Nada mudou nas regras."
          onClick={() =>
            iniciar(async () => {
              setErro(null)
              const falha = await salvar({ regrasConfirmadas: [...marcadas] })
              if (falha) return setErro(falha)
              mostrarToast({ tom: 'ok', titulo: 'Regras salvas' })
              router.refresh()
            })
          }
        >
          Salvar regras
        </Button>
      ) : null}
    </Card>
  )
}
