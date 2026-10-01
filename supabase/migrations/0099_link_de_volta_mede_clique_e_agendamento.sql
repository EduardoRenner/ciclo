-- CICLO · link de volta: a chamada manual passa a medir clique e agendamento (docs/95 E1)
--
-- Até aqui a "volta" de uma chamada manual (botão Chamar, WhatsApp do dono) era atribuída por
-- TEMPO: o primeiro agendamento em 30 dias depois da mensagem (`core/attribution/compute.ts`). Isso
-- dá crédito a quem voltaria sozinho e não diz se a mensagem foi sequer aberta.
--
-- Com o link pessoal de agendamento dentro do texto, a mensagem ganha duas marcas:
--   · `clicked_at`: quando a pessoa abriu o link (a prova de que a mensagem chegou e foi lida);
--   · `booked_appointment_id`: o agendamento feito pelo link (atribuição por clique).
--
-- Aditiva e anulável: o código no ar não lê nem escreve as colunas. Sobe antes do deploy.
-- `on delete set null` segue o resto de `messages` (0001): agendamento nunca é apagado (regra 11),
-- mas a FK não pode impedir a eliminação de dados de cliente pela LGPD.

alter table messages add column if not exists clicked_at timestamptz;
alter table messages add column if not exists booked_appointment_id uuid references appointments(id) on delete set null;

create index if not exists messages_booked_appointment_id_idx
  on messages (booked_appointment_id) where booked_appointment_id is not null;

comment on column messages.clicked_at is
  'Primeira abertura do link de volta (docs/95 E1). Nulo = nunca aberto ou mensagem sem link.';
comment on column messages.booked_appointment_id is
  'Agendamento feito pelo link de volta desta mensagem (atribuição por clique, docs/95 E1).';
