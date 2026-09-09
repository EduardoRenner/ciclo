import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { sessaoAtual } from '@/server/auth/session'

import FormularioOnboarding from './formulario'

export const metadata = { title: "Primeiros passos" }

/*
 * `/onboarding` recebe a CSP com nonce do `middleware.ts` (não está em `ROTAS_DE_CONTEUDO_ESTATICO`)
 * e não herda mais o `force-dynamic` do layout raiz — ele mora só no painel agora. Já é dinâmica
 * por ler `sessaoAtual()`, mas cravar aqui é a mesma defesa em profundidade do `admin/layout.tsx`:
 * rota com nonce nunca pode ser cacheada. Ver `perf/csp-duas-faixas` e `docs/DECISOES.md` (01/09).
 */
export const dynamic = 'force-dynamic'

export default async function PaginaOnboarding() {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  const db = await criarClienteDoUsuario()
  const { data: vinculos } = await db.from('memberships').select('id').eq('user_id', sessao.userId).eq('active', true).limit(1)
  if (vinculos && vinculos.length > 0) redirect('/admin/hoje')

  // P4: as 17 profissões do catálogo (professions, P0+P5) — busca de verdade, não mais as 8
  // verticais de beleza hardcoded. Server-side pra não custar um round-trip extra no fluxo
  // que precisa ficar em menos de 3 minutos (§16 critério 4).
  const { data: profissoes } = await db.from('professions').select('id, slug, nome, grupo, sinonimos').eq('ativa', true).order('posicao').order('nome')

  return (
    <TelaPublica>
      <Selo />
      {/*
        `docs/20-COPY-PLANO.md` §D.9, variante A — recomendada em 24/08 e não implementada.

        **"Vamos criar seu negócio" saiu por ser factualmente errado**, e é o tipo de frase que quem
        TEM o negócio nota na hora: o negócio dela existe há anos; o que está sendo criado é uma
        conta. Errar isso na terceira tela do funil, depois de a pessoa já ter dado nome, e-mail,
        telefone e senha, é caro por um motivo específico — ela acabou de decidir confiar, e a
        primeira coisa que o produto faz é mostrar que não entendeu o que ela é.

        **"Três respostas" é contável e verificável**, e é a razão de a variante A ganhar: o
        formulário tem exatamente três campos (nome do negócio, profissão e endereço da página,
        conferidos em `formulario.tsx`). Se um quarto campo aparecer um dia, a copy fica falsa —
        o que é bom, porque ela passa a ser um freio contra o formulário crescer.

        E ela promete a ENTREGA ("sua página está no ar"), não o trabalho ("vamos configurar"), que
        é a diferença entre redução de atrito e descrição de tarefa.
      */}
      <div className="text-center">
        <h1 className="text-titulo font-bold">Três respostas e sua página está no ar</h1>
        <p className="mt-1 text-secundario text-txt-2">Você pode ajustar tudo isso depois.</p>
      </div>
      <FormularioOnboarding profissoes={profissoes ?? []} />
    </TelaPublica>
  )
}
