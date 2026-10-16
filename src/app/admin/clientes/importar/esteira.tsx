'use client'

import Link from 'next/link'

import { CalendarClock, ClipboardPaste, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import AlertBanner from '@/components/ui/alert-banner'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Segmented from '@/components/ui/segmented'
import Select from '@/components/ui/select'
import Textarea from '@/components/ui/textarea'
import { neutralizarFormula } from '@/core/exportacao/csv'
import { planilhaAnotada, processarGrade, TEXTO_DO_AVISO, type ContextoDaEsteira, type RegistroCanonico } from '@/core/ingestao/esteira'
import { previaDoDinheiro } from '@/core/ingestao/previa-do-dinheiro'
import { acharTabelas } from '@/core/ingestao/tabela'
import { rodarEsteira } from '@/lib/ingestao/rodar-esteira'
import { dinheiro, formatarTelefone } from '@/lib/formato'
import { fetchComTentativa } from '@/lib/tentativa'

import type { RespostaDaEsteira } from '@/lib/ingestao/processar-arquivo'

export type ServicoParaImportar = { id: string; nome: string; cycleDays: number; priceCents: number }

type Lido = Extract<RespostaDaEsteira, { ok: true }>
type Origem = 'arquivo' | 'colado' | 'contatos' | 'imagem'
type Pulada = { linha: number; motivo: string }
type Pedaco = {
  gravadas: number
  jaGravadas: number
  puladas: Pulada[]
  erros: Pulada[]
  previsao: { comDataInformada: number; jaDevendoVoltar: number; cyclesGravados: number } | null
  lote: { id: string; status: string; rowsExpected: number; rowsWritten: number }
}
type Fim = { loteId: string; gravadas: number; jaEstavam: number; puladas: Pulada[]; erros: Pulada[]; noMotor: number; jaImportado: boolean }

/** Pedaço de 500: o servidor aceita até isso (`LINHAS_POR_PEDACO`), e cabe longe do teto de corpo da Vercel. */
const POR_PEDACO = 500
/** Versão do texto da declaração abaixo do botão. Texto do advogado pendente (docs/103 §pendências). */
const VERSAO_DA_DECLARACAO = 'provisoria-2026-10'

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios)
const diaBr = (iso: string) => iso.split('-').reverse().join('/')

