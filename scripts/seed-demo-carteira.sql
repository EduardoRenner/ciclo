-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Carteira das SEIS contas de demonstração: clientes, histórico, avaliações, fidelidade.
--
--   psql "$SUPABASE_DB_URL" -v salt="$PHONE_HASH_SALT" -f scripts/seed-demo-carteira.sql
--
-- As CONTAS ficam (tenant, dono, equipe, catálogo, horário, plano). Só a carteira é refeita.
-- Re-executável: apaga os clientes de cada conta e recria tudo do zero.
--
-- O salt entra por `-v` e NUNCA fica no repositório (regra 10 do CLAUDE.md). Sem `psql`, o
-- caminho é `scripts/seed-demo-hashes.mjs`, que calcula os hashes na máquina e devolve só eles.
--
-- ── Por que este arquivo existe ─────────────────────────────────────────────────────────────
--
-- O seed anterior gravou 132 clientes com `phone_e164` preenchido e `phone_hash` NULO. Nada
-- quebrava na tela: o painel listava, a ficha abria, o gráfico somava. Mas toda busca por
-- telefone no produto passa pelo hash — `agendamentos.ts` (marcar para quem já é cliente),
-- `reconhecimento.ts` ("oi Ana, faz 32 dias"), `clientes.ts` (busca no admin) e
-- `importacao-clientes.ts` (duplicata). Com o hash nulo:
--
--   · o reconhecimento no site nunca reconhecia ninguém — a funcionalidade parecia não existir;
--   · marcar para quem já é cliente procurava pelo hash, não achava, tentava INSERT e batia na
--     `clients_unique_phone` pelo `phone_e164` → 500 na cara de quem estava agendando.
--
-- A demonstração quebrava exatamente na hora de demonstrar. É a categoria de falha de
-- `docs/DECISOES.md` "verde não é prova": nenhum teste reprovava, nenhuma tela reclamava.
--
-- ── O que a carteira precisa provar ─────────────────────────────────────────────────────────
--
-- O produto não é a agenda, é o Motor de Ciclo: prever quando cada cliente volta e trazer de
-- volta quem atrasou. Carteira com todo mundo em dia não demonstra nada — "Recuperar receita"
-- nasce vazia e o diferencial fica invisível. Daí a distribuição por arquétipo, deliberada.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

begin;

create schema if not exists seed;
-- Fora de `public` de propósito: o PostgREST expõe toda função de `public` em /rest/v1/rpc/.
revoke all on schema seed from anon, authenticated;

-- Aleatório DETERMINÍSTICO: mesma semente, mesma carteira. Sem isto, cada regeração inventa 300
-- pessoas diferentes e ninguém distingue "o seed mudou de comportamento" de "sorteou outro
-- número".
create or replace function seed.rnd(sem bigint, chave text)
returns double precision language sql immutable as $$
  select (abs(hashtext(sem::text || '|' || chave)) % 100000)::double precision / 100000.0
$$;

create or replace function seed.pick(sem bigint, chave text, itens text[])
returns text language sql immutable as $$
  select itens[1 + floor(seed.rnd(sem, chave) * array_length(itens, 1))::int]
$$;

create or replace function seed.pick_uuid(sem bigint, chave text, itens uuid[])
returns uuid language sql immutable as $$
  select itens[1 + floor(seed.rnd(sem, chave) * array_length(itens, 1))::int]
$$;

-- Domingo e segunda viram terça: o expediente das seis contas é terça a sábado.
--
-- Opera em DATA LOCAL, nunca em `timestamptz`. A primeira versão recebia um `date_trunc` em UTC
-- — e 00:00 UTC é 21:00 do dia ANTERIOR em São Paulo, então o dia da semana saía deslocado e
-- 12% do histórico caiu em domingo/segunda, com o salão fechado. Medido, não suposto. É a
-- armadilha "somar minutos em horário local para gerar slot" da tabela do CLAUDE.md, ao contrário.
create or replace function seed.dia_util_local(d date)
returns date language sql immutable as $$
  select d + (case extract(dow from d) when 0 then 2 when 1 then 1 else 0 end)::int
$$;

-- Histórico nunca cai no futuro: o que passar de hoje depois do empurrão volta uma semana.
create or replace function seed.dia_passado(d date)
returns date language sql stable as $$
  select case when seed.dia_util_local(d) > (now() at time zone 'America/Sao_Paulo')::date
              then seed.dia_util_local(d - 7)
              else seed.dia_util_local(d) end
$$;

-- `search_path` fixo em todas as funções acima. Sem isso, quem chama pode sombrear o que a
-- função referencia — e o `get_advisors` acusa uma linha por função. Foram SETE avisos novos no
-- banco de produção quando este seed rodou pela primeira vez; o projeto já tinha resolvido a
-- mesma coisa antes (migration 0055).
--
-- `pg_catalog, seed, pg_temp` onde a função chama outra do schema; só `pg_catalog, pg_temp` no
-- resto. Função com search_path errado não falha ao ser criada: falha ao ser CHAMADA.
alter function seed.rnd(bigint, text)               set search_path = pg_catalog, pg_temp;
alter function seed.pick(bigint, text, text[])      set search_path = pg_catalog, seed, pg_temp;
alter function seed.pick_uuid(bigint, text, uuid[]) set search_path = pg_catalog, seed, pg_temp;
alter function seed.dia_util_local(date)            set search_path = pg_catalog, pg_temp;
alter function seed.dia_passado(date)               set search_path = pg_catalog, seed, pg_temp;

-- ── Configuração ───────────────────────────────────────────────────────────────────────────
create table if not exists seed.cfg (slug text primary key, tenant_id uuid, qtd int, publico text, ordem int);
create table if not exists seed.arq (nome text primary key, ini int, fim int, vmin int, vmax int,
  atr_min numeric, atr_max numeric, ns_min int, ns_max int, p_review numeric, p_futuro numeric);
create table if not exists seed.voc (chave text primary key, itens text[]);

insert into seed.cfg (slug, qtd, publico, ordem) values
  ('demo-navalha-de-ouro', 44, 'm', 1),  -- grátis: teto DURO de 50 clientes em planos.ts. 44
  ('demo-corte-fino',      47, 'm', 2),  -- deixa a conta perto do limite de propósito, para a
  ('demo-dom-estilo',      52, 'm', 3),  -- demonstração mostrar o aviso de upgrade chegando.
  ('demo-studio-bella',    55, 'f', 4),
  ('demo-salao-encanto',   58, 'f', 5),
  ('demo-espaco-vitoria',  54, 'f', 6)
on conflict (slug) do update set qtd = excluded.qtd, publico = excluded.publico, ordem = excluded.ordem;

update seed.cfg c set tenant_id = t.id from tenants t where t.slug = c.slug;

do $$
declare faltando text;
begin
  select string_agg(slug, ', ') into faltando from seed.cfg where tenant_id is null;
  if faltando is not null then raise exception 'conta de demonstração não encontrada: %', faltando; end if;
end $$;

-- `atr_*` é medido a partir do VENCIMENTO, não da última visita: 0 = vence hoje, negativo =
-- ainda dentro do ciclo. Sem os negativos a carteira inteira vence no mesmo dia, e "Recuperar
-- receita" listaria o salão todo — tão inútil quanto listar ninguém.
insert into seed.arq values
  ('fiel',     0, 17,  9, 16, -0.85, 0.15, 0, 0, 0.70, 0.85),
  ('regular', 18, 47,  4,  8, -0.80, 0.30, 0, 1, 0.35, 0.55),
  ('novo',    48, 63,  1,  2, -0.90, 0.20, 0, 0, 0.30, 0.40),
  ('atrasado',64, 85,  3,  9,  0.60, 2.40, 0, 1, 0.20, 0.00),
  ('faltante',86, 94,  2,  6, -0.20, 1.20, 2, 4, 0.05, 0.20),
  ('sumido',  95, 99,  1,  3,  3.00, 8.00, 0, 2, 0.00, 0.00)
on conflict (nome) do update set ini=excluded.ini, fim=excluded.fim, vmin=excluded.vmin,
  vmax=excluded.vmax, atr_min=excluded.atr_min, atr_max=excluded.atr_max, ns_min=excluded.ns_min,
  ns_max=excluded.ns_max, p_review=excluded.p_review, p_futuro=excluded.p_futuro;

insert into seed.voc values
 ('m', array['Lucas','Rafael','Bruno','Thiago','Gabriel','Matheus','Felipe','Diego','André','Rodrigo','Vinícius','Eduardo','Guilherme','Leandro','Marcelo','Fernando','Ricardo','Paulo','Caio','Danilo','Otávio','Henrique','Murilo','Fábio','Alexandre','Renato','Wesley','Gustavo','Igor','Júlio','Sérgio','Tiago','Alan','Everton','Marcos','Douglas','Emerson','Fabrício','Jonatas','Cleber','Anderson','Robson','Elias','Vitor','Samuel']),
 ('f', array['Ana','Juliana','Camila','Beatriz','Larissa','Mariana','Fernanda','Patrícia','Letícia','Amanda','Carolina','Bruna','Gabriela','Vanessa','Priscila','Renata','Aline','Débora','Tatiane','Sabrina','Jéssica','Natália','Isabela','Michele','Simone','Cristiane','Elaine','Luciana','Rafaela','Adriana','Bianca','Daniela','Eliane','Flávia','Helena','Ingrid','Karina','Lívia','Marcela','Nayara','Olívia','Paula','Raquel','Silvia','Talita','Verônica','Yasmin','Andressa','Carla','Denise']),
 ('sobre', array['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Gomes','Costa','Ribeiro','Martins','Carvalho','Almeida','Lopes','Soares','Fernandes','Vieira','Barbosa','Rocha','Dias','Nascimento','Moreira','Nunes','Marques','Machado','Mendes','Freitas','Cardoso','Ramos','Gonçalves','Santana','Teixeira','Araújo','Correia','Pinto','Cavalcanti','Monteiro','Moura','Duarte','Antunes','Bezerra','Peixoto','Siqueira']),
 -- DDD que existe de verdade: `libphonenumber-js` valida formato, não faixa (defeito 7 da especificação).
 ('ddd', array['11','11','11','12','13','14','15','16','17','19','21','21','27','31','41','47','48','51','61','62','71','81','85']),
 ('origem', array['instagram','indicacao','google','presencial','whatsapp','fachada'])
