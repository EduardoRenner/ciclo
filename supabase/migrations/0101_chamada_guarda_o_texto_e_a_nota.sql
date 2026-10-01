-- CICLO · a chamada de volta guarda qual texto foi usado e como a cliente estava (docs/95 E4/E5)
--
-- Para saber qual texto traz mais gente de volta, cada chamada manual ("Chamar", fila de chamadas)
-- precisa dizer QUAL versão da biblioteca foi mandada (`core/mensageria/biblioteca-de-volta.ts`) e
-- COMO a pessoa estava naquele momento: a nota e o perfil mudam todo dia (`client_scores`, 0100),
-- então ler a nota de hoje para uma chamada de três semanas atrás mediria a coisa errada.
--
-- Hora e dia da semana não precisam de coluna: saem de `sent_at` no fuso do salão.
--
-- Aditiva e anulável: o código no ar não lê nem escreve. Sobe antes do deploy.

alter table messages add column if not exists variant_key text;
alter table messages add column if not exists score_at_send smallint check (score_at_send between 0 and 100);
alter table messages add column if not exists profile_at_send text;

comment on column messages.variant_key is
  'Versão do texto da chamada de volta (core/mensageria/biblioteca-de-volta.ts). Nulo = mensagem antiga ou de outro tipo.';
comment on column messages.score_at_send is
  'Nota do cliente (client_scores) no momento da chamada, para medir por faixa de nota (docs/95 E5).';
comment on column messages.profile_at_send is
  'Perfil do cliente no momento da chamada, para medir por perfil (docs/95 E5).';
