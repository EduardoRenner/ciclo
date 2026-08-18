-- =====================================================================
-- CICLO · Packs de vertical
--
-- O "modelo único" só funciona porque a diferença entre as profissões é
-- CONFIGURAÇÃO, não código. Este arquivo é a fonte da verdade dessa
-- configuração. Ao criar um tenant, a aplicação lê o pack correspondente
-- e materializa serviços, produtos, ficha de consumo e formulário de
-- anamnese no tenant.
--
-- Implementação: a função apply_vertical_pack(tenant_id, vertical) roda
-- no fim do onboarding. Idempotente — rodar duas vezes não duplica.
-- =====================================================================

create table if not exists vertical_packs (
  vertical      vertical_pack primary key,
  label         text not null,
  accent_color  text not null,
  services      jsonb not null,   -- [{name,duration_min,price_cents,cycle_days,deposit_bps,requires_anamnesis,buffer_after_min}]
  products      jsonb not null,   -- [{name,unit,avg_cost_cents,reorder_point}]
  consumption   jsonb not null,   -- [{service,product,qty}]
  anamnesis     jsonb not null,   -- {key, version, questions:[{id,label,type,options?,alert_if?}]}
  consent_texts jsonb not null    -- {health_data, image_use, marketing}
);

-- catálogo global (sem tenant_id): leitura para todos, escrita só pelo servidor
alter table vertical_packs enable row level security;
alter table vertical_packs force row level security;
drop policy if exists vertical_packs_read on vertical_packs;
create policy vertical_packs_read on vertical_packs for select using (true);

-- ---------------------------------------------------------------------
-- CÍLIOS
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'lashes','Cílios','#a855f7',
'[
 {"name":"Aplicação volume russo","duration_min":150,"price_cents":22000,"cycle_days":21,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Manutenção volume russo","duration_min":90,"price_cents":12000,"cycle_days":21,"deposit_bps":3000,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Aplicação híbrida","duration_min":120,"price_cents":18000,"cycle_days":21,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Aplicação clássica","duration_min":90,"price_cents":15000,"cycle_days":21,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Lash lifting + botox","duration_min":60,"price_cents":15000,"cycle_days":45,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Remoção","duration_min":30,"price_cents":6000,"cycle_days":0,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5}
]'::jsonb,
'[
 {"name":"Cola para cílios","unit":"ml","avg_cost_cents":9000,"reorder_point":2},
 {"name":"Cola sensitive","unit":"ml","avg_cost_cents":12000,"reorder_point":1},
 {"name":"Fio 0.05 (bandeja)","unit":"un","avg_cost_cents":4500,"reorder_point":3},
 {"name":"Primer","unit":"ml","avg_cost_cents":3500,"reorder_point":1},
 {"name":"Pad de hidrogel","unit":"un","avg_cost_cents":250,"reorder_point":20},
 {"name":"Micro brush","unit":"un","avg_cost_cents":30,"reorder_point":100},
 {"name":"Fita micropore","unit":"un","avg_cost_cents":600,"reorder_point":3}
]'::jsonb,
'[
 {"service":"Aplicação volume russo","product":"Cola para cílios","qty":0.5},
 {"service":"Aplicação volume russo","product":"Fio 0.05 (bandeja)","qty":0.3},
 {"service":"Aplicação volume russo","product":"Pad de hidrogel","qty":1},
 {"service":"Aplicação volume russo","product":"Micro brush","qty":4},
 {"service":"Manutenção volume russo","product":"Cola para cílios","qty":0.25},
 {"service":"Manutenção volume russo","product":"Fio 0.05 (bandeja)","qty":0.15},
 {"service":"Manutenção volume russo","product":"Pad de hidrogel","qty":1}
]'::jsonb,
'{"key":"lashes_v1","version":"1.0","questions":[
 {"id":"pregnant","label":"Está gestante ou amamentando?","type":"bool"},
 {"id":"eye_surgery","label":"Fez cirurgia ocular nos últimos 6 meses?","type":"bool","alert_if":true},
 {"id":"glue_allergy","label":"Já teve reação a cola de cílios (cianoacrilato)?","type":"bool","alert_if":true},
 {"id":"other_allergy","label":"Alergia a látex, esparadrapo ou cosméticos?","type":"text"},
 {"id":"contact_lens","label":"Usa lente de contato?","type":"bool"},
 {"id":"blepharitis","label":"Tem blefarite, terçol frequente ou olho seco?","type":"select","options":["Não","Leve","Moderado","Severo"],"alert_if":"Severo"},
 {"id":"isotretinoin","label":"Usa ou usou isotretinoína (Roacutan) nos últimos 6 meses?","type":"bool","alert_if":true},
 {"id":"meds","label":"Usa algum medicamento contínuo? Qual?","type":"text"},
 {"id":"previous","label":"Já usou extensão de cílios antes?","type":"bool"},
 {"id":"expectation","label":"Qual efeito você quer? (natural, volumoso, delineado)","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações de saúde acima, que serão usadas exclusivamente para avaliar a segurança do procedimento e definir o protocolo adequado. Sei que posso solicitar acesso, correção ou eliminação desses dados a qualquer momento.",
  "image_use":"Autorizo o uso das fotos do meu procedimento em portfólio e redes sociais do estabelecimento, sem identificação nominal. Esta autorização é separada do atendimento e pode ser revogada a qualquer momento, sem prejuízo ao serviço.",
  "marketing":"Aceito receber mensagens sobre horários, promoções e lembretes de manutenção pelo WhatsApp. Posso cancelar respondendo SAIR."}'::jsonb
);

