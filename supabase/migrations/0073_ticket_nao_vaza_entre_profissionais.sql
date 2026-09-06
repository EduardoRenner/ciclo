-- CICLO · a RLS de `tickets`/`ticket_items` deixa de publicar o financeiro de um
--         profissional para outro
--
-- ## O buraco, medido e já registrado
--
-- O `docs/DECISOES.md` (2026-09-06, "O que isto deixa em aberto") nomeia isto com todas as
-- letras: desde a `0001`, `tickets` e `ticket_items` têm uma única política, `*_tenant_all`,
-- que libera `for all using (has_tenant(tenant_id))`. Qualquer papel do tenant — `professional`
-- e `reception` inclusive — que chame a REST API do Supabase DIRETAMENTE, com o próprio JWT,
-- fora do Next.js, lê `commission_cents`, `cost_cents` e `total_cents` de QUALQUER colega.
-- É o dado mais delicado do produto dentro de uma equipe (o `docs/48` §4.6 nomeia o risco como
-- social), e ele saía pela porta lateral.
--
-- Não vazava pelo painel: toda rota do app passa por `withTenant` (service_role, `with-tenant.ts`),
-- que ignora a RLS de propósito e filtra `tenant_id` na mão. A política de banco só governa o
-- acesso direto com JWT de usuário — e é exatamente esse acesso que estava aberto.
--
-- ## Por que agora dá para apertar sem quebrar o fluxo de fechar a comanda
--
-- O motivo pelo qual a sessão de 2026-09-06 NÃO apertou: `tickets/[id]/close`, `/cancel`,
-- `/items` e `wallet/*` deixam qualquer pessoa da equipe operar a comanda de um colega, e uma
-- trava de SELECT por profissional pareceu que ia derrubar isso. Medido de novo: não derruba.
-- Essas rotas rodam com `service_role` via `withTenant`, então a RLS não as toca. Nenhuma
-- leitura de `tickets`/`ticket_items` no cliente passa pela chave anônima hoje
-- (`grep -rn "from('tickets')" src` fora de `server/` devolve só imports de tipo).
--
-- Então esta migration fecha o vazamento de LEITURA e deixa INSERT/UPDATE/DELETE como estavam
-- (`has_tenant`), que é o desenho já em produção para a equipe fechar a comanda de qualquer um.
--
-- ## A régua é a mesma de `appointments`, de propósito
--
-- `can_see_ticket` delega para a decisão que `can_see_appointment` (`0001`) já toma: dono,
-- gerente, recepção e financeiro veem tudo; o profissional vê tudo também, A MENOS que o dono
-- tenha ligado `tenants.settings.restrict_professional_view` — e aí ele só vê o que é dele.
-- Um interruptor só, um modelo mental só. O financeiro da comanda é no mínimo tão sensível
-- quanto a agenda, então cai sob o mesmo controle; dar a ele um interruptor próprio seria pedir
-- para o dono lembrar de dois.
--
-- Efeito da régua sobre linha sem dono (`professional_id is null` — walk-in lançado na
-- recepção): com a trava ligada, `null = my_professional_id(t)` é NULL, tratado como falso, e o
-- profissional não alcança essa linha pela API direta. Aceito: é o lado seguro, e o app (que
-- não passa pela RLS) continua mostrando tudo na tela de quem tem a permissão.

-- Delega para a decisão de `can_see_appointment`, mas com nome próprio para poder divergir
-- depois sem mexer em agenda. `security definer` + `search_path` fixo pelo mesmo motivo das
-- outras: a política roda com o privilégio de quem consulta, e sem isso a função não enxergaria
-- `memberships`/`professionals`.
create or replace function public.can_see_ticket(t uuid, prof uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_see_appointment(t, prof);
$$;

comment on function public.can_see_ticket(uuid, uuid) is
  'Quem pode LER esta comanda: mesma regra de can_see_appointment (dono/gerente/recepcao/financeiro veem tudo; profissional so o proprio quando tenants.settings.restrict_professional_view esta ligado). So governa acesso direto via REST com JWT de usuario -- as rotas do app usam service_role e nao passam por aqui.';

-- `revoke`/`grant` no mesmo espírito da `0004`: as funções de apoio não ficam executáveis por
-- papel anônimo solto, só pelo caminho autenticado que a RLS usa.
revoke all on function public.can_see_ticket(uuid, uuid) from public, anon;
grant execute on function public.can_see_ticket(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- tickets: troca a política única `for all` por uma por operação
-- ---------------------------------------------------------------------------
drop policy if exists tickets_tenant_all on tickets;

create policy tickets_select on tickets for select
  using (public.has_tenant(tenant_id) and public.can_see_ticket(tenant_id, professional_id));

create policy tickets_insert on tickets for insert
  with check (public.has_tenant(tenant_id));

-- UPDATE fica em `has_tenant` (não em `can_see_ticket`): fechar/cancelar a comanda de um colega
-- é o fluxo de equipe já existente. O `using` também é `has_tenant` para não criar o buraco
-- oposto — um profissional bloqueado de LER a linha ainda não deve conseguir alterá-la às
-- cegas, mas travar por `can_see_ticket` aqui quebraria o fechamento no caso raro em que
-- alguém opera direto na API. Mantido igual ao pré-0073.
create policy tickets_update on tickets for update
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));

create policy tickets_delete on tickets for delete
  using (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- ticket_items: mesma troca. O escopo de leitura usa o `professional_id` DO ITEM
-- (quem executou aquela linha), não o da comanda — um item pode ser de outro
-- profissional que não o dono do ticket.
-- ---------------------------------------------------------------------------
drop policy if exists ticket_items_tenant_all on ticket_items;

create policy ticket_items_select on ticket_items for select
  using (public.has_tenant(tenant_id) and public.can_see_ticket(tenant_id, professional_id));

create policy ticket_items_insert on ticket_items for insert
  with check (public.has_tenant(tenant_id));

create policy ticket_items_update on ticket_items for update
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));

create policy ticket_items_delete on ticket_items for delete
  using (public.has_tenant(tenant_id));
