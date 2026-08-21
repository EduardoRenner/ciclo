import { EsqueletoCabecalho, EsqueletoFormulario } from '@/components/ui/esqueleto-tela'

export default function CarregandoConfigNotificacoes() {
  return (
    <>
      <EsqueletoCabecalho comDescricao={false} />
      <EsqueletoFormulario campos={3} />
    </>
  )
}
