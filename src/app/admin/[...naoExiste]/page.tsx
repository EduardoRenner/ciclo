import { notFound } from 'next/navigation'

export const metadata = { title: 'Essa página não existe' }

/**
 * APR-113: endereço que não existe DENTRO do painel (`/admin/xyz`). Sem este pega-tudo o Next
 * responde com o 404 da raiz, sem a casca do painel: medido na build de produção, `/admin/xyz`
 * saía sem a barra e sem "Voltar para Hoje". Rotas estáticas têm precedência, então isto só
 * casa com o que nenhuma outra tela de `/admin` atende, e entrega ao `not-found.tsx` ao lado.
 */
export default function RotaInexistenteNoPainel() {
  notFound()
}
