import { EsqueletoCabecalho, EsqueletoLista } from '@/components/ui/esqueleto-tela'

/** Três blocos de escolha (público, modelo, envio) — a forma real de `campanhas/nova`. */
export default function CarregandoNovaCampanha() {
  return (
    <>
      <EsqueletoCabecalho comDescricao={false} />
      <EsqueletoLista itens={5} />
    </>
  )
}
