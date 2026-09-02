-- =====================================================================
-- CICLO · Os três packs que faltavam: cabelo, tatuagem e geral
--
-- O enum `vertical_pack` promete NOVE verticais desde a 0002, mas só SEIS
-- foram semeadas (`barber`, `nails`, `lashes`, `brows`, `waxing`,
-- `aesthetics`). `hair`, `tattoo` e `general` existiam como valor válido e
-- não tinham catálogo nenhum.
--
-- O sintoma não era erro: a 0008 ensinou o onboarding a TOLERAR pack
-- ausente (antes disso derrubava com 500), então quem escolhia "cabelo"
-- criava a conta com sucesso e caía num app com ZERO serviço — sem nada
-- para agendar, sem preço, sem página pública que mostrasse algo. Medido
-- em 02/09 ao semear um salão de cabelo: `apply_vertical_pack` retornou
-- sem criar linha nenhuma.
--
-- `general` é o caso que a landing promete em letra: "e qualquer trabalho
-- que dependa de hora marcada e de cliente que volta". Sem pack, essa
-- promessa terminava numa conta vazia.
--
-- accent_color entra NULL de propósito: a 0033 aposentou a cor por
-- vertical (virou por tenant) e zerou as seis existentes. Repor cor aqui
-- ressuscitaria uma decisão já revertida.
--
-- Preços e durações são de mercado brasileiro de 2026 e servem de ponto
-- de partida — o onboarding diz "você ajusta o que quiser", e é a primeira
-- coisa que a tela de primeiros passos manda conferir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CABELO
--
-- A anamnese aqui não é burocracia: química em cabelo tem incompatibilidade
-- real (progressiva sobre descoloração recente arrebenta o fio) e alergia a
-- PPD/tintura manda gente para o pronto-socorro. Os quatro `alert_if` são
-- exatamente os que mudam a conduta do profissional.
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'hair','Cabelo',null,
'[
 {"name":"Corte feminino","duration_min":60,"price_cents":8000,"cycle_days":60,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Corte masculino","duration_min":30,"price_cents":4500,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Escova","duration_min":45,"price_cents":6000,"cycle_days":15,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Hidratação","duration_min":60,"price_cents":9000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Coloração / retoque de raiz","duration_min":120,"price_cents":18000,"cycle_days":45,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Mechas / luzes","duration_min":240,"price_cents":35000,"cycle_days":90,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Progressiva","duration_min":180,"price_cents":25000,"cycle_days":120,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":15},
 {"name":"Penteado","duration_min":60,"price_cents":12000,"cycle_days":0,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10}
]'::jsonb,
'[{"name":"Tintura (tubo)","unit":"un","avg_cost_cents":2200,"reorder_point":15},
  {"name":"Água oxigenada","unit":"ml","avg_cost_cents":3,"reorder_point":1000},
  {"name":"Pó descolorante","unit":"g","avg_cost_cents":12,"reorder_point":500},
  {"name":"Máscara de tratamento","unit":"ml","avg_cost_cents":8,"reorder_point":500},
  {"name":"Shampoo profissional","unit":"ml","avg_cost_cents":5,"reorder_point":1000},
  {"name":"Papel alumínio","unit":"un","avg_cost_cents":15,"reorder_point":200},
  {"name":"Luva descartável","unit":"un","avg_cost_cents":40,"reorder_point":100}]'::jsonb,
'[{"service":"Coloração / retoque de raiz","product":"Tintura (tubo)","qty":1},
  {"service":"Coloração / retoque de raiz","product":"Água oxigenada","qty":60},
  {"service":"Coloração / retoque de raiz","product":"Luva descartável","qty":2},
  {"service":"Mechas / luzes","product":"Pó descolorante","qty":80},
  {"service":"Mechas / luzes","product":"Água oxigenada","qty":160},
  {"service":"Mechas / luzes","product":"Papel alumínio","qty":30},
  {"service":"Mechas / luzes","product":"Luva descartável","qty":2},
  {"service":"Hidratação","product":"Máscara de tratamento","qty":40},
  {"service":"Escova","product":"Shampoo profissional","qty":20}]'::jsonb,
