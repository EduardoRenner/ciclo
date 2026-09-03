-- Uma definição só de "quem o Motor diz para chamar de volta".
--
-- `client_cycles` guarda uma linha por (cliente, serviço) — é assim que a previsão funciona,
-- porque corte e progressiva voltam em ritmos diferentes. Três lugares do produto contavam essas
-- linhas como se fossem clientes, cada um do seu jeito:
--
--   · `listarParaRecuperar` — o cartão rotulado "Clientes" mostrou 149 num salão com 55;
--   · `centralDeAcoes`     — "147 clientes estão sumindo" na TELA INICIAL, em cartão de alerta;
--   · `painelDaCarteira`   — o mesmo número no topo da lista de clientes.
--
-- Medido nas seis contas de demonstração em 02/09: 72% a 92% dessas linhas eram de gente que
-- nunca deixou de vir — só experimentou um serviço uma vez, meses atrás. E o alarme da tela
-- inicial levava para uma lista que mostrava outro número, contradizendo a si mesmo num toque.
--
-- Quem vem todo mês cortar o cabelo não está "sumindo" porque não faz progressiva desde março.
-- Isso é venda no salão, que é outra coisa — e misturar as duas foi o que produziu o ruído.
create or replace view public.v_clientes_a_recuperar
with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  -- O serviço de maior valor em risco é o que a tela mostra na linha da cliente.
  max(cc.value_at_risk_cents) as maior_valor_cents,
  max(cc.late_days) as maior_atraso_dias,
  -- `due` é "vence hoje", ainda não é sumiço. O alarme da tela inicial fala de quem JÁ atrasou;
  -- a lista mostra os dois. Uma coluna, dois recortes, nenhuma duplicação de regra.
  bool_or(cc.state in ('late', 'at_risk', 'lost')) as ja_atrasado
from public.client_cycles cc
where cc.state in ('due', 'late', 'at_risk', 'lost')
  and not exists (
    select 1 from public.client_cycles saudavel
    where saudavel.tenant_id = cc.tenant_id
      and saudavel.client_id = cc.client_id
      and saudavel.state = 'on_track'
  )
group by cc.tenant_id, cc.client_id;

comment on view public.v_clientes_a_recuperar is
  'Uma linha por CLIENTE a recuperar (não por cliente×serviço). Exclui quem tem qualquer ciclo em dia: quem vem todo mês não está sumindo por não fazer um serviço secundário.';
