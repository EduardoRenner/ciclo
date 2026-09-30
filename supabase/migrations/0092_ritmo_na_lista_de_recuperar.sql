-- CICLO · "por que essa pessoa está na lista" chega em Recuperar receita
--
-- `core/ciclo/ritmo-do-cliente.ts` já existe desde o `docs/48` C4 ("o João vem a cada 18 dias,
-- está há 31") e já é honesto sobre procedência — só nunca ganhou os dados que precisa na tela de
-- MAIOR tráfego do produto (`/admin/recuperar`, o botão central da barra desde 31/08). Hoje ele só
-- aparece na ficha individual do cliente, uma pessoa de cada vez.
--
-- `v_recover_revenue` (0001, alterada em 0067) não expõe `personal_cycle_days` nem `last_visit_on`
-- — só dá para dizer O ESTADO e O ATRASO, nunca o RITMO por trás dele. E falta um dado que a view
-- não tem em lugar nenhum: quantos intervalos formaram aquele número. Sem isso a tela não consegue
-- distinguir "medido em 5 visitas" de "só o palpite do catálogo, cliente com 1 visita só" — a
-- MESMA distinção que `ritmo-do-cliente.ts` já protege na ficha, e que este arquivo existe para
-- levar também a Recuperar, sem repetir a fórmula (ela mora só em `computeCycle`, passo 3).
--
-- `sample_size`: quantos intervalos (gaps) entraram na mediana que decidiu `personal_cycle_days` —
-- 0 quando o valor é só o padrão do serviço. Escrito pelas três portas que gravam `client_cycles`
-- (`server/services/ciclo.ts`, duas vezes, e `ciclo-de-quem-ja-atende.ts`), a partir do campo novo
-- `amostra` de `ResultadoComputeCycle`. Sem escritor nas três, a coluna ficaria certa numa porta e
-- mentindo nas outras duas — a mesma classe de defeito que este projeto já se cobrou antes
-- ("coluna sem escritor vem em fila").
alter table client_cycles add column if not exists sample_size int not null default 0;
comment on column client_cycles.sample_size is
  'Quantos intervalos (gaps) formaram personal_cycle_days — 0 quando o valor é só o padrão do serviço, sem nada pessoal medido. Ver core/cycle/compute.ts, passo 3.';

-- Mesma armadilha de sempre (`0067`, comentário original): `create or replace view` só aceita
-- coluna NOVA no fim, e `security_invoker = true` não é herdado — tem que repetir, senão a view
-- volta a rodar com o dono e fura a RLS de `client_cycles`.
create or replace view v_recover_revenue with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name        as client_name,
  c.phone_e164,
  cc.service_id,
  s.name        as service_name,
  cc.state,
  cc.late_days,
  cc.predicted_on,
  cc.value_at_risk_cents,
  cc.last_campaign_at,
  cc.profit_at_risk_cents,
  cc.personal_cycle_days,
  cc.last_visit_on,
  cc.sample_size
from client_cycles cc
join clients  c on c.id = cc.client_id and c.deleted_at is null
join services s on s.id = cc.service_id
where cc.state in ('due','late','at_risk','lost')
order by cc.value_at_risk_cents desc;
