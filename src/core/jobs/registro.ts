/**
 * Quais tipos de job a fila sabe processar — e por que `/api/health` precisa saber disso.
 *
 * ## O que estava acontecendo, medido em 2026-08-30
 *
 * `/api/health` devolvia **503** com `1 job(s) parado(s) há mais de 15 min`. Não havia defeito
 * nenhum no worker. A fila de produção tinha 20+ jobs de tipo `teste_saude` e `seed`, todos com
 * o mesmo `last_error`:
 *
 *     Nenhum handler registrado para o tipo de job "teste_saude".
 *
 * São resíduo de fixture de teste (`.env.local` aponta para o Supabase de produção — achado A1 da
 * super auditoria), e nenhum deles **pode** ser processado: `HANDLERS` em
 * `src/app/api/cron/jobs/route.ts` está vazio, porque os handlers reais chegam nos tickets que os
 * pedem. Um job de tipo sem handler não é fila atrasada — é fila com lixo. Ele falha, volta para
 * `failed`, e é contado de novo como "parado" no disparo seguinte, para sempre.
 *
 * ## Por que isso é pior do que parece
 *
 * É **exatamente o mesmo defeito** que `src/core/cron/agendadas.ts` já consertou para os
 * heartbeats em 26/08, e a lição está escrita lá:
 *
 *   > com o alarme tocando todo dia por um motivo conhecido e inofensivo, o dia em que o Motor de
 *   > Ciclo morrer de verdade não muda a cor de nada.
 *
 * O conserto foi aplicado à vigilância de heartbeat e **não** à da fila, que fazia a mesma coisa
 * ao lado. É o padrão que a super auditoria nomeou como o achado mais reusável desta base:
 * *um conserto certo, aplicado num lugar só.*
 *
 * ## A regra
 *
 * Job de tipo **conhecido** parado é alarme de verdade: existe quem o processe e ele não está
 * sendo processado. Job de tipo **desconhecido** é lixo: aparece no relatório, com o nome do
 * tipo, mas não pinta o endpoint de vermelho — 503 quer dizer "o serviço está doente", e lixo na
 * fila não deixa o serviço doente.
 *
 * `tests/unit/server/saude-nao-alarma-por-lixo.test.ts` guarda as duas direções.
 */

/**
 * Os tipos que `src/app/api/cron/jobs/route.ts` sabe processar.
 *
 * **Hoje está vazio de propósito**, e isso é verdade e não esquecimento: o registro daquela rota
 * nasceu vazio no TICKET-012 com a nota *"handlers reais por tipo de job chegam nos tickets que
 * os pedem; por ora o registro fica vazio, e todo job sem handler morre marcado — nunca falha em
 * silêncio"*.
 *
 * **Por que a lista mora aqui, e não é lida da rota:** `health.ts` importar de
 * `app/api/.../route.ts` inverteria a direção das dependências (serviço puxando rota). Esta é uma
 * cópia, e cópia sem guarda apodrece — o teste confere contra o `HANDLERS` de verdade, nas duas
 * direções, do mesmo jeito que `saude-vigia-so-o-que-roda` faz com o `cron.yml`.
 */
export const TIPOS_DE_JOB_COM_HANDLER: readonly string[] = []

/**
 * Existe alguém capaz de processar este tipo?
 *
 * Tipo desconhecido devolve `false` — e quem chama decide o que fazer com isso. Note que aqui o
 * padrão seguro é o oposto do de `heartbeatVigiado`: lá, `kind` desconhecido é VIGIADO (alarmar
 * é o seguro, porque um heartbeat novo que ninguém cadastrou provavelmente devia estar rodando).
 * Aqui, tipo desconhecido é LIXO (não alarmar é o seguro, porque um job que ninguém sabe
 * processar não vai ser processado por mais que se alarme).
 *
 * A diferença é qual erro custa mais: deixar de vigiar um cron que morreu custa dias de silêncio;
 * alarmar por um job impossível custa o alarme inteiro, todo dia, para sempre.
 */
export function tipoDeJobTemHandler(kind: string): boolean {
  return TIPOS_DE_JOB_COM_HANDLER.includes(kind)
}
