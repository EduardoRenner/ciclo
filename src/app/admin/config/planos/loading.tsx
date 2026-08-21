import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

export default function CarregandoConfigPlanos() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoLista itens={3} />
    </>
  )
}
