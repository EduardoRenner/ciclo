import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

/** Uma linha por automação do catálogo — o esqueleto tem que ter a altura do que vem depois. */
export default function CarregandoAutomacoes() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoLista itens={6} />
    </>
  )
}
