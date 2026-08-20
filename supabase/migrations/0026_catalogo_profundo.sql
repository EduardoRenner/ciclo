-- =====================================================================
-- CICLO · TICKET-065 · Catálogo — 3 profissões profundas + 7 rasas (P5)
--
-- docs/09-PLATAFORMA.md §5: "existir no catálogo" e "estar pronta pra
-- vender" são coisas diferentes. As 3 profundas (preço/duração que a área
-- reconhece como certo, não INSERT solto) são as que este comércio testa
-- primeiro: faxina/diarista, eletricista, e barbearia (a de beleza — já era
-- a base, ganha os serviços que faltavam; os preços de barber vêm do
-- catálogo real do tenant dom-rocha, cadastrado à mão nesta mesma família
-- de projetos, não são inventados). As 7 rasas (encanador, personal
-- trainer, psicólogo, professor particular, fotógrafo, banho e tosa,
-- jardineiro) existem pra provar que os 4 eixos generalizam — 1-2 serviços
-- plausíveis cada, sem pesquisa de campo, registrado como tal.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BARBEARIA (profunda) — profissão já existia (P0); só faltava o catálogo
-- de serviços. Preços de dom-rocha (tenant real desta base, TICKET-VÁRIOS).
-- ---------------------------------------------------------------------
insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, s.nome, s.duracao_min, s.preco_cents, s.ciclo_dias, s.posicao
from professions, lateral (values
  ('Corte', 40, 4500, 21, 1),
  ('Corte + barba', 60, 7000, 21, 2),
  ('Barba', 30, 3500, 21, 3),
  ('Corte infantil', 30, 4000, 21, 4),
  ('Platinado', 150, 18000, 45, 5),
  ('Pigmentação', 45, 6000, 21, 6)
) as s(nome, duracao_min, preco_cents, ciclo_dias, posicao)
where professions.slug = 'barber';

-- ---------------------------------------------------------------------
-- FAXINA / DIARISTA (profunda, nova) — vai até o cliente, diária,
-- recorrente semanal (cadência mais comum de diarista fixa no Brasil).
-- ---------------------------------------------------------------------
insert into professions (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo, vocab, duracao_padrao_min, ciclo_padrao_dias, posicao)
values (
  'faxina', 'Faxina e diarista', 'casa', '{"diarista","limpeza","faxineira"}',
  'vai_ate', 'diaria', 'direto', 'recorrente',
  '{"cliente":"cliente","atendimento":"faxina","profissional":"profissional","servico":"serviço","agenda":"agenda"}',
  480, 7, 9
);

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, s.nome, s.duracao_min, s.preco_cents, s.ciclo_dias, s.posicao
from professions, lateral (values
  ('Faxina padrão — meia diária', 240, 13000, 7, 1),
  ('Faxina padrão — diária inteira', 480, 25000, 7, 2),
  ('Faxina pesada (geral, armários, janelas)', 480, 30000, 30, 3),
  ('Passar roupa', 180, 7000, 7, 4)
) as s(nome, duracao_min, preco_cents, ciclo_dias, posicao)
where professions.slug = 'faxina';

-- ---------------------------------------------------------------------
-- ELETRICISTA (profunda, nova) — visita + hora, orçamento antes de
-- executar o serviço (não é a mesma coisa que orçamento fechado de um
-- fotógrafo: aqui a visita costuma já resolver o reparo pequeno).
-- ---------------------------------------------------------------------
insert into professions (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo, vocab, duracao_padrao_min, ciclo_padrao_dias, posicao)
values (
  'eletricista', 'Eletricista', 'casa', '{"eletricidade","instalação elétrica","eletricista predial"}',
  'vai_ate', 'visita_hora', 'orcamento_antes', 'sob_demanda',
  '{"cliente":"cliente","atendimento":"serviço","profissional":"técnico","servico":"serviço","agenda":"agenda"}',
  60, 365, 10
);

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, s.nome, s.duracao_min, s.preco_cents, s.ciclo_dias, s.posicao
from professions, lateral (values
  ('Visita técnica / diagnóstico', 30, 6000, null::int, 1),
  ('Instalação de tomada ou interruptor', 40, 9000, null::int, 2),
  ('Instalação de chuveiro elétrico', 45, 10000, null::int, 3),
  ('Instalação de ventilador de teto', 60, 12000, null::int, 4),
  ('Revisão de quadro elétrico', 90, 18000, 365, 5)
) as s(nome, duracao_min, preco_cents, ciclo_dias, posicao)
where professions.slug = 'eletricista';

