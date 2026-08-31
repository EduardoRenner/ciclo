-- Bucket PÚBLICO para o material de vitrine do salão: logo e capa da página pública.
--
-- Por que não reusar o bucket `media` (0013): aquele é privado de propósito — guarda foto de
-- cliente e assinatura de consentimento, e o acesso é sempre signed URL de 5 minutos gerada no
-- servidor. Isso está certo para dado de pessoa e **errado** para logo: a página do salão é
-- cacheada e lida por robô de rede social (a prévia do WhatsApp busca a imagem sem sessão
-- nenhuma), então uma URL que expira em 5 minutos apareceria quebrada exatamente onde o link é
-- colado. Além disso, assinar URL a cada visita é custo por visita numa página que existe para
-- ser visitada.
--
-- Público aqui é a propriedade desejada, não um relaxamento: logo e capa são material que o salão
-- publica de propósito. O que protege continua valendo — `storage_key` é `{tenantId}/{uuid}.webp`
-- (nunca previsível, mesmo padrão da 0013), só imagem entra, e a ESCRITA continua sendo
-- exclusivamente via `service_role` no servidor, com RLS ligada por padrão em `storage.objects` e
-- nenhuma política de insert para `anon`/`authenticated`.
--
-- 2 MB, não 10: logo e capa são servidas em toda visita da página pública, e o `sharp` já
-- reencoda para WebP antes de subir. O limite é rede de segurança contra upload absurdo, não o
-- tamanho esperado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vitrine', 'vitrine', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
