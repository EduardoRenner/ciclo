-- =====================================================================
-- CICLO · keep-alive de graça contra cold start (migration 0090)
--
-- Discutido com o Eduardo em 12/09: o "clique demora" que sobrou depois da 0089 (que já cortou
-- 4 idas de rede em 1 na Central de Ações) é sobretudo cold start — o primeiro pedido depois de
-- um período sem tráfego paga ~1s de boot de contêiner (`docs/28` §7-9). O produto ainda não tem
-- cliente pagante, então o tráfego de verdade não é suficiente para manter uma instância quente
-- sozinho.
--
-- A opção certa NÃO é ligar concorrência reservada/instância sempre-quente (recurso Enterprise da
-- Vercel, custo mensal) nem mudar de plano — é bater periodicamente num endpoint barato para o
-- contêiner nunca esfriar. Mesmo padrão do Motor de Ciclo (0087): pg_cron + net.http_get, dentro
-- do próprio Postgres do projeto, sem depender de conta de terceiro nova.
--
-- ## Por que `/api/health`, e não uma rota nova
--
-- Já existe, já é pública (sem credencial — `src/app/api/health/route.ts` diz isso de propósito:
-- "é o endpoint que o monitor externo bate de fora"), já tem limite próprio de taxa (30/min por
-- IP, em memória). Criar `/api/ping` só para isto seria o arquivo que o ticket não pediu.
--
-- ## Por que não precisa de segredo, diferente da 0087
--
-- `recompute-cycles`/`segments` MUDAM dado (upsert de previsão) e por isso exigem
-- `Authorization: Bearer CRON_SECRET` — sem isso qualquer um na internet poderia forçar o
-- recálculo. `/api/health` só LÊ e não vaza nada sensível (contagens agregadas e booleanos, o
-- próprio comentário da rota já diz). Não há o que proteger aqui além do limite de taxa que a
-- rota já impõe sozinha.
--
-- ## Por que 5 em 5 minutos
--
-- Suficiente para não deixar o contêiner esfriar (a folga observada antes de esfriar é de minutos,
-- não de segundos) e barato: 288 chamadas por dia a uma rota que já é leve. Ativo-CPU (o modelo de
-- cobrança padrão da Vercel desde 2026, em todo plano) só cobra o tempo de CPU realmente ocupado —
-- 288 pings por dia num endpoint leve não chega perto do teto gratuito do Hobby.
--
-- ## O que fica pendente, e por quê
--
-- `cron_base_url` já existe no Vault (criado para a 0087). Se este projeto nunca rodou a 0087
-- (banco novo), o mesmo passo manual vale aqui: `select vault.create_secret('https://seuciclo.com.br', 'cron_base_url');`
-- Sem ele, o job roda e a URL fica nula — inofensivo, mas inútil, mesmo desenho de sempre.
-- =====================================================================

select cron.schedule(
  'ciclo_keep_alive',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_base_url' limit 1) || '/api/health',
    timeout_milliseconds := 30000
  );
  $$
);
