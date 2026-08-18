import { NextResponse } from 'next/server'

import { withNovoTenant } from '@/server/db/with-tenant'
import { verificarSaude } from '@/server/services/health'

/**
 * J129/TICKET-058. Sem autenticação de propósito — é o endpoint que o monitor externo (uptime
 * checker, Vercel) bate de fora, e não vaza nada sensível (só contagens agregadas e booleanos).
 * 200 quando tudo ok, 503 quando algum check falha — é o código que a maioria dos monitores de
 * uptime já sabe interpretar sem configuração especial.
 */
export async function GET() {
  const relatorio = await withNovoTenant((svc) => verificarSaude(svc))
  return NextResponse.json(relatorio, { status: relatorio.ok ? 200 : 503 })
}
