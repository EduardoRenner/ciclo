import { dataLocalDe, dentroDaJanela, horaLocalDe } from '@/core/cron/janela'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { limparChavesDeIdempotencia } from '@/server/http/idempotency'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'
import { registrarHeartbeat } from '@/server/services/health'

/**
 * §5.3: "03:00 no fuso de cada tenant". A cada disparo, checa QUAIS tenants estão passando pela
 * madrugada no próprio fuso agora. Rodar `recomputarCiclosDoTenant` de novo pelo mesmo tenant no
 * mesmo dia é inofensivo (upsert por PK, TICKET-036) — a checagem de hora só existe para não
 * gastar processamento à toa, não para garantir corretude.
 *
 * É exatamente por isso que aqui é uma JANELA e não uma igualdade: o agendador atrasa, e trocar
 * exatidão por folga custa só processamento. Em 25/08 a igualdade exata custou o dia inteiro do
 * Motor de Ciclo por 56 minutos de atraso do GitHub. Ver `src/core/cron/janela.ts` e `docs/23` §2.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    // Um instante só para todos os tenants: com `new Date()` dentro do laço, um tenant avaliado
    // na virada da hora usaria um relógio diferente do vizinho.
    const agora = new Date()

    let processados = 0
    for (const tenant of tenants ?? []) {
      if (!dentroDaJanela(horaLocalDe(tenant.timezone, agora), 3)) continue

      await recomputarCiclosDoTenant(svc, tenant.id, tenant.timezone, dataLocalDe(tenant.timezone, agora))
      processados++
    }

    /*
     * O heartbeat só bate quando houve TRABALHO, e essa distinção é o ponto.
     *
     * Medido em 26/08: o Motor de Ciclo devolveu `{"tenantsProcessados":0}` nos CINCO disparos do
     * dia, com HTTP 200 — e o `cron.yml` só olha o código de status (`2xx passa`), então os cinco
     * jobs ficaram verdes. Foi o segundo dia seguido em que o diferencial que sustenta o preço do
     * produto não rodou, e nada em lugar nenhum reclamou. Era a mesma falha do dia 25 (`docs/23`
     * §2), sobrevivendo ao próprio conserto porque a correção da janela estava em `main` e não em
     * produção.
     *
     * Registrar em toda chamada repetiria o defeito numa camada nova: "a rota foi chamada" já era
     * verdade nos cinco disparos zerados. O que precisa ser observável é "algum tenant teve o
     * ciclo recalculado" — por isso o `> 0`.
     *
     * Não derruba a rota se falhar: um heartbeat perdido não pode desfazer recálculo que já
     * aconteceu, e a checagem de saúde acusa o silêncio no próximo ciclo de qualquer forma.
     */
    if (processados > 0) {
      await registrarHeartbeat(svc, 'recompute_cycles').catch((erro: unknown) => {
        console.error(JSON.stringify({ level: 'error', event: 'heartbeat_recompute_cycles_falhou' }), erro)
      })
    }

    /*
     * Faxina de `idempotency_keys` de carona. Ela não tem nada a ver com o Motor de Ciclo, e mora
     * aqui por um motivo só: esta é a ÚNICA rota do projeto que roda sozinha de verdade em
     * produção (`recompute-cycles` e `segments` são as duas do `on.schedule`, e esta dispara seis
     * vezes por dia). Limpeza pendurada numa rota que ninguém agenda é limpeza que não existe —
     * e criar uma sétima rota de cron só para isso obrigaria a mexer no `cron.yml`, no
     * `ROTAS_DE_CRON` e nas duas guardas de agendamento, para varrer uma tabela.
     *
     * Fora do `if (processados > 0)` de propósito: as chaves órfãs prendem reenvio da fila
     * offline em qualquer hora do dia, não só na madrugada dos tenants. E não derruba a rota se
     * falhar — recálculo que já aconteceu não pode ser desfeito por uma faxina.
     */
    const faxina = await limparChavesDeIdempotencia(svc, agora).catch((erro: unknown) => {
      console.error(JSON.stringify({ level: 'error', event: 'faxina_idempotencia_falhou' }), erro)
      return { orfas: 0, vencidas: 0 }
    })

    return { tenantsProcessados: processados, chavesOrfas: faxina.orfas, chavesVencidas: faxina.vencidas }
  })
})
