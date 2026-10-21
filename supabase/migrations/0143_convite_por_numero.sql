-- docs/112 EXP-K01 · convite da equipe pelo WhatsApp.
--
-- O convite só existia por e-mail (`email citext not null`, 0007), e o aceite conferia o e-mail de
-- quem entrou. Quem entra pelo número (docs/110 L1) tem e-mail vazio: a tela do convite dizia
-- "Você entrou como ." e a pessoa não tinha como entrar na equipe.
--
-- Aditiva: relaxa o `not null` e cria a coluna nova. Sobe ANTES do código (o código antigo continua
-- gravando e-mail, e passa na regra nova). O telefone é guardado em E.164 ("+5511912345678"), o
-- mesmo formato de `profiles.phone`.

alter table invites alter column email drop not null;
alter table invites add column phone text;

alter table invites add constraint invites_email_ou_telefone check (email is not null or phone is not null);
