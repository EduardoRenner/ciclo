-- CICLO · lote de importação (docs/103 CNV-019): cada arquivo que entra pela esteira vira um lote.
--
-- ## Para que serve
--
-- 1. Idempotência de verdade. A importação antiga deduplicava pelo telefone: a mesma planilha enviada
--    duas vezes duplicava todo mundo SEM telefone (D5). Aqui cada linha gravada leva o lote e o número
--    da linha; reenviar o mesmo pedaço do mesmo lote bate no índice único e não cria ninguém de novo.
-- 2. O mesmo arquivo duas vezes. `file_sha256` é único por salão enquanto o lote está aberto ou
--    concluído: a segunda tentativa recebe o lote que já existe, não um novo.
-- 3. Desfazer por 7 dias (CNV-022) sabe exatamente o que o lote criou.
-- 4. Estado honesto (D6): "falhou" só quando nada ficou gravado; com linhas gravadas, o lote fica
--    "aberto" com `rows_written` dizendo quantas, e a carga continua de onde parou.
--
-- ## O que NÃO vai para o banco
--
-- O arquivo bruto. Nem o nome do arquivo (pode ter nome de pessoa: "clientes da Maria.xlsx"). Só o
-- hash, o formato, as contagens da esteira e o nível. `import_signatures` (assinatura de sistema, sem
-- dado de pessoa, Onda G) fica para o CNV-040, que é quem a lê.
--
-- ## Sem DELETE
--
-- Lote desfeito é informação (quem desfez, quando): `undone_at` + estado `desfeito`, nunca apagar.
-- O DELETE é revogado de `authenticated` explicitamente: a política ausente nega com RLS forçada, e o
-- privilégio revogado garante que uma política escrita por engano amanhã não abra a porta (0117).
--
-- Migration ADITIVA: vai ANTES do deploy do código que a usa (regra da ordem, DECISOES).

create table import_batches (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  file_sha256         text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  -- O formato que a esteira reconheceu pelos bytes (`core/ingestao/formato.ts`), nunca a extensão.
  formato             text not null check (formato ~ '^[a-z]{2,12}$'),
  origem              text not null check (origem in ('arquivo', 'colado', 'contatos', 'imagem')),
  nivel               text not null check (nivel in ('N0', 'N1', 'N2', 'N3')),
  -- { "lidas": n, "ouro": n, "comAviso": n, "quarentena": n, "ignoradas": n } da esteira, no momento da prévia.
  counts              jsonb not null check (jsonb_typeof(counts) = 'object'),
  rows_expected       integer not null check (rows_expected between 1 and 50000),
  rows_written        integer not null default 0 check (rows_written >= 0),
  -- Versão do texto da declaração ("tenho autorização para guardar estes contatos") que a pessoa aceitou.
  declaration_version text check (declaration_version is null or char_length(declaration_version) <= 40),
  status              text not null default 'aberto' check (status in ('aberto', 'concluido', 'falhou', 'desfeito')),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  undone_at           timestamptz,
  undone_by           uuid references auth.users(id) on delete set null,
  check (rows_written <= rows_expected),
  check ((status = 'desfeito') = (undone_at is not null)),
  check (status <> 'concluido' or completed_at is not null)
);

-- O mesmo arquivo não abre dois lotes vivos no mesmo salão. Depois de desfeito, pode entrar de novo.
create unique index import_batches_mesmo_arquivo on import_batches (tenant_id, file_sha256)
  where status in ('aberto', 'concluido');
create index import_batches_tenant_idx on import_batches (tenant_id, created_at desc);
create index import_batches_created_by_idx on import_batches (created_by);
create index import_batches_undone_by_idx on import_batches (undone_by);

alter table import_batches enable row level security;
alter table import_batches force row level security;

create policy import_batches_select on import_batches for select using (public.has_tenant(tenant_id));
create policy import_batches_insert on import_batches for insert with check (public.has_tenant(tenant_id));
create policy import_batches_update on import_batches for update
  using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

revoke delete on public.import_batches from authenticated, anon;

comment on table import_batches is
  'docs/103 CNV-019: um arquivo importado pela esteira. Só hash, formato, contagens e nível; nunca o arquivo nem o nome dele. Sem DELETE: desfazer é status desfeito + undone_at.';

-- A ficha sabe de que lote e de que linha veio. O par é único: reenviar o mesmo pedaço não duplica,
-- tenha a pessoa telefone ou não.
-- Sem checagem "os dois ou nenhum": o lote só some na exclusão da conta inteira, e o SET NULL deixaria
-- a linha sem o lote, barrando a cascata. A linha órfã não pesa: o índice único só vale com lote.
alter table clients add column import_batch_id uuid references import_batches(id) on delete set null;
alter table clients add column import_row integer check (import_row is null or import_row >= 1);
create unique index clients_uma_ficha_por_linha_do_lote on clients (import_batch_id, import_row)
  where import_batch_id is not null;

comment on column clients.import_batch_id is
  'docs/103 CNV-019: lote de importação que criou a ficha (nulo para quem foi cadastrado à mão). Base do desfazer (CNV-022).';
