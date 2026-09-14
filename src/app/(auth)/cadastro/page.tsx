import { redirect } from 'next/navigation'

import { provedoresSociaisAtivos } from '@/server/auth/provedores-sociais'
import { sessaoAtual } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'

import FormularioCadastro from './formulario'

export const metadata = { title: "Criar conta" }

/**
 * Sem sessão ainda (é o cadastro), mas a lista de profissões é pública — `professions_read`
 * (migration 0022) usa `using (true)`, então `criarClienteDoUsuario()` funciona igual sem
 * cookie de usuário, só com a chave anônima. Mesma consulta de `/onboarding/page.tsx`, trazida
 * pra cá porque o quiz agora pergunta a profissão antes de existir conta.
 */
export default async function PaginaCadastro() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  const [provedores, db] = await Promise.all([provedoresSociaisAtivos(), criarClienteDoUsuario()])
  const { data: profissoes } = await db.from('professions').select('id, slug, nome, grupo, sinonimos').eq('ativa', true).order('posicao').order('nome')

  return <FormularioCadastro profissoes={profissoes ?? []} provedores={provedores} />
}
