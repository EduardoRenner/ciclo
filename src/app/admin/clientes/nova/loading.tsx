import { EsqueletoCabecalho, EsqueletoFormulario } from '@/components/ui/esqueleto-tela'

export default function CarregandoClientesNova() {
  return (
    <>
      <EsqueletoCabecalho comDescricao={false} />
      <EsqueletoFormulario campos={7} />
    </>
  )
}
