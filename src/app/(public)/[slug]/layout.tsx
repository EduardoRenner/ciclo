import { notFound } from 'next/navigation'

import { corDeContraste } from '@/core/text/cor'
import { AppError } from '@/server/http/errors'
import { perfilPublico } from '@/server/services/public-booking'

/**
 * Cor de acento por tenant como variável CSS **inline no wrapper**, não um
 * `<style>` global nem sobrescrevendo `:root` — assim cada componente que já
 * usa `bg-acc`/`text-acc-2`/`bg-acc-soft` (a maioria da vitrine em
 * `src/components/ui/`) recolore de graça, e o admin (árvore irmã, fora
 * deste layout) nunca é afetado. `style-src` do CSP não leva nonce de
 * propósito (ver `middleware.ts`), então `style={{...}}` é permitido sem
 * gambiarra. Sem `await`, esta rota seria candidata a página estática — e o
 * nonce do CSP por requisição nunca bateria com o do build (bug já corrigido
 * uma vez em produção, ver `docs/DECISOES.md`).
 *
 * `data-theme="light"` — 2026-09-21, pedido direto do Eduardo (a página pública de agendamento,
 * "Barbearia Dom Estilo" de exemplo, veio como prova). Mesmo mecanismo de `tela-publica.tsx`/
 * `app/page.tsx`: `color`/`background` explícitos porque `body` já declara `color: var(--txt)`,
 * herdado (não recalculado) — sem redeclarar aqui, qualquer elemento de `agendar.tsx` sem a
 * própria classe de cor herdaria o `--txt` escuro do `body` em vez do claro deste wrapper.
 *
 * **Não verificado ao vivo nesta sessão** — esta rota depende de tenant real (`perfilPublico`),
 * e Docker/Supabase local está indisponível. `agendar.tsx` tem 1352 linhas e é a página pública
 * mais complexa do produto (fluxo de agendamento multi-etapa, calendário, seleção de serviço);
 * o mecanismo é o mesmo já provado nas outras três telas, mas o Eduardo deveria conferir esta
 * especificamente antes de considerar fechado, pelo tamanho e por ser a única das quatro com
 * cliente de verdade do outro lado.
 */
export const dynamic = 'force-dynamic'

const HEX = /^#[0-9a-f]{6}$/i

export default async function LayoutSlug({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const perfil = await perfilPublico(slug).catch((erro: unknown) => {
    if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
    throw erro
  })
  if (!perfil) notFound()

  // Fallback se o dono não escolheu cor (ou salvou um valor inválido): osso — o
  // mesmo acento neutro do app (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §3.3),
  // nunca o roxo antigo por profissão (removido na migration 0033). Um salão sem
  // cor configurada não deve herdar a marca de IA.
  const acc = HEX.test(perfil.accentColor.acc) ? perfil.accentColor.acc : '#f0ebe3'
  const acc2 = HEX.test(perfil.accentColor.acc2) ? perfil.accentColor.acc2 : '#fffcf7'

  return (
    <div
      data-theme="light"
      style={
        {
          '--acc': acc,
          '--acc-2': acc2,
          '--acc-soft': `color-mix(in srgb, ${acc} 16%, transparent)`,
          '--on-acc': corDeContraste(acc),
          color: 'var(--txt)',
          background: 'var(--bg)',
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#faf8f5}' }} />
      {children}
    </div>
  )
}
