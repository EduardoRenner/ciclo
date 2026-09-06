import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

export default function CarregandoFichaDeConsumo() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoLista itens={3} />
    </>
  )
}
