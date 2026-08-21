import { EsqueletoCabecalho, EsqueletoFormulario } from '@/components/ui/esqueleto-tela'

export default function CarregandoConfigSeguranca() {
  return (
    <>
      <EsqueletoCabecalho comDescricao={false} />
      <EsqueletoFormulario campos={3} />
    </>
  )
}
