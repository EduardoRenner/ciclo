import { redirect } from 'next/navigation'

/**
 * `/admin` sozinho não é tela — cai direto no resumo do dia. Sem `await`
 * nenhum, o Next tentaria pré-renderizar estática — e o nonce do CSP por
 * requisição nunca bate com o carimbado no HTML do build (achado ao vivo em
 * produção antes, ver `docs/DECISOES.md`). `force-dynamic` evita repetir.
 */
export const dynamic = 'force-dynamic'

export default function PaginaAdmin() {
  redirect('/admin/hoje')
}
