-- docs/112 EXP-S03 · a busca do cadastro acha o que a dona de salão digita.
--
-- A tela pede "Ex.: manicure, lash, sobrancelha…" e "lash" não achava nada: Cílios e Depilação
-- nasceram com `sinonimos = '{}'` (0022). Quem não se achava seguia como "Outra profissão", que não
-- tem serviço pronto, e a conta nascia vazia. Termos de `docs/112-experiencia/04-salao.md` §7.2.
--
-- Só dados e aditiva: acrescenta sem tirar nada e sem repetir o que já existe. Pode subir antes do
-- código (a busca antiga também lê `sinonimos`). O teste `catalogo-profissoes` roda a busca da tela
-- contra estas linhas e confere que cada termo acha uma profissão só.

update professions
   set sinonimos = array(select distinct s from unnest(sinonimos || novos.termos) as s order by s)
  from (values
    ('lashes',     array['lash', 'lash designer', 'extensão de cílios', 'alongamento de cílios', 'lash lifting', 'cilios']),
    ('nails',      array['nail', 'nail designer', 'esmalteria', 'unha em gel', 'alongamento de unhas', 'pedicure']),
    ('brows',      array['designer de sobrancelha', 'brow', 'henna', 'micropigmentação', 'sobrancelha']),
    ('hair',       array['salão de beleza', 'colorista', 'escova', 'cabelereira', 'trancista']),
    ('waxing',     array['depiladora', 'cera', 'depilação a laser']),
    ('aesthetics', array['limpeza de pele', 'drenagem', 'massagem', 'estética facial'])
  ) as novos(slug, termos)
 where professions.slug = novos.slug;
