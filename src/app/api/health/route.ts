import { withNovoTenant } from '@/server/db/with-tenant'
import { ipDe } from '@/server/http/ip'
import { limitador } from '@/server/services/rate-limit'
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
/**
 * Teto próprio, porque esta é a ÚNICA rota que não passa pelo `rota()` — e por isso a única fora
 * do teto global de 120/min por IP. Sem ele, um endpoint anônimo que custa sete idas ao banco com
 * `service_role` fica aberto para qualquer um marretar: não vaza dado, mas consome a conexão que o
 * app pagante precisa.
 *
 * 30/min é folgado para monitor de uptime (o normal é 1/min) e apertado para script. Fica em
 * memória de propósito, igual ao teto global: o trabalho dele é conter laço maluco numa instância,
 * e uma ida ao Postgres para decidir se pode ir ao Postgres seria o contrário do objetivo.
 */
const LIMITE = { limite: 30, janelaSegundos: 60, somenteMemoria: true }

export async function GET(req: Request) {
  const { permitido } = await limitador(`health:ip:${ipDe(req)}`, LIMITE)
  if (!permitido) {
    // 429 puro, sem corpo de relatório: quem apanhou do limite não é o monitor legítimo.
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '60' },
    })
  }

  const relatorio = await withNovoTenant((svc) => verificarSaude(svc))
  return new Response(JSON.stringify(relatorio), {
    status: relatorio.ok ? 200 : 503,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