on conflict (chave) do update set itens = excluded.itens;

-- ── Plano por cliente ──────────────────────────────────────────────────────────────────────
create table if not exists seed.plano (
  id uuid primary key, sem bigint unique, tenant_id uuid, slug text, seq int,
  arquetipo text, cadencia int, visitas int, desde_ultima int, no_shows int,
  p_review numeric, p_futuro numeric, prof_id uuid, servs uuid[], e_feminino boolean,
  nome text, e164 text, phone_hash text
);
delete from seed.plano;

insert into seed.plano (id, sem, tenant_id, slug, seq, arquetipo, cadencia, visitas, desde_ultima,
                        no_shows, p_review, p_futuro, prof_id, servs, e_feminino, nome, e164)
with cat as (
  select c.tenant_id, c.slug, c.qtd, c.publico, c.ordem,
    (select array_agg(p.id order by p.created_at) from professionals p where p.tenant_id=c.tenant_id and p.active) as profs,
    (select array_agg(s.id order by s.created_at) from services s where s.tenant_id=c.tenant_id and s.active) as servs
  from seed.cfg c
),
base as (
  select cat.*, i as seq, (cat.ordem::bigint * 100000 + i) as sem
  from cat, generate_series(1, cat.qtd) i
),
comarq as (
  select b.*, a.* from base b
  join seed.arq a on (abs(hashtext(b.sem::text || '|arq')) % 100) between a.ini and a.fim
)
select
  gen_random_uuid(), sem, tenant_id, slug, seq, nome, cad.v,
  vmin + floor(seed.rnd(sem,'vis') * (vmax - vmin + 1))::int,
  greatest(1, round(cad.v * (1 + (atr_min + seed.rnd(sem,'atr') * (atr_max - atr_min))))::int
              + floor(seed.rnd(sem,'jit') * 5)::int - 2),
  ns_min + floor(seed.rnd(sem,'ns') * (ns_max - ns_min + 1))::int,
  p_review, p_futuro,
  seed.pick_uuid(sem,'prof',profs), servs,
  -- 12% do público oposto: nem toda barbearia atende só homem, nem todo salão só mulher.
  case when seed.rnd(sem,'alt') < 0.12 then publico = 'm' else publico <> 'm' end,
  null, null
from comarq,
  -- Cadências FORA da tabuada do 7 de propósito: 21 ou 28 faz toda visita da mesma pessoa cair
  -- sempre no mesmo dia da semana — a agenda vira listra e o salão parece atender só às terças.
  -- Já apagou o histórico de 10 de 45 clientes num seed anterior.
  lateral (select (array[18,20,23,25,26,30,33,38,45,52])[1 + floor(seed.rnd(sem,'cad')*10)::int] as v) cad;

update seed.plano p set
  nome = seed.pick(p.sem,'nome', (select itens from seed.voc where chave = case when p.e_feminino then 'f' else 'm' end))
         || ' ' || seed.pick(p.sem,'sobre', (select itens from seed.voc where chave='sobre')),
  -- `md5` e não `hashtext`: o hash do telefone precisa poder ser calculado FORA do banco (o salt
  -- não circula), e só o md5 é reproduzível byte a byte nos dois lados. `seq` nos 4 últimos
  -- dígitos garante unicidade dentro da conta sem loop de retentativa.
  e164 = '+55'
      || (select itens from seed.voc where chave='ddd')
         [1 + (('x' || substr(md5(p.sem::text || '|ddd'), 1, 8))::bit(32)::bigint & 2147483647) % 23]
      || '9'
      || lpad(((('x' || substr(md5(p.sem::text || '|tel'), 1, 8))::bit(32)::bigint & 2147483647) % 9000 + 1000)::text, 4, '0')
      || lpad(p.seq::text, 4, '0');

-- O hash é a razão de este arquivo pedir `-v salt`. Sem `psql`, rode `seed-demo-hashes.mjs`.
update seed.plano p set phone_hash = encode(extensions.digest(p.e164 || :'salt', 'sha256'), 'hex');

-- ── Clientes ───────────────────────────────────────────────────────────────────────────────
delete from clients where tenant_id in (select tenant_id from seed.cfg);

insert into clients (
  id, tenant_id, name, phone_e164, phone_hash, email, birth_date, tags, source, gender,
  marketing_opt_in, preferred_professional_id, notes, created_at
)
select
  p.id, p.tenant_id, p.nome, p.e164, p.phone_hash,
  case when seed.rnd(p.sem,'mail') < 0.62 then
    (lower(unaccent(split_part(p.nome,' ',1))) || '.' || lower(unaccent(split_part(p.nome,' ',2)))
     || (10 + floor(seed.rnd(p.sem,'n') * 89)::int) || '@exemplo.com.br')::citext end,
  -- Aniversário espalhado pelo ano, com ~1 em 7 no mês corrente: a tela de aniversariantes do
  -- mês precisa de gente dentro para provar que funciona.
  make_date(1958 + floor(seed.rnd(p.sem,'ano') * 48)::int,
    case when seed.rnd(p.sem,'mesq') < 0.14 then extract(month from now())::int
         else 1 + floor(seed.rnd(p.sem,'mes') * 12)::int end,
    1 + floor(seed.rnd(p.sem,'dia') * 28)::int),
  (case when p.arquetipo = 'fiel' then array['vip'] else array[]::text[] end)
    || (case when p.arquetipo = 'novo' then array['novo'] else array[]::text[] end)
    || (case when p.arquetipo = 'faltante' then array['atenção'] else array[]::text[] end)
    || (case when p.arquetipo = 'sumido' then array['sumiu'] else array[]::text[] end),
  seed.pick(p.sem,'org',(select itens from seed.voc where chave='origem')),
  case when p.e_feminino then 'feminino' else 'masculino' end,
  seed.rnd(p.sem,'mkt') < 0.72,
  -- Só ~45% declara profissional de preferência; o resto é "qualquer um", como na vida.
  case when seed.rnd(p.sem,'pref') < 0.45 then p.prof_id end,
  case when seed.rnd(p.sem,'obs') < 0.30 then (array[
      'Prefere o fim da tarde, sai direto do trabalho.','Gosta de conversar pouco durante o atendimento.',
      'Pediu para avisar por WhatsApp na véspera, não no dia.','Chega sempre uns 10 minutos adiantado.',
      'Prefere pagar no Pix, sempre pergunta a chave.','Sensível a produto com cheiro forte.',
      'Costuma remarcar quando cai em semana de plantão.'])[1 + floor(seed.rnd(p.sem,'obsq') * 7)::int] end,
  -- Cadastro SEMPRE antes da primeira visita, senão o painel anuncia "N clientes novos este mês"
  -- e denuncia o dado falso na hora.
  now() - ((p.desde_ultima + p.visitas * p.cadencia + 3 + floor(seed.rnd(p.sem,'cad0') * 40)::int) || ' days')::interval
from seed.plano p;

-- ── Histórico concluído ────────────────────────────────────────────────────────────────────
delete from appointments where tenant_id in (select tenant_id from seed.cfg);

insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
  status, origin, price_cents, completed_at, confirmed_at, created_at)
select p.tenant_id, p.id, p.prof_id, s.id, q.inicio, q.inicio + (s.duration_min || ' min')::interval,
  'done'::appointment_status,
  (case when seed.rnd(p.sem,'org'||v) < 0.45 then 'public_page' else 'app' end)::appointment_origin,
  s.price_cents, q.inicio + (s.duration_min || ' min')::interval, q.inicio - interval '1 day',
  q.inicio - ((2 + floor(seed.rnd(p.sem,'cri'||v) * 13)::int) || ' days')::interval
from seed.plano p
cross join lateral generate_series(0, p.visitas - 1) v
cross join lateral (
  select (seed.dia_passado((now() at time zone 'America/Sao_Paulo')::date
            - (p.desde_ultima + v * (p.cadencia - 4 + floor(seed.rnd(p.sem,'gap'||v) * 10)::int)))
    -- 09h–17h no relógio do salão, em passos de 15min como a agenda real.
    -- O último início possível depende da DURAÇÃO: sortear entre 9h e 17h sem olhar isso fazia
    -- progressiva de 3h começar 16h45 e terminar 19h45, com o salão fechado.
    + make_time(9 + floor(seed.rnd(p.sem,'h'||v) * greatest(1, 10 - ceil(s.duration_min / 60.0)))::int,
                floor(seed.rnd(p.sem,'m'||v) * 4)::int * 15, 0)
  ) at time zone 'America/Sao_Paulo' as inicio) q
cross join lateral (
  -- Enviesado para o começo do catálogo: os primeiros serviços são os populares. Uniforme faria
  -- "Platinado" (R$ 180, 2h30) vender tanto quanto "Corte".
  select * from services where id = p.servs[1 + floor(power(seed.rnd(p.sem,'srv'||v), 1.8) * array_length(p.servs,1))::int]) s;

-- ── Faltas e cancelamentos (isentos da `appointments_no_overlap`, que só vale para
--    pending/confirmed/arrived) ───────────────────────────────────────────────────────────────
insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
  status, origin, price_cents, canceled_at, canceled_by, cancel_reason, created_at)
select p.tenant_id, p.id, p.prof_id, s.id, q.inicio, q.inicio + (s.duration_min || ' min')::interval,
  (case when seed.rnd(p.sem,'ns'||n) < 0.6 then 'no_show' else 'canceled' end)::appointment_status,
  (case when seed.rnd(p.sem,'nso'||n) < 0.5 then 'public_page' else 'app' end)::appointment_origin,
  s.price_cents, q.inicio - interval '2 hours',
  case when seed.rnd(p.sem,'ns'||n) >= 0.6 then 'client' end,
  case when seed.rnd(p.sem,'ns'||n) >= 0.6 then (array['Imprevisto no trabalho',
    'Remarcou para a semana seguinte','Problema de saúde na família','Não conseguiu chegar a tempo'])
    [1 + floor(seed.rnd(p.sem,'mot'||n) * 4)::int] end,
  q.inicio - interval '6 days'
