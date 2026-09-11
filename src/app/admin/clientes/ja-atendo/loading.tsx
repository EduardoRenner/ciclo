import { EsqueletoCabecalho, EsqueletoFormulario } from '@/components/ui/esqueleto-tela'

export default function CarregandoQuemJaAtendo() {
  return (
    <>
      <EsqueletoCabecalho />
      {/* Um campo de serviço mais as três linhas de pessoa que a tela abre preenchidas. */}
      <EsqueletoFormulario campos={4} />
    </>
  )
}
