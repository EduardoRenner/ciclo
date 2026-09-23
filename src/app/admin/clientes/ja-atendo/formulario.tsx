'use client'

import { Temporal } from '@js-temporal/polyfill'
import { CalendarClock, ClipboardList, Contact, Plus, Search, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Input from '@/components/ui/input'
import Textarea from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { lerListaDeNomes, MAX_DA_LISTA, pessoasDosContatos, type ContatoDoCelular, type PessoaDaLista } from '@/core/ciclo/lista-de-nomes'
import { primeiraVolta } from '@/core/ciclo/primeira-volta'
import { QUANDO_FOI, type QuandoFoi } from '@/core/ciclo/quando-foi-a-ultima-vez'

export type ServicoComRitmo = { id: string; nome: string; cycleDays: number }

type Pessoa = { nome: string; telefone: string; quando: QuandoFoi }
type ClienteEncontrado = { id: string; name: string; phone_e164: string | null }
type Retorno = { clientId: string; nome: string; quando: QuandoFoi }
type Resultado = {
  cadastrados: number
  /**
   * Quantas fichas existentes entraram por "quem já tem ficha e voltou" — contado na tela, porque a
   * rota só devolve os cadastros novos. Sem isto, marcar só quem já tinha ficha terminava em
   * "0 pessoas cadastradas", como se nada tivesse acontecido (medido, docs/82 rodada 18).
   */
  atualizados: number
  jaExistiam: string[]
  previsao: { comDataInformada: number; jaDevendoVoltar: number; cyclesGravados: number; proximaVolta: string | null } | null
}

const LINHA_VAZIA: Pessoa = { nome: '', telefone: '', quando: 'quinzena' }

/** Três linhas abertas: uma só parece um formulário de cadastro avulso, e a tarefa aqui é em lote. */
const INICIAIS = [LINHA_VAZIA, LINHA_VAZIA, LINHA_VAZIA]

type Props = {
  servicos: ServicoComRitmo[]
  /** `core/cycle/servico-padrao-da-base.ts` — mais atendido, ou o de ritmo do meio. */
  servicoPadrao: string | null
  /**
   * A conta já tem alguém cadastrado? Sem ninguém, a busca de "quem já tem ficha e voltou" não
   * acha nada — era a primeira coisa que uma conta nova via, perguntando por fichas que não existem.
   */
  temClientes: boolean
}

export default function FormularioQuemJaAtendo({ servicos, servicoPadrao, temClientes }: Props) {
  const [serviceId, setServiceId] = useState(servicoPadrao ?? servicos[0]?.id ?? '')
  const [pessoas, setPessoas] = useState<Pessoa[]>(INICIAIS)
  const [retornos, setRetornos] = useState<Retorno[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()

  const preenchidas = pessoas.filter((p) => p.nome.trim() !== '')
  const total = preenchidas.length + retornos.length

  /*
    docs/82 §14 semana 2, "importar do caderno mais rápido": na visita, digitar quinze nomes com o
    dono olhando é onde a conta morre antes de ver o Motor. Duas portas para trazer a lista de uma
    vez — colar (qualquer celular) e o seletor de contatos (Chrome no Android; o iPhone não tem a
    API, e o botão simplesmente não aparece). As linhas vazias dão lugar às novas; quem já foi
    escrito à mão fica, e nome repetido não entra duas vezes.
  */
  const [colando, setColando] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [quandoColado, setQuandoColado] = useState<QuandoFoi>('quinzena')
  const [temContatos, setTemContatos] = useState(false)
  useEffect(() => {
    // Detectado depois de montar: no servidor não existe `navigator`, e decidir no render daria
    // uma tela diferente na hidratação.
    setTemContatos('contacts' in navigator && 'ContactsManager' in window)
  }, [])
  const daLista = lerListaDeNomes(textoColado)

  function trazer(novas: PessoaDaLista[], quando: QuandoFoi) {
    const escritas = pessoas.filter((p) => p.nome.trim() !== '')
    const ja = new Set(escritas.map((p) => p.nome.trim().toLocaleLowerCase('pt-BR')))
    const somadas = novas
      .filter((n) => !ja.has(n.nome.toLocaleLowerCase('pt-BR')))
      .map((n) => ({ nome: n.nome, telefone: n.telefone, quando }))
    const juntas = [...escritas, ...somadas].slice(0, MAX_DA_LISTA)
    setPessoas(juntas.length > 0 ? juntas : INICIAIS)
    return juntas.length - escritas.length
  }

  function colar() {
    const trazidas = trazer(daLista, quandoColado)
    setColando(false)
    setTextoColado('')
    mostrarToast({ tom: 'ok', titulo: `${trazidas} ${trazidas === 1 ? 'pessoa na lista' : 'pessoas na lista'}`, descricao: 'Confira e toque em "Pôr no Motor".' })
  }

  async function escolherDosContatos() {
    try {
      const nav = navigator as Navigator & { contacts: { select(campos: string[], opcoes: { multiple: boolean }): Promise<ContatoDoCelular[]> } }
      const contatos = await nav.contacts.select(['name', 'tel'], { multiple: true })
      if (contatos.length === 0) return
      const trazidas = trazer(pessoasDosContatos(contatos), 'quinzena')
      mostrarToast({
        tom: 'ok',
        titulo: `${trazidas} ${trazidas === 1 ? 'pessoa trazida' : 'pessoas trazidas'} dos contatos`,
        descricao: 'Ajuste a "Última vez" de cada uma antes de pôr no Motor.',
      })
    } catch {
      // Recusar a permissão ou fechar o seletor cai aqui; nada foi descartado, a lista continua igual.
      mostrarToast({ tom: 'erro', titulo: 'Não consegui abrir os contatos', descricao: 'Cole a lista ou escreva os nomes abaixo.' })
    }
  }

  function mudar(indice: number, campo: keyof Pessoa, valor: string) {
    setPessoas((atual) => atual.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)))
  }

  function mudarRetorno(clientId: string, quando: QuandoFoi) {
    setRetornos((atual) => atual.map((r) => (r.clientId === clientId ? { ...r, quando } : r)))
  }

  function adicionarRetorno(cliente: ClienteEncontrado) {
    setRetornos((atual) => (atual.some((r) => r.clientId === cliente.id) ? atual : [...atual, { clientId: cliente.id, nome: cliente.name, quando: 'semana' }]))
  }

  function enviar() {
    if (total === 0 || !serviceId) return

    iniciarTransicao(async () => {
      try {
        const r = await fetch('/api/v1/clients/ja-atendo', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            serviceId,
            pessoas: preenchidas.map((p) => ({ nome: p.nome.trim(), telefone: p.telefone.trim() || undefined, quando: p.quando })),
            retornos: retornos.map((rt) => ({ clientId: rt.clientId, quando: rt.quando })),
          }),
        })
        const json = (await r.json()) as { data?: Omit<Resultado, 'atualizados'>; error?: { message: string } }
        if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui salvar.')
        setResultado({ ...json.data!, atualizados: retornos.length })
        setPessoas(INICIAIS)
        setRetornos([])
        mostrarToast({ tom: 'ok', titulo: 'Pronto', descricao: `${total} ${total === 1 ? 'pessoa atualizada' : 'pessoas atualizadas'} no Motor.` })
      } catch (erro) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui salvar', descricao: (erro as Error).message })
      }
    })
  }

  if (resultado) {
    const p = resultado.previsao
    const noMotor = (p?.cyclesGravados ?? 0) > 0
    const volta = p && p.jaDevendoVoltar === 0 && noMotor && p.proximaVolta ? primeiraVolta(p.proximaVolta, Temporal.Now.plainDateISO()) : null
    return (
      <div className="flex flex-col gap-4">
        {/*
          A recompensa. Esta tela existe para produzir ESTE cartão — é o momento em que uma lista de
          nomes digitados vira "olha quem já devia ter voltado", que é o produto. Vem antes da
          contagem seca, pelo mesmo motivo que na importação.
        */}
        {p && p.jaDevendoVoltar > 0 && noMotor ? (
          <Link href="/admin/recuperar" className="block">
            <Card pressionavel className="border-acc-2/40 bg-acc-soft">
              <div className="flex items-start gap-3">
                <Sparkles aria-hidden className="mt-0.5 size-6 shrink-0 text-acc-2" />
                <div>
                  <p className="text-corpo font-semibold text-acc-2">
                    {p.jaDevendoVoltar} {p.jaDevendoVoltar === 1 ? 'pessoa já está' : 'pessoas já estão'} atrasadas para voltar
                  </p>
                  <p className="mt-1 text-secundario text-txt-2">
                    O Motor de Ciclo já está acompanhando essa gente. Ver quem são →
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ) : null}

        {/*
          O outro lado da mesma recompensa, e o caso MAIS comum: a linha nasce em "Uns 15 dias" e o
          corte volta a cada 21, então quem aceita o padrão cadastra todo mundo em dia. Sem este
          cartão a tela dizia só "2 pessoas cadastradas" e a aba Recuperar, "Todo mundo em dia" —
          medido no navegador, docs/82 §16 rodada 17.
        */}
        {volta ? (
          <Card className="border-acc-2/40 bg-acc-soft">
            <div className="flex items-start gap-3">
              <CalendarClock aria-hidden className="mt-0.5 size-6 shrink-0 text-acc-2" />
              <div>
                <p className="text-corpo font-semibold text-acc-2">{volta.titulo}</p>
                <p className="mt-1 text-secundario text-txt-2">{volta.descricao}</p>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <p className="text-corpo font-semibold">
            {[
              resultado.cadastrados > 0 || resultado.atualizados === 0
                ? `${resultado.cadastrados} ${resultado.cadastrados === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}`
                : null,
              resultado.atualizados > 0
                ? `${resultado.atualizados} ${resultado.atualizados === 1 ? 'ficha atualizada' : 'fichas atualizadas'}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {resultado.jaExistiam.length > 0 ? (
            <p className="mt-1 text-secundario text-txt-2">
              {resultado.jaExistiam.length === 1 ? 'Já tinha ficha' : 'Já tinham ficha'}: {resultado.jaExistiam.join(', ')}.
            </p>
          ) : null}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setResultado(null)}>Adicionar mais gente</Button>
          <Link
            href="/admin/hoje"
            className="inline-flex h-12 items-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt"
          >
            Ir para o Hoje
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-5">
      <section>
        <label className="flex flex-col gap-1">
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
            É por ele que o CICLO sabe de quanto em quanto tempo cada pessoa costuma voltar.
          </span>
        </label>
      </section>

      {/*
        A porta de manutenção: quem já está cadastrado (veio da importação, do cadastro de memória,
        ou de um atendimento de verdade) e voltou de novo — sem reabrir a ficha, sem digitar nome e
        telefone outra vez. Fica ACIMA da lista de gente nova: quem volta toda semana usa isto mais
        que o cadastro inicial, que só acontece uma vez.
      */}
      {temClientes ? <BuscaDeRetorno jaAdicionados={retornos.map((r) => r.clientId)} aoEscolher={adicionarRetorno} /> : null}

      {retornos.length > 0 ? (
        <section className="flex flex-col gap-2">
          {retornos.map((rt) => (
            <Card key={rt.clientId} className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-corpo font-semibold text-txt">{rt.nome}</p>
              <select
                value={rt.quando}
                onChange={(e) => mudarRetorno(rt.clientId, e.target.value as QuandoFoi)}
                className="h-12 shrink-0 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              >
                {QUANDO_FOI.map((q) => (
                  <option key={q.valor} value={q.valor}>
                    {q.rotulo}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRetornos((atual) => atual.filter((r) => r.clientId !== rt.clientId))}
                aria-label={`Tirar ${rt.nome}`}
                className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-3 transition active:scale-95"
              >
                <X aria-hidden className="size-5" />
              </button>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <span className="text-label font-semibold text-txt-2">
          {temClientes ? 'Ou gente nova, que ainda não tem ficha' : 'Quem você atende e quando veio pela última vez'}
        </span>

        {colando ? (
          <Card className="flex flex-col gap-3">
            <Textarea
              rotulo="Cole a lista, um nome por linha"
              ajuda="Do bloco de notas ou de uma conversa. Telefone na mesma linha entra junto."
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
              rows={6}
              placeholder={'Marcos - 49 99999-0001\nRafael\nDona Alzira'}
            />
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Quando essas pessoas vieram, mais ou menos?</span>
              <select
                value={quandoColado}
                onChange={(e) => setQuandoColado(e.target.value as QuandoFoi)}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              >
                {QUANDO_FOI.map((q) => (
                  <option key={q.valor} value={q.valor}>
                    {q.rotulo}
                  </option>
                ))}
              </select>
              <span className="text-secundario text-txt-3">Dá para mudar uma por uma depois. Quem sumiu faz tempo, cole numa lista separada.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={colar} disabled={daLista.length === 0} motivoDesabilitado="Cole pelo menos um nome.">
                {daLista.length === 0 ? 'Pôr na lista' : `Pôr ${daLista.length} na lista`}
              </Button>
              <Button variante="ghost" onClick={() => setColando(false)}>
                Cancelar
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variante="secondary" onClick={() => setColando(true)}>
              <ClipboardList aria-hidden className="size-4" />
              Colar uma lista
            </Button>
            {temContatos ? (
              <Button variante="secondary" onClick={escolherDosContatos}>
                <Contact aria-hidden className="size-4" />
                Escolher dos contatos
              </Button>
            ) : null}
          </div>
        )}
        {pessoas.map((pessoa, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input rotulo={`Nome ${i + 1}`} value={pessoa.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} placeholder="Ex.: Dona Alzira" />
              </div>
              {pessoas.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setPessoas((atual) => atual.filter((_, j) => j !== i))}
                  aria-label={`Tirar a linha ${i + 1}`}
                  className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-3 transition active:scale-95"
                >
                  <X aria-hidden className="size-5" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {/*
                `min-w` de 128px, e o número é medido, não escolhido: a 375px sobram ~311px dentro do
                cartão, então dois campos de 150px (o valor anterior) não cabiam e quebravam linha —
                cada pessoa ocupava ~250px de altura. Numa tela cujo trabalho é digitar quinze
                nomes, isso é rolagem que a tarefa não precisa.
              */}
              <label className="flex min-w-[128px] flex-1 flex-col gap-1">
                <span className="text-label font-semibold text-txt-2">Última vez</span>
                <select
                  value={pessoa.quando}
                  onChange={(e) => mudar(i, 'quando', e.target.value)}
                  className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
                >
                  {QUANDO_FOI.map((q) => (
                    <option key={q.valor} value={q.valor}>
                      {q.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <div className="min-w-[128px] flex-1">
                <Input
                  rotulo="WhatsApp (opcional)"
                  value={pessoa.telefone}
                  onChange={(e) => mudar(i, 'telefone', e.target.value)}
                  inputMode="tel"
                  placeholder="(51) 99999-9999"
                />
              </div>
            </div>
          </Card>
        ))}

        <button
          type="button"
          onClick={() => setPessoas((atual) => [...atual, LINHA_VAZIA])}
          className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line-2 text-corpo font-semibold text-txt-2 transition active:scale-[.99]"
        >
          <Plus aria-hidden className="size-4" />
          Adicionar mais uma
        </button>
      </section>

      {/*
        O número no botão é o que diz que a tarefa está avançando — numa tela de digitação em lote, o
        rótulo fixo ("Salvar") não distingue uma linha preenchida de quinze.
      */}
      <Button
        carregando={pendente}
        onClick={enviar}
        disabled={total === 0 || !serviceId}
        motivoDesabilitado={total === 0 ? 'Escreva um nome ou escolha alguém que já atende.' : 'Escolha acima o serviço que essas pessoas fazem.'}
      >
        {total === 0 ? 'Adicione pelo menos uma pessoa' : `Pôr ${total} ${total === 1 ? 'pessoa' : 'pessoas'} no Motor`}
      </Button>
    </div>
  )
}

/**
 * A busca de quem já tem ficha. Debounce de 300ms — cada tecla batendo `/api/v1/clients` numa tela
 * pensada para digitar rápido no celular gastaria banda e cota à toa; 300ms é curto o bastante para
 * não parecer travado e longo o bastante para não disparar a cada letra.
 *
 * `jaAdicionados` esconde quem já está na lista de retorno — repetir o mesmo nome nos resultados
 * depois de escolhido é ruído, e a pessoa já viu que funcionou.
 */
function BuscaDeRetorno({ jaAdicionados, aoEscolher }: { jaAdicionados: string[]; aoEscolher: (c: ClienteEncontrado) => void }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ClienteEncontrado[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const termoLimpo = termo.trim()
    if (termoLimpo.length < 2) {
      setResultados([])
      return
    }
    setBuscando(true)
    const temporizador = setTimeout(() => {
      fetch(`/api/v1/clients?q=${encodeURIComponent(termoLimpo)}&limit=8`)
        .then((r) => r.json())
        .then((json: { data?: { clients?: ClienteEncontrado[] } }) => setResultados(json.data?.clients ?? []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(temporizador)
  }, [termo])

  const visiveis = resultados.filter((c) => !jaAdicionados.includes(c.id))

  return (
    <section className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Alguém que já é sua cliente voltou?</span>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-txt-3" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Busque pelo nome"
            className="h-12 w-full rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 pl-9 pr-3 text-corpo text-txt"
          />
        </div>
      </label>

      {termo.trim().length >= 2 && !buscando && visiveis.length === 0 ? (
        <p className="px-1 text-secundario text-txt-3">Ninguém com esse nome na sua base ainda.</p>
      ) : null}

      {visiveis.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-line-2 p-1">
          {visiveis.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                aoEscolher(c)
                setTermo('')
                setResultados([])
              }}
              className="toque-48 flex h-11 shrink-0 items-center justify-between rounded-[var(--radius-sm)] px-3 text-left text-corpo text-txt transition-colors hover:bg-surface-2"
            >
              <span className="truncate">{c.name}</span>
              {c.phone_e164 ? <span className="shrink-0 text-secundario text-txt-3">{c.phone_e164.slice(-9)}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
