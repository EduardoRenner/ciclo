-- Auditoria de segurança de 2026-08-23, achado S17 (BAIXO).
--
-- `can_see_appointment` é `security definer` e executável por `anon` e `authenticated` via
-- `/rest/v1/rpc/` — o que está certo e precisa continuar assim: a RLS avalia a função com o
-- privilégio de quem consulta, e revogar o EXECUTE transformaria um `select` negado num erro de
-- permissão (foi por isso que a 0004 manteve as quatro auxiliares executáveis).
--
-- O problema não era o EXECUTE, era o corpo. O segundo ramo lia
-- `tenants.settings->>'restrict_professional_view'` para o `t` que veio por parâmetro — e, sendo
-- `security definer`, essa leitura passa **por cima da RLS**. A política real de `tenants` é
-- `tenants_select: has_tenant(id)`, que negaria isso a quem não é membro. Resultado: qualquer
-- pessoa, inclusive sem login, podia chamar a função com o uuid de um tenant alheio e distinguir
-- `true` (trava desligada) de `null` (trava ligada). Um oráculo de um bit sobre a configuração de
-- outro salão.
--
-- O bit em si não vale quase nada hoje — nenhum tenant tem a trava ligada, e ela sequer tem tela
-- (achado S3). O que vale é a classe: função `security definer` que lê tabela de outro tenant é
-- exatamente a forma como um vazamento sério nasce, e esta vai ganhar mais lógica no dia em que
-- o S3 for implementado.
--
-- A correção é um ramo, e não muda nada para quem consulta de verdade: as SEIS políticas que
-- usam esta função (appointments, appointment_series, quotes — select e update de cada) já são
-- `has_tenant(tenant_id) and can_see_appointment(...)`, então o `and` sempre eliminou o
-- não-membro antes. O que fecha é só o caminho pelo RPC direto.
create or replace function public.can_see_appointment(t uuid, prof uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Primeiro de todos: quem não é do tenant não recebe resposta sobre o tenant (S17).
    when not public.has_tenant(t) then false
    when public.tenant_role(t) in ('owner','manager','reception','finance') then true
    when coalesce((select (settings->>'restrict_professional_view')::boolean
                   from public.tenants where id = t), false) = false then true
    else prof = public.my_professional_id(t)
  end;
$$;
