'use client'

import Link from 'next/link'

import { CalendarClock, Upload } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Preview = { colunas: string[]; sample: Record<string, string>[] }
type Previsao = { comDataInformada: number; jaDevendoVoltar: number; cyclesGravados: number }
type Resultado = {
  imported: number
  skipped: { linha: number; motivo: string }[]
  errors: { linha: number; motivo: string }[]
  previsao: Previsao | null
}
type Mapeamento = { name: string; phone: string; email: string; tags: string; lastVisit: string }

export type ServicoComRitmo = { id: string; nome: string; cycleDays: number }

const CAMPO_VAZIO = '__nenhum__'

async function enviarMultipart<T>(url: string, form: FormData): Promise<T> {
  const r = await fetch(url, { method: 'POST', body: form })
  const json = (await r.json()) as { data?: T; error?: { message: string } }
  if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui processar o arquivo.')
  return json.data as T
}

export default function Importador({ servicos }: { servicos: ServicoComRitmo[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapa, setMapa] = useState<Mapeamento>({ name: '', phone: '', email: '', tags: '', lastVisit: '' })
  /*
    Começa no primeiro serviço em vez de vazio, e isso é decisão de ativação, não de conveniência:
    campo opcional que nasce vazio é campo que a maioria não preenche, e sem ele a importação NÃO
    entra no Motor de Ciclo — que é o motivo de a pessoa estar importando. Quem faz outra coisa
    troca num toque; quem não olhar cai no caso mais provável (o serviço principal do negócio, que
    é o primeiro da lista) em vez de cair no pior.
  */
  const [serviceId, setServiceId] = useState<string>(servicos[0]?.id ?? '')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  function escolherArquivo(f: File) {
    setArquivo(f)
    setPreview(null)
    setResultado(null)

    iniciarTransicao(async () => {
      try {
        const form = new FormData()
        form.set('file', f)
        const p = await enviarMultipart<Preview>('/api/v1/clients/import/preview', form)
        setPreview(p)
        // Chute inicial: coluna cujo nome já bate com o campo.
        const achar = (alvo: string) => p.colunas.find((c) => c.toLowerCase().includes(alvo)) ?? ''
        setMapa({
          name: achar('nome'),
          phone: achar('telefone'),
          email: achar('mail'),
          tags: achar('etiqueta'),
          lastVisit: p.colunas.find((c) => /visita|atendimento|compra/i.test(c)) ?? '',
        })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui ler o arquivo', descricao: (erro as Error).message })
      }
    })
  }

  function confirmarImportacao() {
    if (!arquivo || !mapa.name) return

    iniciarTransicao(async () => {
      try {
        const form = new FormData()
        form.set('file', arquivo)
        form.set(
          'mapping',
          JSON.stringify({
            name: mapa.name,
            phone: mapa.phone || undefined,
            email: mapa.email || undefined,
            tags: mapa.tags || undefined,
            lastVisit: mapa.lastVisit || undefined,
            // Só faz sentido com data: sem ela não há de quando prever, e o servidor ignoraria.
            serviceId: (mapa.lastVisit && serviceId) || undefined,
          }),
        )
        const r = await enviarMultipart<Resultado>('/api/v1/clients/import', form)
        setResultado(r)
        mostrarToast({ tom: 'ok', titulo: 'Importação concluída', descricao: `${r.imported} clientes importados.` })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'A importação falhou', descricao: (erro as Error).message })
      }
    })
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-6">
      {!preview ? (
        <Card
          className="flex flex-col items-center gap-3 border-dashed py-10 text-center"
          onClick={() => inputRef.current?.click()}
          /*
           * `role="button"` + `tabIndex` davam o foco, mas nada respondia a
           * Enter/Espaço — medido: só o mouse abria o seletor. Elemento que
           * recebe foco e não faz nada é pior que elemento não focável, e
           * importar planilha era a única porta de entrada em massa de
           * cliente no produto. Botão nativo faz isso sozinho; como aqui é um
           * `Card`, o teclado precisa ser escrito à mão.
           */
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
        >
          <Upload aria-hidden className="size-8 text-txt-3" />
          <p className="text-corpo font-semibold">Escolher o arquivo CSV</p>
          <p className="text-secundario text-txt-2">Até 5 MB, 5.000 linhas.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) escolherArquivo(f)
            }}
          />
        </Card>
      ) : null}

      {preview ? (
        <>
          <section>
            <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
              Qual coluna é qual
            </h2>
            <div className="flex flex-col gap-3">
              {(
                [
                  ['name', 'Nome (obrigatório)'],
                  ['phone', 'Telefone'],
                  ['email', 'E-mail'],
                  ['tags', 'Etiquetas'],
                  ['lastVisit', 'Última visita (opcional, AAAA-MM-DD)'],
                ] as const
              ).map(([campo, rotulo]) => (
                <label key={campo} className="flex flex-col gap-1">
                  <span className="text-label font-semibold text-txt-2">{rotulo}</span>
                  <select
                    value={mapa[campo] || CAMPO_VAZIO}
                    onChange={(e) =>
                      setMapa((atual) => ({ ...atual, [campo]: e.target.value === CAMPO_VAZIO ? '' : e.target.value }))
                    }
                    className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
                  >
                    <option value={CAMPO_VAZIO}>Nenhuma</option>
                    {preview.colunas.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {/*
              F2/ticket 13: a coluna de última visita não é óbvia — sem essa explicação, "Última
              visita" ao lado de Nome/Telefone/E-mail lê como campo de cadastro qualquer, e quem
              não tem a informação na planilha nem tenta preencher.
            */}
            <p className="mt-3 text-secundario text-txt-2">
              Se a sua planilha tiver a data do último atendimento de cada cliente, mapeie essa
              coluna: assim que a importação terminar, o CICLO já mostra quem está atrasado para
              voltar.
            </p>

            {/*
              2026-09-10. O campo que faltava para aquela frase acima ser VERDADE.

              `client_cycles` tem PK `(tenant_id, client_id, service_id)` e cliente importado não
              tem atendimento, logo não tem serviço — então a importação não tinha como criar ciclo
              nenhum, e a data virava um contador que sumia junto com a página. Perguntar o serviço
              é o caminho honesto: o dono sabe a resposta, o catálogo já veio preenchido do
              onboarding, e é UM campo.

              Só aparece depois de a coluna de data ser mapeada. Antes disso não há o que prever, e
              um `<select>` a mais competindo com o mapeamento só atrapalharia a tarefa em curso.
            */}
            {mapa.lastVisit && servicos.length > 0 ? (
              <label className="mt-4 flex flex-col gap-1">
                <span className="text-label font-semibold text-txt-2">Que serviço essas pessoas fazem com você?</span>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
                >
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} · volta a cada {s.cycleDays} dias
                    </option>
                  ))}
                </select>
                <span className="text-secundario text-txt-3">
                  É por ele que o Motor sabe de quanto em quanto tempo essas pessoas voltam. Dá para
                  ajustar cliente por cliente depois; agora vale o que a maioria faz.
                </span>
              </label>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
              Prévia (primeiras linhas)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-secundario">
                <thead>
                  <tr>
                    {preview.colunas.map((c) => (
                      <th key={c} className="whitespace-nowrap px-2 py-1 text-left text-txt-2">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((linha, i) => (
                    <tr key={i} className="border-t border-line">
                      {preview.colunas.map((c) => (
                        <td key={c} className="whitespace-nowrap px-2 py-1 text-txt">
                          {linha[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {resultado ? (
            <>
              {/*
                F2/ticket 13 (docs/25-ESTRATEGIA-E-EXECUCAO.md): o momento em que a lista de
                contatos (chato) vira "olha quem já devia ter voltado" (o produto) — calculado com
                o mesmo algoritmo do Motor de Ciclo, não um número decorativo. Vem ANTES do card
                de contagem simples porque é a resposta à pergunta que importou a planilha.
              */}
              {/*
                2026-09-10: este cartão LEVAVA para `/admin/recuperar` e a lista de lá vinha vazia,
                porque nada tinha sido gravado em `client_cycles`. Anunciar "ver quem são →" para
                uma tela vazia é a pior versão do defeito: a prova do produto virava a decepção
                dele. Agora o link só existe quando `cyclesGravados > 0` — quando o Motor de fato
                passou a acompanhar essas pessoas. Sem isso, o número continua verdadeiro (é o mesmo
                cálculo) e a frase diz o que falta fazer, em vez de prometer uma tela que não tem o
                que mostrar.
              */}
              {resultado.previsao && resultado.previsao.jaDevendoVoltar > 0 ? (
                (() => {
                  const p = resultado.previsao
                  const noMotor = p.cyclesGravados > 0
                  const conteudo = (
                    <Card pressionavel={noMotor} className="border-acc-2/40 bg-acc-soft">
                      <div className="flex items-start gap-3">
                        <CalendarClock aria-hidden className="mt-0.5 size-6 shrink-0 text-acc-2" />
                        <div>
                          <p className="text-corpo font-semibold text-acc-2">
                            {p.jaDevendoVoltar} {p.jaDevendoVoltar === 1 ? 'cliente já está' : 'clientes já estão'}{' '}
                            atrasados para voltar
                          </p>
                          <p className="mt-1 text-secundario text-txt-2">
                            De {p.comDataInformada} com data de última visita informada.{' '}
                            {noMotor
                              ? 'Já estão no Motor de Ciclo. Ver quem são →'
                              : 'Para o Motor acompanhar essas pessoas, importe de novo escolhendo o serviço que elas fazem.'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                  return noMotor ? (
                    <Link href="/admin/recuperar" className="block">
                      {conteudo}
                    </Link>
                  ) : (
                    conteudo
                  )
                })()
              ) : null}

              <Card>
                <p className="text-corpo font-semibold">{resultado.imported} clientes importados</p>
                {resultado.skipped.length > 0 ? (
                  <p className="mt-1 text-secundario text-warn">{resultado.skipped.length} não importadas (duplicata)</p>
                ) : null}
                {resultado.errors.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-secundario text-bad">{resultado.errors.length} linha(s) com erro:</p>
                    <ul className="mt-1 list-inside list-disc text-secundario text-txt-2">
                      {resultado.errors.slice(0, 10).map((e) => (
                        <li key={e.linha}>
                          Linha {e.linha}: {e.motivo}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            </>
          ) : (
            <Button
              largura="cheia"
              carregando={pendente}
              disabled={!mapa.name}
              motivoDesabilitado="Escolha acima qual coluna do arquivo tem o nome."
              onClick={confirmarImportacao}
            >
              Importar
            </Button>
          )}
        </>
      ) : null}
    </div>
  )
}