'{"key":"hair_v1","version":"1.0","questions":[
 {"id":"dye_allergy","label":"Já teve alergia a tintura, henna ou PPD?","type":"bool","alert_if":true},
 {"id":"recent_chemistry","label":"Fez alguma química (progressiva, alisamento, descoloração) nos últimos 15 dias?","type":"bool","alert_if":true},
 {"id":"scalp_lesion","label":"Tem ferida, irritação ou descamação no couro cabeludo?","type":"bool","alert_if":true},
 {"id":"pregnant","label":"Está gestante ou amamentando?","type":"bool","alert_if":true},
 {"id":"breakage","label":"O cabelo já sofreu quebra ou corte químico?","type":"bool"},
 {"id":"last_chemistry","label":"Qual foi a última química feita, e quando?","type":"text"},
 {"id":"meds","label":"Usa medicamento contínuo? Qual?","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações acima para avaliação de compatibilidade química e de contraindicações.",
  "image_use":"Autorizo o uso de fotos do antes e depois em portfólio e redes sociais, sem identificação nominal. Revogável a qualquer momento.",
  "marketing":"Aceito receber lembretes de manutenção e novidades pelo WhatsApp. Posso cancelar respondendo SAIR."}'::jsonb
);

-- ---------------------------------------------------------------------
-- TATUAGEM
--
-- Único pack em que TODO serviço que fura a pele pede anamnese: o
-- procedimento é invasivo e as contraindicações (anticoagulante, queloide,
-- álcool nas últimas 24h) mudam a decisão de fazer ou não fazer no dia.
--
-- Não perguntamos doença por nome (HIV, hepatite). A pergunta que muda a
-- conduta é sobre CICATRIZAÇÃO — e o cuidado universal com material
-- descartável não depende da resposta. Perguntar o diagnóstico coletaria
-- dado de saúde sensível que não muda nada no atendimento, contra a regra
-- de minimização da LGPD que o resto desta base segue.
--
-- Sinal do orçamento antes: `deposit_bps` alto porque no-show em sessão
-- longa custa a tarde inteira do profissional.
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'tattoo','Tatuagem',null,
'[
 {"name":"Orçamento e consulta","duration_min":30,"price_cents":0,"cycle_days":0,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Tatuagem pequena (até 10cm)","duration_min":90,"price_cents":35000,"cycle_days":0,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":20},
 {"name":"Tatuagem média (10 a 20cm)","duration_min":180,"price_cents":80000,"cycle_days":0,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":20},
 {"name":"Sessão longa / fechamento","duration_min":300,"price_cents":150000,"cycle_days":30,"deposit_bps":3000,"requires_anamnesis":true,"buffer_after_min":30},
 {"name":"Retoque","duration_min":60,"price_cents":12000,"cycle_days":0,"deposit_bps":0,"requires_anamnesis":true,"buffer_after_min":20}
]'::jsonb,
'[{"name":"Cartucho de agulha","unit":"un","avg_cost_cents":600,"reorder_point":50},
  {"name":"Tinta preta","unit":"ml","avg_cost_cents":300,"reorder_point":100},
  {"name":"Tinta colorida","unit":"ml","avg_cost_cents":450,"reorder_point":50},
  {"name":"Luva descartável","unit":"un","avg_cost_cents":40,"reorder_point":200},
  {"name":"Filme protetor","unit":"cm","avg_cost_cents":3,"reorder_point":1000},
  {"name":"Sabonete antisséptico","unit":"ml","avg_cost_cents":6,"reorder_point":500},
  {"name":"Pomada cicatrizante","unit":"g","avg_cost_cents":25,"reorder_point":200}]'::jsonb,
'[{"service":"Tatuagem pequena (até 10cm)","product":"Cartucho de agulha","qty":3},
  {"service":"Tatuagem pequena (até 10cm)","product":"Tinta preta","qty":5},
  {"service":"Tatuagem pequena (até 10cm)","product":"Luva descartável","qty":4},
  {"service":"Tatuagem pequena (até 10cm)","product":"Filme protetor","qty":30},
  {"service":"Tatuagem média (10 a 20cm)","product":"Cartucho de agulha","qty":6},
  {"service":"Tatuagem média (10 a 20cm)","product":"Tinta preta","qty":12},
  {"service":"Tatuagem média (10 a 20cm)","product":"Luva descartável","qty":6},
  {"service":"Tatuagem média (10 a 20cm)","product":"Filme protetor","qty":60},
  {"service":"Sessão longa / fechamento","product":"Cartucho de agulha","qty":12},
  {"service":"Sessão longa / fechamento","product":"Tinta preta","qty":25},
  {"service":"Sessão longa / fechamento","product":"Luva descartável","qty":10}]'::jsonb,
