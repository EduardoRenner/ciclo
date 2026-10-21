-- CICLO · o pacote Oficina no catálogo (docs/106-automotivo AUT-104; docs/105-ciclo/C-031)
--
-- ADITIVA (catálogo). Mesmo molde da advocacia (0102): a linha existe para o cadastro local e para a
-- demonstração; nenhuma conta usa o pacote em produção enquanto a chave `OFICINA_ABERTA`
-- (`core/pacotes/oficina-aberta.ts`) estiver desligada — entrar no mercado de oficinas é decisão do
-- Eduardo (docs/106 AUT-D1..D4). O onboarding confere a chave no servidor (`pacoteAberto`).
--
-- O pacote reaproveita as abas do base (as telas próprias da oficina são a fase 4 do 106) e muda o
-- vocabulário: o lugar é "oficina" e o atendimento é "serviço"; quem atende segue "profissional" (neutro:
-- há mecânicas, e a guarda copy-nao-supoe-genero recusa o masculino). Os sinônimos de BUSCA trazem as duas formas. Os serviços iniciais têm preço SUGERIDO
-- (estimativa de oficina de bairro, editável no onboarding) e ciclo de referência; o relógio de km por
-- item (core/manutencao) entra quando o check-in existir.

alter table public.professions drop constraint professions_pacote_check;
alter table public.professions add constraint professions_pacote_check
  check (pacote in ('base', 'advocacia', 'oficina'));

insert into public.professions
  (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo,
   vocab, duracao_padrao_min, ciclo_padrao_dias, ativa, posicao, pacote)
values
  ('oficina_mecanica', 'Oficina mecânica', 'outros',
   '{"mecânico","mecânica","oficina","auto center","troca de óleo","funilaria","centro automotivo"}',
   'no_local', 'orcamento', 'direto', 'recorrente',
   '{"cliente":"cliente","atendimento":"serviço","profissional":"profissional","servico":"serviço","local":"oficina","agenda":"agenda"}',
   60, 180, true, 100, 'oficina')
on conflict (slug) do nothing;

insert into public.profession_services (profession_id, nome, duracao_min, preco_sugerido_cents, ciclo_dias, posicao)
select p.id, s.nome, s.duracao_min, s.preco, s.ciclo, s.posicao
from public.professions p
cross join (values
  ('Troca de óleo e filtro', 60, 25000, 180, 1),
  ('Alinhamento e balanceamento', 60, 15000, 180, 2),
  ('Pastilhas de freio dianteiras', 90, 30000, 365, 3),
  ('Revisão completa', 180, 45000, 365, 4)
) as s(nome, duracao_min, preco, ciclo, posicao)
where p.slug = 'oficina_mecanica'
  and not exists (select 1 from public.profession_services ps where ps.profession_id = p.id);
