-- Fase 2 do docs/40: a cliente passa a poder PEDIR orcamento pela pagina do salao. Ate aqui
-- `quotes` so comportava o fluxo do profissional, e duas colunas provavam isso.
--
-- 1) `professional_id` era `not null`. Pedido recem-chegado nao tem profissional: ninguem pegou
--    ainda. Atribuir um arbitrariamente cria dono falso, e obrigar a cliente a escolher no
--    formulario e friccao sobre quem ainda nem sabe o que precisa.
alter table quotes alter column professional_id drop not null;

-- 2) `status` comecava em 'draft', que quer dizer "o profissional comecou a escrever". Empilhar
--    pedido da cliente ali apagaria a distincao que faz o painel saber o que exige resposta.
alter table quotes drop constraint if exists quotes_status_check;

alter table quotes
  add constraint quotes_status_check
  check (status in ('requested', 'draft', 'sent', 'approved', 'rejected', 'expired', 'converted'));

comment on column quotes.status is
  'requested = a cliente pediu pela página pública e ninguém pegou ainda; draft = o profissional começou a escrever; o resto é o ciclo de envio e resposta.';

-- Pedido novo e o que o painel precisa achar primeiro. O indice existente e por (tenant, created_at);
-- este cobre a consulta "o que esta esperando resposta" sem varrer o historico inteiro.
create index if not exists quotes_pedidos_abertos
  on quotes (tenant_id, created_at desc)
  where status = 'requested';
