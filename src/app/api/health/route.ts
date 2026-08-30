import { withNovoTenant } from '@/server/db/with-tenant'
import { verificarSaude } from '@/server/services/health'

/**
 * J129/TICKET-058. Sem autenticação de propósito — é o endpoint que o monitor externo (uptime
 * checker, Vercel) bate de fora, e não vaza nada sensível (só contagens agregadas e booleanos).
 * 200 quando tudo ok, 503 quando algum check falha — é o código que a maioria dos monitores de
 * uptime já sabe interpretar sem configuração especial.
 *
 * O `charset=utf-8` é explícito, e não é zelo: `NextResponse.json()` manda só
 * `application/json`, e sem o charset o cliente escolhe o dele. Medido em 30/08 na produção — os
 * bytes saíam em UTF-8 correto e chegavam como `1 job(s) parado(s) hÃ¡ mais de 15 min` em quem
 * lê. Toda outra rota da API já mandava o charset (`comRequestId` em `server/http/response.ts`);
 * esta ficou de fora por montar a própria resposta, sem passar pelo `rota()`.
 */
export async function GET() {
  const relatorio = await withNovoTenant((svc) => verificarSaude(svc))
  return new Response(JSON.stringify(relatorio), {
    status: relatorio.ok ? 200 : 503,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
