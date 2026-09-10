'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { causaDaFalhaDaTela, detalheTecnicoDaFalha, FRASE_DA_CAUSA, type CausaDaFalha } from '@/core/schema/causa-da-falha'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

/**
 * Erro dentro do shell do profissional.
 *
 * **A intenção original deste arquivo estava certa e não se cumpriu.** O comentário dizia: *"mantém
 * topbar e tab bar de pé, para a pessoa poder ir para outra aba em vez de ficar presa"* — e a
 * navegação de fato continua desenhada. Mesmo assim, o Eduardo caiu aqui em 2026-09-03 e descreveu
 * como *"ficou tudo travado e nem tem como sair"*.
 *
 * Duas coisas explicam a distância entre a intenção e o que ele viveu, e o conserto ataca as duas:
 *
 * **1. A saída era implícita.** Este cartão tinha UMA ação — "Tentar de novo" — no meio de uma área
 * vazia enorme. A navegação lateral, no desktop, lê como moldura, não como escape. O irmão deste
 * arquivo (`src/app/error.tsx`, o boundary da raiz) já resolvia isso direito: ele oferece a ação E
 * um link de saída, com um comentário longo explicando que o destino tem que depender de ONDE o
 * erro aconteceu. Este aqui sombreia aquele em toda rota `/admin` e não seguia a mesma regra.
 *
 * **2. `reset()` sozinho não escapa de estado quebrado.** Ele re-renderiza o segmento com o mesmo
 * estado de cliente; se o erro não for transitório, o toque devolve a mesma tela e a pessoa conclui
 * que travou. E navegar pela barra lateral é navegação de cliente — reaproveita o mesmo runtime.
 * Por isso a saída daqui é uma navegação de página inteira (`<a href>`, não `<Link>`): é a única
 * que descarta o estado que quebrou. É mais lenta de propósito.
 *
 * Quando o erro é NA PRÓPRIA tela Hoje, mandar para Hoje é um botão que não faz nada. Por isso o
 * destino olha o caminho atual, no mesmo padrão do boundary da raiz.
 */
export default function ErroDoApp({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname() ?? ''
  const jaEstaNoHoje = caminho.startsWith('/admin/hoje')
  const [causa, setCausa] = useState<CausaDaFalha>('desconhecida')
  const [detalhe, setDetalhe] = useState<string | null>(null)

  /*
   * Pergunta a CAUSA a quem sabe, em vez de chutar.
   *
   * O `error` que chega aqui não serve: em produção o Next higieniza a mensagem de erro de Server
   * Component e sobra só o `digest`. Quem já compara o livro de migrations com o que o código
   * espera é `/api/health` (`compararSchema`), e ele responde sem sessão.
   *
   * Falhar aqui é o caso NORMAL de queda de rede, e aí a frase genérica é a verdadeira: por isso o
   * `catch` não conta nem avisa nada, ele só deixa a causa em `desconhecida`. É a exceção
   * consciente à armadilha do "catch que descarta" do CLAUDE.md, porque o que ele descarta é
   * justamente o sinal de que a hipótese padrão estava certa.
   */
  useEffect(() => {
    const controlador = new AbortController()
    // Teto curto: este cartão já é a tela de erro, e ninguém espera por um diagnóstico.
    const relogio = setTimeout(() => controlador.abort(), 4000)

    fetch('/api/health', { signal: controlador.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((corpo: unknown) => {
        const c = causaDaFalhaDaTela(corpo)
        setCausa(c)
        setDetalhe(detalheTecnicoDaFalha(corpo, c))
      })
      .catch(() => {})
      .finally(() => clearTimeout(relogio))

    return () => {
      clearTimeout(relogio)
      controlador.abort()
    }
  }, [])

  return (
    <Card className="mt-8 flex flex-col items-center px-6 py-12 text-center">
      <p className="text-corpo font-semibold text-txt">Não consegui carregar esta tela</p>
      <p className="mt-1 max-w-[42ch] text-secundario text-txt-2">{FRASE_DA_CAUSA[causa]}</p>
      {detalhe ? (
        // Linha discreta: quem cuida do salão ignora, quem cuida do sistema lê aqui o que fazer.
        <p className="mt-2 max-w-[52ch] font-mono text-[11px] leading-relaxed text-txt-3">{detalhe}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>
          <RotateCcw aria-hidden className="size-4" />
          Tentar de novo
        </Button>
        {/*
          `<a>` e não `<Link>`: navegação de página inteira, que é o que descarta o estado de
          cliente quebrado. Um `<Link>` aqui faria navegação de cliente e poderia cair no mesmo
          erro, que é exatamente a sensação de "travado" que este conserto existe para tirar.
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
            A regra existe para impedir que alguém perca a navegação de cliente por descuido. Aqui
            a perda é o RECURSO: um `<Link>` reaproveitaria o runtime que acabou de quebrar, e é
            disso que esta tela precisa escapar. O boundary da raiz faz a mesma escolha e não é
            sinalizado só porque o `href` de lá é uma variável — o ponto cego da regra, não uma
            decisão diferente. */}
        <a
          href="/admin/hoje"
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition hover:bg-surface-3 active:scale-[.97]"
        >
          {/* O destino é o mesmo; o que muda é o RÓTULO, porque "Ir para Hoje" estando no Hoje é
              um botão que promete ir a lugar nenhum. Carregar a mesma URL por navegação inteira é
              recarregar de verdade, e é isso que a palavra diz. */}
          {jaEstaNoHoje ? 'Recarregar a página' : 'Ir para Hoje'}
        </a>
      </div>
    </Card>
  )
}
