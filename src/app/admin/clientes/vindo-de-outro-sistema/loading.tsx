import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

export default function CarregandoVindoDeOutroSistema() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoLista itens={3} />
    </>
  )
}
