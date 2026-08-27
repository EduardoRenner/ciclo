import { EsqueletoCabecalho, EsqueletoLista, EsqueletoNumeros } from '@/components/ui/esqueleto-tela'

export default function CarregandoMeuPlano() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoLista itens={1} />
      <div className="mt-5">
        <EsqueletoNumeros quantos={2} />
      </div>
      <div className="mt-5">
        <EsqueletoLista itens={3} />
      </div>
    </>
  )
}
