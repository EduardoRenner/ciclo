import Card from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton'

/**
 * Peças de esqueleto para as telas inteiras. Existem porque 18 telas ficaram sem `loading.tsx`
 * e escrever o esqueleto à mão em cada uma levaria ao mesmo problema que `PageHeader` resolveu:
 * 18 ritmos verticais diferentes para o mesmo momento.
 *
 * A regra que governa todas: o esqueleto imita a **forma real** da tela — mesma quantidade de
 * blocos, mesma altura aproximada. Esqueleto de forma errada é pior que nenhum, porque o
 * conteúdo "pula" quando chega, e o pulo lê como defeito.
 */

/** Título + descrição do `PageHeader`, no mesmo ritmo vertical dele (`pb-5 pt-6`). */
export function EsqueletoCabecalho({ comDescricao = true }: { comDescricao?: boolean }) {
  return (
    <header className="pb-5 pt-6">
      <Skeleton className="h-7 w-40" />
      {comDescricao ? <Skeleton className="mt-2 h-4 w-56" /> : null}
    </header>
  )
}

/** Lista de cards — a forma de `servicos`, `profissionais`, `campanhas`, `planos`. */
export function EsqueletoLista({ itens = 4, comSubtitulo = true }: { itens?: number; comSubtitulo?: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: itens }, (_, i) => (
        <Card key={i}>
          <Skeleton className="h-4 w-1/2" />
          {comSubtitulo ? <Skeleton className="mt-2 h-3 w-1/3" /> : null}
        </Card>
      ))}
    </div>
  )
}

/**
 * Formulário — a forma de `negocio`, `nova`, `novo`. Rótulo curto + campo de 48px, que é a
 * altura real de `Input`; sem isso o campo "cresce" quando o formulário chega.
 */
export function EsqueletoFormulario({ campos = 5 }: { campos?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="mt-2 h-12 w-full" />
    </div>
  )
}

/** Grade de números (`StatTile`) — topo de `campanhas` e da comanda. */
export function EsqueletoNumeros({ quantos = 2 }: { quantos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-busy="true">
      {Array.from({ length: quantos }, (_, i) => (
        <Card key={i}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-6 w-24" />
        </Card>
      ))}
    </div>
  )
}
