import { EsqueletoCabecalho, EsqueletoFormulario } from '@/components/ui/esqueleto-tela'

export default function CarregandoConfigHorarios() {
  return (
    <>
      <EsqueletoCabecalho comDescricao={false} />
      <EsqueletoFormulario campos={5} />
    </>
  )
}