from seed.plano p
cross join lateral generate_series(1, p.no_shows) n
cross join lateral (
  select (seed.dia_passado((now() at time zone 'America/Sao_Paulo')::date
            - (p.desde_ultima + n * p.cadencia + 3 + floor(seed.rnd(p.sem,'nsd'||n) * 18)::int))
    + make_time(9 + floor(seed.rnd(p.sem,'nsh'||n) * 8)::int, floor(seed.rnd(p.sem,'nsm'||n) * 4)::int * 15, 0)
  ) at time zone 'America/Sao_Paulo' as inicio) q
cross join lateral (
  select * from services where id = p.servs[1 + floor(power(seed.rnd(p.sem,'nssv'||n), 1.8) * array_length(p.servs,1))::int]) s;

-- ── Agenda futura: aqui a trava anti-conflito MORDE ────────────────────────────────────────
with dias_uteis as (
  select d::date as dia, row_number() over (order by d) - 1 as idx
  from generate_series((now() at time zone 'America/Sao_Paulo')::date + 1,
                       (now() at time zone 'America/Sao_Paulo')::date + 21, interval '1 day') d
  where extract(dow from d) not in (0, 1)
),
escolhidos as (
  select p.*, s.id as service_id, s.duration_min, s.price_cents
  from seed.plano p
  cross join lateral (select * from services
    where id = p.servs[1 + floor(power(seed.rnd(p.sem,'fsv'), 1.8) * array_length(p.servs,1))::int]) s
  where seed.rnd(p.sem,'fut') < p.p_futuro
),
distribuido as (
  select e.*, row_number() over (partition by e.prof_id order by seed.rnd(e.sem,'ord')) as rn,
    (select count(*) from dias_uteis) as n_dias
  from escolhidos e
),
com_dia as (
  select d.*, du.dia,
    -- Encadear pelo FIM do anterior, nunca por passo fixo: com passo fixo um serviço longo
    -- invade o horário seguinte e a `appointments_no_overlap` recusa o lote inteiro.
    sum(d.duration_min) over (partition by d.prof_id, du.dia order by d.rn
      rows between unbounded preceding and 1 preceding) as offset_min
  from distribuido d join dias_uteis du on du.idx = (d.rn - 1) % d.n_dias
)
insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
  status, origin, price_cents, confirmed_at, created_at)
select c.tenant_id, c.id, c.prof_id, c.service_id, ini.t, ini.t + (c.duration_min || ' min')::interval,
  (case when seed.rnd(c.sem,'st') < 0.7 then 'confirmed' else 'pending' end)::appointment_status,
  (case when seed.rnd(c.sem,'fo') < 0.5 then 'public_page' else 'app' end)::appointment_origin,
  c.price_cents,
  case when seed.rnd(c.sem,'st') < 0.7 then now() - interval '1 day' end,
  now() - ((1 + floor(seed.rnd(c.sem,'fc') * 9)::int) || ' days')::interval
from com_dia c
cross join lateral (select (c.dia + make_time(9,0,0) + (coalesce(c.offset_min,0) || ' min')::interval)
                           at time zone 'America/Sao_Paulo' as t) ini
-- O que não cabe até as 18h não é agendado: melhor menos agenda futura do que profissional
-- atendendo às 21h numa demonstração.
where coalesce(c.offset_min, 0) + c.duration_min <= 540;

-- ── Números derivados DOS AGENDAMENTOS, nunca somados por fora ─────────────────────────────
-- O que a tela mostra e o que o histórico prova têm que ser o mesmo, senão a demonstração se
-- contradiz sozinha.
update clients c set visits_count = x.visitas, ltv_cents = x.ltv,
                     no_show_count = x.faltas, last_visit_at = x.ultima
from (
  select a.client_id,
    count(*) filter (where a.status = 'done') as visitas,
    coalesce(sum(a.price_cents) filter (where a.status = 'done'), 0) as ltv,
    count(*) filter (where a.status = 'no_show') as faltas,
    max(a.starts_at) filter (where a.status = 'done') as ultima
  from appointments a where a.tenant_id in (select tenant_id from seed.cfg)
  group by a.client_id
) x where c.id = x.client_id;

-- `created_at` do cliente RECUADO para antes da primeira visita real. O valor inicial era uma
-- ESTIMATIVA (`desde_ultima + visitas * cadencia + folga`), e o jitter da cadência às vezes
-- fazia o span real passar do previsto — resultado: ~6% dos clientes com visita ANTES do
-- próprio cadastro, timeline impossível. Derivar de `min(starts_at)` é o mesmo princípio das
-- linhas acima: o número sai da realidade, não de uma conta paralela.
update clients c set created_at = x.primeira - ((3 + floor(seed.rnd_id(c.id,'cad_fix')*7)) || ' days')::interval
from (
  select a.client_id, min(a.starts_at) as primeira
  from appointments a where a.tenant_id in (select tenant_id from seed.cfg)
  group by a.client_id
) x
where c.id = x.client_id and c.created_at > x.primeira;

-- Indicação: ~26% aponta para outro cliente da MESMA carteira. Alimenta o bônus dos dois lados.
update clients c set referred_by = p.padrinho, source = 'indicacao'
from (
  select a.id, b.id as padrinho from seed.plano a
  join lateral (select id from seed.plano z where z.tenant_id = a.tenant_id and z.id <> a.id
                order by seed.rnd(a.sem, 'pad' || z.seq) limit 1) b on true
  where seed.rnd(a.sem, 'ind') < 0.26
) p where c.id = p.id;

-- ── Avaliações ─────────────────────────────────────────────────────────────────────────────
-- Uma por cliente, sempre no atendimento MAIS RECENTE concluído (é quando o convite sai).
--
-- A distribuição de notas é ~4,5, não 3,6: quem está insatisfeito raramente responde ao convite,
-- e a faixa real no Fresha/Booksy é 4,7-4,9. Uma primeira versão com 80/20 entre "bom" e "ruim"
-- deu 3,6 — nenhum salão de verdade com página pública tem isso, e a demonstração precisa
-- parecer um negócio de verdade.
insert into client_reviews (tenant_id, appointment_id, client_id, rating, comment, created_at)
select p.tenant_id, u.id, p.id,
  case when seed.rnd(p.sem,'nt') < 0.70 then 5 when seed.rnd(p.sem,'nt') < 0.90 then 4
       when seed.rnd(p.sem,'nt') < 0.97 then 3 else 2 end,
  -- ~38% sem comentário: nota 5 muda é o caso mais comum na vida real. E o texto acompanha a
  -- nota — "adorei" em 2 estrelas denuncia dado fabricado.
  case when seed.rnd(p.sem,'tc') < 0.62 then
    case when seed.rnd(p.sem,'nt') < 0.90 then (array[
      'Atendimento impecável, saí muito satisfeita.','Sempre pontual e caprichoso. Recomendo demais.',
      'Melhor lugar da região, sem exagero.','Adorei o resultado, ficou exatamente como pedi.',
      'Ambiente agradável e profissional atencioso.','Já é meu lugar fixo, não troco por nada.',
      'Super indico! Cuidado com cada detalhe.','Fui bem atendida do começo ao fim.',
      'Resultado durou muito mais do que eu esperava.','Explica tudo o que vai fazer antes de começar.',
      'Chegou no horário e entregou o que prometeu.','Preço justo pelo que entrega.',
      'Saí de lá me sentindo outra pessoa.','Terceira vez que venho e nunca me decepcionou.'])
      [1 + floor(seed.rnd(p.sem,'cb') * 14)::int]
    else (array['Gostei do resultado, mas esperei além do horário.',
      'Bom atendimento. Só achei o ambiente meio cheio.','Ficou bom, mas queria um tom um pouco diferente.',
      'O serviço é bom, só o estacionamento que complica.'])[1 + floor(seed.rnd(p.sem,'cm') * 4)::int]
    end end,
  u.starts_at + interval '1 day'
from seed.plano p
join lateral (select a.id, a.starts_at from appointments a
              where a.client_id = p.id and a.status = 'done'
              order by a.starts_at desc limit 1) u on true
where seed.rnd(p.sem,'rev') < p.p_review;

-- ── Fidelidade: livro-razão, nunca saldo (resgate é lançamento negativo — regra 11) ────────
insert into loyalty_entries (tenant_id, client_id, appointment_id, points, reason, created_at)
select a.tenant_id, a.client_id, a.id, (a.price_cents / 100)::int, 'atendimento', a.completed_at
from appointments a
where a.tenant_id in (select tenant_id from seed.cfg) and a.status = 'done' and a.client_id is not null;

-- ── Anotação DATADA (nunca sobrescreve, ao contrário de `clients.notes`) ───────────────────
insert into client_notes (tenant_id, client_id, body, created_at)
select p.tenant_id, p.id, (array[
    'Alérgica a produto com amônia — conferir o rótulo antes.',
    'Costuma trazer a filha junto na última quinta do mês.',
    'Trabalha em escala 12x36, só consegue vir em dia par.',
    'Indicou três pessoas no último semestre.',
    'Pele sensível na região do queixo, usar produto mais suave.',
    'Cliente desde o endereço antigo, veio junto na mudança.',
    'Fez uma reclamação em março, resolvida na hora. Tratar com atenção.',
    'Não gosta de música alta, baixar o som quando chegar.',
    'Sempre pede o mesmo tom. Anotado para não errar.'])[1 + floor(seed.rnd(p.sem,'nq'||g) * 9)::int],
  now() - ((10 + floor(seed.rnd(p.sem,'nd'||g) * 190)::int) || ' days')::interval
from seed.plano p
cross join lateral generate_series(1,
  case when seed.rnd(p.sem,'nn') < 0.35 then 1 + floor(seed.rnd(p.sem,'nc') * 2)::int else 0 end) g;

