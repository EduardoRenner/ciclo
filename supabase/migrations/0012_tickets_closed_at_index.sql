-- TICKET-047: fechamento diário/mensal filtra tickets por closed_at dentro
-- de uma janela — sem este índice, a consulta varre a tabela inteira.
create index if not exists tickets_tenant_closed_at
  on tickets (tenant_id, closed_at)
  where status in ('closed', 'paid');
