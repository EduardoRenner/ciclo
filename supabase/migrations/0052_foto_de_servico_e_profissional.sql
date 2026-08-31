-- Foto de serviço e de profissional na página pública.
--
-- Escolher "Platinado" por um retângulo de texto é diferente de escolher vendo o resultado, e
-- marcar com "Diego Martins" é diferente de marcar com um rosto. Os dois são padrão em Fresha e
-- Booksy; aqui a página inteira tinha zero imagens até a 0051.
--
-- Guarda a CHAVE no bucket `vitrine` (`{tenantId}/{uuid}.webp`), nunca a URL: a origem do Supabase
-- muda de projeto para projeto e já vive em `NEXT_PUBLIC_SUPABASE_URL`. Quem monta o endereço é
-- `core/text/vitrine.ts`, num lugar só — mesma decisão da logo e da capa (0051).
--
-- Coluna, e não uma linha em `media`: aquela tabela é de foto DE CLIENTE, com `client_id not null`,
-- consentimento e trilha de acesso ao cofre. Serviço e profissional não são pessoa física com dado
-- protegido — é material de vitrine, público de propósito, e forçá-lo naquele modelo exigiria um
-- `client_id` falso e uma trilha de acesso que não significa nada.
alter table services add column image_key text;

-- `professionals.avatar_url` existe desde a 0001 e é LIDA (`profissionais.ts` a traz no select),
-- mas nunca teve escritor: 15 profissionais em produção, 0 preenchidos. É a mesma classe de
-- `fee_cents`, `media.consent_id`, `clients.referred_by` e `tenants.plan` — coluna que todo mundo
-- lê e ninguém escreve.
--
-- Renomear em vez de criar uma `photo_key` ao lado: duas colunas para a mesma coisa é a condição
-- exata para elas divergirem, e o nome novo passa a dizer a verdade sobre o conteúdo (é a chave no
-- bucket, não uma URL). Seguro porque não há dado a migrar — a coluna está 100% vazia — e o único
-- leitor é um `select`, atualizado no mesmo commit.
alter table professionals rename column avatar_url to photo_key;

comment on column services.image_key is
  'Chave no bucket público `vitrine` — foto do serviço na página pública. Endereço montado por core/text/vitrine.ts.';
comment on column professionals.photo_key is
  'Chave no bucket público `vitrine` — foto do profissional. Era `avatar_url`, lida e nunca escrita desde a 0001.';