-- ── Personalização da página do cliente ────────────────────────────────────────────────────
-- As seis contas nasceram com `settings = '{}'`: sem frase, sem "sobre", sem cor. A página
-- pública existia e não tinha o que mostrar — o produto sabe personalizar desde o TICKET-115 e a
-- demonstração não provava nada disso.
--
-- Merge por namespace, NUNCA substituição: `settings` também guarda configuração de agenda
-- (`min_lead_time_minutes` etc), e trocar o objeto inteiro apagaria isso sem ninguém ver.
--
-- `logoKey`/`coverKey`, foto de profissional e foto de serviço ficam de fora daqui de propósito:
-- são chave de arquivo no bucket `vitrine`, e só `fazerUploadDaVitrine` escreve lá. Semear a
-- chave sem o arquivo daria imagem quebrada na página pública — pior que ausência.
update tenants t set settings = coalesce(t.settings, '{}'::jsonb) || jsonb_build_object(
  'site', coalesce(t.settings->'site', '{}'::jsonb) || v.site,
  'loyalty', jsonb_build_object('pointsPerReal', 1, 'pointsPerReward', 500)
)
from (values
  ('demo-navalha-de-ouro', jsonb_build_object(
    'tagline', 'Corte clássico, navalha e conversa boa desde 2014.',
    'about', E'A Navalha de Ouro nasceu numa sala de 12 m² no centro e continua com a mesma ideia: cadeira boa, tesoura afiada e ninguém com pressa.\n\nAtendemos com hora marcada para você não esperar em pé. Se precisar remarcar, é só chamar no WhatsApp — a gente resolve.',
    'whatsapp', '+5511987650001', 'instagram', 'navalhadeouro.oficial', 'accent', '#c8a24a')),
  ('demo-corte-fino', jsonb_build_object(
    'tagline', 'Barbearia de bairro, acabamento de estúdio.',
    'about', E'Marcos corta cabelo há 18 anos e atende sozinho — por isso a agenda é curta e o atendimento é inteiro seu.\n\nCafé por conta da casa. Aceitamos Pix, cartão e dinheiro.',
    'whatsapp', '+5511987650002', 'instagram', 'cortefino.barbearia', 'accent', '#3f6f5b')),
  ('demo-dom-estilo', jsonb_build_object(
    'tagline', 'Três cadeiras, zero espera. Agende e chegue na hora.',
    'about', E'Anderson, Diego e Felipe dividem a Dom Estilo há seis anos. Cada um tem o seu jeito — dá para escolher com quem você quer cortar na hora de agendar.\n\nAbrimos de terça a sábado. Última cadeira sai às 18h.',
    'whatsapp', '+5511987650003', 'instagram', 'domestilo.barber', 'accent', '#2f4f78')),
  ('demo-studio-bella', jsonb_build_object(
    'tagline', 'Unhas, cabelo e cílios no mesmo lugar, no mesmo dia.',
    'about', E'O Studio Bella é da Camila, e com ela trabalham a Renata (cabelo) e a Priscila (cílios). A ideia é simples: resolver tudo numa visita só, sem você precisar marcar em três lugares diferentes.\n\nTrabalhamos com hora marcada. Chegue 5 minutinhos antes e aproveite o café.',
    'whatsapp', '+5511987650004', 'instagram', 'studiobella.oficial', 'accent', '#b5657f')),
  ('demo-salao-encanto', jsonb_build_object(
    'tagline', 'Estética, cabelo e cuidado — do jeito que a sua pele pede.',
    'about', E'A Vanessa é esteticista há 12 anos e montou o Encanto para juntar o que ela mais gosta: pele, cabelo e um lugar calmo para passar a tarde.\n\nToda cliente nova faz uma avaliação de pele sem custo antes do primeiro procedimento — é assim que a gente escolhe o protocolo certo em vez de chutar.',
    'whatsapp', '+5511987650005', 'instagram', 'salaoencanto', 'accent', '#7d5aa6')),
  ('demo-espaco-vitoria', jsonb_build_object(
    'tagline', 'Alongamento, progressiva e cílios com hora marcada.',
    'about', E'Espaço Vitória: a Vitória, a Larissa e a Bruna atendendo de terça a sábado, com agenda aberta no site para você marcar a qualquer hora — inclusive de madrugada, quando lembrar.\n\nUsamos produto profissional e mostramos a marca antes de aplicar. Se você tiver alergia a alguma coisa, avise na hora de agendar que a gente adapta.',
    'whatsapp', '+5511987650006', 'instagram', 'espacovitoria.beauty', 'accent', '#a8556b'))
) as v(slug, site)
where t.slug = v.slug;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- "EXPERIMENTOU E NÃO VOLTOU" — o arquétipo que faltava
--
-- Sem ele a carteira mostrava 91% a 96% de retorno, com 2 a 5 pessoas em toda a base que vieram
-- uma vez e sumiram. Salão nenhum tem isso: metade dos estreantes não volta, e um livro onde
-- quase todo mundo voltou denuncia dado fabricado para qualquer pessoa do ramo — o mesmo erro de
-- agregado da campanha que convertia 100%.
--
-- E o filtro "Primeira visita sem volta" da lista de clientes, que é um recurso REAL do produto,
-- nascia praticamente vazio.
--
-- A quantidade é calculada para a taxa de retorno cair para ~72%, respeitando o teto DURO de 50
-- clientes do plano grátis (`src/core/billing/planos.ts`). A conta grátis fica EXATAMENTE no
-- teto de propósito: é o que faz a demonstração mostrar o aviso de limite, que é o gatilho de
-- upgrade do produto.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

create temp table seed_exp on commit drop as
with hoje as (
  select c.tenant_id, cfg.slug, cfg.ordem, cfg.publico,
    count(*) as clientes, count(*) filter (where c.visits_count >= 2) as voltaram
  from clients c join seed.cfg cfg on cfg.tenant_id = c.tenant_id
  group by c.tenant_id, cfg.slug, cfg.ordem, cfg.publico
)
select h.*, least(
  greatest(0, ceil(h.voltaram / 0.72) - h.clientes)::int,
  case when h.slug = 'demo-navalha-de-ouro' then 50 - h.clientes else 999 end
) as adicionar
from hoje h;

insert into clients (tenant_id, name, phone_e164, phone_hash, birth_date, tags, source, gender,
                     marketing_opt_in, created_at)
select e.tenant_id,
  seed.pick(sem.v,'nome',(select itens from seed.voc where chave = e.publico)) || ' ' ||
  seed.pick(sem.v,'sobre',(select itens from seed.voc where chave='sobre')),
  tel.v,
  encode(extensions.digest(tel.v || :'salt', 'sha256'), 'hex'),
  make_date(1962 + floor(seed.rnd(sem.v,'ano')*44)::int, 1 + floor(seed.rnd(sem.v,'mes')*12)::int,
            1 + floor(seed.rnd(sem.v,'dia')*28)::int),
  array['veio uma vez']::text[],
  seed.pick(sem.v,'org',(select itens from seed.voc where chave='origem')),
  case when e.publico = 'f' then 'feminino' else 'masculino' end,
  false,
  now() - ((70 + floor(seed.rnd(sem.v,'cad')*260)) || ' days')::interval
from seed_exp e
cross join lateral generate_series(1, e.adicionar) i
cross join lateral (select (e.ordem::bigint * 100000 + 900 + i) as v) sem
cross join lateral (
  select '+55' || (select itens from seed.voc where chave='ddd')
       [1 + (('x'||substr(md5(sem.v::text||'|ddd'),1,8))::bit(32)::bigint & 2147483647) % 23]
     || '9'
     || lpad(((('x'||substr(md5(sem.v::text||'|tel'),1,8))::bit(32)::bigint & 2147483647) % 9000 + 1000)::text,4,'0')
     || lpad((900 + i)::text,4,'0') as v
) tel;

-- A visita única: poucos dias depois do cadastro, e nunca mais. Serviço de entrada — sorteado
-- entre os três mais baratos, que é o que alguém testa numa primeira vez.
insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
                          status, origin, price_cents, completed_at, confirmed_at, created_at)
select c.tenant_id, c.id, p.id, s.id, q.inicio, q.inicio + (s.duration_min || ' min')::interval,
  'done'::appointment_status,
  -- Quem experimenta e some quase sempre chegou pelo site, não indicado por alguém.
  (case when seed.rnd_id(c.id,'org') < 0.7 then 'public_page' else 'app' end)::appointment_origin,
  s.price_cents, q.inicio + (s.duration_min || ' min')::interval, q.inicio - interval '1 day', c.created_at
from clients c
join lateral (
  select pr.id from professionals pr where pr.tenant_id = c.tenant_id and pr.active
  order by seed.rnd_id(c.id,'prof'||pr.id::text) limit 1
) p on true
join lateral (
  select sv.* from (select * from services where tenant_id = c.tenant_id and active order by price_cents limit 3) sv
  order by seed.rnd_id(c.id,'sv'||sv.id::text) limit 1
) s on true
cross join lateral (
  select (seed.dia_passado((c.created_at at time zone 'America/Sao_Paulo')::date
            + (1 + floor(seed.rnd_id(c.id,'dia')*9))::int)
          + make_time(9 + floor(seed.rnd_id(c.id,'h') * greatest(1, 10 - ceil(s.duration_min/60.0)))::int,
                      floor(seed.rnd_id(c.id,'m')*4)::int * 15, 0)
         ) at time zone 'America/Sao_Paulo' as inicio
) q
where 'veio uma vez' = any(c.tags)
  and not exists (select 1 from appointments a where a.client_id = c.id);
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- CLIENTES NOVOS — para a manchete "N novos este mês" não ser um 0 plano
--
-- `v_carteira_resumo.novos_mes` conta quem cadastrou desde o dia 1º no fuso do salão. Toda a
-- carteira nasce com `created_at` de meses atrás, então em qualquer dia do mês esse número era
-- ZERO nas seis contas — manchete parecendo tela quebrada, não negócio parado.
--
-- Foi o mesmo erro de calendário da campanha "este mês": olhar o número sem pensar na data.
--
-- A quantidade: 3 a 6 por conta, com MAIS DA METADE cadastrada nos ÚLTIMOS 2 DIAS — isso garante
-- que `novos_mes` seja > 0 em qualquer dia em que o seed rode, sem inventar um pico irreal de
-- cadastros no começo do mês. O resto se espalha pelas últimas 3 semanas (recente, mas mês
-- passado se o seed rodar cedo).
--
-- Metade tem UMA visita já concluída; a outra "cadastrou e ainda não veio" — estado realista de
-- quem assinou ontem. `demo-navalha-de-ouro` fica de fora: está EXATAMENTE no teto de 50 do
-- plano grátis, e conta no limite não cresce (é o gatilho de upgrade).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

