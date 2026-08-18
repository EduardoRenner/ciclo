-- TICKET-052: bucket privado para fotos antes/depois e assinaturas de
-- consentimento (§8/§9). Sem política em storage.objects de propósito — RLS
-- já vem ligada por padrão (verificado antes de aplicar) e o acesso é
-- sempre via service_role no servidor + signed URL de 5 min pro cliente,
-- nunca leitura direta do bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
