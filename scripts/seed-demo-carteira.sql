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
    + make_time(9 + floor(seed.rnd(p.sem,'h'||v) * 8)::int, floor(seed.rnd(p.sem,'m'||v) * 4)::int * 15, 0)
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

commit;

-- ── Conferência (o seed não termina sem provar o que fez) ──────────────────────────────────
select t.slug,
  (select count(*) from clients c where c.tenant_id = t.id) as clientes,
  (select count(*) from clients c where c.tenant_id = t.id and c.phone_e164 is not null and c.phone_hash is null) as telefone_sem_hash,
  (select count(*) from appointments a where a.tenant_id = t.id and a.status = 'done' and a.starts_at > now()) as concluido_no_futuro,
  (select count(*) from appointments a where a.tenant_id = t.id
     and extract(dow from a.starts_at at time zone 'America/Sao_Paulo') in (0,1)) as em_dia_fechado,
  (select round(avg(r.rating),2) from client_reviews r where r.tenant_id = t.id) as nota_media
from tenants t where t.slug in (select slug from seed.cfg) order by t.slug;
