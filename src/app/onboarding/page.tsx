import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { sessaoAtual } from '@/server/auth/session'

import FormularioOnboarding from './formulario'

export const metadata = { title: "Primeiros passos" }

export default async function PaginaOnboarding() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  const db = await criarClienteDoUsuario()
  const { data: vinculos } = await db.from('memberships').select('id').eq('user_id', sessao.userId).eq('active', true).limit(1)
  if (vinculos && vinculos.length > 0) redirect('/admin/hoje')

  // P4: as 17 profissões do catálogo (professions, P0+P5) — busca de verdade, não mais as 8
  // verticais de beleza hardcoded. Server-side pra não custar um round-trip extra no fluxo
  // que precisa ficar em menos de 3 minutos (§16 critério 4).
  const { data: profissoes } = await db.from('professions').select('id, nome, grupo, sinonimos').eq('ativa', true).order('posicao').order('nome')

  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Vamos criar seu negócio</h1>
        <p className="mt-1 text-secundario text-txt-2">Você poderá ajustar tudo isso depois.</p>
      </div>
      <FormularioOnboarding profissoes={profissoes ?? []} />
    </TelaPublica>
  )
}
