import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDoPainel } from '@/server/auth/tenant'

import FormularioPerfil from './formulario'

export const metadata = { title: 'Do seu jeito' }

/*
 * Mesma defesa em profundidade do `admin/layout.tsx` e do `/onboarding`: rota com nonce nunca
 * pode ser cacheada (`perf/csp-duas-faixas`, `docs/DECISOES.md` 01/09). Já seria dinâmica de fato
 * por ler `contextoDoPainel`, mas cravar aqui documenta a intenção.
 */
export const dynamic = 'force-dynamic'

/**
 * `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §5.1 (P1): "Pra deixar o CICLO do seu jeito" — a tela
 * de qualificação que entra DEPOIS de `/onboarding`, nunca dentro dela. O freio de "três respostas
 * e sua página está no ar" é deliberado (comentário em `onboarding/page.tsx`); esta tela só existe
 * porque a promessa das três respostas já foi cumprida quando ela aparece.
 *
 * `contextoDoPainel` — não `contextoAtual` puro — porque quem ainda não tem tenant (`FORBIDDEN`)
 * precisa cair de volta em `/onboarding`, não numa tela que pressupõe conta criada.
 *
 * A checagem de `product_events` é o que faz a tela **não voltar a aparecer** depois que a pessoa
 * já respondeu ou pulou — sem coluna nova em `tenants`, sem migration: o evento já registrado é a
 * própria memória de "já mostrei isso". Custa uma consulta indexada a mais só nesta rota (mesmo
 * índice de `registrarPrimeiraOcorrencia`, `product_events_tenant_tipo_idx`), nunca em `/admin/hoje`.
 */
export default async function PaginaPerfilDeOnboarding() {
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/onboarding-perfil', { headers: hdrs }))

  const db = await criarClienteDoUsuario()
  const { data: jaRespondeuOuPulou } = await db
    .from('product_events')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .in('event_type', ['perfil_respondido', 'perfil_pulado'])
    .limit(1)

  if (jaRespondeuOuPulou && jaRespondeuOuPulou.length > 0) redirect('/admin/hoje')

  return (
    <TelaPublica>
      <Selo />
      <div className="w-full max-w-sm text-center">
        <h1 className="text-titulo font-bold">Pra deixar o CICLO do seu jeito</h1>
        <p className="mt-1 text-secundario text-txt-2">30 segundos, e dá pra pular.</p>
      </div>
      <FormularioPerfil />
    </TelaPublica>
  )
}
