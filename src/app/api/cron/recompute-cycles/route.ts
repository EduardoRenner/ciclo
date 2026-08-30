import { dataLocalDe } from '@/core/cron/janela'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { limparChavesDeIdempotencia } from '@/server/http/idempotency'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'
import { registrarHeartbeat } from '@/server/services/health'

/**
 * §5.3 pedia "03:00 no fuso de cada tenant". **Esse filtro de hora saiu em 2026-08-30, e a razão
 * é medida** — é a terceira vez que a MESMA falha derruba o Motor de Ciclo, cada vez sobrevivendo
 * ao próprio conserto porque o conserto atacava o sintoma:
 *
 *   - 25/08: igualdade exata (`hora == 3`), atraso de 56 min do GitHub → zero tenants (`docs/23` §2);
 *   - 26/08: conserto vira JANELA de 3h, calibrada contra aquele atraso de 56 min;
 *   - 30/08: medido de novo, com `gh run list`. O atraso do `schedule` do GitHub nesta base é de
 *     **5 a 6,5 horas**, não 56 minutos. Os seis disparos nominais (05:10–10:10 UTC) aconteceram
 *     às 11:38, 12:39, 13:09, 13:48, 14:24 e 15:02 UTC. Todos os tenants são UTC-3, então isso é
 *     hora local 8,6 a 12,0 — e a janela elegível era 3h–5h. **Nenhum disparo pegou nenhum tenant
 *     por dois dias e meio**, com HTTP 200 e job verde nas seis execuções de cada dia.
 *
 * Alargar a janela de novo seria repetir o erro: 7h de tolerância cobriria um terço do dia e
 * ainda seria refém do humor do agendador. O filtro sai inteiro, porque o próprio comentário
 * original já dizia a verdade que torna isso seguro: **a checagem de hora é economia de
 * processamento, não corretude.** Reprocessar o mesmo tenant no mesmo dia é inofensivo (upsert
 * por PK, TICKET-036).
 *
 * O que isso custa: 12 tenants × 6 disparos = 72 recálculos/dia, cada um poucas consultas. Nada.
 * **Quando revisitar:** se a base passar de ~500 tenants, o custo volta a importar — e aí a saída
 * NÃO é ressuscitar o filtro de hora (o agendador continua sendo best-effort), é registrar por
 * tenant a última data local processada e pular quem já rodou hoje. Fica escrito aqui para
 * ninguém "reotimizar" de volta para o defeito.
 *
 * Rotas que MANDAM MENSAGEM (`campaigns`, `reminders`) continuam com o filtro de hora, e ali ele
 * não é economia: é não acordar cliente às 3 da manhã.
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
