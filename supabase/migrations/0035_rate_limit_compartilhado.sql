-- Auditoria de segurança de 2026-08-23, achado S4 (ALTO).
--
-- `limitador()` cai para um `Map` em memória do processo quando `UPSTASH_REDIS_REST_URL` não
-- existe — e, conferido em 2026-08-23 com `vercel env ls production`, **não existe**. Em deploy
-- serverless isso significa um balde por instância viva: o "5/min por IP" do agendamento público
-- vale por instância, não por IP, e um script que abre conexões em paralelo cai em instâncias
-- diferentes (ou em instâncias recém-acordadas, com o Map zerado). A hCaptcha também não está
-- provisionada, então `verificarCaptcha()` devolve `true`. Sobrava o honeypot, que se burla não
-- preenchendo um campo.
--
-- ## Por que Postgres e não Upstash
--
-- A especificação (G99) escolheu Upstash por ser "a única exceção ao sem Redis". Só que o
-- Upstash exige criar conta em terceiro — a mesma fila em que Asaas e WhatsApp estão parados há
-- semanas. O Postgres deste projeto já é um armazenamento compartilhado por todas as instâncias,
-- já está provisionado, já tem RLS e já é o caminho de toda requisição. Trocar uma dependência
-- bloqueada por uma que já existe fecha o achado hoje em vez de "quando o Eduardo criar a conta".
--
-- Se o Upstash for provisionado um dia, `limitador()` continua preferindo ele: a ordem é
-- Upstash → Postgres → memória. Nada aqui impede a otimização futura.
--
-- ## Janela fixa, incrementada em um comando só
--
-- O `insert ... on conflict do update` é atômico: quem chega junto disputa a mesma linha e o
-- Postgres serializa. Ler-e-depois-escrever teria exatamente a corrida do achado S11, num
-- mecanismo cujo trabalho é justamente contar direito.
create table if not exists rate_limits (
  key        text primary key,
  count      int not null,
  expires_at timestamptz not null
);

create index if not exists rate_limits_expira_idx on rate_limits (expires_at);

-- Sem política, de propósito: mesmo desenho de `job_queue` e `idempotency_keys`. RLS ligada com
-- zero políticas nega tudo para `anon` e `authenticated`; só a `service_role` alcança, e o
-- limitador roda antes de existir sessão, então é ela mesmo quem chama.
alter table rate_limits enable row level security;
alter table rate_limits force row level security;

create or replace function public.consumir_rate_limit(
  p_key             text,
  p_limite          int,
  p_janela_segundos int
)
returns table (permitido boolean, restante int)
language plpgsql
volatile
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_janela_segundos))
  on conflict (key) do update
     -- Janela vencida reinicia a contagem em vez de somar em cima do que já passou.
     set count      = case when r.expires_at <= now() then 1 else r.count + 1 end,
         expires_at = case when r.expires_at <= now()
                           then now() + make_interval(secs => p_janela_segundos)
                           else r.expires_at end
  returning r.count into v_count;

  -- Limpeza oportunista, só quando uma janela NOVA começa: sem cron no plano Hobby, ninguém
  -- varreria a tabela, e um scraper rodando IPs cria linha nova a cada requisição. Fica fora do
  -- caminho quente (a chamada que só incrementa não paga por isto) e é limitada a 50 linhas para
  -- nunca virar uma varredura cara escondida dentro de um contador.
  if v_count = 1 then
    delete from public.rate_limits
     where key in (
       select key from public.rate_limits
        where expires_at < now() - interval '1 hour'
        limit 50
     );
  end if;

  return query select v_count <= p_limite, greatest(0, p_limite - v_count);
end;
$$;

revoke execute on function public.consumir_rate_limit(text, int, int) from public, anon, authenticated;
grant  execute on function public.consumir_rate_limit(text, int, int) to service_role;

comment on table public.rate_limits is
  'Contador de janela fixa compartilhado entre instâncias serverless (auditoria S4). Só service_role alcança.';