-- ---------------------------------------------------------------------
-- UNHAS
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'nails','Unhas','#ec4899',
'[
 {"name":"Esmaltação em gel","duration_min":90,"price_cents":9000,"cycle_days":18,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":5},
 {"name":"Alongamento em fibra","duration_min":150,"price_cents":18000,"cycle_days":25,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Manutenção de alongamento","duration_min":120,"price_cents":13000,"cycle_days":25,"deposit_bps":2000,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Banho de gel","duration_min":90,"price_cents":11000,"cycle_days":21,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Manicure simples","duration_min":45,"price_cents":4500,"cycle_days":15,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Pedicure","duration_min":60,"price_cents":5500,"cycle_days":21,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Remoção","duration_min":30,"price_cents":3000,"cycle_days":0,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5}
]'::jsonb,
'[
 {"name":"Gel construtor","unit":"g","avg_cost_cents":180,"reorder_point":30},
 {"name":"Esmalte em gel (cor)","unit":"ml","avg_cost_cents":250,"reorder_point":10},
 {"name":"Top coat","unit":"ml","avg_cost_cents":200,"reorder_point":10},
 {"name":"Primer/desidratador","unit":"ml","avg_cost_cents":150,"reorder_point":10},
 {"name":"Lixa","unit":"un","avg_cost_cents":180,"reorder_point":20},
 {"name":"Molde/tips","unit":"un","avg_cost_cents":25,"reorder_point":200},
 {"name":"Luva descartável","unit":"un","avg_cost_cents":40,"reorder_point":100}
]'::jsonb,
'[
 {"service":"Esmaltação em gel","product":"Esmalte em gel (cor)","qty":1.5},
 {"service":"Esmaltação em gel","product":"Top coat","qty":1},
 {"service":"Esmaltação em gel","product":"Primer/desidratador","qty":0.5},
 {"service":"Esmaltação em gel","product":"Lixa","qty":1},
 {"service":"Esmaltação em gel","product":"Luva descartável","qty":2},
 {"service":"Alongamento em fibra","product":"Gel construtor","qty":4},
 {"service":"Alongamento em fibra","product":"Molde/tips","qty":10},
 {"service":"Alongamento em fibra","product":"Lixa","qty":2}
]'::jsonb,
'{"key":"nails_v1","version":"1.0","questions":[
 {"id":"diabetes","label":"Tem diabetes?","type":"bool","alert_if":true},
 {"id":"circulation","label":"Tem problema de circulação nas mãos ou pés?","type":"bool","alert_if":true},
 {"id":"mycosis","label":"Tem ou já teve micose nas unhas?","type":"bool","alert_if":true},
 {"id":"onycholysis","label":"Já teve descolamento de unha (onicólise)?","type":"bool","alert_if":true},
 {"id":"allergy","label":"Alergia a acrilato, acetona ou látex?","type":"text"},
 {"id":"nail_biting","label":"Costuma roer as unhas?","type":"bool"},
 {"id":"pregnant","label":"Está gestante?","type":"bool"},
 {"id":"meds","label":"Usa medicamento contínuo? Qual?","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações de saúde acima para avaliação da segurança do procedimento.",
  "image_use":"Autorizo o uso das fotos do meu procedimento em portfólio e redes sociais, sem identificação nominal. Revogável a qualquer momento.",
  "marketing":"Aceito receber lembretes e novidades pelo WhatsApp. Posso cancelar respondendo SAIR."}'::jsonb
);

