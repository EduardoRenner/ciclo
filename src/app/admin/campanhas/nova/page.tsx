import { headers } from 'next/headers'
import Link from 'next/link'

import { podeUsarModulo } from '@/core/billing/planos'
import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { publicoDaCampanha, SEGMENTOS_CAMPANHA } from '@/server/services/crm'
import { listarModelos } from '@/server/services/mensagens-prontas'
import { contextoDePlano } from '@/server/services/planos'

import NovaCampanha from './nova'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Nova campanha" }

export default async function PaginaNovaCampanha() {
  const ctx = await contextoAtual(new Request('https://interno/campanhas/nova', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  // Os cinco públicos vêm resolvidos de uma vez: a tela precisa mostrar o tamanho de cada grupo
  // ANTES da escolha ("Sumiram · 11 pessoas"), senão a pessoa escolhe às cegas.
  const [modelos, negocio, ...publicos] = await Promise.all([
    listarModelos(db, ctx.tenantId),
    db.from('tenants').select('name').eq('id', ctx.tenantId).single(),
    ...SEGMENTOS_CAMPANHA.map((s) => publicoDaCampanha(db, ctx.tenantId, s.valor)),
  ])

  const porSegmento = Object.fromEntries(SEGMENTOS_CAMPANHA.map((s, i) => [s.valor, publicos[i] ?? []]))

  /*
    A lista (`campanhas/page.tsx`) trava isto desde 2026-09-03, mas o conserto ficou só lá — e
    esta rota é alcançável direto: pela URL, por link salvo, e pelo card de aniversariantes da
    Central de Ações (`crm.ts:661`, que aponta para cá sem checar plano).
    Quem chegava no Grátis por qualquer um desses caminhos escolhia o público, escolhia o
    modelo, abria o WhatsApp de uma pessoa por vez — e só no botão final a rota recusava. É o
    defeito que `recurso-pago-avisa-antes` existe para pegar, na hora em que a pessoa mais quer
    o Essencial: o produto joga fora o trabalho que ela acabou de fazer.

    O maior dos cinco públicos é a evidência com o dado DELA que o §M.1 pede — é exatamente o
    que o Essencial libera alcançar de uma vez.
  */
  const plano = await contextoDePlano(db, ctx.tenantId)
  if (podeUsarModulo(plano, 'campaigns').estado !== 'liberado') {
    const maiorPublico = Math.max(0, ...Object.values(porSegmento).map((p) => p.length))
    return (
      <BloqueioPlano
        precisaDo="essencial"
        acao="mandar a mesma mensagem para todo mundo de uma vez"
        {...(maiorPublico > 0
          ? {
              evidencia: {
                quantidade: maiorPublico,
                substantivo: maiorPublico === 1 ? 'pessoa esperando no maior grupo' : 'pessoas esperando no maior grupo',
              },
            }
          : {})}
        alternativa={<Link href="/admin/recuperar">Avisar uma de cada vez, de graça</Link>}
      />
    )
  }

  return (
    <NovaCampanha
      segmentos={[...SEGMENTOS_CAMPANHA]}
      publicoPorSegmento={porSegmento}
      modelos={modelos.filter((m) => m.active)}
      nomeDoNegocio={negocio.data?.name ?? ''}
    />
  )
}