create temp table seed_novos on commit drop as
select cfg.tenant_id, cfg.slug, cfg.ordem, cfg.publico,
  case when cfg.slug = 'demo-navalha-de-ouro' then 0 else 3 + (cfg.ordem % 4) end as quantos
from seed.cfg cfg;

insert into clients (tenant_id, name, phone_e164, phone_hash, birth_date, tags, source, gender,
                     marketing_opt_in, created_at)
select n.tenant_id,
  seed.pick(sem.v,'nome',(select itens from seed.voc where chave=n.publico)) || ' ' ||
  seed.pick(sem.v,'sobre',(select itens from seed.voc where chave='sobre')),
  tel.v,
  encode(extensions.digest(tel.v || :'salt', 'sha256'), 'hex'),
  make_date(1970 + floor(seed.rnd(sem.v,'ano')*36)::int, 1 + floor(seed.rnd(sem.v,'mes')*12)::int,
            1 + floor(seed.rnd(sem.v,'dia')*28)::int),
  array['novo']::text[],
  -- Cliente novo quase sempre chega pelo Instagram ou pela busca.
  (array['instagram','google','instagram','indicacao'])[1 + floor(seed.rnd(sem.v,'org')*4)::int],
  case when n.publico = 'f' then 'feminino' else 'masculino' end,
  seed.rnd(sem.v,'mkt') < 0.8,
  -- >55%: últimos 2 dias (conta como deste mês). resto: últimas 3 semanas.
  case when seed.rnd(sem.v,'quando') < 0.55
       then now() - (floor(seed.rnd(sem.v,'r')*2) || ' days')::interval - (floor(seed.rnd(sem.v,'h')*18) || ' hours')::interval
       else now() - ((3 + floor(seed.rnd(sem.v,'r2')*18)) || ' days')::interval end
from seed_novos n
cross join lateral generate_series(1, n.quantos) i
cross join lateral (select (n.ordem::bigint * 100000 + 850 + i) as v) sem
cross join lateral (
  select '+55' || (select itens from seed.voc where chave='ddd')
       [1 + (('x'||substr(md5(sem.v::text||'|ddd'),1,8))::bit(32)::bigint & 2147483647) % 23]
     || '9' || lpad(((('x'||substr(md5(sem.v::text||'|tel'),1,8))::bit(32)::bigint & 2147483647) % 9000 + 1000)::text,4,'0')
     || lpad((850 + i)::text,4,'0') as v
) tel;

-- A primeira visita: só para quem cadastrou há tempo de vir (>2 dias), encadeada na primeira
-- folga do profissional no dia, para não colidir com a agenda que já existe.
with pend as (
  select c.id as client_id, c.tenant_id, c.created_at, p.id as prof_id, s.id as service_id,
         s.duration_min, s.price_cents,
         seed.dia_passado((c.created_at at time zone 'America/Sao_Paulo')::date + 1) as dia
  from clients c
  join lateral (select pr.id from professionals pr where pr.tenant_id=c.tenant_id and pr.active
                order by seed.rnd_id(c.id,'p'||pr.id::text) limit 1) p on true
  join lateral (select sv.* from (select * from services where tenant_id=c.tenant_id and active order by price_cents limit 3) sv
                order by seed.rnd_id(c.id,'s'||sv.id::text) limit 1) s on true
  where 'novo' = any(c.tags)
    and c.created_at < now() - interval '2 days'
    and not exists (select 1 from appointments a where a.client_id = c.id)
),
livre as (
  select p.*,
    (select coalesce(max(a.ends_at), (p.dia + time '09:00') at time zone 'America/Sao_Paulo')
     from appointments a
     where a.professional_id = p.prof_id and (a.starts_at at time zone 'America/Sao_Paulo')::date = p.dia) as inicio
  from pend p
)
insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
                          status, origin, price_cents, completed_at, confirmed_at, created_at)
select l.tenant_id, l.client_id, l.prof_id, l.service_id, l.inicio, l.inicio + (l.duration_min||' min')::interval,
  'done'::appointment_status, 'public_page'::appointment_origin, l.price_cents,
  l.inicio + (l.duration_min||' min')::interval, l.inicio - interval '1 day', l.created_at
from livre l
where (l.inicio at time zone 'America/Sao_Paulo')::time < time '18:30' and l.inicio < now();

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- CAMADA DE DINHEIRO: comanda, item, pagamento, comissão e estoque.
--
-- Medido em 02/09 antes de escrever isto: das 17 tabelas que as telas do admin leem, **15
-- estavam vazias** nas seis contas. Caixa, comanda, comissão, estoque, campanha, orçamento,
-- recorrência, fila de espera, pacote e assinatura — nada aparecia. A demonstração mostrava
-- cliente e agenda, e o resto do produto era invisível.
--
-- Tudo aqui deriva do que já existe (atendimento concluído → comanda → item → pagamento), nunca
-- de número digitado: é o que impede a tela e o histórico que a explica de discordarem.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

create or replace function seed.rnd_id(id uuid, chave text)
returns double precision language sql immutable as $$
  select ((('x' || substr(md5(id::text || '|' || chave), 1, 8))::bit(32)::bigint & 2147483647) % 100000)::double precision / 100000.0
$$;

-- O dono que atende é o primeiro profissional da conta. Ele NÃO recebe comissão — fica com o
-- resultado do salão. Comissão é para quem trabalha para o salão.
alter function seed.rnd_id(uuid, text) set search_path = pg_catalog, pg_temp;

create or replace view seed.dono_que_atende as
  select distinct on (tenant_id) tenant_id, id as professional_id
  from professionals where active order by tenant_id, created_at;

-- ── Produto de REVENDA ─────────────────────────────────────────────────────────────────────
-- `apply_vertical_pack` semeia só INSUMO (ficha de consumo): sem `price_cents` e com
-- `is_retail = false`. A camada de revenda nasce invisível em TODA conta nova, não só na
-- demonstração — a tela de estoque abre sem nada para vender e o caixa nunca mostra balcão.
delete from products where tenant_id in (select tenant_id from seed.cfg) and is_retail;

insert into products (tenant_id, name, unit, avg_cost_cents, price_cents, stock_qty, reorder_point, is_retail)
select c.tenant_id, v.nome, 'un', v.custo, v.preco, 0, v.minimo, true
from seed.cfg c
cross join lateral (
  select * from (values
    ('m', 'Pomada modeladora 50g', 2200::bigint, 4500::bigint, 5::numeric),
    ('m', 'Óleo para barba 30ml',  2700::bigint, 5500::bigint, 4::numeric),
    ('m', 'Shampoo anticaspa',     1900::bigint, 3800::bigint, 4::numeric),
    ('m', 'Balm pós-barba',        2100::bigint, 4200::bigint, 4::numeric),
    ('f', 'Óleo de cutícula',      1300::bigint, 2800::bigint, 6::numeric),
    ('f', 'Creme para mãos 60g',   1700::bigint, 3600::bigint, 5::numeric),
    ('f', 'Esmalte vegano',        1500::bigint, 3200::bigint, 8::numeric),
    ('f', 'Protetor solar FPS 50', 4600::bigint, 8900::bigint, 5::numeric),
    ('f', 'Sérum de vitamina C',   6200::bigint, 12000::bigint, 3::numeric)
  ) as x(publico, nome, custo, preco, minimo)
  where x.publico = c.publico
) v;

-- ── Comanda por atendimento concluído ──────────────────────────────────────────────────────
delete from tickets where tenant_id in (select tenant_id from seed.cfg);

insert into tickets (tenant_id, client_id, appointment_id, professional_id, status,
                     discount_cents, tip_cents, closed_at, created_at)
select a.tenant_id, a.client_id, a.id, a.professional_id, 'paid'::ticket_status,
  -- ~12% ganha 10% de desconto: é o que testa de verdade a coluna "Sobrou" contra o bug de lucro
  -- maior que entrada, que já aconteceu nesta base.
  case when seed.rnd_id(a.id,'desc') < 0.12 then (a.price_cents * 0.1)::bigint else 0 end,
  -- ~18% deixa gorjeta. Entra no total (a cliente paga) e sai do lucro (é 100% do profissional).
  case when seed.rnd_id(a.id,'gor') < 0.18 then (round(a.price_cents * (0.05 + seed.rnd_id(a.id,'gv') * 0.05) / 100) * 100)::bigint else 0 end,
  a.completed_at, a.completed_at
from appointments a
where a.tenant_id in (select tenant_id from seed.cfg) and a.status = 'done' and a.client_id is not null;

-- ── Itens: serviço sempre, produto em ~22% ─────────────────────────────────────────────────
insert into ticket_items (tenant_id, ticket_id, service_id, professional_id, description,
                          qty, unit_price_cents, discount_cents, total_cents,
                          commission_bps, commission_cents, cost_cents)
select t.tenant_id, t.id, a.service_id, t.professional_id, s.name,
  1, a.price_cents, 0, a.price_cents,
  case when t.professional_id = d.professional_id then 0 else 4000 end,
  case when t.professional_id = d.professional_id then 0 else (a.price_cents * 0.4)::bigint end,
  -- Custo de material: 12% a 22% do preço. Sem ele a coluna "Sobrou" nasce igual ao faturamento,
  -- que é o quadro zerado de sempre — coluna de custo que ninguém escreve.
  (a.price_cents * (0.12 + seed.rnd_id(a.id,'mat') * 0.10))::bigint