async function postar<T>(url: string, corpo: unknown): Promise<T> {
  const r = await fetchComTentativa(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
  const json = (await r.json().catch(() => ({}))) as { data?: T; error?: { message?: string; details?: { fields?: Record<string, string> } } }
  if (!r.ok) throw new Error(Object.values(json.error?.details?.fields ?? {})[0] ?? json.error?.message ?? 'Não consegui falar com o servidor. Confira a internet e tente de novo.')
  return json.data as T
}

async function hashDoArquivo(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A planilha anotada vai para o Excel em português: `;`, BOM e fórmula neutralizada (D17). */
function baixarAnotada(grade: string[][], nome: string) {
  const celula = (v: string) => {
    const s = neutralizarFormula(v)
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = `${String.fromCharCode(0xfeff)}${grade.map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome.replace(/\.[^.]+$/, '')}-conferida.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function origemDe(lido: Lido, colado: boolean): Origem {
  if (colado) return 'colado'
  if (lido.lidoDeImagem) return 'imagem'
  if (lido.formato === 'vcard') return 'contatos'
  return 'arquivo'
}

function linhaParaEnviar(r: RegistroCanonico, i: number) {
  return {
    linha: i + 1,
    nome: r.nome.slice(0, 120),
    telefone: r.telefone,
    email: r.email,
    nascimento: r.nascimento,
    ultimaVisita: r.ultimaVisita,
    observacao: r.observacao?.slice(0, 2000) ?? null,
    etiquetas: r.etiquetas.slice(0, 20).map((e) => e.slice(0, 40)),
  }
}

/**
 * docs/103 CNV-023 · Um lugar só para trazer a clientela: arquivo de qualquer tipo, lista colada,
 * contatos, print e foto. A leitura inteira acontece NO APARELHO (`rodarEsteira`, Web Worker); o
 * servidor só recebe as fichas que a pessoa confirmou, em pedaços que não duplicam (CNV-020).
 */
export default function EsteiraDeImportacao({ servicos, servicoPadrao, timezone }: { servicos: ServicoParaImportar[]; servicoPadrao: string | null; timezone: string }) {
  const hoje = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()), [timezone])
  const [etapa, setEtapa] = useState<'escolher' | 'lendo' | 'previa' | 'gravando' | 'pronto'>('escolher')
  const [erro, setErro] = useState<string | null>(null)
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [lido, setLido] = useState<Lido | null>(null)
  const [contexto, setContexto] = useState<ContextoDaEsteira>({ hoje })
  const [ddd, setDdd] = useState('')
  const [servicoId, setServicoId] = useState(servicoPadrao ?? servicos[0]?.id ?? '')
  const [declarou, setDeclarou] = useState(false)
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0 })
  const [fim, setFim] = useState<Fim | null>(null)
  const [desfeito, setDesfeito] = useState<{ removidas: number; mantidas: number } | null>(null)
  const [desfazendo, setDesfazendo] = useState(false)
  const arquivo = useRef<{ bytes: Uint8Array; nome: string; colado: boolean } | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  // Responder uma pergunta reprocessa a grade JÁ LIDA (puro, instantâneo): um print não passa pelo OCR de novo.
  const resultado = useMemo(() => (lido ? processarGrade(lido.grade, { ...contexto, lidoDeImagem: lido.lidoDeImagem }) : null), [lido, contexto])
  // Mais de uma tabela na mesma aba (duas listas, ativos e inativos): a pessoa escolhe; o padrão é a maior.
  const tabelas = useMemo(() => (lido ? acharTabelas(lido.grade).tabelas : []), [lido])
  const tabelaPadrao = tabelas.reduce((melhor, t, i, todas) => (t.linhas.length > (todas[melhor]?.linhas.length ?? -1) ? i : melhor), 0)
  const servico = servicos.find((s) => s.id === servicoId) ?? null
  const previa = useMemo(() => (resultado && servico ? previaDoDinheiro(resultado.registros, servico, hoje) : null), [resultado, servico, hoje])

  async function ler(bytes: Uint8Array, nome: string, colado: boolean, aba?: number) {
    arquivo.current = { bytes, nome, colado }
    setErro(null)
    setEtapa('lendo')
    const r = await rodarEsteira({ bytes, nome, contexto: { hoje }, aba })
    if (!r.ok) {
      setErro(r.mensagem)
      setEtapa('escolher')
      return
    }
    setLido(r)
    setContexto({ hoje })
    setDdd('')
    setEtapa('previa')
  }

  async function importar() {
    if (!lido || !resultado || !arquivo.current) return
    setErro(null)
    setEtapa('gravando')
    const registros = resultado.registros
    setProgresso({ feitas: 0, total: registros.length })
    try {
      const { lote, jaExistia } = await postar<{ lote: Pedaco['lote']; jaExistia: boolean }>('/api/v1/imports', {
        fileSha256: await hashDoArquivo(arquivo.current.bytes),
        formato: lido.formato,
        origem: origemDe(lido, arquivo.current.colado),
        nivel: resultado.nivel,
        counts: { lidas: resultado.contagem.lidas, ouro: resultado.contagem.ouro, comAviso: resultado.contagem.comAviso, quarentena: resultado.contagem.quarentena, ignoradas: resultado.contagem.ignoradas },
        rowsExpected: registros.length,
        declarationVersion: VERSAO_DA_DECLARACAO,
      })
      if (jaExistia && lote.status === 'concluido') {
        setFim({ loteId: lote.id, gravadas: 0, jaEstavam: lote.rowsWritten, puladas: [], erros: [], noMotor: 0, jaImportado: true })
        setEtapa('pronto')
        return
      }
      const total: Fim = { loteId: lote.id, gravadas: 0, jaEstavam: 0, puladas: [], erros: [], noMotor: 0, jaImportado: false }
      for (let i = 0; i < registros.length; i += POR_PEDACO) {
        const linhas = registros.slice(i, i + POR_PEDACO).map((r, j) => linhaParaEnviar(r, i + j))
        const p = await postar<Pedaco>(`/api/v1/imports/${lote.id}/rows`, { linhas, ultimo: i + POR_PEDACO >= registros.length, servicoId: servico?.id ?? null })
        total.gravadas += p.gravadas
        total.jaEstavam += p.jaGravadas
        total.puladas.push(...p.puladas)
        total.erros.push(...p.erros)
        total.noMotor += p.previsao?.cyclesGravados ?? 0
        setProgresso({ feitas: Math.min(i + POR_PEDACO, registros.length), total: registros.length })
      }
      setFim(total)
      setEtapa('pronto')
    } catch (e) {
      // O que já entrou fica (cada pedaço é idempotente): mandar de novo continua de onde parou.
      setErro(`${(e as Error).message} O que já foi gravado continua lá; tocar em importar de novo continua de onde parou, sem repetir ninguém.`)
      setEtapa('previa')
    }
  }

  async function desfazer() {
    if (!fim) return
    setDesfazendo(true)
    try {
      setDesfeito(await postar<{ removidas: number; mantidas: number }>(`/api/v1/imports/${fim.loteId}/undo`, {}))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setDesfazendo(false)
    }
  }

  function recomecar() {
    arquivo.current = null
    setLido(null)
    setFim(null)
    setDesfeito(null)
    setDeclarou(false)
    setTexto('')
    setErro(null)
    setEtapa('escolher')
  }

  const anuncio =
    etapa === 'lendo'
      ? 'Lendo o arquivo no seu aparelho.'
      : etapa === 'gravando'
        ? `Gravando ${progresso.feitas} de ${progresso.total}.`
        : etapa === 'previa' && resultado
          ? `Encontrei ${resultado.contagem.pessoas} ${plural(resultado.contagem.pessoas, 'pessoa', 'pessoas')}. Confira antes de importar.`
          : etapa === 'pronto' && fim
            ? fim.jaImportado
              ? 'Este arquivo já tinha sido importado. Nada foi gravado em dobro.'
              : `${fim.gravadas} ${plural(fim.gravadas, 'ficha criada', 'fichas criadas')}.`
            : ''

  return (
    <div className="flex flex-col gap-6" aria-busy={etapa === 'lendo' || etapa === 'gravando'}>
      {/* Vive sempre no DOM: região que nasce junto com o conteúdo não é anunciada. */}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {etapa === 'escolher' || etapa === 'lendo' ? (
        <>
          <Button variante="primary" largura="cheia" carregando={etapa === 'lendo'} onClick={() => entrada.current?.click()}>
            <Upload aria-hidden className="size-5" />
            Escolher arquivo, print ou foto
          </Button>
          <input
            ref={entrada}
            type="file"
            className="hidden"
            aria-label="Arquivo, print ou foto com a lista de clientes"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) await ler(new Uint8Array(await f.arrayBuffer()), f.name, false)
            }}
          />
          <p className="-mt-3 text-secundario text-txt-2">
            Planilha (Excel, Google, CSV), contatos do celular, conversa do WhatsApp, PDF, Word, print de tela ou foto. A leitura acontece no seu aparelho: nada é gravado antes de você conferir.
          </p>

          {colando ? (
            <div className="flex flex-col gap-3">
              <Textarea rotulo="Cole a lista" ajuda="Uma pessoa por linha, com o telefone se tiver. Serve lista das notas, do WhatsApp ou de uma planilha." rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
              <Button
                variante="secondary"
                largura="cheia"
                disabled={texto.trim() === ''}
                motivoDesabilitado="Cole a lista no campo acima."
                carregando={etapa === 'lendo'}
                onClick={() => ler(new TextEncoder().encode(texto), 'lista-colada.txt', true)}
              >
                Ler a lista colada
              </Button>
            </div>
          ) : (
            <Button variante="ghost" largura="cheia" onClick={() => setColando(true)}>
              <ClipboardPaste aria-hidden className="size-5" />
              Ou cole a lista
            </Button>
          )}
        </>
      ) : null}

      {(etapa === 'previa' || etapa === 'gravando') && lido && resultado ? (
        <>
          <Card>
            <p className="text-corpo font-semibold">
              {resultado.contagem.pessoas} {plural(resultado.contagem.pessoas, 'pessoa encontrada', 'pessoas encontradas')}
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-secundario text-txt-2">
              <li>{resultado.contagem.ouro} {plural(resultado.contagem.ouro, 'pronta', 'prontas')} para entrar</li>
              {resultado.contagem.comAviso > 0 ? <li className="text-warn">{resultado.contagem.comAviso} {plural(resultado.contagem.comAviso, 'entra', 'entram')} com aviso (veja abaixo)</li> : null}
              {resultado.contagem.quarentena > 0 ? <li className="text-bad">{resultado.contagem.quarentena} {plural(resultado.contagem.quarentena, 'linha ficou', 'linhas ficaram')} de fora para corrigir</li> : null}
              {resultado.contagem.ignoradas > 0 ? <li>{resultado.contagem.ignoradas} {plural(resultado.contagem.ignoradas, 'linha ignorada', 'linhas ignoradas')} (título, total, linha em branco)</li> : null}
            </ul>
            {lido.avisos.map((a) => (
              <p key={a} className="mt-2 text-secundario text-warn">
                {a}
              </p>
            ))}
          </Card>

          {lido.abas.length > 1 ? (
            <Select rotulo="Qual aba tem a lista?" value={String(lido.aba)} onChange={(e) => arquivo.current && ler(arquivo.current.bytes, arquivo.current.nome, arquivo.current.colado, Number(e.target.value))}>
              {lido.abas.map((nome, i) => (
                <option key={nome} value={i}>
                  {nome}
                </option>
              ))}
            </Select>
          ) : null}

          {tabelas.length > 1 ? (
            <Select rotulo="Achei mais de uma tabela. Qual tem a lista?" value={String(contexto.tabela ?? tabelaPadrao)} onChange={(e) => setContexto((c) => ({ ...c, tabela: Number(e.target.value) }))}>
              {tabelas.map((t, i) => (
                <option key={i} value={i}>
                  Tabela {i + 1}: {t.linhas.length} {plural(t.linhas.length, 'linha', 'linhas')} ({t.cabecalho.filter(Boolean).slice(0, 3).join(', ')})
                </option>
              ))}
            </Select>
          ) : null}

          {resultado.perguntas.map((p) =>
            p.tipo === 'ddd_do_salao' ? (
              <div key="ddd" className="flex flex-col gap-2">
                <Input
                  rotulo={`${p.linhas} ${plural(p.linhas, 'telefone veio', 'telefones vieram')} sem DDD. Qual é o DDD do seu negócio?`}
                  ajuda="Só vale para quem veio sem DDD. Sem resposta, esses números ficam de fora para você conferir."
                  inputMode="numeric"
                  maxLength={2}
                  value={ddd}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                    setDdd(v)
                    setContexto((c) => ({ ...c, dddPadrao: v.length === 2 ? Number(v) : undefined }))
                  }}
                />
              </div>
            ) : p.tipo === 'ordem_de_data' ? (
              <Segmented
                key="ordem"
                rotulo={`A data "${p.exemplo}" é dia/mês ou mês/dia?`}
                segmentos={[
                  { valor: 'dmy', rotulo: 'Dia/mês' },
                  { valor: 'mdy', rotulo: 'Mês/dia' },
                ]}
                valor={contexto.ordemDeData ?? ''}
                aoTrocar={(v) => setContexto((c) => ({ ...c, ordemDeData: v as ContextoDaEsteira['ordemDeData'] }))}
              />
            ) : null,
          )}

          {previa && previa.comData > 0 && servicos.length > 0 ? (
            <Select rotulo="Que serviço essas pessoas fazem com você?" ajuda="É dele que o Motor tira de quanto em quanto tempo elas voltam e quanto vale chamar de volta." value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · volta a cada {s.cycleDays} dias
                </option>
              ))}
            </Select>
          ) : null}

          {previa && previa.sumidos > 0 ? (
            <Card className="border-acc-2/40 bg-acc-soft">
              <div className="flex items-start gap-3">
                <CalendarClock aria-hidden className="mt-0.5 size-6 shrink-0 text-acc-2" />
                <div>
                  <p className="text-corpo font-semibold text-acc-2">
                    {previa.sumidos} {plural(previa.sumidos, 'pessoa já passou', 'pessoas já passaram')} da hora de voltar: {dinheiro.format(previa.valorCents / 100)} para recuperar
                  </p>
                  <p className="mt-1 text-secundario text-txt-2">
                    A mesma conta da tela Hoje, com o preço de {servico?.nome}. {previa.semData > 0 ? `${previa.semData} ${plural(previa.semData, 'veio sem a última visita e fica', 'vieram sem a última visita e ficam')} fora da conta.` : ''}
                  </p>
                  <p className="mt-3 text-label font-semibold text-txt-2">Chame primeiro:</p>
                  <ol className="mt-1 list-inside list-decimal text-secundario text-txt">
                    {previa.primeiros.map((x) => (
                      <li key={`${x.nome}-${x.ultimaVisita}`}>
                        {x.nome} · última vez em {diaBr(x.ultimaVisita)}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Card>
          ) : previa && previa.comData === 0 && resultado.registros.length > 0 ? (
            <p className="text-secundario text-txt-2">Ninguém veio com a data da última visita. As fichas entram e o Motor começa a contar a partir do próximo atendimento.</p>
          ) : null}

          <section>
            <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Como vai ficar</h2>
            <ul className="flex flex-col gap-2">
              {resultado.registros.slice(0, 5).map((r) => (
                <li key={r.linhas.join('-')} className="rounded-[var(--radius-sm)] border border-line px-3 py-2">
                  <p className="text-corpo font-semibold">{r.nome}</p>
                  <p className="text-secundario text-txt-2">
                    {[formatarTelefone(r.telefone), r.email, r.ultimaVisita ? `última visita ${diaBr(r.ultimaVisita)}` : null].filter(Boolean).join(' · ') || 'Sem contato'}
                  </p>
                  {r.avisos.map((a) => (
                    <p key={a} className="text-secundario text-warn">
                      {TEXTO_DO_AVISO[a]}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            {resultado.registros.length > 5 ? <p className="mt-2 text-secundario text-txt-3">E mais {resultado.registros.length - 5}.</p> : null}
          </section>

          {resultado.quarentena.length > 0 ? (
            <section>
              <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Ficaram de fora</h2>
              <ul className="flex flex-col gap-1 text-secundario text-txt-2">
                {resultado.quarentena.slice(0, 10).map((q) => (
                  <li key={q.origem}>
                    Linha {q.origem + 1}: {TEXTO_DO_AVISO[q.motivo]}
                  </li>
                ))}
              </ul>
              <Button variante="secondary" largura="cheia" className="mt-3" onClick={() => baixarAnotada(planilhaAnotada(lido.grade, resultado), arquivo.current?.nome ?? 'lista')}>
                Baixar a planilha com o motivo de cada linha
              </Button>
            </section>
          ) : null}

          {resultado.registros.length > 0 ? (
            <>
              <label className="flex min-h-12 items-start gap-3 text-secundario text-txt-2">
                <input type="checkbox" className="mt-1 size-5 shrink-0" checked={declarou} onChange={(e) => setDeclarou(e.target.checked)} />
                <span>Estas pessoas são clientes do meu negócio, e eu posso guardar o contato delas para falar sobre os atendimentos.</span>
              </label>
              <Button
                largura="cheia"
                carregando={etapa === 'gravando'}
                disabled={!declarou}
                motivoDesabilitado="Confirme a frase acima para importar."
                onClick={importar}
              >
                Importar {resultado.registros.length} {plural(resultado.registros.length, 'pessoa', 'pessoas')}
              </Button>
              {etapa === 'gravando' ? (
                <p className="-mt-3 text-center text-secundario text-txt-2">
                  Gravando {progresso.feitas} de {progresso.total}…
                </p>
              ) : null}
            </>
          ) : (
            <AlertBanner tom="warn">Não achei nenhuma pessoa para importar. Baixe a planilha acima para ver o motivo de cada linha, ou tente outro arquivo.</AlertBanner>
          )}

          {etapa === 'previa' ? (
            <Button variante="ghost" largura="cheia" onClick={recomecar}>
              Escolher outro arquivo
            </Button>
          ) : null}
        </>
      ) : null}

      {etapa === 'pronto' && fim ? (
        <>
          <Card>
            {fim.jaImportado ? (
              <p className="text-corpo font-semibold">Este arquivo já tinha sido importado ({fim.jaEstavam} {plural(fim.jaEstavam, 'ficha', 'fichas')}). Nada foi gravado em dobro.</p>
            ) : (
              <p className="text-corpo font-semibold">
                {fim.gravadas} {plural(fim.gravadas, 'ficha criada', 'fichas criadas')}
                {fim.jaEstavam > 0 ? `, ${fim.jaEstavam} ${plural(fim.jaEstavam, 'já estava', 'já estavam')} de antes` : ''}.
              </p>
            )}
            {fim.puladas.length > 0 ? (
              <>
                <p className="mt-2 text-secundario text-warn">
                  {fim.puladas.length} {plural(fim.puladas.length, 'pessoa não entrou', 'pessoas não entraram')} de novo:
                </p>
                <ul className="mt-1 list-inside list-disc text-secundario text-txt-2">
                  {fim.puladas.slice(0, 10).map((p) => (
                    <li key={p.linha}>
                      Pessoa {p.linha}: {p.motivo}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {fim.erros.length > 0 ? (
              <p className="mt-2 text-secundario text-bad">
                {fim.erros.length} {plural(fim.erros.length, 'linha não foi salva', 'linhas não foram salvas')}. Tocar em importar de novo tenta só essas.
              </p>
            ) : null}
          </Card>

          {fim.noMotor > 0 ? (
            <Link href="/admin/recuperar" className="block">
              <Card pressionavel className="border-acc-2/40 bg-acc-soft">
                <p className="text-corpo font-semibold text-acc-2">
                  {fim.noMotor} {plural(fim.noMotor, 'pessoa já está', 'pessoas já estão')} no Motor de Ciclo. Ver quem chamar primeiro →
                </p>
              </Card>
            </Link>
          ) : null}

          {desfeito ? (
            <p role="status" className="text-secundario text-txt-2">
              Desfeito: {desfeito.removidas} {plural(desfeito.removidas, 'ficha saiu', 'fichas saíram')}.
              {desfeito.mantidas > 0 ? ` ${desfeito.mantidas} ${plural(desfeito.mantidas, 'ficou porque já tem', 'ficaram porque já têm')} agendamento, comanda ou anotação.` : ''}
            </p>
          ) : fim.gravadas > 0 || fim.jaEstavam > 0 ? (
            <Button variante="ghost" largura="cheia" carregando={desfazendo} onClick={desfazer}>
              Desfazer esta importação
            </Button>
          ) : null}

          <Button variante="secondary" largura="cheia" onClick={recomecar}>
            Importar outro arquivo
          </Button>
        </>
      ) : null}
    </div>
  )
}
