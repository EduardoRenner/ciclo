import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

/** Mesma forma da tela pronta: cabeçalho e a lista de produtos com duas linhas cada. */
export default function CarregandoEstoque() {
  return (
    <div aria-busy="true">
      <EsqueletoCabecalho />
      <EsqueletoLista itens={6} />
    </div>
  )
}
