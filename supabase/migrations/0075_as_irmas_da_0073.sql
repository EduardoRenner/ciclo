-- CICLO · as irmãs que a 0073 deixou abertas: escrita de cadastro e leitura de dinheiro
--
-- ## O buraco, e por que ele é maior do que a 0073 fechou
--
-- A `0073` corrigiu `tickets`/`ticket_items`. Mas o laço da `0001:688-709` aplica a MESMA política
-- a 25 tabelas: `for all using (has_tenant(tenant_id))`, e `has_tenant` (`0001:627`) só pergunta
-- "é membro ativo?" — não olha papel. Com a `0038` dando `select, insert, update, delete` a
-- `authenticated` e a anon key sendo `NEXT_PUBLIC_*`, qualquer membro fala direto com o PostgREST,
-- com o próprio JWT, e o RBAC de `rbac.ts` fica inteiramente fora do caminho.
--
-- Duas famílias de estrago, medidas na auditoria de 2026-09-08:
--
--   1. ESCRITA DE CADASTRO. Um `professional` faz
--      `PATCH /rest/v1/professionals?id=eq.<o próprio>` e grava `commission_bps: 10000` ou
--      `rent_cents: 0` — as duas colunas que o fechamento da comanda usa para calcular quanto ele
--      recebe (`0001:101-102`). Também dá para reescrever `user_id` e se vincular ao registro de
--      outro profissional. O mesmo vale para `services.price_cents` e `products`.
--
--   2. LEITURA DE DINHEIRO. `commissions` (866 linhas em produção) tem `professional_id` +
--      `amount_cents` congelado por período: é literalmente o que a `0073` chama de "o dado mais
--      delicado do produto dentro de uma equipe", numa tabela que ela não tocou. `payments`
--      (2.066 linhas) expõe valor, forma e cliente de cada pagamento.
--
-- ## Por que apertar não quebra nada, verificado chamador por chamador
--
-- `commissions` e `payments`: **nenhum leitor em todo o repositório**. `grep -rn "from('commissions')"`
-- devolve zero em `src/`. A tela `/admin/comissao` não lê essa tabela — `extratoDeComissao`
-- (`services/comissao.ts:76`) lê `ticket_items`, que a `0073` já protegeu. Ou seja: a trava de
-- extrato por profissional JÁ está em vigor pelo outro caminho, e o que sobra aqui é fechar a
-- porta lateral de uma tabela que o produto não consulta.
--
-- `professionals`/`services`/`products`: as rotas usam `criarClienteDoUsuario()`, NÃO
-- `service_role` — diferente de `tickets`, a escrita destas PASSA pela RLS. Por isso a política
-- abaixo não foi inventada: ela espelha o que `rbac.ts` já concede, papel por papel. Apertar além
-- disso quebraria edição legítima; apertar aquém deixaria o buraco.
--
-- ## A régua é o RBAC, e não `can_see_ticket`
--
-- Reusar `can_see_ticket` aqui seria MAIS permissivo que o produto: ele delega para
-- `can_see_appointment`, que libera `reception` — e a recepção não tem `commission:*` nem
-- `payment:*` em `rbac.ts`. O mapa real (`rbac.ts:12-29`) é:
--
--   · `professionals` escrita  → só `owner` (o `manager` tem apenas `professional:read`)
--   · `services`/`products`    → `owner` e `manager` (`service:*`, `inventory:*`)
--   · `commissions` leitura    → `owner` e `finance` (`commission:*`), mais o profissional no
--                                PRÓPRIO registro (`commission:own`, docs/53 C-01)
--   · `payments` leitura       → `owner` e `finance` (`payment:*`)
--
-- ## O que NÃO muda
--
-- Leitura de `professionals`, `services` e `products` continua em `has_tenant`: as telas do admin
-- (`caixa/page.tsx`, `meu-plano/page.tsx`, `estoque/page.tsx`) são Server Components que leem com
-- o cliente do usuário e passariam pela RLS — apertar a leitura apagaria o seletor de profissional
-- do caixa sem motivo. O risco dessas três é escrita, não leitura.
--
-- Escrita de `commissions`/`payments` também fica como estava: quem escreve é o fechamento da
-- comanda, por `service_role`, que não passa por aqui.

