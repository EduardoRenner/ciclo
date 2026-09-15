import PageHeader from '@/components/ui/page-header'

import FormularioExcluirConta from './formulario'

export const metadata = { title: 'Excluir minha conta' }

/**
 * T-DEL (docs/64 §0.3): guideline 5.1.1(v) da Apple/exigência equivalente do Google Play — quem
 * criou conta precisa conseguir excluí-la DE DENTRO do app, sem ligar nem mandar e-mail. A
 * situação (pode ou não, e por quê) só se sabe depois de logar quantos negócios a conta atinge —
 * por isso o formulário busca isso sozinho ao abrir, em vez de a página server-side decidir.
 */
export default function PaginaExcluirConta() {
  return (
    <>
      <PageHeader titulo="Excluir minha conta" />
      <FormularioExcluirConta />
    </>
  )
}
