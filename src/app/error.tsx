'use client'

import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import Button from '@/components/ui/button'
import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'

/**
 * Não existia `error.tsx` em nenhuma rota do projeto: qualquer falha de
 * servidor caía na página crua do Next — em inglês, fundo branco, sem saída —
 * dentro de um app que é preto, em português e mobile-first. `§6` do design
 * system manda o erro explicar o que fazer, não só que deu erro.
 *
 * `reset()` re-renderiza o segmento sem recarregar a página inteira: numa rede
 * de subsolo isso é a diferença entre um toque e vinte segundos.
 *
 * ⚠️ Este boundary é da RAIZ: ele pega TODA rota, inclusive as públicas. Medido no navegador em
 * 2026-08-25, quebrando o `fetch` de propósito em `/dom-rocha/agendar`: um único pedido que falha
 * ao escolher o dia derruba a tela inteira e caía aqui — onde a pessoa lia "Seus dados estão
 * salvos" (ela não estava salvando nada, estava escolhendo horário) e recebia um botão **"Ir para
 * Hoje"**, que leva ao painel do profissional. Quem está nessa tela é o CLIENTE do salão: o botão
 * o mandava para um login que não é dele.
 *
 * Por isso a saída depende de ONDE o erro aconteceu. É a mesma regra do resto do produto: o texto
 * tem que ser verdade no contexto em que aparece.
 */
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname() ?? '/'
  const noPainel = caminho.startsWith('/admin')
  /* `/dom-rocha/agendar` → `dom-rocha`. Vazio na home e nas rotas por token. */
  const slug = !noPainel ? (caminho.split('/')[1] ?? '') : ''
  const voltarPara = noPainel ? '/admin/hoje' : slug ? `/${slug}` : '/'
  const rotuloDoVoltar = noPainel ? 'Ir para Hoje' : slug ? 'Voltar para a página do estabelecimento' : 'Ir para o início'

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Algo saiu do lugar</h1>
        <p className="mt-2 max-w-[34ch] text-corpo text-txt-2">
          {noPainel
            ? 'Não consegui carregar esta tela. Seus dados estão salvos — foi só a exibição que falhou.'
            : 'Não consegui carregar esta tela. Nada foi marcado ainda — dá para tentar de novo.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>
          <RotateCcw aria-hidden className="size-4" />
          Tentar de novo
        </Button>
        <Link
          href={voltarPara}
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition hover:bg-surface-3 active:scale-[.97]"
        >
          {rotuloDoVoltar}
        </Link>
      </div>
    </TelaPublica>
  )
}