-- ---------------------------------------------------------------------
-- AS 7 RASAS — 1-2 serviços plausíveis cada, provando que os 4 eixos
-- generalizam. Preço e duração NÃO vieram de pesquisa de campo — não é
-- o que se leva pra vender ainda (§5 do plano).
-- ---------------------------------------------------------------------
insert into professions (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo, vocab, duracao_padrao_min, ciclo_padrao_dias, posicao)
values
  ('encanador', 'Encanador', 'casa', '{"bombeiro hidráulico","hidráulica","desentupidor"}',
   'vai_ate', 'visita_hora', 'orcamento_antes', 'sob_demanda',
   '{"cliente":"cliente","atendimento":"serviço","profissional":"técnico","servico":"serviço","agenda":"agenda"}',
   60, 365, 11),
  ('personal', 'Personal trainer', 'fitness', '{"educador físico","personal"}',
   'hibrido', 'pacote', 'direto', 'recorrente',
   '{"cliente":"aluno","atendimento":"treino","profissional":"personal","servico":"treino","agenda":"agenda"}',
   60, 2, 12),
  ('psicologo', 'Psicólogo', 'saude', '{"psicoterapia","terapeuta","psicoterapeuta"}',
   'hibrido', 'fixo', 'solicitacao', 'recorrente',
   '{"cliente":"paciente","atendimento":"sessão","profissional":"psicólogo","servico":"sessão","agenda":"agenda"}',
   50, 7, 13),
  ('professor', 'Professor particular', 'educacao', '{"aula particular","reforço escolar","tutor"}',
   'hibrido', 'hora', 'direto', 'recorrente',
   '{"cliente":"aluno","atendimento":"aula","profissional":"professor","servico":"aula","agenda":"agenda"}',
   60, 7, 14),
  ('fotografo', 'Fotógrafo', 'eventos', '{"fotografia","fotógrafa","ensaio fotográfico"}',
   'vai_ate', 'orcamento', 'orcamento_antes', 'sazonal',
   '{"cliente":"cliente","atendimento":"ensaio","profissional":"fotógrafo","servico":"ensaio","agenda":"agenda"}',
   120, 180, 15),
  ('banho_tosa', 'Banho e tosa', 'pet', '{"pet shop","tosa","banho pet","estética animal"}',
   'no_local', 'fixo', 'direto', 'avulso',
   '{"cliente":"tutor","atendimento":"atendimento","profissional":"profissional","servico":"serviço","local":"pet shop","agenda":"agenda"}',
   60, 30, 16),
  ('jardineiro', 'Jardineiro', 'casa', '{"jardinagem","paisagismo"}',
   'vai_ate', 'fixo', 'direto', 'recorrente',
   '{"cliente":"cliente","atendimento":"serviço","profissional":"jardineiro","servico":"serviço","agenda":"agenda"}',
   120, 30, 17);

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, s.nome, s.duracao_min, s.preco_cents, s.ciclo_dias, s.posicao
from professions, lateral (values
  ('Desentupimento de pia ou ralo', 60, 10000, null::int, 1),
  ('Reparo de vazamento', 60, 12000, null::int, 2)
) as s(nome, duracao_min, preco_cents, ciclo_dias, posicao)
where professions.slug = 'encanador';

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, 'Treino personalizado', 60, 8000, 2, 1
from professions where professions.slug = 'personal';

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, 'Sessão de terapia', 50, 15000, 7, 1
from professions where professions.slug = 'psicologo';

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, 'Aula particular', 60, 7000, 7, 1
from professions where professions.slug = 'professor';

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, 'Ensaio fotográfico', 120, 40000, null::int, 1
from professions where professions.slug = 'fotografo';

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, s.nome, s.duracao_min, s.preco_cents, s.ciclo_dias, s.posicao
from professions, lateral (values
  ('Banho', 60, 5000, 30, 1),
  ('Banho e tosa', 90, 9000, 30, 2)
) as s(nome, duracao_min, preco_cents, ciclo_dias, posicao)
where professions.slug = 'banho_tosa';

insert into profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select id, 'Manutenção de jardim', 120, 12000, 30, 1
from professions where professions.slug = 'jardineiro';