-- ---------------------------------------------------------------------------
-- 1. professionals: leitura igual, escrita só do dono
-- ---------------------------------------------------------------------------
drop policy if exists professionals_tenant_all on professionals;

create policy professionals_select on professionals for select
  using (public.has_tenant(tenant_id));

create policy professionals_insert on professionals for insert
  with check (public.tenant_role(tenant_id) = 'owner');

create policy professionals_update on professionals for update
  using (public.tenant_role(tenant_id) = 'owner')
  with check (public.tenant_role(tenant_id) = 'owner');

create policy professionals_delete on professionals for delete
  using (public.tenant_role(tenant_id) = 'owner');

-- ---------------------------------------------------------------------------
-- 2. services e products: escrita de quem administra o catálogo
-- ---------------------------------------------------------------------------
drop policy if exists services_tenant_all on services;

create policy services_select on services for select
  using (public.has_tenant(tenant_id));

create policy services_insert on services for insert
  with check (public.tenant_role(tenant_id) in ('owner','manager'));

create policy services_update on services for update
  using (public.tenant_role(tenant_id) in ('owner','manager'))
  with check (public.tenant_role(tenant_id) in ('owner','manager'));

create policy services_delete on services for delete
  using (public.tenant_role(tenant_id) in ('owner','manager'));

drop policy if exists products_tenant_all on products;

create policy products_select on products for select
  using (public.has_tenant(tenant_id));

create policy products_insert on products for insert
  with check (public.tenant_role(tenant_id) in ('owner','manager'));

create policy products_update on products for update
  using (public.tenant_role(tenant_id) in ('owner','manager'))
  with check (public.tenant_role(tenant_id) in ('owner','manager'));

create policy products_delete on products for delete
  using (public.tenant_role(tenant_id) in ('owner','manager'));

-- ---------------------------------------------------------------------------
-- 3. commissions: o extrato de um profissional para de ser público na equipe
-- ---------------------------------------------------------------------------
-- `commission:own` do `rbac.ts` traduzido para o banco. `my_professional_id` devolve NULL para
-- quem não é profissional vinculado, e `NULL = x` é NULL (tratado como falso) — então recepção e
-- gerente não alcançam nada por aqui, que é exatamente o que o RBAC diz.
create or replace function public.can_see_commission(t uuid, prof uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.tenant_role(t) in ('owner','finance') then true
    else prof = public.my_professional_id(t)
  end;
$$;

comment on function public.can_see_commission(uuid, uuid) is
  'Quem pode LER esta linha de comissao/pagamento: owner e finance veem tudo (commission:* e payment:* do rbac.ts); o profissional ve so o proprio registro (commission:own, docs/53 C-01); manager e reception nao alcancam. So governa acesso direto via REST com JWT de usuario -- o fechamento da comanda escreve por service_role e nao passa por aqui.';

revoke all on function public.can_see_commission(uuid, uuid) from public, anon;
grant execute on function public.can_see_commission(uuid, uuid) to authenticated, service_role;

drop policy if exists commissions_tenant_all on commissions;

create policy commissions_select on commissions for select
  using (public.has_tenant(tenant_id) and public.can_see_commission(tenant_id, professional_id));

create policy commissions_insert on commissions for insert
  with check (public.has_tenant(tenant_id));

create policy commissions_update on commissions for update
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));

create policy commissions_delete on commissions for delete
  using (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- 4. payments: valor, forma e cliente de cada pagamento
-- ---------------------------------------------------------------------------
-- `payments` não tem `professional_id`: o dinheiro é do estabelecimento, não de uma pessoa. Então
-- a régua é só o papel — `payment:*` é de `owner` e `finance` no `rbac.ts`. Passar NULL como
-- segundo argumento cai no `else` da função, onde `NULL = my_professional_id(t)` é NULL/falso:
-- ninguém fora dos dois papéis alcança, que é a leitura correta do RBAC.
drop policy if exists payments_tenant_all on payments;

create policy payments_select on payments for select
  using (public.has_tenant(tenant_id) and public.can_see_commission(tenant_id, null));

create policy payments_insert on payments for insert
  with check (public.has_tenant(tenant_id));

create policy payments_update on payments for update
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));

create policy payments_delete on payments for delete
  using (public.has_tenant(tenant_id));
