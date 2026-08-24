import { headers } from 'next/headers'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarModulos } from '@/server/services/modulos'

import Modulos from './modulos'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição. */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Módulos' }

/**
 * docs/09-PLATAFORMA.md §6 e docs/18-MONETIZACAO-PLANO.md §L.2.
 *
 * `tenant_modules` existia desde a migration 0025 sem nenhuma tela que a lesse ou escrevesse.
 * Esta é a tela, e ela materializa a precedência de três camadas da §D.5:
 *
 *   - módulo que não faz sentido para o eixo do negócio **não aparece na lista** (some, sem oferta);
 *   - módulo que o plano não libera aparece com cadeado e o caminho para o degrau que resolve;
 *   - módulo liberado tem interruptor, e desligar é escolha reversível do dono.
 *
 * O que o dono NÃO consegue é ligar além do teto do plano — a rota recusa. Sem isso
 * `tenant_modules` viraria uma segunda fonte de verdade brigando com `tenants.plan`.
 */
export default async function PaginaModulos() {
  const ctx = await contextoAtual(new Request('https://interno/modulos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const modulos = await listarModulos(db, ctx.tenantId)

  return (
    <>
      <PageHeader
        titulo="Módulos"
        descricao="Ligue só o que você usa. Desligar esconde da interface — nunca apaga nada."
      />
      <Modulos iniciais={modulos} />
    </>
  )
}