'{"key":"tattoo_v1","version":"1.0","questions":[
 {"id":"anticoagulant","label":"Usa anticoagulante (inclusive aspirina de uso contínuo)?","type":"bool","alert_if":true},
 {"id":"keloid","label":"Já teve queloide ou cicatriz que cresceu além do corte?","type":"bool","alert_if":true},
 {"id":"healing","label":"Tem alguma condição que atrapalhe a cicatrização (diabetes, imunidade baixa)?","type":"bool","alert_if":true},
 {"id":"epilepsy","label":"Tem epilepsia ou já desmaiou durante procedimento?","type":"bool","alert_if":true},
 {"id":"alcohol_24h","label":"Consumiu álcool nas últimas 24 horas?","type":"bool","alert_if":true},
 {"id":"pregnant","label":"Está gestante ou amamentando?","type":"bool","alert_if":true},
 {"id":"latex_allergy","label":"Tem alergia a látex, pigmento ou anestésico tópico?","type":"text"},
 {"id":"skin_area","label":"A região a ser tatuada tem pinta, ferida ou tatuagem antiga?","type":"text"},
 {"id":"meds","label":"Usa medicamento contínuo? Qual?","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações de saúde acima para avaliação de contraindicações e segurança do procedimento.",
  "image_use":"Autorizo o uso de fotos da tatuagem em portfólio e redes sociais, sem identificação nominal. Revogável a qualquer momento.",
  "marketing":"Aceito receber lembretes de retoque e novidades pelo WhatsApp. Posso cancelar respondendo SAIR."}'::jsonb
);

-- ---------------------------------------------------------------------
-- GERAL
--
-- O curinga: "qualquer trabalho que dependa de hora marcada e de cliente
-- que volta", como a landing promete. Serviços deliberadamente NEUTROS —
-- quem escolhe "geral" é justamente quem não se viu nas outras oito, e um
-- catálogo específico demais aqui seria pior que catálogo nenhum (a pessoa
-- teria que apagar tudo antes de cadastrar o dela).
--
-- Sem produtos e sem ficha de consumo: estoque de quê, se não sabemos o
-- ofício? A lista vazia é honesta e o módulo continua disponível para quem
-- quiser cadastrar o próprio. `[]` também é o que o `apply_vertical_pack`
-- espera — ele itera sobre o array e simplesmente não entra no laço.
--
-- A anamnese fica no mínimo universal: alergia e medicamento contínuo são
-- as duas que valem para praticamente qualquer atendimento presencial, e
-- nenhum serviço padrão marca `requires_anamnesis`, então ela só aparece
-- se o dono ligar em algum serviço dele.
-- ---------------------------------------------------------------------
insert into vertical_packs values (
'general','Geral',null,
'[
 {"name":"Avaliação inicial","duration_min":45,"price_cents":8000,"cycle_days":0,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Atendimento padrão","duration_min":60,"price_cents":10000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":10},
 {"name":"Atendimento rápido","duration_min":30,"price_cents":6000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5},
 {"name":"Retorno","duration_min":30,"price_cents":5000,"cycle_days":30,"deposit_bps":0,"requires_anamnesis":false,"buffer_after_min":5}
]'::jsonb,
'[]'::jsonb,
'[]'::jsonb,
'{"key":"general_v1","version":"1.0","questions":[
 {"id":"allergy","label":"Tem alguma alergia?","type":"text"},
 {"id":"meds","label":"Usa medicamento contínuo? Qual?","type":"text"},
 {"id":"notes","label":"Algo que eu precise saber antes do atendimento?","type":"text"}
]}'::jsonb,
'{"health_data":"Autorizo o registro das informações acima para avaliação do atendimento.",
  "image_use":"Autorizo o uso de fotos do trabalho em portfólio, sem identificação nominal. Revogável a qualquer momento.",
  "marketing":"Aceito receber lembretes e novidades pelo WhatsApp. Posso cancelar respondendo SAIR."}'::jsonb
);