from tickets t
join appointments a on a.id = t.appointment_id
join services s on s.id = a.service_id
left join seed.dono_que_atende d on d.tenant_id = t.tenant_id
where t.tenant_id in (select tenant_id from seed.cfg);

insert into ticket_items (tenant_id, ticket_id, product_id, professional_id, description,
                          qty, unit_price_cents, discount_cents, total_cents,
                          commission_bps, commission_cents, cost_cents)
select t.tenant_id, t.id, p.id, t.professional_id, p.name,
  1, p.price_cents, 0, p.price_cents, 0, 0, p.avg_cost_cents
from tickets t
join lateral (
  select pr.* from products pr
  where pr.tenant_id = t.tenant_id and pr.active and pr.is_retail and pr.price_cents > 0
  order by seed.rnd_id(t.id, 'prod' || pr.id::text) limit 1
) p on true
where t.tenant_id in (select tenant_id from seed.cfg) and seed.rnd_id(t.id, 'temprod') < 0.22;

-- ── Totais derivados DOS ITENS ─────────────────────────────────────────────────────────────
update tickets t set
  subtotal_cents = x.subtotal,
  material_cost_cents = x.material,
  commission_cents = x.comissao,
  total_cents = greatest(0, x.subtotal - t.discount_cents) + t.tip_cents,
  -- Taxa de maquininha: só cartão paga. O MESMO sorteio define o método do pagamento abaixo —
  -- senão apareceria comanda no débito com taxa de crédito, e o caixa se contradiria sozinho.
  fee_cents = case
    when seed.rnd_id(t.id,'metodo') < 0.45 then 0
    when seed.rnd_id(t.id,'metodo') < 0.70 then ((greatest(0, x.subtotal - t.discount_cents) + t.tip_cents) * 0.0329)::bigint
    when seed.rnd_id(t.id,'metodo') < 0.85 then ((greatest(0, x.subtotal - t.discount_cents) + t.tip_cents) * 0.0189)::bigint
    else 0 end
from (
  select ticket_id, sum(total_cents) as subtotal, sum(cost_cents) as material, sum(commission_cents) as comissao
  from ticket_items where tenant_id in (select tenant_id from seed.cfg) group by ticket_id
) x
where t.id = x.ticket_id;

-- `calcularSobraDaComanda` de `core/comanda/totals.ts`, palavra por palavra. A gorjeta entra no
-- total (a cliente paga) e NÃO entra aqui: é 100% do profissional, senão vira lucro que o salão
-- nunca viu.
update tickets t set profit_cents =
  greatest(0, t.subtotal_cents - t.discount_cents) - t.material_cost_cents - t.fee_cents - t.commission_cents
where t.tenant_id in (select tenant_id from seed.cfg);

-- ── Pagamento e comissão ───────────────────────────────────────────────────────────────────
insert into payments (tenant_id, ticket_id, appointment_id, client_id, kind, method, status,
                      amount_cents, fee_cents, net_cents, installments, paid_at, created_at)
select t.tenant_id, t.id, t.appointment_id, t.client_id, 'service'::payment_kind,
  (case when seed.rnd_id(t.id,'metodo') < 0.45 then 'pix'
        when seed.rnd_id(t.id,'metodo') < 0.70 then 'credit'
        when seed.rnd_id(t.id,'metodo') < 0.85 then 'debit'
        else 'cash' end)::payment_method,
  'paid'::payment_status,
  t.total_cents, t.fee_cents, t.total_cents - t.fee_cents,
  case when seed.rnd_id(t.id,'metodo') between 0.45 and 0.70 and seed.rnd_id(t.id,'parc') < 0.25 then 2 else 1 end,
  t.closed_at, t.closed_at
from tickets t where t.tenant_id in (select tenant_id from seed.cfg);

insert into commissions (tenant_id, professional_id, ticket_item_id, period_start, period_end,
                         base_cents, bps, amount_cents, settled_at, created_at)
select i.tenant_id, i.professional_id, i.id,
  date_trunc('month', t.closed_at at time zone 'America/Sao_Paulo')::date,
  (date_trunc('month', t.closed_at at time zone 'America/Sao_Paulo') + interval '1 month - 1 day')::date,
  i.total_cents, i.commission_bps, i.commission_cents,
  -- Mês fechado está pago; o corrente ainda não. É o que dá as duas situações na mesma tela.
  case when date_trunc('month', t.closed_at at time zone 'America/Sao_Paulo')
          < date_trunc('month', now() at time zone 'America/Sao_Paulo')
       then (date_trunc('month', t.closed_at at time zone 'America/Sao_Paulo') + interval '1 month 5 days') end,
  t.closed_at
from ticket_items i join tickets t on t.id = i.ticket_id
where i.tenant_id in (select tenant_id from seed.cfg) and i.commission_cents > 0;

-- ── Estoque ────────────────────────────────────────────────────────────────────────────────
-- Saída por venda de balcão, apontando para a comanda que originou: sem `source_id` a tela mostra
-- movimento sem dizer de onde veio.
insert into stock_moves (tenant_id, product_id, kind, qty, unit_cost_cents, source, source_id, created_at)
select i.tenant_id, i.product_id, 'out'::stock_move_type, 1, i.cost_cents, 'ticket', i.ticket_id, t.closed_at
from ticket_items i join tickets t on t.id = i.ticket_id
where i.tenant_id in (select tenant_id from seed.cfg) and i.product_id is not null;

-- Uma perda por conta: é o lançamento que explica diferença de inventário sem apagar histórico
-- (regra 11 — nunca deletar movimento de estoque).
insert into stock_moves (tenant_id, product_id, kind, qty, unit_cost_cents, source, note, created_at)
select distinct on (p.tenant_id) p.tenant_id, p.id, 'loss'::stock_move_type, 1, p.avg_cost_cents,
  'adjust', 'Frasco quebrou na prateleira', now() - interval '23 days'
from products p where p.tenant_id in (select tenant_id from seed.cfg) and p.is_retail
order by p.tenant_id, seed.rnd_id(p.id, 'perda');

-- A ENTRADA é dimensionada A PARTIR do que saiu, para o saldo final ser uma decisão e não um
-- resto: alvo = ponto de pedido + (-3 a +12). Assim parte dos produtos fica de fato abaixo do
-- mínimo e a tela tem o que alertar — com alerta que o salão CONSEGUE resolver comprando, ao
-- contrário do alarme permanente dos insumos (que nascem com estoque 0 e ponto de pedido > 0).
with saidas as (
  select p.id, p.tenant_id, p.avg_cost_cents, p.reorder_point,
    coalesce((select sum(m.qty) from stock_moves m where m.product_id = p.id and m.kind in ('out','loss')), 0) as saiu
  from products p where p.tenant_id in (select tenant_id from seed.cfg) and p.is_retail
),
alvo as (
  select s.*, greatest(1, s.saiu + s.reorder_point + (floor(seed.rnd_id(s.id,'alvo') * 16) - 3)::numeric) as entrar
  from saidas s
)
insert into stock_moves (tenant_id, product_id, kind, qty, unit_cost_cents, source, note, created_at)
select a.tenant_id, a.id, 'in'::stock_move_type,
  case when g = 0 then ceil(a.entrar * 0.6) else a.entrar - ceil(a.entrar * 0.6) end,
  a.avg_cost_cents, 'entry', 'Compra do fornecedor',
  now() - ((case when g = 0 then 150 else 62 end + floor(seed.rnd_id(a.id,'d'||g) * 18)) || ' days')::interval
from alvo a, generate_series(0,1) g
where (case when g = 0 then ceil(a.entrar * 0.6) else a.entrar - ceil(a.entrar * 0.6) end) > 0;

-- Saldo derivado do extrato, nunca digitado: o número da tela e o histórico que o explica saem
-- da mesma fonte, senão o estoque "some" sem lançamento que justifique.
update products p set stock_qty = coalesce(x.saldo, 0)
from (select product_id, sum(case kind when 'in' then qty when 'return' then qty else -qty end) as saldo
      from stock_moves where tenant_id in (select tenant_id from seed.cfg) group by product_id) x
where p.id = x.product_id;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- AGENDA DE HOJE E DOS PRÓXIMOS DIAS, ASSINATURA, FILA DE ESPERA E CAMPANHA.
--
-- Duas medições que mudaram esta seção:
--
-- 1. **HOJE nascia vazio nas seis contas.** O histórico era gerado a partir de "1 dia atrás", e a
--    agenda futura a partir de "amanhã" — ninguém era atendido hoje. A tela "Hoje" é a inicial do
--    app e o botão central da barra: abrir com "nada marcado para hoje" é a demonstração começar
--    dizendo o contrário do que ela existe para mostrar. Já tinha acontecido antes (PR #47) e eu
--    reintroduzi.
--
-- 2. **A agenda futura tinha 2,7 atendimentos por dia por conta.** Salão de três cadeiras com três
--    clientes no dia inteiro parece fechado, não movimentado.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ── Hoje: o dia que já passou, mais quem ainda está na cadeira ──────────────────────────────
with prof as (
  select p.id as prof_id, p.tenant_id from professionals p
  where p.tenant_id in (select tenant_id from seed.cfg) and p.active
),
vagas as (select pr.*, g as ordem from prof pr, generate_series(0, 7) g),
comservico as (
  select v.*, s.id as service_id, s.duration_min, s.price_cents,
    -- Intervalo de 0 a 30min entre atendimentos: agenda 100% colada não existe em salão de verdade.
    (floor(seed.rnd_id(v.prof_id, 'gap' || v.ordem) * 3) * 15)::int as folga
  from vagas v
  cross join lateral (
    select sv.* from services sv where sv.tenant_id = v.tenant_id and sv.active
    order by seed.rnd_id(v.prof_id, 'sv' || v.ordem || sv.id::text) limit 1
  ) s
),
encadeado as (
  select c.*, coalesce(sum(c.duration_min + c.folga) over (
    partition by c.prof_id order by c.ordem rows between unbounded preceding and 1 preceding), 0) as offset_min
  from comservico c
),
comcliente as (
  select e.*, cl.id as client_id,
    ((now() at time zone 'America/Sao_Paulo')::date + make_time(9,0,0) + (e.offset_min || ' min')::interval)
      at time zone 'America/Sao_Paulo' as inicio
  from encadeado e
  cross join lateral (
    select c2.id from clients c2 where c2.tenant_id = e.tenant_id
    order by seed.rnd_id(c2.id, 'hoje' || e.prof_id::text || e.ordem) limit 1
  ) cl
)
insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
                          status, origin, price_cents, completed_at, confirmed_at, created_at)
