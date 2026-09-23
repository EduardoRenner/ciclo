'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import Chip from '@/components/ui/chip'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import { linkComOrigem } from '@/core/aquisicao/origem'
import { LIMITES, RITMOS_COMUNS, calcularParado } from '@/core/aquisicao/calculadora'

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function paraInteiro(texto: string): number {
  const digitos = texto.replace(/\D/g, '').slice(0, 4)
  return digitos === '' ? 0 : Number(digitos)
}

/**
 * `docs/82` §8. Começa com números de exemplo (uma barbearia de cidade pequena) para o resultado
 * aparecer antes de a pessoa digitar qualquer coisa — um formulário vazio pede esforço antes de
 * mostrar por que vale a pena. O rótulo diz que é exemplo.
 */
export default function Calculadora() {
  const [clientes, setClientes] = useState(8)
  const [ticketCents, setTicketCents] = useState(3500)
  const [retorno, setRetorno] = useState(30)

  const resultado = calcularParado({ clientesSumidos: clientes, ticketCents, retornoDias: retorno })

  // Cada limite de `calcularParado` precisa de uma frase aqui: um valor fora da faixa que não vira
  // erro faz o resultado sumir com a tela dizendo "preencha os três números" — os três preenchidos.
  const erroClientes =
    clientes < LIMITES.clientesSumidos.min
      ? 'Pense em pelo menos um cliente que sumiu.'
      : clientes > LIMITES.clientesSumidos.max
        ? `Até ${LIMITES.clientesSumidos.max}. Esta conta é de quem você lembra de cabeça.`
        : undefined
  const erroTicket =
    ticketCents < LIMITES.ticketCents.min
      ? 'Digite quanto um cliente gasta por visita.'
      : ticketCents > LIMITES.ticketCents.max
        ? `Até ${reais.format(LIMITES.ticketCents.max / 100)} por visita.`
        : undefined
  const erroRetorno =
    retorno < LIMITES.retornoDias.min || retorno > LIMITES.retornoDias.max
      ? `Use um número entre ${LIMITES.retornoDias.min} e ${LIMITES.retornoDias.max} dias.`
      : undefined

  // A região viva existe sempre e o texto sai do MESMO resultado que desenha o número grande —
  // nascer junto com o conteúdo não é anunciado pelo leitor de tela (armadilha do CLAUDE.md).
  const anuncio = resultado
    ? `${reais.format(resultado.paradoPorMesCents / 100)} por mês, ${reais.format(resultado.paradoPorAnoCents / 100)} por ano.`
    : 'Preencha os três números para ver a conta.'

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-[var(--radius)] border border-line bg-surface p-5 shadow-elevado">
        <Input
          rotulo="Quantos clientes que vinham sempre pararam de vir? Conte quem você lembra."
          ajuda="Pense em nomes, não em porcentagem. Exemplo: 8."
          erro={erroClientes}
          type="text"
          inputMode="numeric"
          value={clientes === 0 ? '' : String(clientes)}
          onChange={(e) => setClientes(paraInteiro(e.target.value))}
          classNameCampo="tabular"
        />

        <MoneyInput
          rotulo="Quanto rendia cada visita?"
          ajuda="O ticket médio. Exemplo: R$ 35,00."
          erro={erroTicket}
          centavos={ticketCents}
          aoMudar={setTicketCents}
        />

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-3 text-secundario font-semibold text-txt">
            De quanto em quanto tempo a clientela fiel volta?
          </legend>
          <div className="flex flex-wrap gap-2">
            {RITMOS_COMUNS.map((dias) => (
              <Chip key={dias} ligado={retorno === dias} onClick={() => setRetorno(dias)}>
                {dias} dias
              </Chip>
            ))}
          </div>
          <Input
            rotulo="Ou digite em dias"
            erro={erroRetorno}
            type="text"
            inputMode="numeric"
            value={retorno === 0 ? '' : String(retorno)}
            onChange={(e) => setRetorno(paraInteiro(e.target.value))}
            classNameCampo="tabular"
          />
        </fieldset>
      </section>

      <section className="rounded-[var(--radius)] border border-acc-2 bg-surface p-5 shadow-elevado">
        <p className="text-secundario text-txt-2">Deixou de entrar, só com essas pessoas:</p>
        <p className="sr-only" role="status" aria-live="polite">
          {anuncio}
        </p>
        {resultado ? (
          <>
            <p aria-hidden className="tabular mt-1 text-numero font-bold text-txt">
              {reais.format(resultado.paradoPorMesCents / 100)}
              <span className="text-corpo font-semibold text-txt-2"> por mês</span>
            </p>
            <p aria-hidden className="tabular text-corpo text-txt-2">
              {reais.format(resultado.paradoPorAnoCents / 100)} por ano
            </p>

            <p className="mt-4 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt-2">
              <span className="font-semibold text-txt">A conta: </span>
              quem volta a cada {retorno} dias vem {decimal.format(resultado.visitasPorAno)} vezes por ano. A{' '}
              {reais.format(ticketCents / 100)} por visita, cada cliente nesse ritmo vale{' '}
              {reais.format(resultado.valorPorClientePorAnoCents / 100)} por ano. Vezes {clientes}.
            </p>
          </>
        ) : (
          <p className="mt-1 text-corpo text-txt-3">Preencha os três números acima.</p>
        )}

        <p className="mt-4 text-corpo text-txt">
          E essa conta é só de quem você lembrou. Quem sumiu sem você notar não entra nela.
        </p>
        <p className="mt-2 text-secundario text-txt-2">
          O CICLO usa o intervalo entre as visitas de cada cliente e mostra, pelo nome, quem passou da hora
          de voltar. Com uma mensagem pronta para mandar pelo seu WhatsApp. É grátis, sem cartão.
        </p>

        <Link
          href={linkComOrigem('/cadastro', 'calculadora')}
          className={
            'mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 ' +
            'text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]'
          }
        >
          Ver quem sumiu, pelo nome
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>
    </div>
  )
}
