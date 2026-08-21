import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

export default function CarregandoConfigServicos() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoLista itens={5} />
    </>
  )
}