-- ---------------------------------------------------------------------
-- BARBEARIA
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'barber','Barbearia','#f59e0b',
'[
 {"name":"Corte","duration_min":40,"price_cents":4500,"cycle_days":21,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Corte + barba","duration_min":60,"price_cents":7000,"cycle_days":21,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Barba","duration_min":30,"price_cents":3500,"cycle_days":14,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Corte infantil","duration_min":30,"price_cents":4000,"cycle_days":25,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Platinado","duration_min":150,"price_cents":18000,"cycle_days":40,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Pigmentação","duration_min":45,"price_cents":6000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":5}
]'::jsonb,
'[
 {"name":"Pó descolorante","unit":"g","avg_cost_cents":12,"reorder_point":200},
 {"name":"Água oxigenada","unit":"ml","avg_cost_cents":4,"reorder_point":500},
 {"name":"Matizador","unit":"ml","avg_cost_cents":25,"reorder_point":100},
 {"name":"Navalha descartável","unit":"un","avg_cost_cents":90,"reorder_point":50},
 {"name":"Toalha descartável","unit":"un","avg_cost_cents":60,"reorder_point":100},
 {"name":"Pomada modeladora","unit":"un","avg_cost_cents":1800,"reorder_point":5}
]'::jsonb,
'[
 {"service":"Barba","product":"Navalha descartável","qty":1},
 {"service":"Barba","product":"Toalha descartável","qty":1},
 {"service":"Corte","product":"Toalha descartável","qty":1},
 {"service":"Platinado","product":"Pó descolorante","qty":60},
 {"service":"Platinado","product":"Água oxigenada","qty":120},
 {"service":"Platinado","product":"Matizador","qty":30}
]'::jsonb,
'{"key":"barber_v1","version":"1.0","questions":[
 {"id":"scalp","label":"Tem alguma sensibilidade ou ferida no couro cabeludo?","type":"bool","alert_if":true},
 {"id":"chem_allergy","label":"Já teve reação a tintura ou descolorante?","type":"bool","alert_if":true},
 {"id":"last_chem","label":"Fez química no cabelo nos últimos 30 dias?","type":"bool"},
 {"id":"skin","label":"Tem foliculite, psoríase ou dermatite?","type":"text"},
 {"id":"style","label":"Referência de corte / máquina preferida","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações acima para segurança do procedimento químico.",
  "image_use":"Autorizo o uso das fotos do meu corte nas redes sociais da barbearia.",
  "marketing":"Aceito receber lembretes de corte pelo WhatsApp."}'::jsonb
);

-- ---------------------------------------------------------------------
-- SOBRANCELHA / ESTÉTICA / DEPILAÇÃO (resumidos — mesma estrutura)
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'brows','Sobrancelhas','#8b5cf6',
'[
 {"name":"Design com henna","duration_min":50,"price_cents":7000,"cycle_days":25,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":5},
 {"name":"Design simples","duration_min":30,"price_cents":4500,"cycle_days":21,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Brow lamination","duration_min":60,"price_cents":14000,"cycle_days":45,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Micropigmentação","duration_min":180,"price_cents":60000,"cycle_days":365,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Retoque de micro","duration_min":90,"price_cents":20000,"cycle_days":30,"deposit_bps":3000,"requires_anamnesis":false,"buffer_after_min":10}
]'::jsonb,
'[{"name":"Henna","unit":"g","avg_cost_cents":400,"reorder_point":10},
  {"name":"Pigmento","unit":"ml","avg_cost_cents":8000,"reorder_point":2},
  {"name":"Agulha/cartucho","unit":"un","avg_cost_cents":1200,"reorder_point":10},
  {"name":"Anestésico tópico","unit":"ml","avg_cost_cents":900,"reorder_point":3},
  {"name":"Linha de threading","unit":"m","avg_cost_cents":5,"reorder_point":100}]'::jsonb,
'[{"service":"Design com henna","product":"Henna","qty":0.5},
  {"service":"Design com henna","product":"Linha de threading","qty":1},
  {"service":"Micropigmentação","product":"Pigmento","qty":1},
  {"service":"Micropigmentação","product":"Agulha/cartucho","qty":2},
  {"service":"Micropigmentação","product":"Anestésico tópico","qty":2}]'::jsonb,
