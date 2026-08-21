import { EsqueletoCabecalho, EsqueletoLista, EsqueletoNumeros } from '@/components/ui/esqueleto-tela'

export default function CarregandoCampanhas() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoNumeros quantos={2} />
      <div className="mt-4">
        <EsqueletoLista itens={4} />
      </div>
    </>
  )
}