select k.tenant_id, k.client_id, k.prof_id, k.service_id, k.inicio,
  k.inicio + (k.duration_min || ' min')::interval,
  -- Terminou antes de agora: concluído. Começou e ainda não terminou: está na cadeira. O que não
  -- cabe antes das 19h simplesmente não entra — melhor fim de expediente honesto do que horário
  -- impossível.
  (case when k.inicio + (k.duration_min || ' min')::interval <= now() then 'done' else 'confirmed' end)::appointment_status,
  (case when seed.rnd_id(k.client_id,'ho'||k.ordem) < 0.45 then 'public_page' else 'app' end)::appointment_origin,
  k.price_cents,
  case when k.inicio + (k.duration_min || ' min')::interval <= now() then k.inicio + (k.duration_min || ' min')::interval end,
  k.inicio - interval '1 day',
  k.inicio - interval '4 days'
from comcliente k
where (k.inicio + (k.duration_min || ' min')::interval) at time zone 'America/Sao_Paulo'
      <= (now() at time zone 'America/Sao_Paulo')::date + make_time(19,0,0);

-- ── Próximos 21 dias ────────────────────────────────────────────────────────────────────────
delete from appointments
where tenant_id in (select tenant_id from seed.cfg) and status in ('pending','confirmed') and starts_at > now();

with dias as (
  select d::date as dia, row_number() over (order by d) as nd
  from generate_series((now() at time zone 'America/Sao_Paulo')::date + 1,
                       (now() at time zone 'America/Sao_Paulo')::date + 21, interval '1 day') d
  where extract(dow from d) not in (0,1)
),
prof as (
  select p.id as prof_id, p.tenant_id from professionals p
  where p.tenant_id in (select tenant_id from seed.cfg) and p.active
),
vagas as (
  -- Cheia perto de hoje, mais vazia lá na frente — como toda agenda de verdade.
  select pr.*, d.dia, d.nd, g as ordem
  from prof pr cross join dias d cross join lateral generate_series(0, greatest(1, 7 - (d.nd / 3))) g
),
comservico as (
  select v.*, s.id as service_id, s.duration_min, s.price_cents,
    (floor(seed.rnd_id(v.prof_id, 'fg' || v.nd || v.ordem) * 3) * 15)::int as folga
  from vagas v
  cross join lateral (
    select sv.* from services sv where sv.tenant_id = v.tenant_id and sv.active
    order by seed.rnd_id(v.prof_id, 'fs' || v.nd || v.ordem || sv.id::text) limit 1
  ) s
),
encadeado as (
  select c.*, coalesce(sum(c.duration_min + c.folga) over (
    partition by c.prof_id, c.dia order by c.ordem rows between unbounded preceding and 1 preceding), 0) as offset_min
  from comservico c
),
comcliente as (
  select e.*, cl.id as client_id,
    (e.dia + make_time(9,0,0) + (e.offset_min || ' min')::interval) at time zone 'America/Sao_Paulo' as inicio
  from encadeado e
  cross join lateral (
    select c2.id from clients c2 where c2.tenant_id = e.tenant_id
    order by seed.rnd_id(c2.id, 'fut' || e.prof_id::text || e.nd || e.ordem) limit 1
  ) cl
  -- 540min = 9h de expediente. O que não cabe não é agendado.
  where e.offset_min + e.duration_min <= 540
)
insert into appointments (tenant_id, client_id, professional_id, service_id, starts_at, ends_at,
                          status, origin, price_cents, confirmed_at, created_at)
select k.tenant_id, k.client_id, k.prof_id, k.service_id, k.inicio,
  k.inicio + (k.duration_min || ' min')::interval,
  -- Quanto mais longe, mais chance de ainda estar só pendente de confirmação.
  (case when seed.rnd_id(k.client_id, 'st'||k.nd||k.ordem) < 0.75 - (k.nd * 0.015) then 'confirmed' else 'pending' end)::appointment_status,
  (case when seed.rnd_id(k.client_id,'fo'||k.nd||k.ordem) < 0.5 then 'public_page' else 'app' end)::appointment_origin,
  k.price_cents,
  case when seed.rnd_id(k.client_id, 'st'||k.nd||k.ordem) < 0.75 - (k.nd * 0.015) then now() - interval '2 days' end,
  now() - ((1 + floor(seed.rnd_id(k.client_id,'fc'||k.nd) * 9)) || ' days')::interval
from comcliente k;

-- ── Assinatura: a receita recorrente, o argumento mais forte de retenção ────────────────────
insert into subscription_plans (tenant_id, name, price_cents, sessions_per_month, benefits, active)
select c.tenant_id, v.nome, v.preco, v.sessoes, v.beneficio, true
from seed.cfg c
cross join lateral (
  select * from (values
    ('m','Clube do Corte',      12900::bigint, 2, 'Dois cortes por mês + 10% em produtos'),
    ('m','Clube Barba & Corte', 19900::bigint, 3, 'Corte quinzenal + barba semanal'),
    ('f','Clube da Unha',       16900::bigint, 2, 'Duas manutenções por mês + esmaltação'),
    ('f','Clube Completo',      29900::bigint, 4, 'Unha, cabelo e 15% em qualquer serviço extra')
  ) as x(publico, nome, preco, sessoes, beneficio)
  where x.publico = c.publico
) v;

insert into client_subscriptions (tenant_id, client_id, plan_id, billing_day, status, started_on, canceled_on)
select cl.tenant_id, cl.id, p.id, 1 + floor(seed.rnd_id(cl.id,'dia') * 28)::int,
  -- ~12% cancelou: cancelar muda estado e data, nunca apaga (regra 11). Sem cancelada nenhuma, a
  -- tela de retenção não teria churn para mostrar.
  case when seed.rnd_id(cl.id,'canc') < 0.12 then 'canceled' else 'active' end,
  (now() - ((60 + floor(seed.rnd_id(cl.id,'ini') * 300)) || ' days')::interval)::date,
  case when seed.rnd_id(cl.id,'canc') < 0.12 then (now() - ((5 + floor(seed.rnd_id(cl.id,'cd') * 50)) || ' days')::interval)::date end
from clients cl
join lateral (
  select sp.* from subscription_plans sp where sp.tenant_id = cl.tenant_id
  order by seed.rnd_id(cl.id, 'plano' || sp.id::text) limit 1
) p on true
where cl.tenant_id in (select tenant_id from seed.cfg) and seed.rnd_id(cl.id,'assina') < 0.07;

-- ── Fila de espera ─────────────────────────────────────────────────────────────────────────
insert into waitlist (tenant_id, client_id, service_id, professional_id, earliest_at, latest_at, period_of_day, created_at)
select cl.tenant_id, cl.id, s.id,
  case when seed.rnd_id(cl.id,'wprof') < 0.5 then cl.preferred_professional_id end,
  now() + interval '1 day', now() + interval '20 days',
  (array['manha','tarde','noite'])[1 + floor(seed.rnd_id(cl.id,'wper') * 3)::int],
  now() - ((1 + floor(seed.rnd_id(cl.id,'wc') * 9)) || ' days')::interval
from clients cl
join lateral (
  select sv.* from services sv where sv.tenant_id = cl.tenant_id and sv.active
  order by seed.rnd_id(cl.id, 'wsv' || sv.id::text) limit 1
) s on true
where cl.tenant_id in (select tenant_id from seed.cfg) and seed.rnd_id(cl.id,'wait') < 0.035;

-- ── Campanha de reativação ─────────────────────────────────────────────────────────────────
insert into campaigns (id, tenant_id, name, segment, template, status, created_at)
select md5(c.tenant_id::text || 'camp1')::uuid, c.tenant_id, 'Quem sumiu — setembro',
  jsonb_build_object('estado', array['late','at_risk'], 'origem', 'motor-de-ciclo'),
  'Oi {nome}! Faz um tempinho que você não aparece por aqui. Separei um horário pra você esta semana — é só responder que eu confirmo.',
  'sent', now() - interval '26 days'
from seed.cfg c;

/*
 * Duas metades, e a segunda é o que impede o número de mentir.
 *
 * `atribuicao.ts` liga campanha e retorno assim: mensagem com `kind='campaign'` e `status='sent'`,
 * seguida de um atendimento CONCLUÍDO do mesmo cliente dentro de 30 dias.
 *
 * A primeira versão mandava a campanha só para quem já tinha voltado — e produzia **100% de
 * conversão em todas as contas**, número que nenhuma campanha do mundo real tem e que denuncia
 * dado inventado na primeira olhada de quem entende do assunto. Uma campanha de reativação vai
 * para todo mundo que sumiu, e a maioria não responde. Com as duas metades, a conversão fica em
 * 23-33%, que é a faixa de uma campanha boa de verdade.
 *
 * `status` nunca é `queued`: é o único que um disparador pega, e mensagem de demonstração não
 * pode virar mensagem de verdade. (Os tenants de demonstração já são pulados em `lembretes.ts` e
 * no cron de campanha — isto é a segunda trava.)
 */
insert into messages (tenant_id, client_id, campaign_id, channel, kind, template, body, status, sent_at, created_at)
select v.tenant_id, v.client_id, md5(v.tenant_id::text || 'camp1')::uuid,
  'whatsapp'::message_channel, 'campaign'::message_kind, 'campanha.retorno',
  'Oi ' || split_part(v.nome,' ',1) || '! Faz um tempinho que você não aparece por aqui. Separei um horário pra você esta semana — é só responder que eu confirmo.',
  'sent'::message_status,
  v.voltou_em - ((3 + floor(seed.rnd_id(v.client_id,'antes') * 8)) || ' days')::interval,
  v.voltou_em - interval '10 days'