'{"key":"brows_v1","version":"1.0","questions":[
 {"id":"henna_allergy","label":"Já teve reação a henna ou tintura?","type":"bool","alert_if":true},
 {"id":"keloid","label":"Tem tendência a queloide?","type":"bool","alert_if":true},
 {"id":"anticoag","label":"Usa anticoagulante?","type":"bool","alert_if":true},
 {"id":"diabetes","label":"Tem diabetes?","type":"bool","alert_if":true},
 {"id":"isotretinoin","label":"Usou isotretinoína nos últimos 6 meses?","type":"bool","alert_if":true},
 {"id":"pregnant","label":"Está gestante ou amamentando?","type":"bool","alert_if":true},
 {"id":"herpes","label":"Tem herpes recorrente?","type":"bool"},
 {"id":"skin_type","label":"Tipo de pele","type":"select","options":["Seca","Normal","Mista","Oleosa"]}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações de saúde para avaliação de contraindicações do procedimento.",
  "image_use":"Autorizo o uso das fotos antes/depois em portfólio e redes sociais.",
  "marketing":"Aceito receber lembretes de retoque e manutenção pelo WhatsApp."}'::jsonb
);

insert into vertical_packs values (
'aesthetics','Estética facial e corporal','#10b981',
'[
 {"name":"Limpeza de pele profunda","duration_min":90,"price_cents":15000,"cycle_days":30,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Peeling químico","duration_min":60,"price_cents":18000,"cycle_days":21,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Microagulhamento","duration_min":90,"price_cents":25000,"cycle_days":30,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Drenagem linfática","duration_min":60,"price_cents":12000,"cycle_days":7,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Massagem modeladora","duration_min":60,"price_cents":13000,"cycle_days":7,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":10}
]'::jsonb,
'[{"name":"Ácido (peeling)","unit":"ml","avg_cost_cents":1500,"reorder_point":3},
  {"name":"Máscara calmante","unit":"g","avg_cost_cents":80,"reorder_point":100},
  {"name":"Agulha de microagulhamento","unit":"un","avg_cost_cents":2500,"reorder_point":10},
  {"name":"Óleo de massagem","unit":"ml","avg_cost_cents":15,"reorder_point":300},
  {"name":"Lençol descartável","unit":"un","avg_cost_cents":150,"reorder_point":50}]'::jsonb,
'[{"service":"Peeling químico","product":"Ácido (peeling)","qty":3},
  {"service":"Peeling químico","product":"Máscara calmante","qty":20},
  {"service":"Microagulhamento","product":"Agulha de microagulhamento","qty":1},
  {"service":"Drenagem linfática","product":"Óleo de massagem","qty":30},
  {"service":"Drenagem linfática","product":"Lençol descartável","qty":1}]'::jsonb,
'{"key":"aesthetics_v1","version":"1.0","questions":[
 {"id":"pregnant","label":"Está gestante ou amamentando?","type":"bool","alert_if":true},
 {"id":"isotretinoin","label":"Usa ou usou isotretinoína nos últimos 6 meses?","type":"bool","alert_if":true},
 {"id":"anticoag","label":"Usa anticoagulante?","type":"bool","alert_if":true},
 {"id":"cancer","label":"Está em tratamento oncológico?","type":"bool","alert_if":true},
 {"id":"pacemaker","label":"Usa marca-passo ou prótese metálica?","type":"bool","alert_if":true},
 {"id":"herpes","label":"Tem herpes recorrente?","type":"bool","alert_if":true},
 {"id":"keloid","label":"Tem tendência a queloide?","type":"bool","alert_if":true},
 {"id":"sun","label":"Tomou sol nos últimos 15 dias?","type":"bool","alert_if":true},
 {"id":"meds","label":"Medicamentos em uso","type":"text"},
 {"id":"allergies","label":"Alergias conhecidas","type":"text"},
 {"id":"goal","label":"Principal queixa / objetivo","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações de saúde acima, necessárias para avaliar contraindicações e definir o protocolo do meu tratamento.",
  "image_use":"Autorizo o uso das fotos de acompanhamento em portfólio, sem identificação nominal. Revogável a qualquer momento.",
  "marketing":"Aceito receber lembretes de sessão e novidades pelo WhatsApp."}'::jsonb
);

