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
      style={
        {
          '--acc': acc,
          '--acc-2': acc2,
          '--acc-soft': `color-mix(in srgb, ${acc} 16%, transparent)`,
          '--on-acc': corDeContraste(acc),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