from (
  select c.tenant_id, c.id as client_id, c.name as nome, max(a.starts_at) as voltou_em
  from clients c join appointments a on a.client_id = c.id and a.status = 'done'
  where c.tenant_id in (select tenant_id from seed.cfg)
  group by c.tenant_id, c.id, c.name
  having max(a.starts_at) between now() - interval '25 days' and now()
) v
where seed.rnd_id(v.client_id,'recebeu') < 0.55;

insert into messages (tenant_id, client_id, campaign_id, channel, kind, template, body, status, sent_at, created_at)
select c.tenant_id, c.id, md5(c.tenant_id::text || 'camp1')::uuid,
  'whatsapp'::message_channel, 'campaign'::message_kind, 'campanha.retorno',
  'Oi ' || split_part(c.name,' ',1) || '! Faz um tempinho que você não aparece por aqui. Separei um horário pra você esta semana — é só responder que eu confirmo.',
  -- Entregue e não respondeu é o caso mais comum; leu e não veio também existe, e é o que dá
  -- textura ao funil em vez de duas colunas secas.
  (case when seed.rnd_id(c.id,'entrega') < 0.12 then 'read' else 'delivered' end)::message_status,
  now() - ((20 + floor(seed.rnd_id(c.id,'quando') * 5)) || ' days')::interval,
  now() - interval '26 days'
from clients c
where c.tenant_id in (select tenant_id from seed.cfg)
  and c.last_visit_at < now() - interval '26 days'
  and not exists (select 1 from messages m where m.client_id = c.id and m.kind = 'campaign');

-- Contadores da campanha derivados das mensagens e dos retornos, nunca digitados.
update campaigns k set sent_count = x.total, booked_count = x.voltaram, revenue_cents = x.receita
from (
  select m.campaign_id, count(*) as total,
    count(*) filter (where r.retorno is not null) as voltaram,
    coalesce(sum(r.valor) filter (where r.retorno is not null), 0) as receita
  from messages m
  left join lateral (
    select a.starts_at as retorno, a.price_cents as valor from appointments a
    where a.client_id = m.client_id and a.status = 'done'
      and a.starts_at > m.sent_at and a.starts_at < m.sent_at + interval '30 days'
    order by a.starts_at limit 1
  ) r on true
  where m.kind = 'campaign' group by m.campaign_id
) x
where k.id = x.campaign_id;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- HORÁRIO FIXO E PACOTE PRÉ-PAGO
--
-- Orçamento (`quotes`) fica DE PROPÓSITO vazio: barbearia e salão não mandam orçamento. A tabela
-- existe para as verticais de serviço (eletricista, faxina) do `docs/09-PLATAFORMA.md`. Encher
-- uma tabela só para ela não ficar vazia é fabricar um caso de uso que o nicho não tem — e a
-- demonstração passa a ensinar errado.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- Série de horário fixo: "a mesma quinta, 15h, toda quinzena". O CHECK da tabela exige coerência
-- entre `tipo` e as colunas de regra — `semanal` usa weekday + intervalo_semanas, e as outras
-- duas colunas precisam ser NULAS.
insert into appointment_series (tenant_id, client_id, professional_id, service_id, tipo,
                                weekday, intervalo_semanas, horario, starts_on, max_ocorrencias,
                                ocorrencias_geradas, status, note, created_at)
select cl.tenant_id, cl.id, coalesce(cl.preferred_professional_id, d.professional_id), s.id, 'semanal',
  (2 + floor(seed.rnd_id(cl.id,'sw') * 5))::smallint,
  -- Quinzenal é o padrão real de manutenção; semanal existe mas é minoria.
  (case when seed.rnd_id(cl.id,'sq') < 0.65 then 2 else 1 end)::smallint,
  make_time(9 + floor(seed.rnd_id(cl.id,'sh') * 8)::int, (floor(seed.rnd_id(cl.id,'sm') * 2) * 30)::int, 0),
  (now() - ((30 + floor(seed.rnd_id(cl.id,'ss') * 120)) || ' days')::interval)::date,
  26::smallint, (4 + floor(seed.rnd_id(cl.id,'sg') * 9))::smallint,
  -- ~15% cancelada: cancelar muda estado e data, nunca apaga (regra 11).
  case when seed.rnd_id(cl.id,'sc') < 0.15 then 'canceled' else 'active' end,
  'Horário fixo combinado com a cliente',
  now() - ((30 + floor(seed.rnd_id(cl.id,'ss') * 120)) || ' days')::interval
from clients cl
join seed.dono_que_atende d on d.tenant_id = cl.tenant_id
join lateral (
  select sv.* from services sv where sv.tenant_id = cl.tenant_id and sv.active
  order by seed.rnd_id(cl.id, 'ssv' || sv.id::text) limit 1
) s on true
where cl.tenant_id in (select tenant_id from seed.cfg)
  and cl.visits_count >= 6 and seed.rnd_id(cl.id,'serie') < 0.10;

/*
 * Pacote pré-pago: a cliente compra 5 ou 10 sessões com 15% de desconto. Receita que entra ANTES
 * do atendimento — por isso `paid_cents` fica no pacote e a receita é reconhecida por sessão
 * consumida, nunca na venda (armadilha da tabela do CLAUDE.md).
 *
 * O serviço é o que a cliente MAIS FAZ, não um sorteio. Sortear produziu 9 de 13 pacotes comprados
 * e NUNCA usados — ninguém compra 10 sessões de algo que nunca fez, e o extrato do pacote nascia
 * vazio. A data da compra é logo antes da 3ª visita mais recente daquele serviço, o que garante
 * consumo real para o extrato mostrar.
 */
with por_servico as (
  -- Sem filtro de duração: barbearia vende "5 cortes" tanto quanto estética vende "10 limpezas".
  -- Um filtro de `duration_min >= 45` parecia razoável e deixou UM pacote nas seis contas.
  select a.tenant_id, a.client_id, a.service_id, count(*) as quantas,
         max(s.price_cents) as preco,
         (array_agg(a.completed_at order by a.completed_at desc))[3] as terceira_mais_recente
  from appointments a join services s on s.id = a.service_id
  where a.tenant_id in (select tenant_id from seed.cfg) and a.status = 'done'
  group by a.tenant_id, a.client_id, a.service_id
  having count(*) >= 3
),
favorito as (
  select distinct on (client_id) * from por_servico order by client_id, quantas desc, service_id
)
insert into packages (tenant_id, client_id, service_id, total_sessions, used_sessions, paid_cents, expires_on, created_at)
select f.tenant_id, f.client_id, f.service_id,
  (case when f.quantas >= 8 then 10 else 5 end)::int, 0,
  (f.preco * (case when f.quantas >= 8 then 10 else 5 end) * 0.85)::bigint,
  (now() + ((60 + floor(seed.rnd_id(f.client_id,'pe') * 150)) || ' days')::interval)::date,
  f.terceira_mais_recente - interval '1 day'
from favorito f
where f.terceira_mais_recente is not null and seed.rnd_id(f.client_id,'pacote2') < 0.12;

-- O consumo aponta para atendimentos REAIS. Sem isso a tela diz "3 de 5 usadas" sem conseguir
-- dizer QUANDO, e o contador vira número que ninguém explica.
insert into package_uses (tenant_id, package_id, appointment_id, used_at)
select p.tenant_id, p.id, a.id, a.completed_at
from packages p
join lateral (
  select a2.id, a2.completed_at from appointments a2
  where a2.client_id = p.client_id and a2.service_id = p.service_id and a2.status = 'done'
    and a2.completed_at >= p.created_at
  order by a2.completed_at limit p.total_sessions
) a on true
where p.tenant_id in (select tenant_id from seed.cfg);

update packages p set used_sessions =
  coalesce((select count(*) from package_uses u where u.package_id = p.id), 0)
where p.tenant_id in (select tenant_id from seed.cfg);
commit;

-- ── Conferência (o seed não termina sem provar o que fez) ──────────────────────────────────
select t.slug,
  (select count(*) from clients c where c.tenant_id = t.id) as clientes,
  (select count(*) from clients c where c.tenant_id = t.id and c.phone_e164 is not null and c.phone_hash is null) as telefone_sem_hash,
  (select count(*) from appointments a where a.tenant_id = t.id and a.status = 'done' and a.starts_at > now()) as concluido_no_futuro,
  (select count(*) from appointments a where a.tenant_id = t.id
     and extract(dow from a.starts_at at time zone 'America/Sao_Paulo') in (0,1)) as em_dia_fechado,
  (select round(avg(r.rating),2) from client_reviews r where r.tenant_id = t.id) as nota_media,
  -- "Sobrou" nunca pode ser maior que "Entrou": foi assim que o bug do desconto ignorado apareceu.
  (select count(*) from tickets k where k.tenant_id = t.id and k.profit_cents > k.total_cents) as sobrou_mais_que_entrou,
  (select count(*) from products p where p.tenant_id = t.id and p.stock_qty < 0) as estoque_negativo,
  (select count(*) from appointments a join clients cc on cc.id = a.client_id where a.tenant_id = t.id and a.starts_at < cc.created_at) as visita_antes_do_cadastro,
  -- A tela "Hoje" é a inicial do app: abrir vazia é a demonstração começar dizendo o contrário do
  -- que ela existe para mostrar. Já aconteceu duas vezes.
  (select count(*) from appointments a where a.tenant_id = t.id
     and (a.starts_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) as agenda_de_hoje,
  (select count(*) from appointments a where a.tenant_id = t.id
     and ((a.starts_at at time zone 'America/Sao_Paulo')::time < '09:00'
       or (a.ends_at at time zone 'America/Sao_Paulo')::time > '19:00')) as fora_do_horario,
  -- `queued` é o único status que um disparador pega: mensagem de demonstração não pode sair.
  (select count(*) from messages m where m.tenant_id = t.id and m.status = 'queued') as mensagem_na_fila_de_envio,
  (select count(*) from packages k2 where k2.tenant_id = t.id and k2.used_sessions = 0) as pacote_nunca_usado
from tenants t where t.slug in (select slug from seed.cfg) order by t.slug;
