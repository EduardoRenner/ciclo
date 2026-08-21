import { EsqueletoCabecalho, EsqueletoLista, EsqueletoNumeros } from '@/components/ui/esqueleto-tela'

/**
 * A comanda é onde se cobra: qualquer hesitação aqui é a mais cara do app. O esqueleto mostra
 * o total no topo e as linhas de item, que é exatamente a forma que chega.
 */
export default function CarregandoComanda() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoNumeros quantos={2} />
      <div className="mt-4">
        <EsqueletoLista itens={3} />
      </div>
    </>
  )
}