insert into vertical_packs values (
'waxing','Depilação','#f97316',
'[
 {"name":"Perna inteira","duration_min":45,"price_cents":7000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Virilha completa","duration_min":30,"price_cents":6000,"cycle_days":28,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":10},
 {"name":"Axila","duration_min":15,"price_cents":2500,"cycle_days":25,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Buço","duration_min":10,"price_cents":1800,"cycle_days":21,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Combo perna + virilha + axila","duration_min":75,"price_cents":12000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":10}
]'::jsonb,
'[{"name":"Cera quente","unit":"g","avg_cost_cents":6,"reorder_point":1000},
  {"name":"Espátula","unit":"un","avg_cost_cents":20,"reorder_point":200},
  {"name":"Óleo pós-depilação","unit":"ml","avg_cost_cents":10,"reorder_point":200},
  {"name":"Lençol descartável","unit":"un","avg_cost_cents":150,"reorder_point":50}]'::jsonb,
'[{"service":"Perna inteira","product":"Cera quente","qty":120},
  {"service":"Perna inteira","product":"Espátula","qty":4},
  {"service":"Perna inteira","product":"Lençol descartável","qty":1},
  {"service":"Virilha completa","product":"Cera quente","qty":60},
  {"service":"Virilha completa","product":"Espátula","qty":3}]'::jsonb,
'{"key":"waxing_v1","version":"1.0","questions":[
 {"id":"isotretinoin","label":"Usa ou usou isotretinoína nos últimos 6 meses?","type":"bool","alert_if":true},
 {"id":"acids","label":"Usa ácidos na pele da região?","type":"bool","alert_if":true},
 {"id":"varicose","label":"Tem varizes acentuadas?","type":"bool","alert_if":true},
 {"id":"diabetes","label":"Tem diabetes?","type":"bool","alert_if":true},
 {"id":"folliculitis","label":"Costuma ter foliculite ou pelo encravado?","type":"bool"},
 {"id":"sensitivity","label":"Sensibilidade da pele","type":"select","options":["Baixa","Média","Alta"]}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações de saúde para avaliação de contraindicações.",
  "image_use":"Autorizo o uso de fotos em portfólio, sem identificação.",
  "marketing":"Aceito receber lembretes de manutenção pelo WhatsApp."}'::jsonb
);

-- ---------------------------------------------------------------------
-- Aplicação do pack no onboarding
-- ---------------------------------------------------------------------
create or replace function public.apply_vertical_pack(p_tenant uuid, p_vertical vertical_pack)
returns void language plpgsql security definer set search_path = public as $$
declare
  pk record; item jsonb;
  svc_ids jsonb := '{}'::jsonb; prod_ids jsonb := '{}'::jsonb;
  new_id uuid;
begin
  select * into pk from vertical_packs where vertical = p_vertical;
  if not found then raise exception 'pack % não encontrado', p_vertical; end if;

  -- serviços
  for item in select * from jsonb_array_elements(pk.services) loop
    insert into services (tenant_id, name, duration_min, price_cents, cycle_days,
                          deposit_bps, requires_anamnesis, buffer_after_min)
    values (p_tenant, item->>'name', (item->>'duration_min')::int, (item->>'price_cents')::bigint,
            greatest((item->>'cycle_days')::int, 1), (item->>'deposit_bps')::int,
            (item->>'requires_anamnesis')::boolean, coalesce((item->>'buffer_after_min')::int, 0))
    on conflict do nothing
    returning id into new_id;
    if new_id is not null then svc_ids := svc_ids || jsonb_build_object(item->>'name', new_id); end if;
  end loop;

  -- produtos
  for item in select * from jsonb_array_elements(pk.products) loop
    insert into products (tenant_id, name, unit, avg_cost_cents, reorder_point)
    values (p_tenant, item->>'name', item->>'unit', (item->>'avg_cost_cents')::bigint,
            (item->>'reorder_point')::numeric)
    on conflict do nothing
    returning id into new_id;
    if new_id is not null then prod_ids := prod_ids || jsonb_build_object(item->>'name', new_id); end if;
  end loop;

  -- ficha de consumo
  for item in select * from jsonb_array_elements(pk.consumption) loop
    if svc_ids ? (item->>'service') and prod_ids ? (item->>'product') then
      insert into service_products (tenant_id, service_id, product_id, qty)
      values (p_tenant, (svc_ids->>(item->>'service'))::uuid,
              (prod_ids->>(item->>'product'))::uuid, (item->>'qty')::numeric)
      on conflict do nothing;
    end if;
  end loop;

  -- expediente padrão: seg-sex 9h-19h, sáb 9h-14h
  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1,6) d
  on conflict do nothing;
end $$;
